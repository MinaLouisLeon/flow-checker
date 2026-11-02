// Global search (M33): one in-memory index over pages, route handlers, components, requests,
// endpoints, types, flows and areas, built once per model. Pure, so the dashboard and tests use the
// same ranking.
import type { AreaList } from './areas'
import { type EndpointList, endpointLabel } from './endpoints'
import type { RequestSite, Route } from './model'
import { type ModelIndex, requestLabel } from './model-index'

export const SEARCH_KINDS = [
  'page',
  'handler',
  'area',
  'component',
  'flow',
  'endpoint',
  'request',
  'type',
] as const
export type SearchKind = (typeof SEARCH_KINDS)[number]

/** How each kind is named on a result. */
export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  page: 'page',
  handler: 'route handler',
  area: 'area',
  component: 'component',
  flow: 'flow',
  endpoint: 'endpoint',
  request: 'request',
  type: 'type',
}

export interface SearchItem {
  kind: SearchKind
  /** Route id, component id, site id, endpoint key, type id, flow id or area id. */
  id: string
  label: string
  /** A file, host or page that tells same-named results apart. */
  detail?: string
}

interface Entry {
  item: SearchItem
  /** Lowercased label. */
  label: string
  /** Lowercased other fields: files, file names, URLs, paths. */
  fields: string[]
  /** Space-separated words of the label (` user list`), for the word match. */
  labelWords: string
  /** The same for every field, label included, one field per line so a word run never spans two. */
  allWords: string
  /** Every field joined, for the substring fallback. */
  allText: string
}

export interface SearchIndex {
  entries: Entry[]
}

export interface SearchResult {
  /** Best first, at most `limit`. */
  items: SearchItem[]
  /** Everything that matched. */
  total: number
}

/** Builds the index. `endpoints` and `areas` are the lists the screens already derive (M29, M30). */
export function buildSearchIndex(
  index: ModelIndex,
  derived: { endpoints?: EndpointList; areas?: AreaList } = {},
): SearchIndex {
  const entries: Entry[] = []
  const add = (item: SearchItem, others: (string | undefined)[]) => entries.push(entry(item, others))

  for (const route of index.model.routes) {
    const component = route.componentId ? index.components.get(route.componentId) : undefined
    add(
      {
        kind: route.kind === 'page' ? 'page' : 'handler',
        id: route.id,
        label: route.path,
        detail: routeDetail(route),
      },
      [...fileFields(route.file), component?.name, ...(route.methods ?? [])],
    )
  }

  for (const component of index.model.components) {
    add(
      {
        kind: 'component',
        id: component.id,
        label: component.name,
        detail: `${component.file}:${component.loc.line}`,
      },
      fileFields(component.file),
    )
  }

  for (const site of index.model.requests) {
    const frames = site.callStack
    const at = frames[0] ? ` · ${frames[0].file}:${frames[0].line}` : ''
    const owner = siteOwner(site, index)
    add({ kind: 'request', id: site.id, label: requestLabel(site), detail: `${owner}${at}` }, [
      site.url?.text,
      owner,
      ...unique(frames.flatMap((f) => [f.callee, ...fileFields(f.file)])),
      site.hook?.key,
      site.procedure?.path,
      site.operation?.name,
      site.serverAction?.name,
      site.client?.name,
    ])
  }

  if (derived.endpoints) {
    const hosts = new Map(derived.endpoints.hosts.map((h) => [h.key, h.label]))
    for (const endpoint of derived.endpoints.endpoints) {
      const host = hosts.get(endpoint.host)
      add({ kind: 'endpoint', id: endpoint.key, label: endpointLabel(endpoint), detail: host }, [
        endpoint.pattern,
        host,
        endpoint.procedure?.path,
        endpoint.operation?.name,
        ...endpoint.contracts.map((c) => c.name),
      ])
    }
  }

  for (const type of index.model.types) {
    add(
      {
        kind: 'type',
        id: type.id,
        label: type.name,
        detail: `${type.definedAt.file}:${type.definedAt.line}`,
      },
      fileFields(type.definedAt.file),
    )
  }

  for (const flow of index.model.flows) {
    const start = flow.routeId ? index.routes.get(flow.routeId)?.path : undefined
    add({ kind: 'flow', id: flow.id, label: flow.name, detail: start }, [
      start,
      index.components.get(flow.componentId)?.name,
    ])
  }

  if (derived.areas) {
    for (const area of derived.areas.areas) {
      const pages = area.routeIds.length
      add({ kind: 'area', id: area.id, label: area.name, detail: `${pages} page${pages === 1 ? '' : 's'}` }, [
        area.key,
        ...area.from,
      ])
    }
  }
  return { entries }
}

