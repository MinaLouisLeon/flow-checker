// Backend endpoints (M29): the request sites folded into one row per endpoint the app calls,
// grouped by host. Derived from the model (nothing is stored), so the dashboard, the exporter and
// the CLI share one implementation.
//
// One endpoint = base + method + URL pattern. tRPC calls are one endpoint per procedure, GraphQL
// calls one per operation, server actions one per action. Requests to relative URLs and the app's
// route handlers are "this app's API"; what those handlers send on is listed under the host it goes to.
import { urlText } from './format-requests'
import { makeId } from './ids'
import type { HttpMethod, RequestSite, RequestUrl, Route, TypeRef } from './model'
import type { ModelIndex } from './model-index'

export const ENDPOINT_TRANSPORTS = ['http', 'trpc', 'graphql', 'sse', 'websocket', 'server-action'] as const
export type EndpointTransport = (typeof ENDPOINT_TRANSPORTS)[number]

/**
 * From the direct call sites: `mismatch` when one has a type mismatch, `needs-recheck` when one
 * changed since its captures, `verified` when one was captured, else `not-captured`.
 */
export const ENDPOINT_STATUSES = ['verified', 'mismatch', 'needs-recheck', 'not-captured'] as const
export type EndpointStatus = (typeof ENDPOINT_STATUSES)[number]

/** `app`: same origin (this app's API). `external`: a base URL or env base. `unknown`: no URL. */
export type HostKind = 'app' | 'external' | 'unknown'

export interface Endpoint {
  /** Stable id (`ep_…`), used in links. Same endpoint, same key across re-scans. */
  key: string
  /** `EndpointHost.key` of its host. */
  host: string
  /** `?` when no call site says. */
  method: HttpMethod | '?'
  /** What is shown: the path pattern (`/users/:id`), procedure path, operation name or action name. */
  pattern: string
  transport: EndpointTransport
  /** Request sites that send it. */
  siteIds: string[]
  /** Requests to a catch-all route handler that forwards them here (`RequestSite.upstream`). */
  forwardedSiteIds: string[]
  /** Query string patterns its sites send, e.g. `userId=:userId`. */
  queries: string[]
  /** Pages that send it: from their components, or through a route handler or server action. */
  routeIds: string[]
  /** Components that send it, directly or through a route handler or server action they call. */
  componentIds: string[]
  /** Sent from code running in the browser (client components, form actions). */
  browser: boolean
  /** Sent from server code (server components, route handlers, actions, middleware, a proxy). */
  server: boolean
  status: EndpointStatus
  /** Of `siteIds`, those matched by a live capture. */
  verifiedSites: number
  /** This app's route handler that serves it. */
  routeId?: string
  /** Postman collection requests its sites call (M15). */
  contracts: { requestId: string; name: string }[]
  /** tRPC procedure (transport `trpc`). */
  procedure?: RequestSite['procedure']
  /** GraphQL operation (transport `graphql`). */
  operation?: RequestSite['operation']
  /** The first type a site declares. */
  bodyType?: TypeRef
  responseType?: TypeRef
}

export interface EndpointHost {
  key: string
  kind: HostKind
  /** `This app's API`, `{API_URL ?? http://localhost:4010}`, `http://localhost:4011`, `URL not known`. */
  label: string
  /** Env variable the base comes from. */
  baseEnv?: string
  /** Base URL, or the env base's fallback. */
  base?: string
  endpoints: Endpoint[]
}

export interface EndpointList {
  /** This app first, then external hosts by label, then unknown URLs. */
  hosts: EndpointHost[]
  /** Every endpoint, in host order. */
  endpoints: Endpoint[]
  byKey: Map<string, Endpoint>
  /** Site id → the endpoints it sends to (its own, then the one it is forwarded to). */
  bySite: Map<string, Endpoint[]>
}

export const APP_HOST = 'app'
export const UNKNOWN_HOST = 'unknown'

const METHOD_ORDER = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', '?']

interface Draft extends Endpoint {
  sortPattern: string
}

