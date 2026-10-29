// M10 "done when": the export of each fixture matches the golden files in test/golden/<fixture>/.
// Update them with `pnpm vitest run packages/exporter -u` and review the diff.
import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src'
import { FIXTURES, fixtureSnapshot } from './helpers'

const golden = join(import.meta.dirname, 'golden')

/** Running with `-u`: golden files are being rewritten, so stale ones are expected. */
function updating(): boolean {
  const state = expect.getState().snapshotState as unknown as { _updateSnapshot?: string } | undefined
  return state?._updateSnapshot === 'all'
}

function listFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => relative(dir, join(e.parentPath, e.name)).split('\\').join('/'))
      .sort()
  } catch {
    return []
  }
}

describe.each(FIXTURES)('Markdown export of %s', (fixture) => {
  const files = renderMarkdown(fixtureSnapshot(fixture))

  it('writes no more and no fewer files than the golden copy', () => {
    if (updating()) return
    expect(Object.keys(files).sort()).toEqual(listFiles(join(golden, fixture, 'md')))
  })

  it.each(Object.keys(files))('%s matches', async (file) => {
    await expect(files[file]).toMatchFileSnapshot(join(golden, fixture, 'md', file))
  })
})
