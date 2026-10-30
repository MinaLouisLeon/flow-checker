// Runs the warm scan session for `flow-checker dev` (docs/PLAN.md 6.7). From the published
// build it lives in a worker thread, so the dashboard and the capture endpoint keep answering
// while a large repo re-scans. Run from source (tests), it stays in this thread.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { applyPostman, type PostmanImport } from '@flow-checker/postman'
import {
  createScanSession,
  type FileChanges,
  ScanError,
  type ScanOptions as ScannerOptions,
  type ScanProgress,
  type ScanSession,
} from '@flow-checker/scanner'
import type { AppModel } from '@flow-checker/shared'
import { writeModel } from './scan'

export type ScanOptions = Pick<
  ScannerOptions,
  'root' | 'appDir' | 'types' | 'include' | 'exclude' | 'apiClients' | 'graphql'
> & {
  /** Write `.flow-checker/model.json` after each scan. Default: true (`export` turns it off). */
  writeModel?: boolean
  /** Postman collection each scan is checked against (M15). */
  postman?: PostmanImport
  /** The app's own origins, e.g. `http://localhost:3000` (collection URLs there are same-origin). */
  appOrigins?: string[]
}

export interface ScanResult {
  model: AppModel
  durationMs: number
}

/** Gets the scan's phase events (CLI progress output). */
export type OnScanProgress = (event: ScanProgress) => void

export interface ScanRunner {
  /** Whether scans run in a worker thread. */
  readonly inWorker: boolean
  /** Scans from scratch and writes model.json. */
  scan(onProgress?: OnScanProgress): Promise<ScanResult>
  /** Re-scans after file changes (a full scan when the last one failed) and writes model.json. */
  update(changes: FileChanges, onProgress?: OnScanProgress): Promise<ScanResult>
  /** Prepares the first re-scan while nothing waits for it. */
  warm(): Promise<void>
  /** Uses another Postman collection (or none) from the next scan on. */
  setPostman(imported: PostmanImport | undefined): Promise<void>
  close(): Promise<void>
}

type WorkerTask =
  | { type: 'scan' }
  | { type: 'update'; changes: FileChanges }
  | { type: 'warm' }
  | { type: 'postman'; imported: PostmanImport | undefined }

export type WorkerRequest = WorkerTask & { id: number }

export type WorkerResponse =
  | { id: number; ok: true; result?: ScanResult }
  | { id: number; ok: false; error: { name: string; message: string } }
  | { id: number; progress: ScanProgress }

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
  // The session keeps its options, so progress goes to whoever runs the current scan.
  let report: OnScanProgress | undefined
  let postman = options.postman
  const run = (onProgress: OnScanProgress | undefined, scan: () => AppModel): ScanResult => {
    report = onProgress
    try {
      const started = performance.now()
      const scanned = scan()
      const model = postman ? applyPostman(scanned, postman, { appOrigins: options.appOrigins }) : scanned
      const durationMs = performance.now() - started
      if (options.writeModel !== false) writeModel(options.root, model)
      return { model, durationMs }
    } finally {
      report = undefined
    }
  }
  const fresh = () => {
    session = undefined
    const { writeModel: _, postman: __, appOrigins: ___, ...scanOptions } = options
    session = createScanSession({ ...scanOptions, onProgress: (event) => report?.(event) })
    return session.model
  }
  return {
    scan: (onProgress?: OnScanProgress) => run(onProgress, fresh),
    update: (changes: FileChanges, onProgress?: OnScanProgress) =>
      run(onProgress, () => {
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
    setPostman: (imported: PostmanImport | undefined) => {
      postman = imported
    },
  }
}

function localRunner(options: ScanOptions): ScanRunner {
  const handler = createScanHandler(options)
  return {
    inWorker: false,
    scan: async (onProgress) => handler.scan(onProgress),
    update: async (changes, onProgress) => handler.update(changes, onProgress),
    warm: async () => handler.warm(),
    setPostman: async (imported) => handler.setPostman(imported),
    close: async () => {},
  }
}

function workerRunner(options: ScanOptions): ScanRunner {
  const worker = new Worker(WORKER_FILE, { workerData: options })
  // The worker shouldn't keep the process alive on its own.
  worker.unref()
  let nextId = 0
  type Done = Exclude<WorkerResponse, { progress: ScanProgress }>
  const pending = new Map<
    number,
    { resolve: (r: Done) => void; reject: (e: Error) => void; onProgress?: OnScanProgress }
  >()
  let failed: Error | undefined

  worker.on('message', (response: WorkerResponse) => {
    if ('progress' in response) {
      pending.get(response.id)?.onProgress?.(response.progress)
      return
    }
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

  const send = async (request: WorkerTask, onProgress?: OnScanProgress): Promise<ScanResult | undefined> => {
    if (failed) throw failed
    const id = ++nextId
    const response = await new Promise<Done>((resolve, reject) => {
      pending.set(id, { resolve, reject, onProgress })
      worker.postMessage({ ...request, id })
    })
    if (response.ok) return response.result
    throw toError(response.error)
  }

  return {
    inWorker: true,
    scan: async (onProgress) => (await send({ type: 'scan' }, onProgress)) as ScanResult,
    update: async (changes, onProgress) =>
      (await send({ type: 'update', changes }, onProgress)) as ScanResult,
    warm: async () => {
      await send({ type: 'warm' })
    },
    setPostman: async (imported) => {
      await send({ type: 'postman', imported })
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
