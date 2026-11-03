// Runtime cache check (M40): what Next's server cache did for each cached entry the scan found
// (M39), summed up from the cache events live capture matched to it, and the two runtime flags.
// Pure, so the tool server, the dashboard's live updates and the export agree.
import type { CacheEvent } from './capture'
import type { AppModel, CacheEntry, CacheFlag, CacheRuntime } from './model'

/** Flag kinds that come from live capture, not from the scan. */
export const RUNTIME_CACHE_FLAGS: ReadonlySet<CacheFlag['kind']> = new Set(['always-missed', 'never-cached'])

/** Times the same data must be missed (or the cache skipped) before it is flagged. */
export const CACHE_FLAG_AFTER = 2

/** A cache event as the check reads it, with the status of the request a miss sent, if any. */
export type CheckedCacheEvent = Pick<CacheEvent, 'status' | 'reason' | 'key' | 'at'> & {
  /** HTTP status of the request a `fetch` miss sent (from its capture). */
  responseStatus?: number
}

/**
 * Says nothing about the code: Next's dev-only copy kept across hot reloads, or a skip because the
 * browser asked for fresh data (a hard reload, or DevTools with the cache disabled).
 */
export function isNeutralCacheEvent(event: Pick<CacheEvent, 'status' | 'reason'>): boolean {
  return event.status === 'hmr' || (event.status === 'skip' && /hard refresh/i.test(event.reason ?? ''))
}

/** Counts and verdict for one entry's events; `undefined` when there are none. */
export function summarizeCacheEvents(events: readonly CheckedCacheEvent[]): CacheRuntime | undefined {
  if (events.length === 0) return undefined
  let hits = 0
  let misses = 0
  let skips = 0
  let lastAt = ''
  const keys = new Set<string>()
  const missedKeys = new Map<string, number>()
  const reasons = new Set<string>()
  for (const event of events) {
    if (event.at > lastAt) lastAt = event.at
    if (isNeutralCacheEvent(event)) continue
    keys.add(event.key)
    if (event.status === 'hit') hits++
    else if (event.status === 'miss') {
      misses++
      missedKeys.set(event.key, (missedKeys.get(event.key) ?? 0) + 1)
      // Next only keeps a fetch that answered 200.
      if (event.responseStatus !== undefined && event.responseStatus !== 200)
        reasons.add(`answered ${event.responseStatus}`)
    } else {
      skips++
      if (event.reason) reasons.add(event.reason)
    }
  }
  const verdict: CacheRuntime['verdict'] =
    hits > 0
      ? 'cached'
      : [...missedKeys.values()].some((n) => n >= CACHE_FLAG_AFTER)
        ? 'always-missed'
        : skips >= CACHE_FLAG_AFTER && misses === 0
          ? 'never-cached'
          : 'not-reused'
  return {
    hits,
    misses,
    skips,
    keys: keys.size,
    ...(reasons.size > 0 ? { reasons: [...reasons].sort() } : {}),
    lastAt,
    verdict,
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "3 hits · 1 miss · 2 skipped", or "no calls counted" when only neutral events came in. */
export function cacheRuntimeText(runtime: CacheRuntime): string {
  const parts = [
    runtime.hits > 0 && plural(runtime.hits, 'hit'),
    runtime.misses > 0 && plural(runtime.misses, 'miss', 'misses'),
    runtime.skips > 0 && `${runtime.skips} skipped`,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'no calls counted'
}

const quoted = (reasons: readonly string[]) => reasons.map((r) => `\`${r}\``).join(', ')

/** The runtime flag for an entry's verdict, if it has one. */
export function runtimeCacheFlag(entry: CacheEntry, runtime: CacheRuntime): CacheFlag | undefined {
  const reasons = runtime.reasons ?? []
  if (runtime.verdict === 'always-missed') {
    const answered = reasons.filter((r) => r.startsWith('answered '))
    const what = entry.kind === 'fetch' ? 'the same URL' : 'the same arguments'
    const why =
      answered.length > 0
        ? ` The request ${answered.join(' and ')}, and Next only keeps a \`fetch\` that answers 200.`
        : entry.kind === 'fetch'
          ? ' Check that it answers 200 (Next keeps nothing else) and that its options allow caching.'
          : ' Check that it returns without throwing and that nothing it reads changes each time.'
    return {
      kind: 'always-missed',
      message: `Expected cached, but Next missed its cache every time ${what} was asked for again (${plural(runtime.misses, 'miss', 'misses')}, no hit).${why}`,
    }
  }
  if (runtime.verdict === 'never-cached') {
    return {
      kind: 'never-cached',
      message: `Expected cached, but Next skipped its cache every time (${runtime.skips} calls)${reasons.length > 0 ? `: ${quoted(reasons)}` : ''}.`,
    }
  }
  return undefined
}

/**
 * The model with each entry's runtime results and flags. Entries without results lose any older
 * runtime data. Returns the same model when nothing changed.
 */
export function applyCacheRuntime(model: AppModel, checks: Readonly<Record<string, CacheRuntime>>): AppModel {
  const cache = model.cache
  if (!cache) return model
  let changed = false
  const entries = cache.entries.map((entry) => {
    const runtime = checks[entry.id]
    const flags = entry.flags.filter((f) => !RUNTIME_CACHE_FLAGS.has(f.kind))
    const flag = runtime && runtimeCacheFlag(entry, runtime)
    if (flag) flags.push(flag)
    if (
      JSON.stringify(runtime) === JSON.stringify(entry.runtime) &&
      JSON.stringify(flags) === JSON.stringify(entry.flags)
    ) {
      return entry
    }
    changed = true
    const { runtime: _, ...rest } = entry
    return runtime ? { ...rest, flags, runtime } : { ...rest, flags }
  })
  return changed ? { ...model, cache: { ...cache, entries } } : model
}
