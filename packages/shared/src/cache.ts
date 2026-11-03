// Server cache map (M39): tag and path matching, and the wording shared by the dashboard, the
// export and the CLI. Pure, so the runtime check (M40) can match captured tags the same way.
import type { AppModel, CacheEntry, CacheFlag, CacheInvalidation, CacheKey, CacheMap, Route } from './model'
import { durationText } from './render'

const HOLE = /\{[^{}]*\}/g
const HAS_HOLE = /\{[^{}]*\}/
const SAMPLE = '\u0001'

/** The cache map; models written before M39 (or apps that cache nothing) have none. */
export function cacheOf(model: Pick<AppModel, 'cache'>): CacheMap {
  return model.cache ?? { entries: [], invalidations: [] }
}

function keyRegex(value: string): RegExp {
  const parts = value.split(HOLE).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^${parts.join('[\\s\\S]+')}$`)
}

/**
 * Whether two tags can be the same at runtime: `post-{id}` matches `post-1` and `post-{slug}`.
 * A tag the scan can't read matches nothing.
 */
export function tagsMatch(a: CacheKey, b: CacheKey): boolean {
  if (a.value === undefined || b.value === undefined) return false
  if (a.confidence === 'exact' && b.confidence === 'exact') return a.value === b.value
  return (
    keyRegex(a.value).test(b.value.replace(HOLE, SAMPLE)) ||
    keyRegex(b.value).test(a.value.replace(HOLE, SAMPLE))
  )
}

/** URL segments of a written path: groups `(x)` and slots `@x` don't count, like in `Route.path`. */
function pathSegments(path: string): string[] {
  return path
    .split(/[?#]/)[0]
    ?.split('/')
    .filter((s) => s !== '' && !/^\(.*\)$/.test(s) && !s.startsWith('@')) as string[]
}

type SegKind = 'static' | 'param' | 'catch-all' | 'optional-catch-all'

function segKind(segment: string): SegKind {
  if (/^\[\[\.\.\..+\]\]$/.test(segment)) return 'optional-catch-all'
  if (/^\[\.\.\..+\]$/.test(segment)) return 'catch-all'
  if (/^\[.+\]$/.test(segment)) return 'param'
  return 'static'
}

/** One written segment against one route segment that isn't a catch-all. */
function segmentMatches(written: string, route: string): boolean {
  const w = segKind(written)
  const r = segKind(route)
  if (r === 'param') return w === 'param' || w === 'static'
  // `static` route segment
  if (w !== 'static') return false
  if (!HAS_HOLE.test(written)) return written === route
  return keyRegex(written).test(route)
}

/**
 * Whether `revalidatePath(path, type)` refreshes the route: a literal path (`/blog/1`) or a route
 * pattern (`/blog/[slug]`) for the page itself; with `type: 'layout'` every route below it too.
 */
export function pathMatchesRoute(path: string, type: 'page' | 'layout' | undefined, route: Route): boolean {
  const written = pathSegments(path)
  const target = pathSegments(route.path)
  const prefix = type === 'layout'
  const match = (wi: number, ri: number): boolean => {
    if (wi === written.length) {
      if (prefix || ri === target.length) return true
      return ri === target.length - 1 && segKind(target[ri] as string) === 'optional-catch-all'
    }
    if (ri === target.length) return false
    const w = written[wi] as string
    const r = target[ri] as string
    const kind = segKind(r)
    if (kind === 'catch-all' || kind === 'optional-catch-all') {
      // The route pattern written as is, or the rest of a literal path.
      if (segKind(w) === kind) return match(wi + 1, ri + 1)
      if (segKind(w) !== 'static') return false
      for (let end = wi + 1; end <= written.length; end++) {
        if (written.slice(wi, end).some((s) => segKind(s) !== 'static')) break
        if (match(end, ri + 1)) return true
      }
      return kind === 'optional-catch-all' && match(wi, ri + 1)
    }
    return segmentMatches(w, r) && match(wi + 1, ri + 1)
  }
  return match(0, 0)
}

// --- Wording ---------------------------------------------------------------------------------

export const CACHE_KIND_LABELS: Record<CacheEntry['kind'], string> = {
  fetch: 'fetch',
  'use-cache': 'use cache',
  'unstable-cache': 'unstable_cache',
}

/** `'posts'`, `post-{id}`, or the expression when it can't be read. */
export function cacheKeyText(key: CacheKey): string {
  return key.value !== undefined ? key.value : key.text
}

/** "1h", "15m (default)", "until revalidated": how long an entry is kept. */
export function cacheLifeText(entry: CacheEntry): string {
  if (entry.revalidate === false) return 'until revalidated'
  if (entry.revalidate !== undefined) {
    const time = durationText(entry.revalidate)
    return entry.kind === 'use-cache' && !entry.life ? `${time} (default)` : time
  }
  if (entry.kind === 'use-cache') return "cacheLife can't be read"
  return 'until revalidated'
}

/** "`revalidateTag('posts', 'max')`", "`revalidatePath('/blog', 'layout')`". */
export function invalidationText(inv: CacheInvalidation): string {
  const key = inv.tag ?? inv.path
  const args = [key ? key.text : '']
  if (inv.path?.type) args.push(`'${inv.path.type}'`)
  if (inv.profile) args.push(inv.profile)
  return `${inv.api}(${args.join(', ')})`
}

/** Where an invalidation runs: "server action `createPost`", "route handler `POST /api/revalidate`". */
export function invalidationWhere(inv: CacheInvalidation, routes: readonly Route[]): string {
  if (inv.origin === 'server-action') return `server action \`${inv.serverAction?.name ?? 'anonymous'}\``
  const route = routes.find((r) => r.id === inv.routeId)
  return `route handler \`${[inv.handlerMethod, route?.path].filter(Boolean).join(' ')}\``
}