const EXACT = 4
const PREFIX = 3
const WORDS = 2
const CONTAINS = 1

/**
 * Ranks every entry against the query: exact > prefix > every word starts a word > every word is
 * somewhere. At the same level a match on the name beats one on a file or URL; then kind order,
 * shorter names, then name order.
 */
export function search(si: SearchIndex, query: string, limit = 50): SearchResult {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!q) return { items: [], total: 0 }
  const words = q.split(' ')
  // Each query word as a run of words: `auth-api.ts` → ` auth api ts`.
  const starts = words.map((w) => tokens(w).join(' '))
  const hits: { entry: Entry; score: number }[] = []
  for (const entry of si.entries) {
    const label = labelLevel(entry, q, words, starts)
    let other = 0
    for (const field of entry.fields) {
      if (field === q) other = Math.max(other, EXACT)
      else if (field.startsWith(q)) other = Math.max(other, PREFIX)
    }
    if (other < WORDS) {
      if (hasWords(entry.allWords, starts)) other = WORDS
      else if (other < CONTAINS && words.every((w) => entry.allText.includes(w))) other = CONTAINS
    }
    const score = Math.max(label ? label * 2 + 1 : 0, other * 2)
    if (score > 0) hits.push({ entry, score })
  }
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      KIND_ORDER[a.entry.item.kind] - KIND_ORDER[b.entry.item.kind] ||
      a.entry.label.length - b.entry.label.length ||
      compare(a.entry.label, b.entry.label) ||
      compare(a.entry.item.detail ?? '', b.entry.item.detail ?? ''),
  )
  return { items: hits.slice(0, limit).map((h) => h.entry.item), total: hits.length }
}

const KIND_ORDER = Object.fromEntries(SEARCH_KINDS.map((k, i) => [k, i])) as Record<SearchKind, number>

function labelLevel(entry: Entry, q: string, words: string[], starts: string[]): number {
  if (entry.label === q) return EXACT
  if (entry.label.startsWith(q)) return PREFIX
  if (hasWords(entry.labelWords, starts)) return WORDS
  if (words.every((w) => entry.label.includes(w))) return CONTAINS
  return 0
}

/**
 * Every query word starts a word in `words`; a word with several pieces (`src/user`) needs them in
 * a row. Words with no letters or digits never match here.
 */
function hasWords(words: string, starts: string[]): boolean {
  return starts.every((run) => run !== '' && words.includes(` ${run}`))
}

function entry(item: SearchItem, others: (string | undefined)[]): Entry {
  const fields = unique(others.filter((f): f is string => !!f).map((f) => f.toLowerCase()))
  const labelWords = ` ${tokens(item.label).join(' ')}`
  const otherWords = others.map((f) => (f ? ` ${tokens(f).join(' ')}` : ''))
  const label = item.label.toLowerCase()
  return {
    item,
    label,
    fields,
    labelWords,
    allWords: [labelWords, ...otherWords].join('\n'),
    allText: [label, ...fields].join('\n'),
  }
}

/** Lowercased words: split on anything not a letter or digit and on camelCase (`getUsers` → get, users). */
function tokens(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

/** The path and the file name, so `auth-api.ts` is an exact match for `src/lib/auth-api.ts`. */
function fileFields(file: string): string[] {
  return [file, file.slice(file.lastIndexOf('/') + 1)]
}

function routeDetail(route: Route): string {
  const extra = route.slot ? `@${route.slot} · ` : route.intercepting ? `intercepts · ` : ''
  const methods = route.methods?.length ? `${route.methods.join(', ')} · ` : ''
  return `${extra}${methods}${route.file}`
}

/** Who sends a request: its component, handler, action or the middleware. */
function siteOwner(site: RequestSite, index: ModelIndex): string {
  if (site.componentId) return index.components.get(site.componentId)?.name ?? 'component'
  if (site.origin === 'route-handler' && site.routeId) {
    return `${site.handlerMethod ?? ''} ${index.routes.get(site.routeId)?.path ?? 'route handler'}`.trim()
  }
  if (site.origin === 'server-action') return `action ${site.serverAction?.name ?? '?'}`
  if (site.origin === 'middleware') return 'middleware'
  return site.origin
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

/** Plain code-unit order: much cheaper than `localeCompare` when a short query matches thousands. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
