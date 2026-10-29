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
import { ScanError, scanProject } from '@flow-checker/scanner'
import { collectSnapshot, type ExportFormat } from '@flow-checker/server'
import type { AppModel, ExportData, FlowCheckerConfig } from '@flow-checker/shared'
import { version } from '../../package.json'
import { ConfigError, loadConfig } from './config'
import { findDashboardDir } from './project'
import type { CliIO } from './run'

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
  const root = resolve(options.root ?? process.cwd())

  let config: FlowCheckerConfig
  try {
    config = (await loadConfig(root, options.config)).config
  } catch (error) {
    if (error instanceof ConfigError) {
      io.err(error.message)
      return 1
    }
    throw error
  }

  const targets = exportTargets(root, options, config)

  let model: AppModel
  try {
    model = scanProject({ root, appDir: options.appDir ?? config.appDir })
  } catch (error) {
    if (error instanceof ScanError) {
      io.err(error.message)
      return 1
    }
    throw error
  }

  const capture = resolveCaptureOptions(config.capture)
  const data = collectSnapshot({
    root,
    model,
    toolVersion: version,
    capture,
    raw: options.raw,
    ...(options.now ? { now: options.now } : {}),
  })
  if (!data.redacted) {
    io.err(
      'Warning: this export has captured requests that are NOT redacted (--raw with capture.storeRaw). Do not share it.',
    )
  } else if (options.raw && !capture.storeRaw) {
    io.out('Note: --raw has no effect here, because captures are saved redacted (capture.storeRaw is off).')
  }
  io.out(describe(data))

  let failed = false
  for (const target of targets) {
    try {
      const written = writeFormat(target.format, data, target.dir, options)
      // Relative to the current folder when inside it, absolute otherwise.
      const rel = relative(process.cwd(), target.dir)
      const where = rel === '' ? '.' : rel.startsWith('..') || isAbsolute(rel) ? target.dir : rel
      io.out(
        target.format === 'md'
          ? `Wrote Markdown docs to ${where} (${written.length} files). Start at ${join(where, 'README.md')}.`
          : `Wrote the static site to ${where} (${written.length} files). Open ${join(where, 'index.html')}, or host the folder anywhere.`,
      )
    } catch (error) {
      if (error instanceof ExportWriteError || error instanceof HtmlExportError) {
        io.err(error.message)
        failed = true
        continue
      }
      throw error
    }
  }
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
  options: { force?: boolean; dashboardDir?: string } = {},
): string[] {
  const files: OutputFiles =
    format === 'md'
      ? renderMarkdown(data)
      : renderHtmlSite(data, options.dashboardDir ?? findDashboardDir() ?? '')
  return writeExport(dir, files, { format, generatedAt: data.generatedAt, force: options.force })
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