export function buildEndpoints(index: ModelIndex): EndpointList {
  const { model } = index
  const drafts = new Map<string, Draft>()
  const hosts = new Map<string, Omit<EndpointHost, 'endpoints'>>()
  const bySite = new Map<string, Endpoint[]>()

  const add = (site: RequestSite, url: RequestUrl | undefined, forwarded: boolean) => {
    const target = endpointTarget(site, url, forwarded)
    if (!hosts.has(target.host.key)) hosts.set(target.host.key, target.host)
    const id = makeId('ep', target.host.key, target.keyText)
    let ep = drafts.get(id)
    if (!ep) {
      ep = {
        key: id,
        host: target.host.key,
        method: site.method ?? '?',
        pattern: target.pattern,
        sortPattern: target.keyText,
        transport: target.transport,
        siteIds: [],
        forwardedSiteIds: [],
        queries: [],
        routeIds: [],
        componentIds: [],
        browser: false,
        server: false,
        status: 'not-captured',
        verifiedSites: 0,
        contracts: [],
        ...(target.procedure ? { procedure: target.procedure } : {}),
        ...(target.operation ? { operation: target.operation } : {}),
      }
      drafts.set(id, ep)
    }
    if (ep.method === '?' && site.method) ep.method = site.method
    if (forwarded) addOnce(ep.forwardedSiteIds, site.id)
    else addOnce(ep.siteIds, site.id)
    if (url?.query && !forwarded) addOnce(ep.queries, url.query)
    if (!forwarded && site.targetRouteId) ep.routeId ??= site.targetRouteId
    if (forwarded) ep.server = true
    else if (runsInBrowser(site, index)) ep.browser = true
    else ep.server = true
    if (!forwarded) {
      if (site.contract && !ep.contracts.some((c) => c.requestId === site.contract?.requestId)) {
        ep.contracts.push({ requestId: site.contract.requestId, name: site.contract.name })
      }
      ep.bodyType = betterType(ep.bodyType, site.bodyType)
      ep.responseType = betterType(ep.responseType, site.responseType)
    }
    const callers = callersOf(site, index)
    for (const id of callers.routeIds) addOnce(ep.routeIds, id)
    for (const id of callers.componentIds) addOnce(ep.componentIds, id)
    const list = bySite.get(site.id)
    if (list) {
      if (!list.includes(ep)) list.push(ep)
    } else bySite.set(site.id, [ep])
  }

  for (const site of model.requests) {
    add(site, site.url, false)
    if (site.upstream) add(site, site.upstream, true)
  }

  // Route handler methods nothing in the code calls are still part of this app's API.
  const served = new Set<string>()
  for (const ep of drafts.values()) {
    if (!ep.routeId) continue
    const route = index.routes.get(ep.routeId)
    // A tRPC, GraphQL or catch-all handler answers whatever its callers send.
    served.add(`${ep.routeId} ${ep.method}`)
    if (ep.transport === 'trpc' || ep.transport === 'graphql' || route?.segments.some(isCatchAll)) {
      for (const m of route?.methods ?? []) served.add(`${ep.routeId} ${m}`)
    }
  }
  for (const route of model.routes) {
    if (route.kind !== 'route-handler') continue
    for (const method of route.methods ?? []) {
      if (served.has(`${route.id} ${method}`)) continue
      const pattern = routePattern(route)
      const host = appHost()
      if (!hosts.has(host.key)) hosts.set(host.key, host)
      const id = makeId('ep', host.key, `${method} ${normalizePath(pattern)}`)
      if (drafts.has(id)) continue
      drafts.set(id, {
        key: id,
        host: host.key,
        method,
        pattern,
        sortPattern: normalizePath(pattern),
        transport: (model.streams ?? []).some((s) => s.routeId === route.id && s.method === method)
          ? 'sse'
          : 'http',
        siteIds: [],
        forwardedSiteIds: [],
        queries: [],
        routeIds: [],
        componentIds: [],
        browser: false,
        server: false,
        status: 'not-captured',
        verifiedSites: 0,
        routeId: route.id,
        contracts: [],
      })
    }
  }

  for (const ep of drafts.values()) {
    const sites = ep.siteIds.map((id) => index.requests.get(id)).filter((s): s is RequestSite => !!s)
    ep.verifiedSites = sites.filter((s) => s.status === 'verified' || s.status === 'mismatch').length
    ep.status = endpointStatus(sites)
  }

  const grouped = new Map<string, Draft[]>()
  for (const ep of drafts.values()) {
    const list = grouped.get(ep.host)
    if (list) list.push(ep)
    else grouped.set(ep.host, [ep])
  }
  const hostList: EndpointHost[] = [...hosts.values()]
    .sort(compareHosts)
    .map((h) => ({ ...h, endpoints: (grouped.get(h.key) ?? []).sort(compareEndpoints).map(strip) }))
  const endpoints = hostList.flatMap((h) => h.endpoints)
  const byKey = new Map(endpoints.map((e) => [e.key, e]))
  // `strip` made new objects: point the site map at them.
  for (const [siteId, list] of bySite) {
    bySite.set(
      siteId,
      list.map((e) => byKey.get(e.key) ?? e),
    )
  }
  return { hosts: hostList, endpoints, byKey, bySite }
}

