import { isAbsolute, join, relative, resolve } from 'node:path'
import {
  ExportWriteError,
  HtmlExportError,
  type OutputFiles,
  renderHtmlSite,
  renderMarkdown,
  writeExport,
} from '@flow-checker/exporter'
import { resolveCaptureOptions } from '@flow-checker/runtime/options'
import { ScanError } from '@flow-checker/scanner'
import { collectSnapshot, type ExportFormat } from '@flow-checker/server'
import type { AppModel, ExportData, FlowCheckerConfig } from '@flow-checker/shared'
import { version } from '../../package.json'
import { ConfigError, configDetails, loadConfig, scanSettings } from './config'
import { graphqlForScan } from './graphql'
import { appOrigins, postmanForScan } from './postman'
import { createProgress, type Progress, scanReporter, scanSteps } from './progress'
import { findDashboardDir } from './project'
import type { CliIO } from './run'
import { createScanRunner } from './scan-runner'

/** Where exports go when neither the command line nor the config says (docs/PLAN.md 12). */
export const DEFAULT_EXPORT_DIRS = { md: 'docs/flow', html: '.flow-checker/site' }

export interface ExportCommandOptions {
  root?: string
  appDir?: string
  config?: string
  /** Markdown folder, relative to the current directory. */
  md?: string
  /** Static site folder, relative to the current directory. */
  html?: string
  /** Export captures as stored, without redacting them again. */
  raw?: boolean
  /** Write into a folder that has other files. */
  force?: boolean
  /** Folder with the dashboard build (tests). Default: next to the CLI. */
  dashboardDir?: string
  /** Export time (tests). */
  now?: Date
}

/**
 * `flow-checker export --md <dir> --html <dir> [--raw]`: scans the project, matches the captures
 * saved by `flow-checker dev` against it, and writes the docs. With neither flag, both formats
 * are written to the folders in the config (`export.md`, `export.html`) or the defaults.
 */
export async function exportCommand(options: ExportCommandOptions, io: CliIO): Promise<number> {
  let root = resolve(options.root ?? process.cwd())
  // Both formats unless one is picked: their steps are planned before the config is read.
  const formats = options.md || options.html ? Number(!!options.md) + Number(!!options.html) : 2
  const progress = createProgress(io, [
    { id: 'config', weight: 2 },
    ...scanSteps(68),
    { id: 'captures', weight: 10 },
    ...(['md', 'html'] as const)
      .slice(0, formats)
      .map((_, i) => ({ id: `write:${i}`, weight: 20 / formats })),
  ])

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

  const targets = exportTargets(root, options, config)

  // In the worker thread (from the build), so the progress line keeps moving during the scan.
  // The export reads .flow-checker/ but writes nothing there.
  const runner = createScanRunner({
    root,
    appDir: options.appDir ?? config.appDir,
    ...scanSettings(config),
    graphql: await graphqlForScan(root, config, io, progress, { save: false }),
    writeModel: false,
    postman: await postmanForScan(root, config, io, progress, { save: false }),
    appOrigins: appOrigins(config),
  })
  progress.detail(`scan runs ${runner.inWorker ? 'in a worker thread' : 'in this thread'}`)
  let model: AppModel
  try {
    model = (await runner.scan(scanReporter(progress))).model
  } catch (error) {
    progress.finish()
    if (error instanceof ScanError) {
      io.err(error.message)
      return 1
    }
    throw error
  } finally {
    await runner.close()
  }

  progress.start('captures', 'Matching captures…')
  const capture = resolveCaptureOptions(config.capture)
  const data = collectSnapshot({
    root,
    model,
    toolVersion: version,
    capture,
    raw: options.raw,
    ...(options.now ? { now: options.now } : {}),
  })
  progress.done(`Captures: ${data.captureCounts.total.toLocaleString('en-US')}`)
  if (!data.redacted) {
    io.err(
      'Warning: this export has captured requests that are NOT redacted (--raw with capture.storeRaw). Do not share it.',
    )
  } else if (options.raw && !capture.storeRaw) {
    io.out('Note: --raw has no effect here, because captures are saved redacted (capture.storeRaw is off).')
  }
  io.out(describe(data))

  let failed = false
  for (const [index, target] of targets.entries()) {
    const name = target.format === 'md' ? 'Markdown docs' : 'static site'
    try {
      progress.start(`write:${index}`, `Rendering the ${name}…`)
      const written = writeFormat(target.format, data, target.dir, { ...options, progress })
      progress.done()
      // Relative to the current folder when inside it, absolute otherwise.
      const rel = relative(process.cwd(), target.dir)
      const where = rel === '' ? '.' : rel.startsWith('..') || isAbsolute(rel) ? target.dir : rel
      io.out(
        target.format === 'md'
          ? `Wrote Markdown docs to ${where} (${written.length} files). Start at ${join(where, 'README.md')}.`
          : `Wrote the static site to ${where} (${written.length} files). Open ${join(where, 'index.html')}, or host the folder anywhere.`,
      )
    } catch (error) {
      progress.done()
      if (error instanceof ExportWriteError || error instanceof HtmlExportError) {
        io.err(error.message)
        failed = true
        continue
      }
      throw error
    }
  }
  progress.finish()
  return failed ? 1 : 0
}

/**
 * Renders one format and writes it to `dir`. Returns the files written. Throws
 * `ExportWriteError` / `HtmlExportError` with a message for the user.
 */
export function writeFormat(
  format: ExportFormat,
  data: ExportData,
  dir: string,
  options: { force?: boolean; dashboardDir?: string; progress?: Progress } = {},
): string[] {
  const files: OutputFiles =
    format === 'md'
      ? renderMarkdown(data)
      : renderHtmlSite(data, options.dashboardDir ?? findDashboardDir() ?? '')
  const label = `Writing the ${format === 'md' ? 'Markdown docs' : 'static site'}… file`
  return writeExport(dir, files, {
    format,
    generatedAt: data.generatedAt,
    force: options.force,
    onFile: options.progress ? (done, total) => options.progress?.update(done, total, label) : undefined,
  })
}

/** The export folders from the config, or the defaults, as absolute paths. */
export function configExportDirs(root: string, config: FlowCheckerConfig): Record<ExportFormat, string> {
  return {
    md: resolve(root, config.export?.md ?? DEFAULT_EXPORT_DIRS.md),
    html: resolve(root, config.export?.html ?? DEFAULT_EXPORT_DIRS.html),
  }
}

function exportTargets(
  root: string,
  options: ExportCommandOptions,
  config: FlowCheckerConfig,
): { format: ExportFormat; dir: string }[] {
  if (options.md || options.html) {
    return [
      ...(options.md ? [{ format: 'md' as const, dir: resolve(options.md) }] : []),
      ...(options.html ? [{ format: 'html' as const, dir: resolve(options.html) }] : []),
    ]
  }
  const dirs = configExportDirs(root, config)
  return [
    { format: 'md', dir: dirs.md },
    { format: 'html', dir: dirs.html },
  ]
}

function describe(data: ExportData): string {
  const total = data.model.requests.length
  const verified = data.model.requests.filter((s) => s.status !== 'inferred').length
  const captures = data.captureCounts.total
  return captures === 0
    ? `Exporting ${data.model.routes.length} routes and ${total} requests (no captures yet, so nothing is verified).`
    : `Exporting ${data.model.routes.length} routes and ${total} requests, ${verified} with captures (${captures} captures${data.redacted ? ', redacted' : ''}).`
}
