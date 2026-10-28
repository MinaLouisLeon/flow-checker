// Facts about the user's project that init and dev need: where the hooks go, which package
// manager and dev command to use, and whether capture data is gitignored.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

const LOCKFILES: [string, PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
]

/** From the nearest lockfile at or above the root (works inside monorepos). */
export function detectPackageManager(root: string): PackageManager {
  for (let dir = root; ; dir = dirname(dir)) {
    for (const [file, pm] of LOCKFILES) if (existsSync(join(dir, file))) return pm
    if (dirname(dir) === dir) return 'npm'
  }
}

export function readPackageJson(root: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<string, unknown>
  } catch {
    return undefined
  }
}

/** `pnpm run dev` when there is a `dev` script, otherwise `npx next dev`. */
export function defaultDevCommand(root: string): string {
  const scripts = readPackageJson(root)?.scripts as Record<string, string> | undefined
  const pm = detectPackageManager(root)
  if (scripts?.dev) return `${pm} run dev`
  return pm === 'npm' ? 'npx next dev' : `${pm} exec next dev`
}

/** Instrumentation files live next to the app directory: `src/` for `src/app`, else the root. */
export function hookDir(root: string, appDir: string): string {
  const rel = relative(root, appDir).replaceAll('\\', '/')
  return rel.startsWith('src/') ? join(root, 'src') : root
}

export const HOOK_EXTENSIONS = ['.ts', '.js', '.mjs', '.tsx', '.jsx']

/** Existing hook file, e.g. `src/instrumentation-client.ts`. */
export function findHook(
  dir: string,
  name: 'instrumentation' | 'instrumentation-client',
): string | undefined {
  return HOOK_EXTENSIONS.map((ext) => join(dir, `${name}${ext}`)).find((file) => existsSync(file))
}

export interface HookStatus {
  client: boolean
  server: boolean
}

/** Whether both hooks exist and load flow-checker. */
export function hookStatus(root: string, appDir: string): HookStatus {
  const dir = hookDir(root, appDir)
  const mentions = (file: string | undefined) =>
    Boolean(file && /flow-checker\/runtime\//.test(readFileSync(file, 'utf8')))
  return {
    client: mentions(findHook(dir, 'instrumentation-client')),
    server: mentions(findHook(dir, 'instrumentation')),
  }
}

/** Paths that hold live data and must stay out of git. */
export const GITIGNORE_ENTRIES = [
  '.flow-checker/captures/',
  '.flow-checker/sessions/',
  '.flow-checker/cache/',
]

/**
 * The entries missing from the project's .gitignore files (the root's and those of parent
 * folders up to the git repository root). Ignoring all of `.flow-checker/` counts too.
 */
export function missingGitignoreEntries(root: string): string[] {
  const lines = new Set<string>()
  for (let dir = root; ; dir = dirname(dir)) {
    const file = join(dir, '.gitignore')
    if (existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) lines.add(line.trim().replace(/^\//, ''))
    }
    if (existsSync(join(dir, '.git')) || dirname(dir) === dir) break
  }
  if (lines.has('.flow-checker') || lines.has('.flow-checker/') || lines.has('.flow-checker/*')) return []
  return GITIGNORE_ENTRIES.filter((entry) => !lines.has(entry) && !lines.has(entry.slice(0, -1)))
}

/** Appends the missing entries to `<root>/.gitignore`. Returns what was added. */
export function ensureGitignore(root: string): string[] {
  const missing = missingGitignoreEntries(root)
  if (missing.length === 0) return []
  const file = join(root, '.gitignore')
  const block = `# flow-checker: live capture data (may contain request bodies)\n${missing.join('\n')}\n`
  if (!existsSync(file)) writeFileSync(file, block)
  else {
    const text = readFileSync(file, 'utf8')
    appendFileSync(file, `${text.length === 0 || text.endsWith('\n') ? '' : '\n'}\n${block}`)
  }
  return missing
}

/** `major.minor` of the installed (or declared) Next.js version. */
export function nextVersion(root: string): { major: number; minor: number; text: string } | undefined {
  let text: string | undefined
  for (let dir = root; ; dir = dirname(dir)) {
    try {
      text = (
        JSON.parse(readFileSync(join(dir, 'node_modules', 'next', 'package.json'), 'utf8')) as {
          version: string
        }
      ).version
      break
    } catch {}
    if (dirname(dir) === dir) break
  }
  if (!text) {
    const pkg = readPackageJson(root)
    const deps = { ...(pkg?.devDependencies as object), ...(pkg?.dependencies as object) } as Record<
      string,
      string
    >
    text = deps.next
  }
  const match = text?.match(/(\d+)\.(\d+)/)
  return match && text ? { major: Number(match[1]), minor: Number(match[2]), text } : undefined
}
