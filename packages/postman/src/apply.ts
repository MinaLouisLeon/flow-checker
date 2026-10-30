// Checks a scan against an imported Postman collection (M15, docs/PLAN.md):
// - each request site is matched to a collection request by method + URL pattern
//   (`{{baseUrl}}/users/:id` ≈ `/users/${id}`), sites with none get `not-in-collection` and
//   collection requests no site calls get `unused-endpoint`;
// - a URL the scanner left `unknown` is filled from the collection when the call's literal path
//   parts, function names and method point to exactly one request (confidence `postman`);
// - saved examples fill missing response / body types (source `postman`), and are checked
//   against the types the code declares (`contract-mismatch`).
// Pure: the scanned model is not changed, a new one is returned.
import {
  type AppModel,
  checkValue,
  describeMismatch,
  type Flag,
  formatTypeShape,
  makeId,
  type PostmanRequest,
  type RequestSite,
  type RequestUrl,
  type TypeMismatch,
  type TypeRef,
  type TypeTable,
  typeTable,
} from '@flow-checker/shared'
import type { ImportedExample, ImportedRequest, JsonBody, PostmanImport, Variable } from './imported'
import { shapeOfValues } from './shape'

export interface ApplyOptions {
  /** Origins the app itself runs on (`http://localhost:3000`): collection URLs there are same-origin. */
  appOrigins?: string[]
}

type Seg = { kind: 'static'; value: string } | { kind: 'param'; name: string }

/**
 * Where a URL goes. `origin`: normalized origin, `app` for the app's own, `undefined` when not
 * known (an unresolved `{{baseUrl}}` or an env variable without fallback). `soft`: the origin is
 * an env variable's fallback, so it may differ at runtime.
 */
interface Target {
  origin: string | undefined
  soft?: boolean
  segments: Seg[]
}

interface Endpoint extends Target {
  request: ImportedRequest
  entry: Omit<PostmanRequest, 'siteIds' | 'flags'>
  words: Set<string>
  staticWords: Set<string>
}

const MAX_VARIABLE_DEPTH = 10
/** The type text shown when the shape is longer than this. */
const MAX_TYPE_TEXT = 80

export function applyPostman(model: AppModel, imported: PostmanImport, options: ApplyOptions = {}): AppModel {
  const appOrigins = new Set((options.appOrigins ?? []).map(normalizeOrigin).filter(Boolean) as string[])
  const endpoints = imported.requests.map((r) => endpoint(r, imported, appOrigins))
  const types = typeTable(model.types)
  const callers = new Map<Endpoint, string[]>(endpoints.map((e) => [e, []]))

  const requests = model.requests.map((site) => {
    if (site.transport === 'server-action' || !site.url) return site
    const target = siteTarget(site.url, appOrigins)
    let match: { endpoint: Endpoint; by: 'url' | 'code' } | undefined
    if (target) {
      const found = bestByUrl(site, target, endpoints)
      if (found) match = { endpoint: found, by: 'url' }
    } else if (site.url.confidence === 'unknown') {
      const found = bestByCode(site, endpoints)
      if (found) match = { endpoint: found, by: 'code' }
    }

    if (!match) {
      // Only sites that call the collection's API: same origin, or one side unknown.
      if (target && site.method && endpoints.some((e) => compatible(target as Target, e))) {
        const flag: Flag = {
          kind: 'not-in-collection',
          message: `The Postman collection "${imported.collection.name}" has no ${site.method} ${site.url.path ?? site.url.text} request.`,
        }
        return { ...site, flags: [...site.flags, flag] }
      }
      return site
    }

    const { endpoint: e, by } = match
    callers.get(e)?.push(site.id)
    let next: RequestSite = { ...site, contract: { requestId: e.entry.id, name: e.entry.name, by } }
    let flags = site.flags
    if (by === 'code') {
      const url: RequestUrl = {
        ...e.entry.url,
        text: site.url.text,
        confidence: 'postman',
        ...(site.url.baseEnv ? { baseEnv: site.url.baseEnv } : {}),
      }
      next.url = url
      if (!next.method) next.method = e.entry.method
      flags = flags.filter((f) => f.kind !== 'dynamic-url' && (f.kind !== 'unknown-method' || !next.method))
    }

    const mismatches: string[] = []
    if (!hasType(site.responseType) && e.entry.responseType) {
      next.responseType = e.entry.responseType
      flags = flags.filter((f) => f.kind !== 'unknown-response')
    } else if (site.responseType && hasType(site.responseType)) {
      const examples = e.request.examples.filter(isSuccess)
      const found = checkExamples(
        examples.map((x) => ({ name: x.name, body: x.body as JsonBody })),
        site.responseType,
        types,
        'response.body',
      )
      if (found) mismatches.push(`The response type ${site.responseType.text} doesn't match ${found}`)
    }
    if (!hasType(site.bodyType) && e.entry.bodyType) {
      next.bodyType = e.entry.bodyType
    } else if (site.bodyType && hasType(site.bodyType) && e.request.body) {
      const found = checkExamples(
        [{ name: 'request body', body: e.request.body }],
        site.bodyType,
        types,
        'request.body',
      )
      if (found) mismatches.push(`The request body type ${site.bodyType.text} doesn't match ${found}`)
    }
    if (mismatches.length > 0) {
      flags = [...flags, { kind: 'contract-mismatch', message: `${mismatches.join('. ')}.` }]
    }
    next = { ...next, flags }
    return next
  })

  const entries: PostmanRequest[] = endpoints.map((e) => {
    const siteIds = callers.get(e) ?? []
    const flags: Flag[] =
      siteIds.length === 0
        ? [{ kind: 'unused-endpoint', message: 'No request in the code calls this endpoint.' }]
        : []
    return { ...e.entry, siteIds, flags }
  })

  return {
    ...model,
    requests,
    postman: {
      collection: imported.collection,
      ...(imported.environment ? { environment: imported.environment } : {}),
      importedAt: imported.importedAt,
      requests: entries,
    },
  }
}

