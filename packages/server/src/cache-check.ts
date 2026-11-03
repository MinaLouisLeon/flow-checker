// Runtime cache check (M40): finds the cache entry the scan made (M39) for each server cache event
// the runtime sent, and sums the events up per entry.
//
// - fetch: the event's innermost project frame is the `fetch` call, which is where the scan puts
//   a fetch entry. A miss also sent a request: its capture's site is the entry's site. Last, the
//   method and URL against the entry's sites (webpack's dev frames have the bundled lines).
// - use cache: the function id resolves through Next's server reference manifest to its file
//   (and `$$RSC_SERVER_CACHE_<n>`, the n-th cached function in it). Tags pick between several.
// - unstable_cache: Next only knows the wrapped function's name, then the tags.
import {
  type AppModel,
  type CacheEntry,
  type CacheEvent,
  type CacheKey,
  type CacheRuntime,
  type Capture,
  type CheckedCacheEvent,
  cacheOf,
  matchedSiteIds,
  matchRequestUrl,
  type RequestSite,
  summarizeCacheEvents,
  tagsMatch,
} from '@flow-checker/shared'
import { type ServerActionInfo, sameSourceFile } from './actions'

const CACHE_FUNCTION = /^\$\$RSC_SERVER_CACHE_(\d+)$/

export interface CacheCheckSources {
  resolveAction: (id: string) => ServerActionInfo | undefined
  capture: (id: string) => Capture | undefined
}

/** Finds the entry for a cache event: `undefined` when no entry (or more than one) fits. */
export function createCacheMatcher(
  model: AppModel,
  sources: CacheCheckSources,
): (event: CacheEvent) => CacheEntry | undefined {
  const entries = cacheOf(model).entries
  const sites = new Map(model.requests.map((s) => [s.id, s]))
  const ofKind = (kind: CacheEvent['kind']) => entries.filter((e) => e.kind === kind)
  const fetches = ofKind('fetch')
  const functions = ofKind('use-cache')
  const wrapped = ofKind('unstable-cache')
  return (event) => {
    if (event.kind === 'fetch') return matchFetch(fetches, sites, event, sources)
    if (event.kind === 'use-cache') return matchUseCache(functions, event, sources)
    return matchUnstableCache(wrapped, event)
  }
}

function matchFetch(
  entries: CacheEntry[],
  sites: Map<string, RequestSite>,
  event: CacheEvent,
  sources: CacheCheckSources,
): CacheEntry | undefined {
  if (entries.length === 0) return undefined
  const frames = event.sourceStack ?? []
  for (const frame of frames) {
    const found = entries.find((e) => e.loc.file === frame.file && Math.abs(e.loc.line - frame.line) <= 1)
    if (found) return found
  }
  const captured = event.captureId ? sources.capture(event.captureId) : undefined
  const siteIds = matchedSiteIds(captured?.match)
  if (siteIds.length > 0) {
    const found = only(entries.filter((e) => e.siteIds.some((id) => siteIds.includes(id))))
    if (found) return found
  }
  let url: URL
  try {
    url = new URL(event.url ?? '')
  } catch {
    return undefined
  }
  const byUrl = entries.filter((e) =>
    e.siteIds.some((id) => {
      const site = sites.get(id)
      return site?.url && site.method === event.method && matchRequestUrl(site.url, url) !== undefined
    }),
  )
  const files = new Set(frames.map((f) => f.file))
  return only(narrow(byUrl, (e) => files.has(e.loc.file)))
}

function matchUseCache(entries: CacheEntry[], event: CacheEvent, sources: CacheCheckSources) {
  const info = event.functionId ? sources.resolveAction(event.functionId) : undefined
  let candidates = info ? entries.filter((e) => sameSourceFile(info.filename, e.loc.file)) : entries
  const ordinal = info ? CACHE_FUNCTION.exec(info.exportedName)?.[1] : undefined
  // A build that names the export (not `$$RSC_SERVER_CACHE_<n>`).
  if (info && ordinal === undefined) candidates = narrow(candidates, (e) => e.name === info.exportedName)
  const tagged = byTags(candidates, event.tags)
  if (tagged.length === 1) return tagged[0]
  if (ordinal === undefined) return undefined
  // Next numbers the cached functions of a file in source order. Only trusted when the tags agree.
  const inFile = [...candidates].sort((a, b) => a.loc.line - b.loc.line || a.loc.column - b.loc.column)
  const picked = inFile[Number(ordinal)]
  return picked && tagged.includes(picked) ? picked : undefined
}

function matchUnstableCache(entries: CacheEntry[], event: CacheEvent) {
  let candidates = entries
  if (event.name) candidates = narrow(candidates, (e) => (e.fn ?? e.name) === event.name)
  return only(byTags(candidates, event.tags))
}

/** The entries `keep` accepts, or all of them when it accepts none. */
function narrow(entries: CacheEntry[], keep: (e: CacheEntry) => boolean): CacheEntry[] {
  const kept = entries.filter(keep)
  return kept.length > 0 ? kept : entries
}

/** Entries with one of the tags Next stored (a pattern tag `todo-{id}` matches `todo-1`). */
function byTags(entries: CacheEntry[], tags: readonly string[] | undefined): CacheEntry[] {
  if (!tags?.length || entries.length <= 1) return entries
  const keys: CacheKey[] = tags.map((t) => ({ text: t, value: t, confidence: 'exact' }))
  return narrow(entries, (e) => e.tags.some((tag) => keys.some((k) => tagsMatch(tag, k))))
}

function only(entries: CacheEntry[]): CacheEntry | undefined {
  return entries.length === 1 ? entries[0] : undefined
}

/** Runtime results per cache entry id, from every event that matched an entry. */
export function checkCache(
  model: AppModel,
  events: readonly CacheEvent[],
  sources: CacheCheckSources,
): Record<string, CacheRuntime> {
  if (events.length === 0 || !model.cache) return {}
  const match = createCacheMatcher(model, sources)
  const byEntry = new Map<string, CheckedCacheEvent[]>()
  for (const event of events) {
    const entry = match(event)
    if (!entry) continue
    const list = byEntry.get(entry.id) ?? []
    byEntry.set(entry.id, list)
    const status = event.captureId ? sources.capture(event.captureId)?.response?.status : undefined
    list.push(status !== undefined ? { ...event, responseStatus: status } : event)
  }
  const out: Record<string, CacheRuntime> = {}
  for (const [id, list] of byEntry) {
    const runtime = summarizeCacheEvents(list)
    if (runtime) out[id] = runtime
  }
  return out
}
