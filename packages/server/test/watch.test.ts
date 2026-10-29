// M9: the file watcher reports source changes in batches and ignores build output and packages.
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { isWatched, type WatchBatch, watchProject } from '../src'

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

describe('watchProject', () => {
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
      writeFileSync(join(root, 'app', 'page.tsx'), 'export default function Page() { return <main /> }\n')
      writeFileSync(join(root, 'app', 'new.ts'), 'export const fresh = 1\n')
      unlinkSync(join(root, 'app', 'old.ts'))
      writeFileSync(join(root, 'node_modules', 'pkg', 'index.js'), 'module.exports = 1\n')
      writeFileSync(join(root, 'notes.md'), '# not code\n')
      // Events can be slow on a busy machine: wait for the three expected ones, then a little
      // longer to catch anything that should have been ignored.
      const deadline = Date.now() + 5000
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
})
