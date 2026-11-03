// M40: what Next's server cache did per entry, from the runtime's cache events: counts, verdicts,
// the two runtime flags, and how they go on the served model.
import { describe, expect, it } from 'vitest'
import {
  type AppModel,
  applyCacheRuntime,
  applyVerification,
  type CacheEntry,
  type CheckedCacheEvent,
  cacheRuntimeText,
  isNeutralCacheEvent,
  summarizeCacheEvents,
} from '../src'

let n = 0
const event = (status: CheckedCacheEvent['status'], key = 'k1', extra: Partial<CheckedCacheEvent> = {}) => ({
  status,
  key,
  at: `2026-11-03T10:00:${String(n++ % 60).padStart(2, '0')}.000Z`,
  ...extra,
})

const entry = (over: Partial<CacheEntry> = {}): CacheEntry => ({
  id: 'ce_1',
  kind: 'fetch',
  name: '{API_URL}/featured',
  tags: [],
  siteIds: [],
  pageIds: [],
  handlerIds: [],
  flags: [{ kind: 'tag-never-revalidated', message: 'from the scan' }],
  loc: { file: 'src/lib/featured.ts', line: 3, column: 21 },
  ...over,
})

const model = (entries: CacheEntry[]): AppModel =>
  ({ cache: { entries, invalidations: [] }, requests: [] }) as unknown as AppModel

describe('summarizeCacheEvents', () => {
  it('has no result without events', () => {
    expect(summarizeCacheEvents([])).toBeUndefined()
  })

  it('is cached after one hit', () => {
    expect(summarizeCacheEvents([event('miss'), event('hit')])).toMatchObject({
      hits: 1,
      misses: 1,
      skips: 0,
      keys: 1,
      verdict: 'cached',
    })
  })

  it('is always missed when the same data missed twice and never hit', () => {
    const runtime = summarizeCacheEvents([
      event('miss', 'a', { responseStatus: 404 }),
      event('miss', 'a', { responseStatus: 404 }),
    ])
    expect(runtime).toMatchObject({ verdict: 'always-missed', misses: 2, reasons: ['answered 404'] })
  })

  it('is not reused yet when every value was asked for once (getTodo(1), getTodo(2))', () => {
    expect(summarizeCacheEvents([event('miss', 'a'), event('miss', 'b')])).toMatchObject({
      verdict: 'not-reused',
      keys: 2,
    })
  })

  it("is never cached when Next skipped it every time, with Next's reasons", () => {
    expect(
      summarizeCacheEvents([
        event('skip', 'a', { reason: 'auto no cache' }),
        event('skip', 'b', { reason: 'auto no cache' }),
      ]),
    ).toMatchObject({ verdict: 'never-cached', skips: 2, reasons: ['auto no cache'] })
    // One skip proves nothing yet.
    expect(summarizeCacheEvents([event('skip', 'a', { reason: 'auto no cache' })])?.verdict).toBe(
      'not-reused',
    )
  })

  it('leaves out hard reloads and hot reload copies', () => {
    const hard = { reason: 'cache-control: no-cache (hard refresh)' }
    expect(isNeutralCacheEvent({ status: 'skip', ...hard })).toBe(true)
    expect(isNeutralCacheEvent({ status: 'hmr' })).toBe(true)
    expect(isNeutralCacheEvent({ status: 'skip', reason: 'auto no cache' })).toBe(false)
    const runtime = summarizeCacheEvents([event('skip', 'a', hard), event('skip', 'a', hard), event('hmr')])
    expect(runtime).toMatchObject({ hits: 0, misses: 0, skips: 0, keys: 0, verdict: 'not-reused' })
    expect(runtime?.lastAt).toBeTruthy()
  })
})

describe('cacheRuntimeText', () => {
  it('lists what happened', () => {
    const base = { keys: 1, lastAt: '', verdict: 'cached' as const }
    expect(cacheRuntimeText({ ...base, hits: 3, misses: 1, skips: 0 })).toBe('3 hits · 1 miss')
    expect(cacheRuntimeText({ ...base, hits: 1, misses: 2, skips: 2 })).toBe('1 hit · 2 misses · 2 skipped')
    expect(cacheRuntimeText({ ...base, hits: 0, misses: 0, skips: 0 })).toBe('no calls counted')
  })
})

describe('applyCacheRuntime', () => {
  const missed = summarizeCacheEvents([
    event('miss', 'a', { responseStatus: 404 }),
    event('miss', 'a', { responseStatus: 404 }),
  ])
  if (!missed) throw new Error('expected a result')

  it('adds the result and a flag that says why, keeping the scan flags', () => {
    const served = applyCacheRuntime(model([entry()]), { ce_1: missed })
    const [e] = served.cache?.entries ?? []
    expect(e?.runtime).toEqual(missed)
    expect(e?.flags.map((f) => f.kind)).toEqual(['tag-never-revalidated', 'always-missed'])
    expect(e?.flags[1]?.message).toBe(
      'Expected cached, but Next missed its cache every time the same URL was asked for again (2 misses, no hit). The request answered 404, and Next only keeps a `fetch` that answers 200.',
    )
  })

  it('words a never-cached function with the reasons', () => {
    const skipped = summarizeCacheEvents([
      event('skip', 'a', { reason: 'fetchCache = force-no-store' }),
      event('skip', 'a', { reason: 'fetchCache = force-no-store' }),
    ])
    if (!skipped) throw new Error('expected a result')
    const served = applyCacheRuntime(model([entry({ kind: 'unstable-cache', flags: [] })]), { ce_1: skipped })
    expect(served.cache?.entries[0]?.flags).toEqual([
      {
        kind: 'never-cached',
        message:
          'Expected cached, but Next skipped its cache every time (2 calls): `fetchCache = force-no-store`.',
      },
    ])
  })

  it('is safe to apply again, and drops results that are gone', () => {
    const once = applyCacheRuntime(model([entry()]), { ce_1: missed })
    expect(applyCacheRuntime(once, { ce_1: missed })).toBe(once)
    const cleared = applyCacheRuntime(once, {})
    expect(cleared.cache?.entries[0]?.runtime).toBeUndefined()
    expect(cleared.cache?.entries[0]?.flags.map((f) => f.kind)).toEqual(['tag-never-revalidated'])
  })

  it('returns the same model when there is nothing to apply', () => {
    const plain = model([entry()])
    expect(applyCacheRuntime(plain, {})).toBe(plain)
    const none = { requests: [] } as unknown as AppModel
    expect(applyCacheRuntime(none, { ce_1: missed })).toBe(none)
  })

  it('runs as part of applyVerification', () => {
    const served = applyVerification(model([entry()]), { sites: {}, cache: { ce_1: missed } })
    expect(served.cache?.entries[0]?.runtime?.verdict).toBe('always-missed')
  })
})
