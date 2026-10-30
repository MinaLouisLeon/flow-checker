import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { ScanError } from '@flow-checker/scanner'
import {
  type AppModel,
  type FlowCheckerConfig,
  formatFlows,
  formatModel,
  formatRequests,
  formatTypes,
} from '@flow-checker/shared'
import { ConfigError, configDetails, loadConfig, scanSettings } from './config'
import { graphqlForScan } from './graphql'
import { appOrigins, contractSummary, postmanForScan } from './postman'
import { createProgress, scanReporter, scanSteps } from './progress'
import type { CliIO } from './run'
import { createScanRunner } from './scan-runner'

export interface ScanCommandOptions {
  root?: string
  appDir?: string
  /** Config file, relative to the root. Default: `flow-checker.config.*` in the root. */
  config?: string
  tree?: boolean
  types?: boolean
  requests?: boolean
  flows?: boolean
}

/** `flow-checker scan`: scans the project and writes `.flow-checker/model.json`. */
export async function scanCommand(options: ScanCommandOptions, io: CliIO): Promise<number> {
  let root = resolve(options.root ?? process.cwd())
  const progress = createProgress(io, [{ id: 'config', weight: 2 }, ...scanSteps(98)])

  let config: FlowCheckerConfig
  progress.start('config', 'Loading config…')
  try {
    const loaded = await loadConfig(root, options.config)
    config = loaded.config
    root = loaded.root
    progress.done()
    for (const line of configDetails(root, loaded.file, config)) progress.detail(line)
  } catch (error) {
    progress.finish()
    if (error instanceof ConfigError) {
      io.err(error.message)
      return 1
    }
    throw error
  }

  const postman = await postmanForScan(root, config, io, progress)
  const graphql = await graphqlForScan(root, config, io, progress, { refresh: true })
  const started = performance.now()
  // In the worker thread (from the build), so the progress line keeps moving during the scan.
  const runner = createScanRunner({
    root,
    appDir: options.appDir ?? config.appDir,
    ...scanSettings(config),
    graphql,
    postman,
    appOrigins: appOrigins(config),
  })
  progress.detail(`scan runs ${runner.inWorker ? 'in a worker thread' : 'in this thread'}`)
  let model: AppModel
  try {
    model = (await runner.scan(scanReporter(progress))).model
  } catch (error) {
    if (error instanceof ScanError) {
      io.err(error.message)
      return 1
    }
    throw error
  } finally {
    progress.finish()
    await runner.close()
  }

  const outFile = join(root, '.flow-checker', 'model.json')

  if (options.tree) io.out(formatModel(model))
  if (options.types) io.out(formatTypes(model))
  if (options.requests) io.out(formatRequests(model))
  if (options.flows) io.out(formatFlows(model))

  io.out(summary(model, performance.now() - started))
  const contract = contractSummary(model)
  if (contract) io.out(contract)
  io.out(`Wrote ${relative(process.cwd(), outFile) || outFile}`)
  return 0
}

/** Writes `.flow-checker/model.json` and returns its path. */
export function writeModel(root: string, model: AppModel): string {
  const outDir = join(root, '.flow-checker')
  const outFile = join(outDir, 'model.json')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, `${JSON.stringify(model, null, 2)}\n`)
  return outFile
}

export function summary(model: AppModel, elapsedMs: number): string {
  const pages = model.routes.filter((r) => r.kind === 'page').length
  const handlers = model.routes.length - pages
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  return (
    `Scanned ${plural(pages, 'page')}, ${plural(handlers, 'route handler')}, ` +
    `${plural(model.components.length, 'component')}, ${plural(model.types.length, 'type')}, ` +
    `${plural(model.requests.length, 'request')} ` +
    `and ${plural(model.flows.length, 'flow')} ` +
    `in ${Math.round(elapsedMs)} ms.`
  )
}