// --- Collection requests ----------------------------------------------------------------------

function endpoint(request: ImportedRequest, imported: PostmanImport, appOrigins: Set<string>): Endpoint {
  // Postman's order: environment over collection; folder variables sit with the collection's.
  const variables = new Map<string, string>()
  for (const list of [
    imported.variables,
    request.variables ?? [],
    imported.environmentValues,
  ] as Variable[][]) {
    for (const v of list) variables.set(v.key, v.value)
  }
  const resolved = resolveUrl(request.url, variables, appOrigins)
  const success = request.examples.filter(isSuccess)
  const responseShape = shapeOfValues(success.map((x) => x.body?.value))
  const bodyShape = request.body ? shapeOfValues([request.body.value]) : undefined
  const path = renderPath(resolved.segments)
  const hasParam = resolved.segments.some((s) => s.kind === 'param')
  const url: RequestUrl = {
    text: request.url,
    confidence: resolved.baseVariable || hasParam ? 'pattern' : 'exact',
    ...(resolved.baseVariable
      ? { base: `{{${resolved.baseVariable}}}` }
      : resolved.origin && resolved.origin !== 'app'
        ? { base: resolved.origin }
        : {}),
    path,
  }
  const entry: Endpoint['entry'] = {
    id: makeId(
      'pmr',
      imported.collection.name,
      request.folder.join('/'),
      request.name,
      request.method,
      request.url,
    ),
    name: request.name,
    folder: request.folder,
    method: request.method,
    url,
    ...(resolved.unresolved.length > 0 ? { unresolved: resolved.unresolved } : {}),
    ...(responseShape ? { responseType: postmanType(responseShape, `${request.name} example`) } : {}),
    ...(bodyShape ? { bodyType: postmanType(bodyShape, `${request.name} body`) } : {}),
    examples: request.examples.map((x) => ({
      name: x.name,
      ...(x.status !== undefined ? { status: x.status } : {}),
    })),
  }
  const staticWords = new Set(resolved.segments.flatMap((s) => (s.kind === 'static' ? words(s.value) : [])))
  return {
    origin: resolved.origin,
    segments: resolved.segments,
    request,
    entry,
    staticWords,
    words: new Set([...staticWords, ...words(request.name)]),
  }
}

function postmanType(shape: NonNullable<TypeRef['shape']>, fallback: string): TypeRef {
  const text = formatTypeShape(shape)
  return { text: text.length <= MAX_TYPE_TEXT ? text : fallback, shape, source: 'postman' }
}

interface ResolvedUrl extends Target {
  /** The unresolved variable the URL starts with (its base is unknown). */
  baseVariable?: string
  unresolved: string[]
}