function strip({ sortPattern: _, ...ep }: Draft): Endpoint {
  return ep
}

interface Target {
  host: Omit<EndpointHost, 'endpoints'>
  /** What identifies the endpoint within its host. */
  keyText: string
  pattern: string
  transport: EndpointTransport
  procedure?: RequestSite['procedure']
  operation?: RequestSite['operation']
}

function endpointTarget(site: RequestSite, url: RequestUrl | undefined, forwarded: boolean): Target {
  if (!forwarded && site.transport === 'server-action') {
    const name = site.serverAction?.name ?? '?'
    return {
      host: appHost(),
      keyText: `action ${name} ${site.serverAction?.loc.file ?? ''}`,
      pattern: name,
      transport: 'server-action',
    }
  }
  const host = hostOf(url)
  const method = site.method ?? '?'
  if (!forwarded && site.transport === 'trpc' && site.procedure) {
    return {
      host,
      keyText: `trpc ${site.procedure.path}`,
      pattern: site.procedure.path,
      transport: 'trpc',
      procedure: site.procedure,
    }
  }
  if (!forwarded && site.transport === 'graphql' && site.operation) {
    const op = site.operation
    return {
      host,
      keyText: `graphql ${op.name || op.id}`,
      pattern: `${op.type} ${op.name || '(anonymous)'}`,
      transport: 'graphql',
      operation: op,
    }
  }
  const transport: EndpointTransport = forwarded
    ? 'http'
    : site.transport === 'sse' || site.transport === 'websocket'
      ? site.transport
      : 'http'
  if (!url?.path) {
    const text = url?.text ?? '?'
    return { host, keyText: `${method} ? ${text}`, pattern: `? ${text}`, transport }
  }
  return { host, keyText: `${method} ${normalizePath(url.path)}`, pattern: url.path, transport }
}

function appHost(): Omit<EndpointHost, 'endpoints'> {
  return { key: APP_HOST, kind: 'app', label: "This app's API" }
}

/** The host a URL goes to. Env bases are one host per variable; ws:// and http:// are the same server. */
export function hostOf(url: RequestUrl | undefined): Omit<EndpointHost, 'endpoints'> {
  if (!url || (!url.path && !url.base && !url.baseEnv)) {
    return { key: UNKNOWN_HOST, kind: 'unknown', label: 'URL not known' }
  }
  if (url.baseEnv) {
    const label = urlText({ ...url, path: '', query: undefined })
    return {
      key: `env:${url.baseEnv}`,
      kind: 'external',
      label,
      baseEnv: url.baseEnv,
      ...(url.base && !url.base.startsWith('{') ? { base: url.base } : {}),
    }
  }
  if (!url.base) return appHost()
  const base = url.base.replace(/^ws(s?):\/\//i, 'http$1://').replace(/\/+$/, '')
  if (base.startsWith('{')) return { key: `base:${base}`, kind: 'unknown', label: base }
  return { key: `base:${base.toLowerCase()}`, kind: 'external', label: base, base }
}

/** `/users/:id/` → `/users/:`: param names and a trailing slash don't make another endpoint. */
function normalizePath(path: string): string {
  const out = path.replace(/:[A-Za-z_$][\w$]*\*?/g, ':').replace(/\{[^}]*\}/g, ':')
  return out.length > 1 ? out.replace(/\/+$/, '') : out
}

