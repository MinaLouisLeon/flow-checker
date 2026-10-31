// React Query keys (M13, docs/PLAN.md 14): formatting and matching.
// The scanner parses keys into `QueryKeyPart`s. Cache calls (`invalidateQueries`) match query
// keys by prefix, like React Query does, and captured keys (runtime values) are matched against
// a site's parsed key.
import type { QueryKeyPart, QueryLink } from './model'

type QueryLinkKind = QueryLink['kind']

/** `['todos', 'detail', :id]`, `['todos', { status: :status }]`, `[...keys]`. */
export function formatQueryKey(parts: readonly QueryKeyPart[]): string {
  return `[${parts.map(formatPart).join(', ')}]`
}

function formatPart(part: QueryKeyPart): string {
  switch (part.kind) {
    case 'static':
      return typeof part.value === 'string' ? `'${part.value}'` : String(part.value)
    case 'param':
      // A template with holes (`page-${n}`) keeps its text: `page-:n`. A value the scanner
      // couldn't read is marked `?`: `?libKey`.
      if (part.unknown) return `?${part.name}`
      return /^[\w$]+$/.test(part.name) ? `:${part.name}` : `\`${part.name}\``
    case 'rest':
      return `...${part.text}`
    case 'object':
      return part.entries.length === 0
        ? '{}'
        : `{ ${part.entries.map((e) => `${e.key}: ${formatPart(e.value)}`).join(', ')} }`
  }
}

/**
 * Whether a cache call's key (`filter`) hits a query key, both as parsed from code. Like React
 * Query, the filter is a prefix unless `exact`. A runtime `param` on either side may be any
 * value, so it matches; objects match when every entry of the filter's object matches.
 *
 * Segments the scanner could not read are never wildcards (M24). In the filter, an unresolved
 * spread or an `unknown` segment ends the part that counts: the known prefix before it is
 * matched, and a filter with no known first segment hits nothing. In the query key they are
 * never hit. A first segment that is only known at runtime says nothing about which queries a
 * key means, so it doesn't link either.
 */
export function queryKeyHits(filter: readonly QueryKeyPart[], key: readonly QueryKeyPart[], exact = false) {
  for (let i = 0; i < filter.length; i++) {
    const f = filter[i] as QueryKeyPart
    if (f.kind === 'rest' || isUnknownPart(f)) return i > 0
    const k = key[i]
    if (!k || k.kind === 'rest' || isUnknownPart(k)) return false
    if (i === 0 && (f.kind === 'param' || k.kind === 'param')) return false
    if (!partsMatch(f, k)) return false
  }
  return !exact || filter.length === key.length
}

/**
 * A cache call's key that can't link to anything: its first segment is a spread, a value the
 * scanner couldn't read, or one only known at runtime. Shown as "key not known".
 */
export function isUnknownKey(key: readonly QueryKeyPart[] | undefined): boolean {
  const first = key?.[0]
  return !!first && (first.kind === 'rest' || first.kind === 'param')
}

function isUnknownPart(part: QueryKeyPart): boolean {
  return part.kind === 'param' && part.unknown === true
}

function partsMatch(f: QueryKeyPart, k: QueryKeyPart): boolean {
  if (isUnknownPart(k)) return false
  if (f.kind === 'param' || k.kind === 'param' || f.kind === 'rest' || k.kind === 'rest') return true
  if (f.kind === 'static' && k.kind === 'static') return f.value === k.value
  if (f.kind === 'object' && k.kind === 'object') {
    return f.entries.every((fe) => {
      const ke = k.entries.find((e) => e.key === fe.key)
      return ke ? partsMatch(fe.value, ke.value) : false
    })
  }
  return false
}

/**
 * Whether a key captured at runtime (JSON values) is the key a site declares. Every segment must
 * fit: a `param` takes any value, statics must be equal, objects must have the same entries.
 */
export function queryKeyMatchesValue(parts: readonly QueryKeyPart[], value: readonly unknown[]): boolean {
  let i = 0
  for (; i < parts.length; i++) {
    const part = parts[i] as QueryKeyPart
    if (part.kind === 'rest') return true
    if (i >= value.length) return false
    if (!partMatchesValue(part, value[i])) return false
  }
  return i === value.length
}

function partMatchesValue(part: QueryKeyPart, value: unknown): boolean {
  switch (part.kind) {
    case 'param':
    case 'rest':
      return true
    case 'static':
      return part.value === value || (part.value === null && value === undefined)
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false
      const record = value as Record<string, unknown>
      const keys = Object.keys(record).filter((k) => record[k] !== undefined)
      const declared = new Set(part.entries.map((e) => e.key))
      // Entries left `undefined` at runtime drop out of the key, like React Query's hashing.
      if (keys.some((k) => !declared.has(k))) return false
      return part.entries.every((e) =>
        record[e.key] === undefined
          ? e.value.kind !== 'static' || e.value.value === null
          : partMatchesValue(e.value, record[e.key]),
      )
    }
  }
}

/** A key part with no static information at all: it says nothing about which query this is. */
export function isOpenKey(parts: readonly QueryKeyPart[]): boolean {
  return parts.every((p) => p.kind === 'param' || p.kind === 'rest')
}

/** What a cache link does to the queries it hits, as a verb: `refetches`, `updates`, ... */
export function queryLinkVerb(kind: QueryLinkKind): string {
  switch (kind) {
    case 'invalidate':
    case 'refetch':
      return 'refetches'
    case 'reset':
      return 'resets'
    case 'remove':
      return 'removes'
    case 'set-data':
      return 'updates'
    case 'hydrate':
      return 'hydrates'
  }
}

/** What a cache link targets, for display: its key, a tRPC procedure path (M16), or every query. */
export function queryLinkTarget(link: Pick<QueryLink, 'key' | 'procedure' | 'operation'>): string {
  if (link.operation) return `GraphQL ${link.operation}`
  if (link.procedure !== undefined) return `tRPC ${link.procedure || 'all procedures'}`
  return link.key ? formatQueryKey(link.key) : 'all queries'
}
