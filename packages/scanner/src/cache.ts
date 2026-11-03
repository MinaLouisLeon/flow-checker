// Server cache map (M39): links the cached data the walk found (`fetch` cache options, `use cache`,
// `unstable_cache`) to the pages that render with it, and each `revalidateTag` / `updateTag` /
// `revalidatePath` call to the entries and pages it refreshes. Tags only one side has are flagged.
import {
  type CacheEntry,
  type CacheFlag,
  type CacheInvalidation,
  type CacheMap,
  type Component,
  cacheKeyText,
  pathMatchesRoute,
  type Route,
  tagsMatch,
} from '@flow-checker/shared'
import { componentsBelow } from './access'
import type { CacheFound, InvalidationFound } from './requests'

export interface CacheInput {
  routes: Route[]
  components: Component[]
  entries: CacheFound[]
  invalidations: InvalidationFound[]
}

/** The cache map, or `undefined` when the app caches nothing and revalidates nothing. */
export function buildCacheMap(input: CacheInput): CacheMap | undefined {
  if (input.entries.length === 0 && input.invalidations.length === 0) return undefined
  const { routes, components } = input
  const pages = routes.filter((r) => r.kind === 'page')
  const handlers = routes.filter((r) => r.kind === 'route-handler')

  // Component -> pages that render it (through their layouts too).
  const below = componentsBelow(components)
  const pagesOf = new Map<string, Set<string>>()
  for (const page of pages) {
    const roots = [...page.layoutChain.map((l) => l.componentId), page.componentId]
    for (const root of roots) {
      if (!root) continue
      for (const id of below(root)) {
        let set = pagesOf.get(id)
        if (!set) {
          set = new Set()
          pagesOf.set(id, set)
        }
        set.add(page.id)
      }
    }
  }
  const pageOrder = new Map(routes.map((r, i) => [r.id, i]))
  const byRoute = (ids: Iterable<string>) =>
    [...new Set(ids)].sort((a, b) => (pageOrder.get(a) ?? 0) - (pageOrder.get(b) ?? 0))

  const entries: CacheEntry[] = input.entries.map((found) => {
    const { siteIds, componentIds, handlerIds, ...rest } = found
    return {
      ...rest,
      siteIds: [...siteIds].sort(),
      pageIds: byRoute([...componentIds].flatMap((id) => [...(pagesOf.get(id) ?? [])])),
      handlerIds: byRoute(handlerIds),
      flags: [],
    }
  })

  const invalidations: CacheInvalidation[] = input.invalidations.map((found) => {
    const inv: CacheInvalidation = { ...found, entryIds: [], pageIds: [], handlerIds: [], flags: [] }
    if (found.tag) {
      const tag = found.tag
      const hits = entries.filter((e) => e.tags.some((t) => tagsMatch(t, tag)))
      inv.entryIds = hits.map((e) => e.id)
      inv.pageIds = byRoute(hits.flatMap((e) => e.pageIds))
      inv.handlerIds = byRoute(hits.flatMap((e) => e.handlerIds))
    } else if (found.path?.value !== undefined) {
      const { value, type } = found.path
      inv.pageIds = pages.filter((p) => pathMatchesRoute(value, type, p)).map((p) => p.id)
      inv.handlerIds = handlers.filter((h) => pathMatchesRoute(value, type, h)).map((h) => h.id)
    }
    return inv
  })

  addFlags(entries, invalidations)
  return { entries, invalidations }
}

function addFlags(entries: CacheEntry[], invalidations: CacheInvalidation[]): void {
  // A tag the scan can't read could be any tag, so the other side isn't flagged.
  const anyTagSet = entries.some((e) => e.tags.some((t) => t.confidence === 'unknown'))
  const anyTagRevalidated = invalidations.some((i) => i.tag?.confidence === 'unknown')
  const revalidated = invalidations.flatMap((i) => (i.tag ? [i.tag] : []))

  for (const inv of invalidations) {
    if (inv.api === 'updateTag' && inv.origin !== 'server-action') {
      inv.flags.push(
        flag(
          'update-tag-outside-action',
          '`updateTag` only works in a server action; Next throws here. Use `revalidateTag(tag, { expire: 0 })` in a route handler.',
        ),
      )
    }
    if (inv.tag && inv.tag.confidence !== 'unknown' && inv.entryIds.length === 0 && !anyTagSet) {
      inv.flags.push(
        flag(
          'tag-never-set',
          `No cached data has the tag \`${cacheKeyText(inv.tag)}\`, so this call refreshes nothing. Tags are set with \`next.tags\` on a \`fetch\`, \`cacheTag()\` or \`unstable_cache\`'s \`tags\`.`,
        ),
      )
    }
    if (inv.path && inv.path.confidence !== 'unknown' && inv.pageIds.length + inv.handlerIds.length === 0) {
      inv.flags.push(
        flag(
          'path-no-route',
          `No page or route handler is at \`${cacheKeyText(inv.path)}\`, so this call refreshes nothing. \`revalidatePath\` takes the route's path (for a rewrite, its destination).`,
        ),
      )
    }
  }

  if (anyTagRevalidated) return
  for (const entry of entries) {
    for (const tag of entry.tags) {
      if (tag.confidence === 'unknown' || revalidated.some((r) => tagsMatch(r, tag))) continue
      entry.flags.push(
        flag(
          'tag-never-revalidated',
          `Nothing revalidates the tag \`${cacheKeyText(tag)}\`: no \`revalidateTag\` or \`updateTag\` call has it, so the data only refreshes ${refreshText(entry)}.`,
        ),
      )
    }
  }
}

function refreshText(entry: CacheEntry): string {
  if (typeof entry.revalidate === 'number') return 'when its time runs out'
  if (entry.kind === 'use-cache') return 'when its cache life runs out'
  return 'on the next build'
}

function flag(kind: CacheFlag['kind'], message: string): CacheFlag {
  return { kind, message }
}
