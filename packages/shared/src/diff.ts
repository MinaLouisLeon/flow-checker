// What a re-scan changed (M9, docs/PLAN.md 6.7). Entity ids include source positions, so code
// that only moved gets a new id. Request sites are paired up again by their code hash.
import type { AppModel, RequestSite } from './model'

export type EntityKind = 'routes' | 'components' | 'types' | 'requests' | 'navigations' | 'flows'

const KINDS: readonly EntityKind[] = ['routes', 'components', 'types', 'requests', 'navigations', 'flows']

export interface EntityChanges {
  added: string[]
  removed: string[]
  changed: string[]
}

export interface ModelDiff {
  /** Per entity kind. Kinds with no change are left out. */
  entities: Partial<Record<EntityKind, EntityChanges>>
  /** Request sites whose id changed because lines moved (old id -> new id). See `pairRenamedSites`. */
  renamedSites: Record<string, string>
  /** Request sites (new ids) whose code hash changed. */
  changedCode: string[]
}

type Entity = { id: string }

/** Status and flags come from verification, not from the code. */
function comparable(kind: EntityKind, entity: Entity): string {
  if (kind === 'requests') {
    const { status: _, flags, ...rest } = entity as RequestSite
    return JSON.stringify({
      ...rest,
      flags: flags.filter((f) => f.kind !== 'type-mismatch' && f.kind !== 'stale'),
    })
  }
  return JSON.stringify(entity)
}

/** Compares two scans of the same project. */
export function diffModels(prev: AppModel, next: AppModel): ModelDiff {
  const entities: ModelDiff['entities'] = {}
  for (const kind of KINDS) {
    const before = new Map((prev[kind] as Entity[]).map((e) => [e.id, e]))
    const after = new Map((next[kind] as Entity[]).map((e) => [e.id, e]))
    const changes: EntityChanges = { added: [], removed: [], changed: [] }
    for (const [id, entity] of after) {
      const old = before.get(id)
      if (!old) changes.added.push(id)
      else if (comparable(kind, old) !== comparable(kind, entity)) changes.changed.push(id)
    }
    for (const id of before.keys()) if (!after.has(id)) changes.removed.push(id)
    if (changes.added.length + changes.removed.length + changes.changed.length > 0) entities[kind] = changes
  }

  const renamedSites = pairRenamedSites(prev.requests, next.requests)
  const oldHash = new Map(prev.requests.map((s) => [s.id, s.hash]))
  for (const [from, to] of Object.entries(renamedSites)) oldHash.set(to, oldHash.get(from))
  const changedCode = next.requests
    .filter((s) => oldHash.has(s.id) && s.hash !== undefined && oldHash.get(s.id) !== s.hash)
    .map((s) => s.id)

  return { entities, renamedSites, changedCode }
}

/**
 * Sites that went away and came back under a new id (old id -> new id). Ids include line
 * numbers, so this happens whenever lines above the code are added or removed. Paired by code
 * hash first (the code only moved), then by call path (same origin, files and callees: the code
 * moved and changed). Only pairs that are unambiguous on both sides.
 */
export function pairRenamedSites(
  prev: readonly RequestSite[],
  next: readonly RequestSite[],
): Record<string, string> {
  const nextIds = new Set(next.map((s) => s.id))
  const prevIds = new Set(prev.map((s) => s.id))
  let gone = prev.filter((s) => !nextIds.has(s.id))
  let fresh = next.filter((s) => !prevIds.has(s.id))
  const pairs: Record<string, string> = {}
  for (const key of [(s: RequestSite) => s.hash, callPath]) {
    const olds = groupBy(gone, key)
    const news = groupBy(fresh, key)
    for (const [k, [from, ...moreFrom]] of olds) {
      const [to, ...moreTo] = news.get(k) ?? []
      if (from && to && moreFrom.length === 0 && moreTo.length === 0) pairs[from.id] = to.id
    }
    const paired = new Set(Object.values(pairs))
    gone = gone.filter((s) => !pairs[s.id])
    fresh = fresh.filter((s) => !paired.has(s.id))
  }
  return pairs
}

/** Where a site is, without line numbers. */
function callPath(site: RequestSite): string {
  return JSON.stringify([
    site.origin,
    site.componentId ?? site.routeId ?? '',
    site.handlerMethod ?? '',
    site.serverAction?.name ?? '',
    site.transport,
    site.callStack.map((f) => `${f.file}#${f.callee}`),
  ])
}

function groupBy(sites: readonly RequestSite[], key: (site: RequestSite) => string | undefined) {
  const out = new Map<string, RequestSite[]>()
  for (const site of sites) {
    const k = key(site)
    if (k === undefined) continue
    const list = out.get(k) ?? []
    list.push(site)
    out.set(k, list)
  }
  return out
}

/** Total entities added, removed or changed. */
export function diffSize(diff: ModelDiff): number {
  let n = 0
  for (const c of Object.values(diff.entities)) n += c.added.length + c.removed.length + c.changed.length
  return n
}

/** The live feed's `scan` event: the model changed (M9). Fetch `/api/model` again. */
export interface ScanEvent {
  /** ISO time the scan finished. */
  scannedAt: string
  durationMs?: number
  /** Project-relative files that changed. Empty for a manual re-scan. */
  files: string[]
  /** How many entities were added, removed or changed, per kind. */
  changes: Partial<Record<EntityKind, { added: number; removed: number; changed: number }>>
  /** Request sites whose code changed. */
  changedCode: string[]
  /** Request sites that need a re-check now: every capture they have is from before the change. */
  needsRecheck: string[]
}

/** Counts per entity kind, for the `scan` event. */
export function diffCounts(diff: ModelDiff): ScanEvent['changes'] {
  const out: ScanEvent['changes'] = {}
  for (const [kind, c] of Object.entries(diff.entities) as [EntityKind, EntityChanges][]) {
    out[kind] = { added: c.added.length, removed: c.removed.length, changed: c.changed.length }
  }
  return out
}
