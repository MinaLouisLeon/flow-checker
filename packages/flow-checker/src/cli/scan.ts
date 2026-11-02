import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { resolveCaptureOptions } from '@flow-checker/runtime/options'
import { ScanError } from '@flow-checker/scanner'
import { collectSnapshot } from '@flow-checker/server'
import {
  type AppModel,
  CLI_NAME,
  type Flag,
  type FlowCheckerConfig,
  formatFlows,
  formatModel,
  formatRequests,
  formatTypes,
} from '@flow-checker/shared'
import { ConfigError, configDetails, loadConfig, scanSettings } from './config'
import { graphqlForScan } from './graphql'
import {
  type ChangedFiles,
  changedFiles,
  formatDiff,
  formatFailOn,
  impactOfChanges,
  openFlags,
  parseFailOn,
} from './impact'
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
  /** `--diff <ref>` (M36): print what the files changed since this git ref affect. */
  diff?: string
  /** `--fail-on <kinds>` (M36): exit 1 when a flag of these kinds is open (comma-separated). */
  failOn?: string
  /** Print JSON instead of text (with `--diff` / `--fail-on`: their results). */
  json?: boolean
}

/** `flow-checker scan`: scans the project and writes `.flow-checker/model.json`. */
export async function scanCommand(options: ScanCommandOptions, io: CliIO): Promise<number> {
  let root = resolve(options.root ?? process.cwd())
  // With --fail-on, a check that couldn't run exits 2, so CI can tell it from open flags (1).
  const broken = options.failOn !== undefined ? 2 : 1
  let failOn: Flag['kind'][] | undefined
  if (options.failOn !== undefined) {
    const parsed = parseFailOn(options.failOn)
    if (typeof parsed === 'string') {
      io.err(parsed)
      return broken
    }
    failOn = parsed
  }
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
      return broken
    }
    throw error
  }

  let changed: ChangedFiles | undefined
  if (options.diff !== undefined) {
    const found = changedFiles(root, options.diff)
    if (typeof found === 'string') {
      progress.finish()
      io.err(found)
      return broken
    }
    changed = found
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
      return broken
    }
    throw error
  } finally {
    progress.finish()
    await runner.close()
  }

  const outFile = join(root, '.flow-checker', 'model.json')
  const elapsed = performance.now() - started
  const impact = changed && impactOfChanges(model, changed)
  let open: ReturnType<typeof openFlags> | undefined
  if (failOn) {
    // Captures from earlier runs add the flags only they can tell: `stale`, `type-mismatch`.
    const checked = existsSync(join(root, '.flow-checker'))
      ? collectSnapshot({ root, model, capture: resolveCaptureOptions(config.capture) }).model
      : model
    open = openFlags(checked, failOn, impact && new Set(impact.requests.map((r) => r.id)))
  }

  if (options.json) {
    io.out(
      JSON.stringify(
        {
          model: outFile,
          scanned: counts(model),
          durationMs: Math.round(elapsed),
          ...(changed && impact ? { diff: { ref: options.diff, ...changed, impact } } : {}),
          ...(failOn && open ? { failOn: { kinds: failOn, open, failed: open.length > 0 } } : {}),
        },
        null,
        2,
      ),
    )
    return open && open.length > 0 ? 1 : 0
  }

  if (options.tree) io.out(formatModel(model))
  if (options.types) io.out(formatTypes(model))
  if (options.requests) {
    io.out(formatRequests(model))
    if (model.requests.some((r) => r.flags.length > 0))
      io.out(`Run "${CLI_NAME} explain <note>" (e.g. explain dynamic-url) to see what a note means.`)
  }
  if (options.flows) io.out(formatFlows(model))

  io.out(summary(model, elapsed))
  const contract = contractSummary(model)
  if (contract) io.out(contract)
  io.out(`Wrote ${relative(process.cwd(), outFile) || outFile}`)
  if (changed && impact && options.diff !== undefined)
    io.out(`\n${formatDiff(options.diff, changed, impact)}`)
  if (failOn && open) {
    io.out(`\n${formatFailOn(failOn, open, Boolean(impact))}`)
    if (open.length > 0) return 1
  }
  return 0
}

function counts(model: AppModel) {
  const pages = model.routes.filter((r) => r.kind === 'page').length
  return {
    pages,
    routeHandlers: model.routes.length - pages,
    components: model.components.length,
    types: model.types.length,
    requests: model.requests.length,
    flows: model.flows.length,
  }
}

/** Writes `model.json` (default: in `<root>/.flow-checker`) and returns its path. */
export function writeModel(root: string, model: AppModel, dataDir?: string): string {
  const outDir = dataDir ?? join(root, '.flow-checker')
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