/** `/api/items/[id]` → `/api/items/:id`, `[...slug]` → `:slug*`. */
export function routePattern(route: Pick<Route, 'path'>): string {
  return route.path
    .replace(/\[\[\.\.\.([^\]]+)\]\]/g, ':$1*')
    .replace(/\[\.\.\.([^\]]+)\]/g, ':$1*')
    .replace(/\[([^\]]+)\]/g, ':$1')
}

function isCatchAll(segment: Route['segments'][number]): boolean {
  return segment.kind === 'catch-all' || segment.kind === 'optional-catch-all'
}

/** Code running in the browser sends it: a client component's render, effect or event, or a form action. */
export function runsInBrowser(site: RequestSite, index: ModelIndex): boolean {
  if (site.origin !== 'component') return false
  if (site.transport === 'server-action') return true
  if (site.trigger.kind === 'server-render') return false
  const component = site.componentId ? index.components.get(site.componentId) : undefined
  return component?.kind !== 'server'
}

/**
 * Pages and components behind a request: its component, or (for a request a route handler or
 * server action sends) the components that call that handler or action.
 */
function callersOf(
  site: RequestSite,
  index: ModelIndex,
  seen = new Set<string>(),
): { routeIds: string[]; componentIds: string[] } {
  const out = { routeIds: [] as string[], componentIds: [] as string[] }
  if (seen.has(site.id)) return out
  seen.add(site.id)
  if (site.componentId) {
    out.componentIds.push(site.componentId)
    for (const id of index.routesOf.get(site.componentId) ?? []) {
      if (index.routes.get(id)?.kind === 'page') out.routeIds.push(id)
    }
    return out
  }
  let callers: RequestSite[] = []
  if (site.origin === 'route-handler' && site.routeId) {
    callers = (index.handlerCallers.get(site.routeId) ?? []).filter(
      (c) => !site.handlerMethod || !c.method || c.method === site.handlerMethod,
    )
  } else if (site.origin === 'server-action' && site.serverAction) {
    const name = site.serverAction.name
    callers = index.model.requests.filter(
      (c) => c.transport === 'server-action' && c.serverAction?.name === name,
    )
  }
  for (const caller of callers) {
    const more = callersOf(caller, index, seen)
    for (const id of more.routeIds) addOnce(out.routeIds, id)
    for (const id of more.componentIds) addOnce(out.componentIds, id)
  }
  return out
}

function endpointStatus(sites: RequestSite[]): EndpointStatus {
  if (sites.some((s) => s.status === 'mismatch')) return 'mismatch'
  if (sites.some((s) => s.status === 'needs-recheck')) return 'needs-recheck'
  if (sites.some((s) => s.status === 'verified')) return 'verified'
  return 'not-captured'
}

/** Keeps the first type found, but a type from the code wins over one from Postman examples. */
function betterType(current: TypeRef | undefined, next: TypeRef | undefined): TypeRef | undefined {
  if (!next) return current
  if (!current || (current.source === 'postman' && next.source !== 'postman')) return next
  return current
}

function compareHosts(a: Omit<EndpointHost, 'endpoints'>, b: Omit<EndpointHost, 'endpoints'>): number {
  const rank = (h: Omit<EndpointHost, 'endpoints'>) => (h.kind === 'app' ? 0 : h.kind === 'external' ? 1 : 2)
  return rank(a) - rank(b) || compareText(a.label, b.label)
}

function compareEndpoints(a: Draft, b: Draft): number {
  const pattern = (e: Draft) => e.sortPattern.replace(/^[A-Z?]+ /, '')
  return (
    compareText(pattern(a), pattern(b)) ||
    METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method) ||
    compareText(a.key, b.key)
  )
}

/** Locale-free, so the order is the same on every machine (exports are golden-tested). */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function addOnce<T>(list: T[], value: T) {
  if (!list.includes(value)) list.push(value)
}

/** `GET /users/:id`, `query Todos`, `action createProduct`. */
export function endpointLabel(ep: Pick<Endpoint, 'method' | 'pattern' | 'transport'>): string {
  if (ep.transport === 'server-action') return `action ${ep.pattern}`
  if (ep.transport === 'graphql') return ep.pattern
  return `${ep.method} ${ep.pattern}`
}
