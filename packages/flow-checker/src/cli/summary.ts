import { existsSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { resolveCaptureOptions } from '@flow-checker/runtime/options'
import { ScanError } from '@flow-checker/scanner'
import { collectSnapshot } from '@flow-checker/server'
import {
  type AppModel,
  buildIndex,
  buildSummary,
  type FlowCheckerConfig,
  type FlowsSummary,
  formatSummary,
} from '@flow-checker/shared'
import { ConfigError, configDetails, loadConfig, scanSettings } from './config'
import { graphqlForScan } from './graphql'
import { appOrigins, postmanForScan } from './postman'
import { createProgress, scanReporter, scanSteps } from './progress'
import type { CliIO } from './run'
import { createScanRunner } from './scan-runner'

export interface SummaryCommandOptions {
  root?: string
  appDir?: string
  config?: string
  /** Print the summary as JSON (for scripts). */
  json?: boolean
}

/**
 * `flow-checker summary [--json]` (M32): scans the project and prints Start here as text. Reads
 * `.flow-checker/` (captures, to show confirmed flows) when it exists, and writes nothing.
 */
export async function summaryCommand(options: SummaryCommandOptions, io: CliIO): Promise<number> {
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

  const runner = createScanRunner({
    root,
    appDir: options.appDir ?? config.appDir,
    ...scanSettings(config),
    graphql: await graphqlForScan(root, config, io, progress, { save: false }),
    writeModel: false,
    postman: await postmanForScan(root, config, io, progress, { save: false }),
    appOrigins: appOrigins(config),
  })
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

  // Captures from earlier `flow-checker` runs: which flows were walked, which requests verified.
  let flows: FlowsSummary | undefined
  let projectName = basename(root)
  if (existsSync(join(root, '.flow-checker'))) {
    const data = collectSnapshot({ root, model, capture: resolveCaptureOptions(config.capture) })
    model = data.model
    projectName = data.projectName
    if (data.captureCounts.total > 0) flows = data.flows
  }

  const summary = buildSummary(buildIndex(model), { flows })
  if (options.json) io.out(JSON.stringify({ project: projectName, ...summary }, null, 2))
  else io.out(formatSummary(summary, projectName).trimEnd())
  return 0
}
