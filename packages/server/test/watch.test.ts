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
  it('reports added, changed and removed source files in one batch', async () => {
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
    try {
      const next = () => new Promise<void>((resolve) => (notify = resolve))
      const got = next()
      writeFileSync(join(root, 'app', 'page.tsx'), 'export default function Page() { return <main /> }\n')
      writeFileSync(join(root, 'app', 'new.ts'), 'export const fresh = 1\n')
      unlinkSync(join(root, 'app', 'old.ts'))
      writeFileSync(join(root, 'node_modules', 'pkg', 'index.js'), 'module.exports = 1\n')
      writeFileSync(join(root, 'notes.md'), '# not code\n')
      await got
      // Late events from the same burst may arrive in a second batch.
      await new Promise((resolve) => setTimeout(resolve, 200))

      const all = { changed: new Set<string>(), added: new Set<string>(), removed: new Set<string>() }
      for (const batch of batches) {
        for (const kind of ['changed', 'added', 'removed'] as const) {
          for (const path of batch[kind]) all[kind].add(path.replaceAll('\\', '/').slice(root.length + 1))
        }
      }
      expect([...all.changed]).toEqual(['app/page.tsx'])
      expect([...all.added]).toEqual(['app/new.ts'])
      expect([...all.removed]).toEqual(['app/old.ts'])
    } finally {
      await watcher.close()
    }
  })
})
