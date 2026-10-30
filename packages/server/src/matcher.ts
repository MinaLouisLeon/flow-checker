// Scores a capture against every scanned request site (docs/PLAN.md 8).
// Each site first has to be possible at all (same side, method, URL, server action, route
// handler). Then evidence adds points, and the best site wins if it is clearly ahead.
import {
  type AppModel,
  type Capture,
  type CaptureMatch,
  type Component,
  formatQueryKey,
  generalizePath,
  isOpenKey,
  type MatchCandidate,
  type MatchEvidence,
  type Middleware,
  matchRequestUrl,
  middlewareRunsOn,
  queryKeyMatchesValue,
  type RequestSite,
  routePathRegex,
  servedPaths,
} from '@flow-checker/shared'
import { type ServerActionInfo, sameSourceFile } from './actions'
import { type SourceFrame, shortName } from './stack'

/** Lowest score that counts as a match. URL + method alone reach it. */
export const MATCH_THRESHOLD = 40
/** How far the best site must be ahead of the next one. Closer than this is ambiguous. */
export const MATCH_MARGIN = 15
const MAX_CANDIDATES = 3

/** Names too common to tell sites apart. */
const GENERIC_CALLEES = new Set([
  'fetch',
  'axios',
  'request',
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'then',
  'call',
  'apply',
  'useQuery',
  'useSuspenseQuery',
  'useInfiniteQuery',
  'useMutation',
  'useSWR',
  'useSWRMutation',
  'useActionState',
  'useEffect',
  'useLayoutEffect',
  'mutate',
  'mutateAsync',
])

/** DOM events that fit each trigger event prop. */
const EVENT_TYPES: Record<string, string[]> = {
  onSubmit: ['submit'],
  action: ['submit', 'click'],
  formAction: ['submit', 'click'],
  onClick: ['click'],
  onChange: ['change', 'click'],
  onInput: ['change'],
  onKeyDown: ['keydown'],
  onKeyUp: ['keydown'],
}

interface SiteInfo {
  site: RequestSite
  /** Where the request is sent from. */
  side: 'browser' | 'server' | 'any'
  componentName?: string
  /** Page routes the site's component renders on. */
  routes: RegExp[]
  /** Origin `route-handler`: the handler it runs in. */
  handler?: { path: RegExp; method?: string }
  /** Function names on the site's call path. */
  callees: Set<string>
  /** Call path locations, for source-mapped frames. */
  locs: { file: string; line: number }[]
  files: Set<string>
  /** Sites whose `chain` leads to this one. */
  parents: Set<string>
  /** The server action: called by it (transport) or run inside it (origin). */
  action?: { name: string; file: string }
}

export interface MatchContext {
  /** Project frames of the capture's stack (source-mapped). */
  frames: SourceFrame[]
  /** Resolves a server action id through Next's manifest. */
  resolveAction: (id: string) => ServerActionInfo | undefined
  /** The match of the browser capture a server capture was made for. */
  parentMatch?: CaptureMatch
  /** A manual decision for captures like this one: a site id, or `null` for "none". */
  override?: string | null
}

export class Matcher {
  private readonly sites: SiteInfo[]
  private readonly siteIds: Set<string>
  private readonly middleware: Middleware | undefined

  constructor(model: AppModel) {
    this.sites = indexSites(model)
    this.siteIds = new Set(model.requests.map((s) => s.id))
    this.middleware = model.middleware
  }

  hasSite(id: string): boolean {
    return this.siteIds.has(id)
  }

  match(capture: Capture, context: MatchContext): CaptureMatch {
    const candidates: MatchCandidate[] = []
    const scoring: Scoring = {
      middleware: this.middleware,
      fromMiddleware: capture.origin === 'server' && fromMiddleware(capture, context, this.middleware),
    }
    for (const info of this.sites) {
      const evidence = scoreSite(info, capture, context, scoring)
      if (!evidence) continue
      const score = evidence.reduce((sum, e) => sum + e.points, 0)
      candidates.push({ siteId: info.site.id, score, evidence })
    }
    candidates.sort((a, b) => b.score - a.score || a.siteId.localeCompare(b.siteId))
    const top = candidates.filter((c) => c.score > 0).slice(0, MAX_CANDIDATES)

    if (context.override !== undefined) {
      const siteId = context.override
      if (siteId === null) return { status: 'unmatched', by: 'manual', score: 0, candidates: top }
      if (this.siteIds.has(siteId)) {
        const found = candidates.find((c) => c.siteId === siteId)
        const list = found ? [found, ...top.filter((c) => c !== found)].slice(0, MAX_CANDIDATES) : top
        return { status: 'matched', by: 'manual', siteId, score: found?.score ?? 0, candidates: list }
      }
      // The site is gone after a re-scan: fall back to automatic matching.
    }

    const [best, second] = top
    if (!best || best.score < MATCH_THRESHOLD) {
      return { status: 'unmatched', by: 'auto', score: best?.score ?? 0, candidates: top }
    }
    if (second && best.score - second.score < MATCH_MARGIN) {
      return { status: 'ambiguous', by: 'auto', score: best.score, candidates: top }
    }
    return { status: 'matched', by: 'auto', siteId: best.siteId, score: best.score, candidates: top }
  }
}

