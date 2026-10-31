// M9: the file watcher reports source changes in batches and ignores build output and packages.
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { isWatched, type WatchBatch, watchProject } from '../src'
import { seedRecentFiles } from '../src/watch'

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

describe('isWatched', () => {
  const root = join(tmpdir(), 'project')
  it.each([
    ['app/page.tsx', true, true],
    ['lib/api.ts', true, true],
    ['tsconfig.json', true, true],
    ['next.config.mjs', true, true],
    ['types/global.d.ts', true, false],
    ['README.md', true, false],
    ['app/styles.css', true, false],
    ['node_modules/next/index.js', true, false],
    ['.next/server/app.js', true, false],
    ['.flow-checker/model.json', true, false],
    ['app/users', false, true],
    ['node_modules', false, false],
  ])('%s', (rel, isFile, expected) => {
    expect(isWatched(root, join(root, rel), isFile)).toBe(expected)
  })
})

describe('seedRecentFiles', () => {
  it('counts a file written earlier in the start millisecond as written before the start', async () => {
    const root = mkdtempSync(join(tmpdir(), 'flow-checker-seed-'))
    dirs.push(root)
    const startedAt = Math.floor(Date.now() / 1000) * 1000 - 5_000
    const at = (ms: number) => new Date(ms)
    for (const [name, mtime] of [
      ['same-ms.ts', startedAt + 0.4],
      ['before.ts', startedAt - 2_000],
      ['after.ts', startedAt + 1],
      ['old.ts', startedAt - 60_000],
    ] as const) {
      writeFileSync(join(root, name), `export const x = '${name}'\n`)
      utimesSync(join(root, name), at(mtime), at(mtime))
    }
    const reported = new Map<string, string>()
    await seedRecentFiles({ [root]: ['same-ms.ts', 'before.ts', 'after.ts', 'old.ts'] }, startedAt, reported)
    expect([...reported.keys()].map((p) => p.slice(root.length + 1)).sort()).toEqual([
      'before.ts',
      'same-ms.ts',
    ])
  })
})

// The tests wait up to 10 s for file events (slow on busy CI runners, macOS especially), so they need
// more than vitest's default 5 s timeout.
describe('watchProject', { timeout: 20_000 }, () => {
  it('reports added, changed and removed source files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'flow-checker-watcher-'))
    dirs.push(root)
    mkdirSync(join(root, 'app'))
    mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true })
    writeFileSync(join(root, 'app', 'page.tsx'), 'export default function Page() { return null }\n')
    writeFileSync(join(root, 'app', 'old.ts'), 'export const old = 1\n')

    const batches: WatchBatch[] = []
    let notify: () => void = () => {}
    const watcher = await watchProject({
      root,
      onChange: (batch) => {
        batches.push(batch)
        notify()
      },
    })
    const all = { changed: new Set<string>(), added: new Set<string>(), removed: new Set<string>() }
    const collect = () => {
      for (const batch of batches.splice(0)) {
        for (const kind of ['changed', 'added', 'removed'] as const) {
          for (const path of batch[kind]) all[kind].add(path.replaceAll('\\', '/').slice(root.length + 1))
        }
      }
      return all.changed.size + all.added.size + all.removed.size
    }
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    try {
      // Give macOS FSEvents time to deliver late events for the setup writes above; the watcher must
      // not report those as edits.
      await sleep(200)
      writeFileSync(join(root, 'app', 'page.tsx'), 'export default function Page() { return <main /> }\n')
      writeFileSync(join(root, 'app', 'new.ts'), 'export const fresh = 1\n')
      unlinkSync(join(root, 'app', 'old.ts'))
      writeFileSync(join(root, 'node_modules', 'pkg', 'index.js'), 'module.exports = 1\n')
      writeFileSync(join(root, 'notes.md'), '# not code\n')
      // Events can be slow on a busy machine: wait for the three expected ones, then a little
      // longer to catch anything that should have been ignored.
      const deadline = Date.now() + 10_000
      while (collect() < 3 && Date.now() < deadline) {
        await new Promise<void>((resolve) => {
          notify = resolve
          setTimeout(resolve, 100)
        })
      }
      await sleep(300)
      collect()

      expect([...all.changed]).toEqual(['app/page.tsx'])
      expect([...all.added]).toEqual(['app/new.ts'])
      expect([...all.removed]).toEqual(['app/old.ts'])
    } finally {
      await watcher.close()
    }
  })

  it('drops a change that leaves the content as it was last reported', async () => {
    const root = mkdtempSync(join(tmpdir(), 'flow-checker-watcher-'))
    dirs.push(root)
    mkdirSync(join(root, 'app'))
    const file = join(root, 'app', 'page.tsx')
    writeFileSync(file, 'export default function Page() { return null }\n')

    const batches: WatchBatch[] = []
    const watcher = await watchProject({ root, onChange: (batch) => batches.push(batch) })
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    const reportedPaths = () => batches.flatMap((b) => [...b.changed, ...b.added])
    const waitForBatch = async () => {
      const deadline = Date.now() + 10_000
      while (batches.length === 0 && Date.now() < deadline) await sleep(50)
    }
    try {
      await sleep(200)
      // A real edit is reported.
      writeFileSync(file, 'export default function Page() { return <main /> }\n')
      await waitForBatch()
      expect(reportedPaths()).toHaveLength(1)

      // Saving the same content again (or a late duplicate event, as macOS sends) is not.
      batches.length = 0
      writeFileSync(file, 'export default function Page() { return <main /> }\n')
      await sleep(600)
      expect(batches).toEqual([])

      // The next real edit is reported again.
      writeFileSync(file, 'export default function Page() { return <section /> }\n')
      await waitForBatch()
      expect(reportedPaths().map((p) => p.replaceAll('\\', '/').slice(root.length + 1))).toEqual([
        'app/page.tsx',
      ])
    } finally {
      await watcher.close()
    }
  })
})
