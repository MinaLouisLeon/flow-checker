// Worker thread entry for the dev scan session (see scan-runner.ts). Bundled as dist/scan-worker.js.
import { parentPort, workerData } from 'node:worker_threads'
import type { ScanProgress } from '@flow-checker/scanner'
import {
  createScanHandler,
  type ScanOptions,
  type ScanResult,
  type WorkerRequest,
  type WorkerResponse,
} from './scan-runner'

const handler = createScanHandler(workerData as ScanOptions)

parentPort?.on('message', (request: WorkerRequest) => {
  // Phase events go out while the scan runs, so the main thread can show progress.
  const onProgress = (progress: ScanProgress) =>
    parentPort?.postMessage({ id: request.id, progress } satisfies WorkerResponse)
  let response: WorkerResponse
  try {
    let result: ScanResult | undefined
    if (request.type === 'scan') result = handler.scan(onProgress)
    else if (request.type === 'update') result = handler.update(request.changes, onProgress)
    else if (request.type === 'postman') handler.setPostman(request.imported)
    else handler.warm()
    response = { id: request.id, ok: true, result }
  } catch (error) {
    const err = error as Error
    response = {
      id: request.id,
      ok: false,
      error: { name: err?.name ?? 'Error', message: err?.message ?? String(error) },
    }
  }
  parentPort?.postMessage(response)
})