/** Facts about the capture that every site's score uses. */
interface Scoring {
  middleware: Middleware | undefined
  /** The server capture was sent from middleware code (M14). */
  fromMiddleware: boolean
}

/** Next runs middleware / proxy through its web adapter, on the edge and on Node.js. */
const MIDDLEWARE_FRAME = /[\\/]next[\\/]dist[\\/](esm[\\/])?server[\\/]web[\\/](adapter|sandbox)/

/** A source-mapped frame in the middleware file, or Next's middleware adapter on the stack. */
function fromMiddleware(
  capture: Capture,
  context: MatchContext,
  middleware: Middleware | undefined,
): boolean {
  if (middleware && context.frames.some((f) => f.file === middleware.file)) return true
  return capture.stack.some((line) => MIDDLEWARE_FRAME.test(line))
}

/** Evidence for one site, or `undefined` when the site cannot have sent this capture. */
function scoreSite(
  info: SiteInfo,
  capture: Capture,
  context: MatchContext,
  scoring: Scoring,
): MatchEvidence[] | undefined {
  const { site } = info
  const evidence: MatchEvidence[] = []
  const add = (signal: MatchEvidence['signal'], points: number, detail?: string) =>
    evidence.push(detail ? { signal, points, detail } : { signal, points })

  // --- Hard filters -------------------------------------------------------------------------

  if (info.side !== 'any' && info.side !== capture.origin) return undefined
  const method = capture.request.method.toUpperCase()
  if (site.method && site.method !== method) return undefined

  const browserAction = capture.origin === 'browser' ? capture.serverAction?.id : undefined
  if ((site.transport === 'server-action') !== Boolean(browserAction)) return undefined

  if (browserAction) {
    // The request posts to the page, so the URL says nothing. The action id says everything.
    const action = context.resolveAction(browserAction)
    if (action && info.action) {
      if (!sameAction(action, info.action)) return undefined
      add('server-action', 100, `${action.exportedName} in ${info.action.file}`)
    }
  } else if (site.url) {
    let url: URL
    try {
      url = new URL(capture.request.url)
    } catch {
      return undefined
    }
    const urlMatch = matchRequestUrl(site.url, url)
    if (urlMatch) {
      add('url', urlMatch.kind === 'exact' ? 40 : 35, `${method} ${site.url.path}`)
      if (urlMatch.sameBase) add('url', 5, 'same base URL')
      if (urlMatch.queryKeys > 0) add('url', 3 * urlMatch.queryKeys, 'query keys')
    } else if (site.url.confidence !== 'unknown') {
      return undefined
    }
  }

  const parent = capture.origin === 'server' ? capture.parent : undefined
  if (info.handler) {
    // Runs inside a route handler: the incoming request must be that handler.
    if (!parent) return undefined
    if (info.handler.method && parent.method.toUpperCase() !== info.handler.method) return undefined
    const handled = pathOf(parent.url)
    const served = handled === undefined ? [] : servedPaths(scoring.middleware, handled)
    if (!served.some((p) => info.handler?.path.test(p))) return undefined
    add('route', 40, `in ${parent.method} ${handled}`)
  }

  // Middleware (M14): it only runs on requests its matcher selects.
  if (site.origin === 'middleware') {
    const requested = pathOf(parent?.url)
    const runs =
      scoring.middleware && requested !== undefined
        ? middlewareRunsOn(scoring.middleware, requested)
        : undefined
    if (runs === 'no' && !scoring.fromMiddleware) return undefined
    if (runs === 'yes' || runs === 'conditional')
      add('middleware', runs === 'yes' ? 20 : 10, `runs on ${requested}`)
    if (scoring.fromMiddleware) add('middleware', 30, 'sent from middleware')
  } else if (scoring.fromMiddleware) {
    add('middleware', -30, 'sent from middleware, the site is not')
  }

  if (site.origin === 'server-action' && info.action) {
    const id = parent?.serverActionId
    const action = id ? context.resolveAction(id) : undefined
    if (action) {
      if (!sameAction(action, info.action)) return undefined
      add('server-action', 60, `inside ${action.exportedName}`)
    } else if (!id) {
      // A server action function called without an action request, e.g. from a server component.
      add('server-action', -10, 'not inside a server action request')
    }
  }

  // --- Evidence -----------------------------------------------------------------------------

  // Source-mapped frames on the site's call path. Shared wrappers match several sites, so the
  // more frames match, the more it counts.
  let lineHits = 0
  let fileHit: string | undefined
  for (const frame of context.frames) {
    if (info.locs.some((loc) => loc.file === frame.file && Math.abs(loc.line - frame.line) <= 1)) lineHits++
    else if (!fileHit && info.files.has(frame.file)) fileHit = frame.file
  }
  if (lineHits > 0) add('stack-source', Math.min(75, 25 * lineHits), `${lineHits} frame(s) on the call path`)
  else if (fileHit) add('stack-source', 10, `frame in ${fileHit}`)

  const names = capture.stack.map(frameName).filter((n): n is string => Boolean(n))
  if (info.componentName) {
    const name = info.componentName
    const hit = names.find((n) => n === name || n.startsWith(`${name}.`))
    if (hit) add('stack-name', 20, hit)
  }
  const calleeHits = new Set(names.map(shortName).filter((n) => info.callees.has(n)))
  if (calleeHits.size > 0)
    add('stack-name', Math.min(15, 5 * calleeHits.size), [...calleeHits].slice(0, 3).join(', '))

  const interaction = capture.interaction
  if (interaction && info.componentName) {
    const index = interaction.componentChain.indexOf(info.componentName)
    if (index >= 0) add('component', index === 0 ? 30 : index <= 2 ? 25 : 15, info.componentName)
  }

  const routePath = capture.origin === 'browser' ? pathOf(capture.pageUrl) : parent && pathOf(parent.url)
  // A rewritten path is answered by another route (M14).
  const served = routePath === undefined ? [] : servedPaths(scoring.middleware, routePath)
  if (routePath !== undefined && info.routes.some((r) => served.some((p) => r.test(p)))) {
    add('route', site.trigger.kind === 'server-render' ? 25 : 15, routePath)
  }

  const parentSite = context.parentMatch?.status === 'matched' ? context.parentMatch.siteId : undefined
  if (parentSite && info.parents.has(parentSite)) add('parent', 40, 'next hop of the browser request')

  const trigger = site.trigger
  if (trigger.kind === 'event') {
    const types = trigger.event ? EVENT_TYPES[trigger.event] : undefined
    // The runtime records clicks, submits, changes and Enter: hover or focus leaves no interaction.
    const untracked =
      !!trigger.event && !types && /^on(Mouse|Pointer|Focus|Blur|Scroll|Touch)/.test(trigger.event)
    if (untracked) {
      if (!interaction) add('trigger', 5, `${trigger.event} is not recorded`)
    } else if (!interaction) add('trigger', -10, `no interaction for ${trigger.event ?? 'event'}`)
    else if (!types || types.includes(interaction.type)) add('trigger', 10, `${interaction.type} event`)
  } else if ((trigger.kind === 'page-load' || trigger.kind === 'effect') && !interaction) {
    add('trigger', 5, trigger.kind)
  }

  // React Query (M13): the key the browser request was sent for.
  const query = capture.origin === 'browser' ? capture.query : undefined
  if (query) {
    const siteKind = site.hook?.name === 'useMutation' ? 'mutation' : site.queryKey ? 'query' : undefined
    if (!site.hook) {
      add('query-key', -10, `sent by a React Query ${query.kind}, not from a query hook here`)
    } else if (siteKind && siteKind !== query.kind) {
      add('query-key', -15, `sent by a ${query.kind}, the site is a ${siteKind}`)
    } else if (site.queryKey && query.key) {
      const text = formatQueryKey(site.queryKey)
      if (!queryKeyMatchesValue(site.queryKey, query.key)) add('query-key', -30, `key is not ${text}`)
      // A key with no fixed part fits any query, so it tells little.
      else add('query-key', isOpenKey(site.queryKey) ? 10 : 45, text)
    }
  }

  return evidence
}

