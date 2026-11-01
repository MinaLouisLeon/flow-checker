// Rows, filters and sorting for the Components and Requests screens (M21). Pure functions of the
// model index, so they are unit-tested without rendering.
import {
  type Component,
  isInfoFlag,
  type NamedType,
  type Navigation,
  type QueryLink,
  type RequestSite,
  RequestSiteSchema,
  urlText,
} from '@flow-checker/shared'
import type { ModelIndex } from './model-index'

export const COMPONENT_KINDS = ['server', 'client', 'shared'] as const satisfies Component['kind'][]
/** `requests`: sends requests. `notes`: has something to check. `no-page`: not reachable from a page. */
export const COMPONENT_HAS = ['requests', 'notes', 'no-page'] as const
export type ComponentHas = (typeof COMPONENT_HAS)[number]
export const COMPONENT_SORTS = ['name', 'requests', 'pages'] as const
export type ComponentSort = (typeof COMPONENT_SORTS)[number]

export const REQUEST_STATUSES = [
  'verified',
  'mismatch',
  'needs-recheck',
  'inferred',
] as const satisfies RequestSite['status'][]
/**
 * When a request is sent, the same split as the overview card: `load` (server render, page load,
 * effect), `event` (a user interaction), `server` (route handlers, server actions, middleware),
 * `unknown` (a component request the scan couldn't place).
 */
export const REQUEST_WHEN = ['load', 'event', 'server', 'unknown'] as const
export type RequestWhen = (typeof REQUEST_WHEN)[number]
export const TRANSPORTS = RequestSiteSchema.shape.transport.options

export interface ComponentRow {
  component: Component
  pages: number
  requests: number
  notes: number
}

export interface ComponentFilter {
  q: string
  kind?: Component['kind']
  has?: ComponentHas
}

export interface RequestFilter {
  q: string
  status?: RequestSite['status']
  when?: RequestWhen
  transport?: RequestSite['transport']
  /** Only sites with flags (not information like `runtime-url`). */
  flagged?: boolean
}

export function componentRows(index: ModelIndex): ComponentRow[] {
  const notes = new Map<string, number>()
  for (const note of index.notes) {
    if (note.componentId) notes.set(note.componentId, (notes.get(note.componentId) ?? 0) + 1)
  }
  return index.model.components.map((component) => ({
    component,
    pages: index.routesOf.get(component.id)?.length ?? 0,
    requests: index.requestsByComponent.get(component.id)?.length ?? 0,
    notes: notes.get(component.id) ?? 0,
  }))
}

export function filterComponents(rows: ComponentRow[], filter: ComponentFilter): ComponentRow[] {
  return rows.filter(
    (row) =>
      (!filter.kind || row.component.kind === filter.kind) &&
      (filter.has !== 'requests' || row.requests > 0) &&
      (filter.has !== 'notes' || row.notes > 0) &&
      (filter.has !== 'no-page' || row.pages === 0) &&
      matchesAll(filter.q, row.component.name, row.component.file),
  )
}

/** Name order, or most requests / pages first (then by name). Returns a new array. */
export function sortComponents(rows: ComponentRow[], sort: ComponentSort = 'name'): ComponentRow[] {
  const byName = (a: ComponentRow, b: ComponentRow) =>
    a.component.name.localeCompare(b.component.name) || a.component.file.localeCompare(b.component.file)
  if (sort === 'name') return [...rows].sort(byName)
  return [...rows].sort((a, b) => b[sort] - a[sort] || byName(a, b))
}

export function requestWhen(site: RequestSite): RequestWhen {
  if (site.origin !== 'component') return 'server'
  switch (site.trigger.kind) {
    case 'server-render':
    case 'page-load':
    case 'effect':
      return 'load'
    case 'event':
      return 'event'
    default:
      return 'unknown'
  }
}

export function countWhen(sites: RequestSite[]): Record<RequestWhen, number> {
  const counts: Record<RequestWhen, number> = { load: 0, event: 0, server: 0, unknown: 0 }
  for (const site of sites) counts[requestWhen(site)]++
  return counts
}

