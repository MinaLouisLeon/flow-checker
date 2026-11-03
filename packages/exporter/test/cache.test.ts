// M39: the Markdown export has a cache.md with tags, cached data, revalidation calls and their
// notes, and each page lists the cached data it renders with and what refreshes it.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import { collectSnapshot } from '@flow-checker/server'
import { beforeAll, describe, expect, it } from 'vitest'
import { type ExportFiles, renderMarkdown } from '../src'
import { NOW, repo } from './helpers'

let files: ExportFiles

beforeAll(() => {
  const model = scanProject({ root: join(repo, 'fixtures', 'caching') })
  const data = collectSnapshot({
    root: join(mkdtempSync(join(tmpdir(), 'fc-export-')), 'caching'),
    model,
    captures: [],
    resolveAction: () => undefined,
    toolVersion: '0.0.0-test',
    now: NOW,
  })
  files = renderMarkdown(data)
}, 60_000)

describe('cache.md', () => {
  it('lists each note to check', () => {
    const doc = files['cache.md'] ?? ''
    const toCheck = doc.slice(doc.indexOf('## To check'), doc.indexOf('## Tags'))
    expect(toCheck).toContain('## To check (5)')
    expect(toCheck).toContain("`revalidateTag('user', 'max')`")
    expect(toCheck).toContain("`revalidatePath('/user')`")
    expect(toCheck).toContain("`updateTag('todos')`")
    expect(toCheck).toContain('use cache `getSettings`')
    expect(toCheck).toContain('fetch `{API_URL ?? http://localhost:4010}/todos`')
  })

  it('links tags to what sets and revalidates them', () => {
    const doc = files['cache.md'] ?? ''
    expect(doc).toContain(
      '| `users` | unstable_cache `getUsers` | `revalidateTag` in server action `refreshUsers` |',
    )
    expect(doc).toContain('| `user` | nothing | `revalidateTag` in server action `refreshUsers` |')
    expect(doc).toContain('| `settings` | use cache `getSettings` | nothing |')
  })

  it('is linked from the README', () => {
    expect(files['README.md']).toContain(
      '[7 cached entries and 11 revalidation calls](cache.md), 5 notes to check.',
    )
  })
})

describe('page docs', () => {
  it('list the cached data and what refreshes the page', () => {
    const page = files['pages/users.md'] ?? ''
    expect(page).toContain('## Server cache')
    expect(page).toContain('- unstable_cache `getUsers`, kept 1m, tags `users`, `src/lib/users.js:10`')
    expect(page).toContain('- use cache `SiteHeader`, kept 15m (default), tags `nav`')
    expect(page).toContain("- `revalidateTag('users', 'max')` in server action `refreshUsers`")
  })
})