function sameAction(action: ServerActionInfo, site: { name: string; file: string }): boolean {
  return action.exportedName === site.name && sameSourceFile(action.filename, site.file)
}

function frameName(line: string): string | undefined {
  const m = /^\s*at\s+(?:async\s+)?([^\s(]+)\s+\(/.exec(line)
  return m?.[1]
}

function pathOf(url: string | undefined): string | undefined {
  if (url === undefined) return undefined
  try {
    return decodeURI(new URL(url, 'http://localhost').pathname)
  } catch {
    return undefined
  }
}

/**
 * Remembers manual decisions across captures: same side, method, URL shape, server action,
 * incoming request (server) and nearest component (browser).
 */
export function fingerprint(capture: Capture): string {
  let target = capture.request.url
  try {
    const url = new URL(capture.request.url)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    target = `${local ? '' : url.host}${generalizePath(url.pathname)}`
  } catch {}
  const parent = capture.parent
  return [
    capture.origin,
    capture.request.method.toUpperCase(),
    target,
    capture.serverAction?.id ?? parent?.serverActionId ?? '',
    parent ? `${parent.method} ${generalizePath(pathOf(parent.url) ?? '')}` : '',
    capture.interaction?.componentChain[0] ?? '',
  ].join('|')
}

// --- Site index -----------------------------------------------------------------------------

function indexSites(model: AppModel): SiteInfo[] {
  const components = new Map(model.components.map((c) => [c.id, c]))
  const routes = new Map(model.routes.map((r) => [r.id, r]))

  // Component → routes whose page or layouts render it, directly or further down.
  const routesOf = new Map<string, Set<string>>()
  for (const route of model.routes) {
    if (route.kind !== 'page') continue
    const seen = new Set<string>()
    const roots = [...route.layoutChain.map((l) => l.componentId), route.componentId]
    for (const id of roots) if (id) walk(id, components, seen)
    for (const id of seen) addTo(routesOf, id, route.path)
  }

  const parents = new Map<string, Set<string>>()
  for (const site of model.requests) {
    for (const next of site.chain ?? []) addTo(parents, next, site.id)
  }

  return model.requests.map((site): SiteInfo => {
    const component = site.componentId ? components.get(site.componentId) : undefined
    const kind = site.trigger.kind
    const side =
      kind === 'server-render' ||
      kind === 'route-handler' ||
      kind === 'server-action' ||
      kind === 'middleware'
        ? 'server'
        : kind === 'unknown'
          ? 'any'
          : 'browser'

    const callees = new Set<string>()
    const locs: { file: string; line: number }[] = []
    const files = new Set<string>()
    for (const frame of site.callStack) {
      const name = shortName(frame.callee.replace(/\(.*$/, ''))
      if (name.length > 2 && !GENERIC_CALLEES.has(name)) callees.add(name)
      locs.push({ file: frame.file, line: frame.line })
      files.add(frame.file)
    }
    if (site.trigger.loc) locs.push({ file: site.trigger.loc.file, line: site.trigger.loc.line })
    if (component) files.add(component.file)

    let handler: SiteInfo['handler']
    if (site.origin === 'route-handler' && site.routeId) {
      const route = routes.get(site.routeId)
      if (route) handler = { path: routePathRegex(route.path), method: site.handlerMethod }
    }

    return {
      site,
      side,
      componentName: component?.name,
      routes: [...(component ? (routesOf.get(component.id) ?? []) : [])].map(routePathRegex),
      handler,
      callees,
      locs,
      files,
      parents: parents.get(site.id) ?? new Set(),
      action: site.serverAction && { name: site.serverAction.name, file: site.serverAction.loc.file },
    }
  })
}

function addTo(map: Map<string, Set<string>>, key: string, value: string) {
  const set = map.get(key)
  if (set) set.add(value)
  else map.set(key, new Set([value]))
}

function walk(id: string, components: Map<string, Component>, seen: Set<string>) {
  if (seen.has(id)) return
  seen.add(id)
  for (const child of components.get(id)?.children ?? []) {
    if (child.componentId) walk(child.componentId, components, seen)
  }
}