export function filterRequests(index: ModelIndex, filter: RequestFilter): RequestSite[] {
  return index.model.requests.filter(
    (site) =>
      (!filter.status || site.status === filter.status) &&
      (!filter.when || requestWhen(site) === filter.when) &&
      (!filter.transport || site.transport === filter.transport) &&
      (!filter.flagged || warnings(site).length > 0) &&
      matchesAll(
        filter.q,
        `${site.method ?? '?'} ${siteTarget(site)}`,
        site.url?.text,
        siteOwner(site, index),
        site.callStack[0]?.file,
      ),
  )
}

/** The URL pattern, or the action name for a server action. */
export function siteTarget(site: RequestSite): string {
  if (site.transport === 'server-action') return site.serverAction?.name ?? '?'
  return site.url ? urlText(site.url) : '?'
}

/** The component, route handler or server action a site runs in. */
export function siteOwner(site: RequestSite, index: ModelIndex): string {
  if (site.componentId) return index.components.get(site.componentId)?.name ?? 'component'
  if (site.origin === 'route-handler' && site.routeId) {
    return `${site.handlerMethod ?? ''} ${index.routes.get(site.routeId)?.path ?? 'route handler'}`.trim()
  }
  if (site.origin === 'server-action') return `action ${site.serverAction?.name ?? '?'}`
  if (site.origin === 'middleware') return `middleware ${index.model.middleware?.file ?? ''}`.trim()
  return site.origin
}

/** Sites that send the same request (method, target, transport, trigger), in first-seen order. */
export function groupSame(sites: RequestSite[]): RequestSite[][] {
  const groups = new Map<string, RequestSite[]>()
  for (const site of sites) {
    const t = site.trigger
    const key = `${site.method ?? '?'} ${siteTarget(site)} ${site.transport} ${t.kind} ${t.event ?? ''}`
    const group = groups.get(key)
    if (group) group.push(site)
    else groups.set(key, [site])
  }
  return [...groups.values()]
}

// ---------------------------------------------------------------------------------------------
// Bounded lists and folding (M23). Lists that grow with the app show a few entries plus "+N more",
// and entries that say the same thing fold into one row.

/** How many entries a capped list shows before "+N more". */
export const CAP = 5

/** The first `limit` items unless expanded, and how many are hidden. */
export function capped<T>(
  items: readonly T[],
  expanded: boolean,
  limit = CAP,
): { shown: T[]; hidden: number } {
  if (expanded || items.length <= limit) return { shown: [...items], hidden: 0 }
  return { shown: items.slice(0, limit), hidden: items.length - limit }
}

/** A cache call with no key, procedure or operation hits every query: no need to list them. */
export function hitsEveryQuery(link: Pick<QueryLink, 'key' | 'procedure' | 'operation'>): boolean {
  return link.key === undefined && link.procedure === undefined && link.operation === undefined
}

/**
 * Navigations that are the same code (kind, target, trigger, line), in first-seen order. A
 * navigation in a shared hook is found once per component that uses the hook.
 */
export function groupNavigations(navigations: Navigation[]): Navigation[][] {
  return groupBy(navigations, (n) => {
    const t = n.trigger
    return `${n.kind} ${n.href.text} ${t.kind} ${t.event ?? ''} ${n.loc.file}:${n.loc.line}:${n.loc.column}`
  })
}

/** Callers of a route handler that send one method and URL. */
export interface CallerGroup {
  /** `POST /api/auth/login`: the URL the callers send, concrete for a catch-all handler. */
  label: string
  /** Callers that send it from the same line fold into one row. */
  rows: RequestSite[][]
  count: number
}