/** Every flag in the map, with what it is on. */
export function cacheFlags(
  cache: CacheMap,
): { flag: CacheFlag; entry?: CacheEntry; invalidation?: CacheInvalidation }[] {
  return [
    ...cache.invalidations.flatMap((invalidation) =>
      invalidation.flags.map((flag) => ({ flag, invalidation })),
    ),
    ...cache.entries.flatMap((entry) => entry.flags.map((flag) => ({ flag, entry }))),
  ]
}

/** One tag and what sets and revalidates it. */
export interface CacheTagRow {
  tag: string
  entries: CacheEntry[]
  invalidations: CacheInvalidation[]
}

/** Tags by value: what sets each one and what revalidates it, sorted by tag. */
export function cacheTags(cache: CacheMap): CacheTagRow[] {
  const rows = new Map<string, CacheTagRow>()
  const row = (tag: string) => {
    let r = rows.get(tag)
    if (!r) {
      r = { tag, entries: [], invalidations: [] }
      rows.set(tag, r)
    }
    return r
  }
  for (const entry of cache.entries) {
    for (const tag of entry.tags) row(cacheKeyText(tag)).entries.push(entry)
  }
  for (const inv of cache.invalidations) {
    if (!inv.tag) continue
    const r = row(cacheKeyText(inv.tag))
    r.invalidations.push(inv)
    // Pattern tags are listed under the tag as written; the matched entries show the links.
    for (const entry of cache.entries) {
      if (inv.entryIds.includes(entry.id) && !r.entries.includes(entry)) r.entries.push(entry)
    }
  }
  return [...rows.values()].sort((a, b) => a.tag.localeCompare(b.tag))
}

/** Entries a page renders with, and the invalidations that refresh the page. */
export function pageCache(
  cache: CacheMap,
  pageId: string,
): { entries: CacheEntry[]; invalidations: CacheInvalidation[] } {
  return {
    entries: cache.entries.filter((e) => e.pageIds.includes(pageId)),
    invalidations: cache.invalidations.filter((i) => i.pageIds.includes(pageId)),
  }
}

/** The cache map as text: `flow-checker scan --tree` and snapshot tests. */
export function formatCache(model: Pick<AppModel, 'cache' | 'routes'>): string[] {
  const cache = cacheOf(model)
  if (cache.entries.length === 0 && cache.invalidations.length === 0) return []
  const path = (id: string) => model.routes.find((r) => r.id === id)?.path ?? id
  const names = new Map(cache.entries.map((e) => [e.id, `${CACHE_KIND_LABELS[e.kind]} ${e.name}`]))
  const at = (loc: { file: string; line: number }) => `${loc.file}:${loc.line}`
  const out: string[] = ['# Server cache', '']
  for (const e of cache.entries) {
    const tags = e.tags.length > 0 ? `  [${e.tags.map(cacheKeyText).join(', ')}]` : ''
    out.push(`${CACHE_KIND_LABELS[e.kind]}  ${e.name}${tags}  ${cacheLifeText(e)}  ${at(e.loc)}`)
    const used = [...e.pageIds, ...e.handlerIds].map(path)
    if (used.length > 0) out.push(`  used by: ${used.join(', ')}`)
    for (const f of e.flags) out.push(`  ! ${f.kind}: ${f.message}`)
  }
  if (cache.invalidations.length > 0) out.push('')
  for (const i of cache.invalidations) {
    out.push(`${invalidationText(i)}  in ${invalidationWhere(i, model.routes)}  ${at(i.loc)}`)
    const hits = i.entryIds.map((id) => names.get(id) ?? id)
    if (hits.length > 0) out.push(`  refreshes: ${hits.join(', ')}`)
    const pages = [...i.pageIds, ...i.handlerIds].map(path)
    if (pages.length > 0) out.push(`  pages: ${pages.join(', ')}`)
    for (const f of i.flags) out.push(`  ! ${f.kind}: ${f.message}`)
  }
  return out
}