/** Fills in `{{variables}}` and splits the URL into origin and path segments. */
export function resolveUrl(
  raw: string,
  variables: Map<string, string>,
  appOrigins: Set<string>,
): ResolvedUrl {
  let text = raw.trim()
  for (let i = 0; i < MAX_VARIABLE_DEPTH && /\{\{[^{}]+\}\}/.test(text); i++) {
    const next = text.replace(/\{\{([^{}]+)\}\}/g, (all, key: string) => variables.get(key.trim()) ?? all)
    if (next === text) break
    text = next
  }
  const unresolved = [...new Set([...text.matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => (m[1] as string).trim()))]
  text = text.replace(/#.*$/, '').replace(/\?.*$/, '')

  let origin: string | undefined
  let baseVariable: string | undefined
  let path: string
  const leading = /^\{\{([^{}]+)\}\}(.*)$/.exec(text)
  const withScheme = /^([a-z][\w+.-]*:\/\/[^/]+)(.*)$/i.exec(text)
  if (leading) {
    baseVariable = (leading[1] as string).trim()
    path = leading[2] as string
  } else if (withScheme) {
    origin = normalizeOrigin(withScheme[1] as string)
    path = withScheme[2] as string
  } else if (text.startsWith('/')) {
    path = text
  } else {
    // `localhost:4010/users`: Postman adds `http://`.
    const slash = text.indexOf('/')
    origin = normalizeOrigin(`http://${slash === -1 ? text : text.slice(0, slash)}`)
    path = slash === -1 ? '' : text.slice(slash)
  }
  if (origin && appOrigins.has(origin)) origin = 'app'
  return {
    origin,
    ...(baseVariable ? { baseVariable } : {}),
    segments: path.split('/').filter(Boolean).map(segment),
    unresolved,
  }
}

function segment(raw: string): Seg {
  const param = /^:([A-Za-z_$][\w$]*)$/.exec(raw)
  if (param) return { kind: 'param', name: param[1] as string }
  const variable = /\{\{([^{}]+)\}\}/.exec(raw)
  if (variable) return { kind: 'param', name: (variable[1] as string).trim().replace(/[^\w$]/g, '_') }
  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {}
  // Example ids in saved URLs (`/users/1`) stand for any id.
  if (
    /^\d+$/.test(value) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
    /^[0-9a-f]{24,}$/i.test(value)
  ) {
    return { kind: 'param', name: 'id' }
  }
  return { kind: 'static', value }
}

function renderPath(segments: Seg[]): string {
  return `/${segments.map((s) => (s.kind === 'param' ? `:${s.name}` : s.value)).join('/')}`
}

// --- Request sites ----------------------------------------------------------------------------

/** Where a site's URL goes, or `undefined` when its path is unknown. */
function siteTarget(url: RequestUrl, appOrigins: Set<string>): Target | undefined {
  if (url.confidence === 'unknown' || url.path === undefined) return undefined
  const path = url.path.replace(/[?#].*$/, '')
  const segments: Seg[] = path
    .split('/')
    .filter(Boolean)
    .map((s) => {
      const param = /^:([A-Za-z_$][\w$]*)$/.exec(s)
      return param ? { kind: 'param', name: param[1] as string } : { kind: 'static', value: s }
    })
  if (!url.base) return url.baseEnv ? { origin: undefined, segments } : { origin: 'app', segments }
  let base: URL
  try {
    base = new URL(url.base)
  } catch {
    // `{NEXT_PUBLIC_API_URL}`: an env variable without a fallback.
    return { origin: undefined, segments }
  }
  const prefix: Seg[] = base.pathname
    .split('/')
    .filter(Boolean)
    .map((value) => ({ kind: 'static', value }))
  let origin = normalizeOrigin(base.origin)
  if (origin && appOrigins.has(origin)) origin = 'app'
  return { origin, ...(url.baseEnv ? { soft: true } : {}), segments: [...prefix, ...segments] }
}

/** Origins can't rule each other out: one is unknown, they are the same, or one may change at runtime. */
function compatible(a: Target, b: Target): boolean {
  return a.origin === undefined || b.origin === undefined || a.origin === b.origin || !!a.soft || !!b.soft
}

/** Points for a site URL vs a collection URL, or `undefined` when they can't be the same. */
function urlScore(site: RequestSite, target: Target, e: Endpoint): number | undefined {
  let score = 0
  if (site.method && site.method !== e.entry.method) return undefined
  if (!site.method) score -= 1
  if (target.origin !== undefined && e.origin !== undefined) {
    if (target.origin === e.origin) score += 2
    else if (target.soft) score -= 1
    else return undefined
  }
  // Compared from the end: a side whose base is unknown may leave out leading segments (`/v1`).
  const a = target.segments
  const b = e.segments
  if (a.length > b.length && e.origin !== undefined) return undefined
  if (b.length > a.length && target.origin !== undefined) return undefined
  score -= Math.abs(a.length - b.length)
  for (let i = 1; i <= Math.min(a.length, b.length); i++) {
    const x = a[a.length - i] as Seg
    const y = b[b.length - i] as Seg
    if (x.kind === 'static' && y.kind === 'static') {
      if (x.value.toLowerCase() !== y.value.toLowerCase()) return undefined
      score += 3
    } else if (x.kind === 'param' && y.kind === 'param') score += 2
    else score += 1
  }
  return score
}

function bestByUrl(site: RequestSite, target: Target, endpoints: Endpoint[]): Endpoint | undefined {
  let best: Endpoint | undefined
  let bestScore = Number.NEGATIVE_INFINITY
  for (const e of endpoints) {
    const score = urlScore(site, target, e)
    // Ties: the first in collection order.
    if (score !== undefined && score > bestScore) {
      best = e
      bestScore = score
    }
  }
  return best
}

/** Callees that say nothing about which endpoint is called. */
const GENERIC_CALLEES = new Set(['fetch', 'axios', 'request', 'http', 'api', 'client', 'ky', 'ofetch'])

/**
 * An unknown URL: the literal path parts written in it (`${API}/todos/${id}` → `todos`) must all
 * be in the request's path, and the function names on the call path (`getTodo`) and the method
 * point to it. Only a single best request is used.
 */
function bestByCode(site: RequestSite, endpoints: Endpoint[]): Endpoint | undefined {
  const literal = new Set(
    [
      ...(site.url?.text ?? '').replace(/\$\{[^{}]*\}/g, ' ').matchAll(/(?<![:/])\/([A-Za-z][\w.-]*)/g),
    ].flatMap((m) => words(m[1] as string)),
  )
  const callees = new Set(
    site.callStack
      .map((f) => f.callee.split('.').pop() ?? f.callee)
      .filter((name) => !GENERIC_CALLEES.has(name.toLowerCase()))
      .flatMap(words),
  )
  if (literal.size === 0 && callees.size === 0) return undefined
  const scored: { e: Endpoint; score: number }[] = []
  for (const e of endpoints) {
    if (site.method && site.method !== e.entry.method) continue
    if ([...literal].some((w) => !e.staticWords.has(w))) continue
    let score = site.method ? 0 : -1
    score += 3 * literal.size
    for (const w of callees) if (e.words.has(w)) score += 1
    scored.push({ e, score })
  }
  scored.sort((a, b) => b.score - a.score)
  const [first, second] = scored
  if (!first || first.score < 2 || (second && second.score >= first.score)) return undefined
  return first.e
}

// --- Types ------------------------------------------------------------------------------------

function isSuccess(example: ImportedExample): boolean {
  return !!example.body && (example.status === undefined || (example.status >= 200 && example.status < 300))
}

/** A type the code really declares (not missing, `any` or `unknown`). */
function hasType(ref: TypeRef | undefined): ref is TypeRef {
  return (
    !!ref && !(ref.shape.kind === 'primitive' && (ref.shape.name === 'any' || ref.shape.name === 'unknown'))
  )
}

/** `the Postman example "200 OK": id is string (expected number); …`, or `undefined` when all fit. */
function checkExamples(
  examples: { name: string; body: JsonBody }[],
  type: TypeRef,
  types: TypeTable,
  root: string,
): string | undefined {
  for (const example of examples) {
    const { mismatches } = checkValue(example.body.value, type.shape, {
      types,
      root,
      redactedPaths: example.body.redactedPaths,
    })
    if (mismatches.length === 0) continue
    return `the Postman ${example.name === 'request body' ? 'request body' : `example "${example.name}"`}: ${describe(mismatches)}`
  }
  return undefined
}

function describe(mismatches: TypeMismatch[]): string {
  const shown = mismatches.slice(0, 3).map(describeMismatch).join('; ')
  return mismatches.length > 3 ? `${shown} (+${mismatches.length - 3} more)` : shown
}

// --- Helpers ----------------------------------------------------------------------------------

function normalizeOrigin(origin: string): string | undefined {
  try {
    const url = new URL(origin)
    if (url.hostname === '127.0.0.1' || url.hostname === '[::1]') url.hostname = 'localhost'
    return url.origin
  } catch {
    return undefined
  }
}

const STOP_WORDS = new Set([
  'get',
  'set',
  'fetch',
  'load',
  'api',
  'http',
  'https',
  'request',
  'req',
  'res',
  'response',
  'url',
  'use',
  'query',
  'mutation',
  'data',
  'client',
  'json',
  'call',
  'send',
  'async',
  'the',
  'by',
  'to',
  'of',
  'for',
  'and',
  'an',
  'with',
  'from',
  'on',
  'in',
  'handle',
  'handler',
  'fn',
])

/** `getUserTodos` → `user`, `todo`. Lowercase, singular, without generic words. */
export function words(text: string): string[] {
  return text
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z\d]+/)
    .map(singular)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
}

function singular(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}