/** Callers grouped by the URL they send (sorted), each folded by the line that sends it. */
export function callerGroups(sites: RequestSite[], index: ModelIndex, q = ''): CallerGroup[] {
  const kept = sites.filter((site) =>
    matchesAll(
      q,
      `${site.method ?? '?'} ${siteTarget(site)}`,
      site.url?.text,
      siteOwner(site, index),
      ...site.callStack.map((f) => f.file),
    ),
  )
  const byUrl = groupBy(kept, (s) => `${s.method ?? '?'} ${siteTarget(s)}`)
  return byUrl
    .map((group) => {
      const first = group[0] as RequestSite
      return {
        label: `${first.method ?? '?'} ${siteTarget(first)}`,
        rows: groupBy(group, (s) => {
          const at = sendLine(s)
          return at ? `${at.file}:${at.line}` : s.id
        }),
        count: group.length,
      }
    })
    .sort((a, b) => urlOf(a.label).localeCompare(urlOf(b.label)) || a.label.localeCompare(b.label))
}

/** The line that sends the request: the last frame of its call path. */
export function sendLine(site: RequestSite): RequestSite['callStack'][number] | undefined {
  return site.callStack[site.callStack.length - 1]
}

const urlOf = (label: string) => label.slice(label.indexOf(' ') + 1)

/** A row of the Types screen: one type, or a generic with its instantiations folded under it. */
export interface TypeRow {
  /** `ApiResponse<…>` for a folded generic, else the type's name. */
  name: string
  types: NamedType[]
  /** Uses of each type, in the order of `types`. */
  uses: number[]
  total: number
}

export interface TypeFilter {
  q: string
  /** Also list types with no uses. */
  unused?: boolean
  /** Always listed (the selected type). */
  keep?: string
}

/** Where a type is used: props, component bodies, other types and requests. */
export function typeUses(index: ModelIndex, typeId: string): number {
  const u = index.typeUsage.get(typeId)
  return (
    (u?.props.length ?? 0) + (u?.usedBy.length ?? 0) + (u?.inTypes.length ?? 0) + (u?.requests.length ?? 0)
  )
}

/**
 * Types, with each generic's instantiations (`Page<User>`, `Page<Post>`: same declaration) folded
 * into one row. Unused types are left out unless `unused` is set.
 */
export function typeRows(index: ModelIndex, filter: TypeFilter): { rows: TypeRow[]; unused: number } {
  let unused = 0
  const groups = groupBy(index.model.types, (t) => {
    const at = t.definedAt
    return `${baseName(t.name)} ${at.file}:${at.line}:${at.column}`
  })
  const rows: TypeRow[] = []
  for (const group of groups) {
    const all = group.map((t) => ({ t, uses: typeUses(index, t.id) }))
    const matching = all.filter(({ t }) => matchesAll(filter.q, t.name, t.definedAt.file))
    const kept = matching.filter(({ t, uses }) => filter.unused || uses > 0 || t.id === filter.keep)
    unused += matching.length - kept.length
    if (kept.length === 0) continue
    const first = (group[0] as NamedType).name
    const generic = group.length > 1 || first.includes('<')
    rows.push({
      name: generic ? `${baseName(first)}<…>` : first,
      types: kept.map(({ t }) => t),
      uses: kept.map(({ uses }) => uses),
      total: kept.reduce((sum, { uses }) => sum + uses, 0),
    })
  }
  return { rows, unused }
}

/** `ApiResponse<User>` -> `ApiResponse`. */
function baseName(name: string): string {
  const at = name.indexOf('<')
  return at < 0 ? name : name.slice(0, at)
}

/** Items with the same key, in first-seen order. */
function groupBy<T>(items: readonly T[], key: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const group = groups.get(k)
    if (group) group.push(item)
    else groups.set(k, [item])
  }
  return [...groups.values()]
}

/** Every word of the query appears in one of the fields (case-insensitive). */
function matchesAll(query: string, ...fields: (string | undefined)[]): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = fields
    .filter((f) => f !== undefined)
    .join('\n')
    .toLowerCase()
  return words.every((w) => text.includes(w))
}

/** A site's flags that ask for a check (`runtime-url` only informs). */
export function warnings(site: RequestSite) {
  return site.flags.filter((f) => !isInfoFlag(f))
}
