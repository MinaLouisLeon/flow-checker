// M40: server cache events recorded from the caching fixtures (Next 16 with Cache Components, and
// Next 15) are matched to the scan's cache entries, and the planted mismatch is flagged: a cached
// `fetch` the mock API answers with 404, which Next never keeps.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import {
  type AppModel,
  applyVerification,
  type CacheEntry,
  type CacheEvent,
  type Capture,
  cacheOf,
} from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import type { ServerActionInfo } from '../src/actions'
import { checkCache, createCacheMatcher } from '../src/cache-check'
import { CaptureStore } from '../src/store'
import { Verifier } from '../src/verify'

const repo = join(import.meta.dirname, '..', '..', '..')

interface Recording {
  actions: Record<string, ServerActionInfo>
  captures: Capture[]
  cache: CacheEvent[]
}

function load(fixture: string): { model: AppModel; recording: Recording } {
  const recording = JSON.parse(
    readFileSync(join(import.meta.dirname, 'recordings', `${fixture}.json`), 'utf8'),
  ) as Recording
  return { model: scanProject({ root: join(repo, 'fixtures', fixture) }), recording }
}

function sources(recording: Recording) {
  return {
    resolveAction: (id: string) => recording.actions[id],
    capture: (id: string) => recording.captures.find((c) => c.id === id),
  }
}

/** `kind name` -> `verdict hits/misses/skips`, for every entry the events reached. */
function results(fixture: string): Record<string, string> {
  const { model, recording } = load(fixture)
  const checks = checkCache(model, recording.cache, sources(recording))
  const out: Record<string, string> = {}
  for (const entry of cacheOf(model).entries) {
    const r = checks[entry.id]
    if (r) out[`${entry.kind} ${entry.name}`] = `${r.verdict} ${r.hits}/${r.misses}/${r.skips}`
  }
  return out
}

describe('runtime cache check (M40)', () => {
  it('matches every recorded event of the Next 16 fixture and flags the 404 fetch', () => {
    const { model, recording } = load('caching')
    const match = createCacheMatcher(model, sources(recording))
    expect(recording.cache.filter((e) => !match(e))).toEqual([])

    const api = '{API_URL ?? http://localhost:4010}'
    expect(results('caching')).toEqual({
      // In the `/api/featured` route handler: the planted 404.
      [`fetch ${api}/products/featured`]: 'always-missed 0/2/0',
      [`fetch ${api}/todos`]: 'cached 1/1/0',
      'use-cache SiteHeader': 'cached 10/0/0',
      [`fetch ${api}/products`]: 'cached 2/0/0',
      'use-cache getSettings': 'cached 1/1/0',
      'use-cache listTodos': 'cached 2/0/0',
      'use-cache getTodo': 'cached 1/1/0',
      'unstable-cache getUsers': 'cached 2/0/0',
    })
  })

  it('matches every recorded event of the Next 15 fixture, and finds a tagged fetch Next never caches', () => {
    const { model, recording } = load('caching-15')
    const match = createCacheMatcher(model, sources(recording))
    expect(recording.cache.filter((e) => !match(e))).toEqual([])

    const api = '{API_URL ?? http://localhost:4010}'
    expect(results('caching-15')).toEqual({
      'unstable-cache listProducts': 'cached 2/0/0',
      [`fetch ${api}/products/featured`]: 'always-missed 0/2/0',
      [`fetch ${api}/todos`]: 'cached 3/0/0',
      // Tags but no `cache` option: Next 15 skips the cache on a page rendered per request.
      [`fetch ${api}/todos/:id`]: 'never-cached 0/0/2',
      'unstable-cache getViewer': 'cached 2/0/0',
    })
  })

  it('puts the results and flags on the served model, explaining the 404', () => {
    const { model, recording } = load('caching')
    const checks = checkCache(model, recording.cache, sources(recording))
    const served = applyVerification(model, { sites: {}, cache: checks })
    const featured = cacheOf(served).entries.find((e) => e.name.endsWith('/products/featured')) as CacheEntry
    expect(featured.runtime).toMatchObject({ verdict: 'always-missed', reasons: ['answered 404'] })
    expect(featured.flags).toEqual([
      {
        kind: 'always-missed',
        message: expect.stringContaining(
          'The request answered 404, and Next only keeps a `fetch` that answers 200.',
        ),
      },
    ])
    // The scan's own flags stay; only runtime flags are added.
    const stats = cacheOf(served).entries.find((e) => e.name.endsWith('/todos')) as CacheEntry
    expect(stats.flags.map((f) => f.kind)).toEqual(['tag-never-revalidated'])
  })

  it('reads each use cache function from the manifest, even with several in one file', () => {
    const { model, recording } = load('caching')
    const match = createCacheMatcher(model, sources(recording))
    const todo = recording.cache.find((e) => e.tags?.includes('todo-1')) as CacheEvent
    expect(match(todo)?.name).toBe('getTodo')
    // Without tags, Next's numbering in the file decides: `$$RSC_SERVER_CACHE_1` is the second one.
    expect(match({ ...todo, tags: undefined })?.name).toBe('getTodo')
    const list = recording.cache.find(
      (e) => e.tags?.includes('todos') && e.kind === 'use-cache',
    ) as CacheEvent
    expect(match({ ...list, tags: undefined })?.name).toBe('listTodos')
  })

  it("matches a fetch by its URL when the stack can't place it (webpack's bundled lines)", () => {
    const { model, recording } = load('caching-15')
    const match = createCacheMatcher(model, sources(recording))
    const hit = recording.cache.find((e) => e.kind === 'fetch' && e.url?.endsWith('/todos')) as CacheEvent
    expect(match({ ...hit, sourceStack: [] })?.name).toBe('{API_URL ?? http://localhost:4010}/todos')
  })

  it('serves the results through the verifier, live and after a re-scan', () => {
    const { model, recording } = load('caching')
    const store = new CaptureStore({ root: join(repo, 'fixtures', 'caching'), readOnly: true })
    for (const capture of recording.captures) store.add(capture)
    const verifier = new Verifier({
      root: join(repo, 'fixtures', 'caching'),
      model,
      store,
      readOnly: true,
      resolveAction: (id) => recording.actions[id],
    })
    expect(verifier.summary().cache).toBeUndefined()
    // No `.next` source maps here, so frames don't resolve: the matching falls back to the URL.
    verifier.ingestCache(recording.cache)
    expect(Object.keys(verifier.summary().cache ?? {})).toHaveLength(8)
    verifier.setModel(model)
    const flagged = cacheOf(verifier.servedModel()).entries.filter((e) =>
      e.flags.some((f) => f.kind === 'always-missed'),
    )
    expect(flagged.map((e) => e.name)).toEqual(['{API_URL ?? http://localhost:4010}/products/featured'])
    expect(Object.keys(verifier.summary().cache ?? {})).toHaveLength(8)
  })
})
