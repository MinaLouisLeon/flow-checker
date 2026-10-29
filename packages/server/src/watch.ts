// Watches the project's source files for the incremental re-scan (M9, docs/PLAN.md 6.7).
// Bursts of events (a save that writes several files, a branch switch) arrive as one batch.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { watch } from 'chokidar'

/** Absolute paths, grouped like the scanner's `FileChanges`. */
export interface WatchBatch {
  changed: string[]
  added: string[]
  removed: string[]
}

export interface WatchOptions {
  root: string
  onChange: (batch: WatchBatch) => void
  /** Wait this long after the last event before reporting. Default: 40 ms. */
  debounceMs?: number
}

export interface ProjectWatcher {
  close: () => Promise<void>
}

/** Never looked into: dependencies, build output, version control and our own files. */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.flow-checker',
  '.turbo',
  '.vercel',
  'out',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
])

const WATCHED_FILE = /\.(tsx?|jsx?|mts|cts|mjs|cjs)$|(^|[\\/])(tsconfig\.json|jsconfig\.json|package\.json)$/

/** Whether a path matters for the scan. Directories count unless they are ignored. */
export function isWatched(root: string, path: string, isFile: boolean | undefined): boolean {
  const rel = relative(root, path)
  if (rel === '') return true
  const parts = rel.split(/[\\/]/)
  if (parts.some((part) => IGNORED_DIRS.has(part))) return false
  if (isFile === false) return true
  // Unknown kind (e.g. a removal): keep source-looking paths and anything without an extension.
  if (isFile === undefined && !/\.[^\\/]+$/.test(rel)) return true
  return WATCHED_FILE.test(rel) && !rel.endsWith('.d.ts')
}

/** Starts watching. Resolves once the initial walk is done, so later edits are seen. */
export function watchProject(options: WatchOptions): Promise<ProjectWatcher> {
  const { root } = options
  const debounceMs = options.debounceMs ?? 40
  const pending = new Map<string, 'add' | 'change' | 'unlink'>()
  // Content hash of each file as last reported. Some file systems (macOS FSEvents) send a second
  // `change` for a file that was just added or saved, after its batch went out; a change whose
  // content is the same as last reported can't change the scan, so it is dropped.
  const reported = new Map<string, string>()
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    timer = undefined
    const batch: WatchBatch = { changed: [], added: [], removed: [] }
    for (const [path, kind] of pending) {
      if (!existsSync(path)) {
        reported.delete(path)
        batch.removed.push(path)
        continue
      }
      const hash = contentHash(path)
      if (kind === 'change' && hash !== undefined && reported.get(path) === hash) continue
      if (hash === undefined) reported.delete(path)
      else reported.set(path, hash)
      if (kind === 'add') batch.added.push(path)
      else batch.changed.push(path)
    }
    pending.clear()
    if (batch.changed.length + batch.added.length + batch.removed.length > 0) options.onChange(batch)
  }
  const queue = (kind: 'add' | 'change' | 'unlink', path: string) => {
    // A file added and changed in the same burst is still new.
    const previous = pending.get(path)
    pending.set(path, previous === 'add' && kind === 'change' ? 'add' : kind)
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, debounceMs)
  }

  const watcher = watch(root, {
    ignoreInitial: true,
    ignored: (path, stats) => !isWatched(root, path, stats ? stats.isFile() : undefined),
  })
  watcher.on('add', (path) => queue('add', path))
  watcher.on('change', (path) => queue('change', path))
  watcher.on('unlink', (path) => queue('unlink', path))
  watcher.on('unlinkDir', (path) => queue('unlink', path))
  // Watching is best effort: a failure (e.g. too many files) must not stop the tool.
  watcher.on('error', () => {})

  return new Promise((resolve) => {
    watcher.once('ready', () =>
      resolve({
        close: async () => {
          if (timer) clearTimeout(timer)
          pending.clear()
          reported.clear()
          await watcher.close()
        },
      }),
    )
  })
}

/** SHA-1 of a file's content, or undefined when it can't be read (a directory, a race). */
function contentHash(path: string): string | undefined {
  try {
    return createHash('sha1').update(readFileSync(path)).digest('hex')
  } catch {
    return undefined
  }
}
