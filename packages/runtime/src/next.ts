// `withFlowChecker()` for next.config (docs/PLAN.md 7.1): makes the capture hooks work on
// Next.js 13.4–15.2, which have no `instrumentation-client` file.
//
// - Before 15.0, `instrumentation.ts` only runs with `experimental.instrumentationHook`.
// - Before 15.3, the browser hook is added to the webpack client entry (`main-app`), so the
//   same `instrumentation-client.ts` that `flow-checker init` writes runs on every version.
//
// It changes nothing unless the app was started by flow-checker (FLOW_CHECKER=1), so production
// builds are untouched. Turbopack ignores webpack config: on Next before 15.3, browser capture
// needs webpack (`next dev` without `--turbo`).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const HOOK_NAME = 'instrumentation-client'
const HOOK_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs']
/** Webpack entry of the App Router's client bundle. */
const APP_ENTRY = 'main-app'

export interface NextVersion {
  major: number
  minor: number
}

export interface WithFlowCheckerOptions {
  /** Project root. Default: the current directory (where `next dev` runs). */
  root?: string
  /** Next.js version. Default: read from the installed `next` package. */
  nextVersion?: NextVersion | string
}

// Next's config types differ between versions, so this stays structural.
// biome-ignore lint/suspicious/noExplicitAny: next.config is untyped across versions
type AnyConfig = Record<string, any>
// biome-ignore lint/suspicious/noExplicitAny: next.config may be a function of (phase, context)
type ConfigInput<C> = C | ((...args: any[]) => C | Promise<C>)

/**
 * Wraps your Next.js config so flow-checker's capture hooks also work on Next.js 13.4–15.2.
 * On 15.3 and later it returns the config unchanged, so it is safe to keep when you upgrade.
 *
 * ```js
 * // next.config.mjs
 * import { withFlowChecker } from '@integr8/flow-checker/next'
 * export default withFlowChecker({ reactStrictMode: true })
 * ```
 */
export function withFlowChecker<C extends AnyConfig>(
  config: ConfigInput<C> = {} as C,
  options: WithFlowCheckerOptions = {},
): ConfigInput<C> {
  if (process.env.FLOW_CHECKER !== '1') return config
  if (typeof config === 'function') {
    // biome-ignore lint/suspicious/noExplicitAny: forwarded as-is
    return async (...args: any[]) => applyFlowChecker(await config(...args), options)
  }
  return applyFlowChecker(config, options)
}

/** The config with the hooks wired in for the given Next.js version. Exported for tests. */
export function applyFlowChecker<C extends AnyConfig>(config: C, options: WithFlowCheckerOptions = {}): C {
  try {
    const root = options.root ?? process.cwd()
    const version =
      typeof options.nextVersion === 'string'
        ? parseVersion(options.nextVersion)
        : (options.nextVersion ?? installedNextVersion(root))
    if (!version) return config
    if (atLeast(version, 15, 3)) return config

    const next: AnyConfig = { ...config }
    if (version.major < 15) {
      next.experimental = { ...config.experimental, instrumentationHook: true }
    }

    const hook = findClientHook(root)
    if (!hook) return next as C
    const userWebpack = config.webpack
    // biome-ignore lint/suspicious/noExplicitAny: webpack config and context come from Next
    next.webpack = (webpackConfig: any, context: any) => {
      const result = typeof userWebpack === 'function' ? userWebpack(webpackConfig, context) : webpackConfig
      if (context?.isServer || !context?.dev) return result
      const entry = result.entry
      result.entry = async () => prependEntry(typeof entry === 'function' ? await entry() : entry, hook)
      return result
    }
    return next as C
  } catch {
    // Capture must never break the app's config.
    return config
  }
}

/** Adds the hook file in front of the App Router client entry. */
// biome-ignore lint/suspicious/noExplicitAny: webpack entry objects
export function prependEntry(entries: any, file: string): any {
  if (!entries || typeof entries !== 'object') return entries
  const current = entries[APP_ENTRY]
  if (current === undefined) return entries
  const add = (list: string[]) => (list.includes(file) ? list : [file, ...list])
  if (typeof current === 'string') entries[APP_ENTRY] = add([current])
  else if (Array.isArray(current)) entries[APP_ENTRY] = add(current)
  else if (current && typeof current === 'object' && current.import !== undefined) {
    const imports = Array.isArray(current.import) ? current.import : [current.import]
    entries[APP_ENTRY] = { ...current, import: add(imports) }
  }
  return entries
}

/** `src/instrumentation-client.*` or `instrumentation-client.*`, like Next 15.3+ looks for it. */
export function findClientHook(root: string): string | undefined {
  for (const dir of [join(root, 'src'), root]) {
    for (const ext of HOOK_EXTENSIONS) {
      const file = join(dir, `${HOOK_NAME}${ext}`)
      if (existsSync(file)) return file
    }
  }
  return undefined
}

export function parseVersion(text: string): NextVersion | undefined {
  const match = text.match(/(\d+)\.(\d+)/)
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : undefined
}

function atLeast(version: NextVersion, major: number, minor: number): boolean {
  return version.major > major || (version.major === major && version.minor >= minor)
}

/** The `next` package found from the project root, walking up (monorepos hoist it). */
function installedNextVersion(root: string): NextVersion | undefined {
  for (let dir = root; ; ) {
    const file = join(dir, 'node_modules', 'next', 'package.json')
    if (existsSync(file)) {
      try {
        return parseVersion((JSON.parse(readFileSync(file, 'utf8')) as { version: string }).version)
      } catch {
        return undefined
      }
    }
    const parent = join(dir, '..')
    if (parent === dir) return undefined
    dir = parent
  }
}
