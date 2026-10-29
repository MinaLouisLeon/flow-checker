// Runs the warm scan session for `flow-checker dev` (docs/PLAN.md 6.7). From the published
// build it lives in a worker thread, so the dashboard and the capture endpoint keep answering
// while a large repo re-scans. Run from source (tests), it stays in this thread.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import {
  createScanSession,
  type FileChanges,
  ScanError,
  type ScanOptions as ScannerOptions,
  type ScanSession,
} from '@flow-checker/scanner'
import type { AppModel } from '@flow-checker/shared'
import { writeModel } from './scan'

export type ScanOptions = Pick<
  ScannerOptions,
  'root' | 'appDir' | 'types' | 'include' | 'exclude' | 'apiClients'
>

export interface ScanResult {
  model: AppModel
  durationMs: number
}

export interface ScanRunner {
  /** Whether scans run in a worker thread. */
  readonly inWorker: boolean
  /** Scans from scratch and writes model.json. */
  scan(): Promise<ScanResult>
  /** Re-scans after file changes (a full scan when the last one failed) and writes model.json. */
  update(changes: FileChanges): Promise<ScanResult>
  /** Prepares the first re-scan while nothing waits for it. */
  warm(): Promise<void>
  close(): Promise<void>
}

type WorkerTask = { type: 'scan' } | { type: 'update'; changes: FileChanges } | { type: 'warm' }

export type WorkerRequest = WorkerTask & { id: number }

export type WorkerResponse =
  | { id: number; ok: true; result?: ScanResult }
  | { id: number; ok: false; error: { name: string; message: string } }

/** Next to the bundled CLI: dist/scan-worker.js. */
const WORKER_FILE = new URL('./scan-worker.js', import.meta.url)

export function createScanRunner(options: ScanOptions): ScanRunner {
  const useWorker =
    process.env.FLOW_CHECKER_SCAN_WORKER !== '0' &&
    import.meta.url.endsWith('.js') &&
    existsSync(fileURLToPath(WORKER_FILE))
  return useWorker ? workerRunner(options) : localRunner(options)
}

/** The session logic, shared by the worker and the in-thread runner. */
export function createScanHandler(options: ScanOptions) {
  let session: ScanSession | undefined
  const run = (scan: () => AppModel): ScanResult => {
    const started = performance.now()
    const model = scan()
    const durationMs = performance.now() - started
    writeModel(options.root, model)
    return { model, durationMs }
  }
  const fresh = () => {
    session = undefined
    session = createScanSession(options)
    return session.model
  }
  return {
    scan: () => run(fresh),
    update: (changes: FileChanges) =>
      run(() => {
        // A failed scan leaves no session: start over.
        if (!session) return fresh()
        try {
          return session.update(changes)
        } catch (error) {
          session = undefined
          throw error
        }
      }),
    warm: () => session?.warm(),
  }
}

function localRunner(options: ScanOptions): ScanRunner {
  const handler = createScanHandler(options)
  return {
    inWorker: false,
    scan: async () => handler.scan(),
    update: async (changes) => handler.update(changes),
    warm: async () => handler.warm(),
    close: async () => {},
  }
}

function workerRunner(options: ScanOptions): ScanRunner {
  const worker = new Worker(WORKER_FILE, { workerData: options })
  // The worker shouldn't keep the process alive on its own.
  worker.unref()
  let nextId = 0
  const pending = new Map<number, { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }>()
  let failed: Error | undefined

  worker.on('message', (response: WorkerResponse) => {
    pending.get(response.id)?.resolve(response)
    pending.delete(response.id)
  })
  const failAll = (error: Error) => {
    failed = error
    for (const p of pending.values()) p.reject(error)
    pending.clear()
  }
  worker.on('error', failAll)
  worker.on('exit', (code) => failAll(new Error(`The scan worker stopped (exit code ${code}).`)))

  const send = async (request: WorkerTask): Promise<ScanResult | undefined> => {
    if (failed) throw failed
    const id = ++nextId
    const response = await new Promise<WorkerResponse>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      worker.postMessage({ ...request, id })
    })
    if (response.ok) return response.result
    throw toError(response.error)
  }

  return {
    inWorker: true,
    scan: async () => (await send({ type: 'scan' })) as ScanResult,
    update: async (changes) => (await send({ type: 'update', changes })) as ScanResult,
    warm: async () => {
      await send({ type: 'warm' })
    },
    close: async () => {
      worker.removeAllListeners('exit')
      await worker.terminate()
    },
  }
}

/** Errors cross the thread as plain data; a ScanError stays a ScanError. */
function toError(error: { name: string; message: string }): Error {
  if (error.name === 'ScanError') return new ScanError(error.message)
  const out = new Error(error.message)
  out.name = error.name
  return out
}
