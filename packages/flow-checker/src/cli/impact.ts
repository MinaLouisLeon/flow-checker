import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { declarationLines, ScanError } from '@flow-checker/scanner'
import {
  type AppModel,
  buildImpact,
  buildIndex,
  CLI_NAME,
  type Flag,
  FlagSchema,
  type FlowCheckerConfig,
  formatImpact,
  type Impact,
  type ImpactTarget,
  requestLabel,
} from '@flow-checker/shared'
import { ConfigError, configDetails, loadConfig, scanSettings } from './config'
import { graphqlForScan } from './graphql'
import { appOrigins, postmanForScan } from './postman'
import { createProgress, scanReporter, scanSteps } from './progress'
import type { CliIO } from './run'
import { createScanRunner } from './scan-runner'

export interface ImpactCommandOptions {
  root?: string
  appDir?: string
  config?: string
  json?: boolean
  /** Resolves file arguments (default: the current directory). */
  cwd?: string
}

/**
 * `flow-checker impact <file>[:line]...` (M36): scans the project and prints the pages, flows and
 * requests that changing the files affects, by area. Writes nothing.
 */
export async function impactCommand(
  args: string[],
  options: ImpactCommandOptions,
  io: CliIO,
): Promise<number> {
  if (args.length === 0) {
    io.err(`Name a file: ${CLI_NAME} impact <file>[:line] (e.g. impact src/lib/api.ts:12).`)
    return 1
  }
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

  const targets: ImpactTarget[] = []
  for (const arg of args) {
    const target = parseTarget(root, options.cwd ?? process.cwd(), arg)
    if (typeof target === 'string') {
      progress.finish()
      io.err(target)
      return 1
    }
    targets.push(target)
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

  const impact = buildImpact(buildIndex(model), targets)
  if (options.json) io.out(JSON.stringify(impact, null, 2))
  else io.out(formatImpact(impact).trimEnd())
  return 0
}

/**
 * `src/lib/api.ts` or `src/lib/api.ts:12`, relative to `cwd` (or absolute), as a project-relative
 * target. With a line, the target is the declaration around it. A string is an error to print.
 */
export function parseTarget(root: string, cwd: string, arg: string): ImpactTarget | string {
  const match = /^(.*?):(\d+)$/.exec(arg)
  const path = match ? (match[1] as string) : arg
  const line = match ? Number(match[2]) : undefined
  const abs = isAbsolute(path) ? path : resolve(cwd, path)
  const file = relative(root, abs).replaceAll('\\', '/')
  if (file === '' || file.startsWith('../') || isAbsolute(file))
    return `${arg} is outside the project (${root}).`
  if (!existsSync(abs) || !statSync(abs).isFile()) return `${arg}: no such file.`
  if (line === undefined) return { file }
  if (line < 1) return `${arg}: lines start at 1.`
  const lines = declarationLines(readFileSync(abs, 'utf8'), abs, line)
  // A blank line between declarations: only what starts on that line (usually nothing, so the
  // whole file is used and the output says so).
  return { file, lines: lines ?? { from: line, to: line } }
}

// --- scan --diff ------------------------------------------------------------------------------

const SOURCE_FILE = /\.(tsx?|jsx?|mts|cts|mjs|cjs)$/

export interface ChangedFiles {
  /** Source files changed since the ref (tracked or new), project-relative. */
  files: string[]
  /** Of those, the ones that no longer exist. */
  removed: string[]
  /** Other changed files (docs, styles, config...), which the scan doesn't read. */
  other: number
}

/**
 * Files changed since `ref` in the project folder: committed, staged and unstaged changes
 * (`git diff --name-only <ref>`) plus new untracked files. A string is an error to print.
 */
export function changedFiles(root: string, ref: string): ChangedFiles | string {
  const git = (args: string[]) =>
    execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])
  } catch (error) {
    const stderr = String((error as { stderr?: unknown }).stderr ?? '').trim()
    if (/not a git repository/i.test(stderr)) return `--diff needs a git repository: ${root} is not in one.`
    return `--diff: "${ref}" is not a commit, branch or tag in this repository.`
  }
  // `--relative` (with `-C root`) keeps the paths relative to the project and leaves out the rest of
  // the repository; `ls-files` prints paths relative to the folder it runs in.
  const lines = (text: string) => text.split('\n').filter(Boolean)
  const all = new Set([
    ...lines(git(['diff', '--name-only', '--relative', '--no-renames', ref, '--'])),
    ...lines(git(['ls-files', '--others', '--exclude-standard'])),
  ])
  const sorted = [...all].map((f) => f.replaceAll('\\', '/')).sort()
  const files = sorted.filter(
    (f) => SOURCE_FILE.test(f) && !f.endsWith('.d.ts') && !f.split('/').includes('node_modules'),
  )
  return {
    files,
    removed: files.filter((f) => !existsSync(resolve(root, f))),
    other: sorted.length - files.length,
  }
}

