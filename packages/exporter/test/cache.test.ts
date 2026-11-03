// M39: the Markdown export has a cache.md with tags, cached data, revalidation calls and their
// notes, and each page lists the cached data it renders with and what refreshes it. M40: with the
// cache events recorded from the app, what Next's cache did with each entry.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import { collectSnapshot, type ServerActionInfo } from '@flow-checker/server'
import type { CacheEvent, Capture } from '@flow-checker/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import { type ExportFiles, renderMarkdown } from '../src'
import { NOW, repo } from './helpers'

let files: ExportFiles
let live: ExportFiles

beforeAll(() => {
  const model = scanProject({ root: join(repo, 'fixtures', 'caching') })
  const snapshot = (
    captures: Capture[],
    cacheEvents: CacheEvent[],
    actions: Record<string, ServerActionInfo>,
  ) =>
    collectSnapshot({
      root: join(mkdtempSync(join(tmpdir(), 'fc-export-')), 'caching'),
      model,
      captures,
      cacheEvents,
      resolveAction: (id) => actions[id],
      toolVersion: '0.0.0-test',
      now: NOW,
    })
  files = renderMarkdown(snapshot([], [], {}))
  const recording = JSON.parse(
    readFileSync(join(repo, 'packages', 'server', 'test', 'recordings', 'caching.json'), 'utf8'),
  ) as { actions: Record<string, ServerActionInfo>; captures: Capture[]; cache: CacheEvent[] }
  live = renderMarkdown(snapshot(recording.captures, recording.cache, recording.actions))
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
      '[8 cached entries and 11 revalidation calls](cache.md), 5 notes to check.',
    )
  })

  it('has no runtime column without cache events', () => {
    expect(files['cache.md']).not.toContain('At runtime')
  })
})

describe('cache.md with live capture (M40)', () => {
  it("says what Next's cache did with each entry", () => {
    const doc = live['cache.md'] ?? ''
    expect(doc).toContain('| Cached | Kept | Tags | Used by | At runtime | Where |')
    expect(doc).toMatch(/\| use cache `listTodos` \|.*\| cached at runtime \(2 hits\) \|/)
    expect(doc).toMatch(
      /\| fetch `\{API_URL \?\? http:\/\/localhost:4010\}\/products\/featured` \|.*\| always missed \(2 misses\) \|/,
    )
  })

  it('lists the always-missed fetch to check, with the status it got', () => {
    const doc = live['cache.md'] ?? ''
    const toCheck = doc.slice(doc.indexOf('## To check'), doc.indexOf('## Tags'))
    expect(toCheck).toContain('## To check (6)')
    expect(toCheck).toContain('The request answered 404, and Next only keeps a `fetch` that answers 200.')
  })

  it('adds the runtime result to page docs', () => {
    expect(live['pages/users.md']).toContain(
      '- unstable_cache `getUsers`, kept 1m, tags `users`, cached at runtime (2 hits), `src/lib/users.js:10`',
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
