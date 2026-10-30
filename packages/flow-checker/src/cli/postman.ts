// Postman collection import (M15): `flow-checker postman import`, the collection every scan is
// checked against, and the doctor check.
import { existsSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import {
  DEFAULT_API_KEY_ENV,
  importPostman,
  isCloud,
  loadPostman,
  POSTMAN_CACHE_FILE,
  PostmanError,
  type PostmanImport,
  readCache,
} from '@flow-checker/postman'
import { resolveCaptureOptions } from '@flow-checker/runtime/options'
import { compileRules } from '@flow-checker/runtime/redact'
import { ScanError } from '@flow-checker/scanner'
import {
  type AppModel,
  DEFAULT_PORTS,
  type FlowCheckerConfig,
  type PostmanCloudSource,
  type PostmanConfig,
} from '@flow-checker/shared'
import { ConfigError, configDetails, loadConfig, scanSettings } from './config'
import type { Check } from './doctor'
import { createProgress, type Progress, scanReporter, scanSteps } from './progress'
import type { CliIO } from './run'
import { createScanRunner } from './scan-runner'

/** The app's own origins: collection URLs there are same-origin calls. */
export function appOrigins(config: FlowCheckerConfig, appPort?: number): string[] {
  const port = appPort ?? config.ports?.app ?? DEFAULT_PORTS.app
  return [`http://localhost:${port}`]
}

/**
 * The collection scans use, or `undefined` (none configured or imported). Problems are printed
 * and the scan goes on without it. `refresh`: read cloud collections again (`dev` start).
 */
export async function postmanForScan(
  root: string,
  config: FlowCheckerConfig,
  io: CliIO,
  progress: Progress | undefined,
  { refresh = false, save = true }: { refresh?: boolean; save?: boolean } = {},
): Promise<PostmanImport | undefined> {
  try {
    const result = await loadPostman({
      root,
      config: config.postman,
      refresh,
      save,
      redact: compileRules(resolveCaptureOptions(config.capture).redact),
    })
    if (result.warning) io.err(`Warning: ${result.warning}`)
    if (result.imported) {
      progress?.detail(
        `postman: "${result.imported.collection.name}" (${result.imported.requests.length} requests, ${
          result.from === 'cache' ? `last import ${result.imported.importedAt}` : 'read now'
        })`,
      )
    }
    return result.imported
  } catch (error) {
    if (error instanceof PostmanError) {
      io.err(`Postman collection not used: ${error.message}`)
      return undefined
    }
    throw error
  }
}

/** One line about how the code lines up with the collection, or `undefined` without one. */
export function contractSummary(model: AppModel): string | undefined {
  const postman = model.postman
  if (!postman) return undefined
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const used = postman.requests.filter((r) => r.siteIds.length > 0).length
  const sites = model.requests
  const missing = sites.filter((s) => s.flags.some((f) => f.kind === 'not-in-collection')).length
  const mismatched = sites.filter((s) => s.flags.some((f) => f.kind === 'contract-mismatch')).length
  const resolved = sites.filter((s) => s.url?.confidence === 'postman').length
  const typed = sites.filter(
    (s) => s.responseType?.source === 'postman' || s.bodyType?.source === 'postman',
  ).length
  const parts = [
    `${used} of ${count(postman.requests.length, 'collection request', 'collection requests')} called`,
    `${count(missing, 'request', 'requests')} not in the collection`,
    count(mismatched, 'type mismatch', 'type mismatches'),
  ]
  if (resolved) parts.push(`${count(resolved, 'URL', 'URLs')} from the collection`)
  if (typed) parts.push(`${count(typed, 'type', 'types')} from examples`)
  return `Postman "${postman.collection.name}": ${parts.join(', ')}.`
}

export interface PostmanCommandOptions {
  root?: string
  appDir?: string
  config?: string
  /** A v2.1 JSON file, a v3 YAML folder or a cloud collection id. Default: the config's. */
  collection?: string
  /** An environment file or cloud id. */
  environment?: string
  /** Env variable with the API key, for cloud ids given on the command line. */
  apiKeyEnv?: string
}

/**
 * `flow-checker postman import`: reads the collection (and environment) into
 * `.flow-checker/postman/`, then scans the project and prints how the code lines up with it.
 */
export async function postmanCommand(action: string | undefined, options: PostmanCommandOptions, io: CliIO) {
  if (action !== 'import') {
    io.err(action ? `Unknown postman command "${action}".` : 'Missing postman command.')
    io.err('Usage: flow-checker postman import [--collection <file|folder|id>] [--environment <file|id>]')
    return 1
  }
  let root = resolve(options.root ?? process.cwd())
  const progress = createProgress(io, [
    { id: 'config', weight: 2 },
    { id: 'import', weight: 8 },
    ...scanSteps(90),
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

  const postman = commandSource(root, options, config.postman)
  if (!postman) {
    progress.finish()
    io.err(
      'No Postman collection: set "postman.collection" in the config or pass --collection <file|folder|id>.',
    )
    return 1
  }

  progress.start('import', 'Importing the Postman collection…')
  let imported: PostmanImport
  try {
    const result = await loadPostman({
      root,
      config: postman,
      refresh: true,
      redact: compileRules(resolveCaptureOptions(config.capture).redact),
    })
    if (!result.imported || result.from !== 'import') {
      throw new PostmanError(result.warning ?? 'The collection could not be read.')
    }
    imported = result.imported
    progress.done()
  } catch (error) {
    progress.finish()
    if (error instanceof PostmanError) {
      io.err(error.message)
      return 1
    }
    throw error
  }
  const examples = imported.requests.reduce((n, r) => n + r.examples.length, 0)
  const from = (s: { source: { path?: string; id?: string } }) => s.source.path ?? `cloud ${s.source.id}`
  io.out(
    `Imported "${imported.collection.name}" from ${from(imported.collection)}: ${imported.requests.length} requests, ${examples} saved examples` +
      (imported.environment ? `, environment "${imported.environment.name}"` : '') +
      '.',
  )
  io.out(`Saved to ${POSTMAN_CACHE_FILE.split(sep).join('/')} in the project.`)
  if (!config.postman) {
    io.out('Scans use this import until the next one. Add "postman" to the config to read it on every scan.')
  }

  const runner = createScanRunner({
    root,
    appDir: options.appDir ?? config.appDir,
    ...scanSettings(config),
    postman: imported,
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
  io.out(contractSummary(model) ?? '')
  for (const r of model.postman?.requests ?? []) {
    if (r.siteIds.length === 0) io.out(`  unused: ${r.method} ${r.url.path ?? r.url.text} (${r.name})`)
  }
  for (const site of model.requests) {
    const flag = site.flags.find((f) => f.kind === 'not-in-collection' || f.kind === 'contract-mismatch')
    if (!flag) continue
    const at = site.callStack.at(-1)
    io.out(`  ${flag.kind}: ${flag.message}${at ? ` (${at.file}:${at.line})` : ''}`)
  }
  return 0
}

/** The command line's collection and environment, or the config's. */
function commandSource(
  root: string,
  options: PostmanCommandOptions,
  configured: PostmanConfig | undefined,
): PostmanConfig | undefined {
  const source = (value: string): string | PostmanCloudSource =>
    existsSync(resolve(root, value)) || /[\\/.]/.test(value)
      ? value
      : { id: value, ...(options.apiKeyEnv ? { apiKeyEnv: options.apiKeyEnv } : {}) }
  if (!options.collection) {
    if (!configured) return undefined
    return options.environment ? { ...configured, environment: source(options.environment) } : configured
  }
  return {
    collection: source(options.collection),
    ...(options.environment ? { environment: source(options.environment) } : {}),
  }
}

/** Doctor: whether the configured collection can be read. `undefined` when there is none. */
export async function checkPostman(root: string, config: FlowCheckerConfig): Promise<Check | undefined> {
  const cached = readCache(root)
  const postman = config.postman
  if (!postman) {
    return cached
      ? {
          name: 'Postman',
          status: 'ok',
          message: `"${cached.collection.name}" from the last import (${cached.importedAt})`,
        }
      : undefined
  }
  if (isCloud(postman)) {
    const envs = [postman.collection, postman.environment]
      .filter((s): s is PostmanCloudSource => typeof s === 'object')
      .map((s) => s.apiKeyEnv ?? DEFAULT_API_KEY_ENV)
    const missing = [...new Set(envs)].filter((name) => !process.env[name])
    if (missing.length > 0) {
      return {
        name: 'Postman',
        status: cached ? 'warn' : 'fail',
        message: `the API key variable ${missing.join(', ')} is not set`,
        hint: cached
          ? `Scans use the last import (${cached.importedAt}) until the key is set.`
          : `Set ${missing.join(', ')} to a Postman API key, then run "flow-checker postman import".`,
      }
    }
  }
  try {
    // Read only: local files are read now, cloud ones come from the last import.
    const imported = isCloud(postman) ? cached : await importPostman({ root, config: postman })
    if (!imported) {
      return {
        name: 'Postman',
        status: 'warn',
        message: 'the cloud collection has not been imported yet',
        hint: 'Run "flow-checker postman import" (or start "flow-checker dev").',
      }
    }
    return {
      name: 'Postman',
      status: 'ok',
      message: `"${imported.collection.name}" (${imported.requests.length} requests${
        imported.environment ? `, environment "${imported.environment.name}"` : ''
      }${isCloud(postman) ? `, last import ${imported.importedAt}` : ''})`,
    }
  } catch (error) {
    return {
      name: 'Postman',
      status: 'fail',
      message: (error as Error).message,
      hint: 'Check postman.collection / postman.environment in the config.',
    }
  }
}