export function impactOfChanges(model: AppModel, changed: ChangedFiles): Impact {
  return buildImpact(
    buildIndex(model),
    changed.files.map((file) => ({ file })),
  )
}

/** `scan --diff`: the changes and their impact as text. */
export function formatDiff(ref: string, changed: ChangedFiles, impact: Impact): string {
  const other = changed.other > 0 ? ` (and ${changed.other} other file${changed.other === 1 ? '' : 's'})` : ''
  if (changed.files.length === 0) return `No source files changed since ${ref}${other}.`
  const removed = changed.removed.length > 0 ? `\nRemoved since ${ref}: ${changed.removed.join(', ')}` : ''
  return `Changes since ${ref}${other}\n\n${formatImpact(impact).trimEnd()}${removed}`
}

// --- scan --fail-on ---------------------------------------------------------------------------

export const FLAG_KINDS = FlagSchema.shape.kind.options

/** `dynamic-url,stale` → the kinds; a string is an error to print. */
export function parseFailOn(value: string): Flag['kind'][] | string {
  const kinds = value
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
  if (kinds.length === 0) return `--fail-on needs flag kinds, e.g. --fail-on dynamic-url,type-mismatch.`
  const unknown = kinds.filter((k) => !(FLAG_KINDS as readonly string[]).includes(k))
  if (unknown.length > 0)
    return `--fail-on: unknown flag kind${unknown.length === 1 ? '' : 's'} ${unknown.join(', ')}. Known kinds: ${FLAG_KINDS.join(', ')}.`
  return [...new Set(kinds)] as Flag['kind'][]
}

export interface OpenFlag {
  kind: Flag['kind']
  message: string
  /** The request site, or the Postman collection request (`unused-endpoint`). */
  label: string
  requestId?: string
  file?: string
  line?: number
}

/**
 * Flags of the given kinds on the model's requests. With `siteIds` (`--diff`), only those requests,
 * and not the collection's own flags (they aren't about the code that changed).
 */
export function openFlags(
  model: AppModel,
  kinds: readonly Flag['kind'][],
  siteIds?: ReadonlySet<string>,
): OpenFlag[] {
  const wanted = new Set(kinds)
  const out: OpenFlag[] = []
  for (const site of model.requests) {
    if (siteIds && !siteIds.has(site.id)) continue
    const first = site.callStack[0]
    for (const flag of site.flags) {
      if (!wanted.has(flag.kind)) continue
      out.push({
        kind: flag.kind,
        message: flag.message,
        label: requestLabel(site),
        requestId: site.id,
        ...(first ? { file: first.file, line: first.line } : {}),
      })
    }
  }
  if (!siteIds) {
    for (const request of model.postman?.requests ?? []) {
      for (const flag of request.flags) {
        if (wanted.has(flag.kind))
          out.push({ kind: flag.kind, message: flag.message, label: `${request.method} ${request.name}` })
      }
    }
  }
  return out
}

export function formatFailOn(kinds: readonly Flag['kind'][], open: OpenFlag[], scoped: boolean): string {
  const where = scoped ? ' on the changed requests' : ''
  if (open.length === 0) return `--fail-on ${kinds.join(',')}: nothing open${where}.`
  const out = [`--fail-on ${kinds.join(',')}: ${open.length} open${where}`]
  for (const flag of open) {
    const at = flag.file ? `  ${flag.file}${flag.line ? `:${flag.line}` : ''}` : ''
    out.push(`  ${flag.kind}  ${flag.label}${at}  ${flag.message}`)
  }
  out.push(`Run "${CLI_NAME} explain <note>" to see what a note means.`)
  return out.join('\n')
}
