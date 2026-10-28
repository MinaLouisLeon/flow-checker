// Inferred user flows (docs/PLAN.md 6.6).
//
// A flow starts at an event handler that sends a request, e.g. a login form's `onSubmit`.
// Its steps: the interaction, the requests the handler sends, then the navigation that follows
// on success, the requests the next page sends when it loads, and the form on that page that
// takes the user further (its own requests and navigation), and so on.
// Error paths that navigate elsewhere become branches. A handler that only continues another
// flow (the OTP form after login) is not listed as a flow of its own.
import {
  type Component,
  type Flow,
  type FlowBranch,
  type FlowStep,
  makeId,
  type Navigation,
  type RequestSite,
  type Route,
  type SourceLoc,
} from '@flow-checker/shared'
import { compare } from './paths'

export interface FlowInput {
  routes: Route[]
  components: Component[]
  requests: RequestSite[]
  navigations: Navigation[]
}

/** Pages a flow passes through before it stops, so cycles end. */
const MAX_PAGES = 8

/** Everything one event handler does. */
interface Handler {
  key: string
  componentId: string
  event: string
  loc: SourceLoc
  requests: RequestSite[]
  /** Navigations on the success path (or with no outcome), in order. */
  next: Navigation[]
  /** Navigations only taken when a request failed. */
  onError: Navigation[]
}

const LOAD_TRIGGERS = new Set(['server-render', 'page-load', 'effect'])

export function inferFlows(input: FlowInput): Flow[] {
  const components = new Map(input.components.map((c) => [c.id, c]))
  const pageComponents = pageSubtrees(input.routes, components)
  const routesOf = new Map<string, string[]>()
  for (const route of input.routes) {
    for (const id of renderedOn(route, components)) push(routesOf, id, route.id)
  }

  // Server actions redirect on the server: their navigations follow the request that calls them.
  const actionNavs = new Map<string, Navigation[]>()
  for (const nav of input.navigations) {
    if (nav.origin === 'server-action' && nav.serverAction) push(actionNavs, actionKey(nav.serverAction), nav)
  }

  const handlers = new Map<string, Handler>()
  const handler = (componentId: string, event: string, loc: SourceLoc) => {
    const key = `${componentId}|${loc.file}:${loc.line}:${loc.column}`
    let found = handlers.get(key)
    if (!found) {
      found = { key, componentId, event, loc, requests: [], next: [], onError: [] }
      handlers.set(key, found)
    }
    return found
  }
  for (const site of input.requests) {
    const t = site.trigger
    if (site.origin !== 'component' || !site.componentId || t.kind !== 'event' || !t.loc) continue
    const h = handler(site.componentId, t.event ?? 'event', t.loc)
    h.requests.push(site)
    if (site.transport === 'server-action' && site.serverAction) {
      for (const nav of actionNavs.get(actionKey(site.serverAction)) ?? []) addNav(h, nav)
    }
  }
  for (const nav of input.navigations) {
    const t = nav.trigger
    if (nav.origin !== 'component' || !nav.componentId || t.kind !== 'event' || !t.loc) continue
    // A link is a handler of its own (a click on it), with no requests: never a flow start.
    addNav(handler(nav.componentId, t.event ?? 'event', t.loc), nav)
  }
  for (const h of handlers.values()) h.requests.sort(bySite)

  /** Handlers on a page that move the user on: they send requests (forms first). */
  const continuationOn = (routeId: string, visited: Set<string>) => {
    const ids = pageComponents.get(routeId) ?? new Set()
    const candidates = [...handlers.values()].filter(
      (h) =>
        ids.has(h.componentId) &&
        h.requests.length > 0 &&
        h.next.some((n) => n.targetRouteId && !visited.has(n.targetRouteId)),
    )
    candidates.sort(
      (a, b) => Number(isFormEvent(b.event)) - Number(isFormEvent(a.event)) || compareLoc(a.loc, b.loc),
    )
    return candidates[0]
  }

  const loadRequests = (routeId: string) => {
    const ids = pageComponents.get(routeId) ?? new Set()
    return input.requests
      .filter((s) => s.componentId && ids.has(s.componentId) && LOAD_TRIGGERS.has(s.trigger.kind))
      .sort(bySite)
  }

  const flows: { key: string; flow: Flow }[] = []
  /** Handler key -> start handlers of the flows that walk into it. */
  const continuedBy = new Map<string, Set<string>>()
  for (const start of [...handlers.values()].sort((a, b) => compareLoc(a.loc, b.loc))) {
    if (start.requests.length === 0) continue
    const routeId = routesOf.get(start.componentId)?.[0]
    const steps: FlowStep[] = []
    const branches: FlowBranch[] = []
    const routeIds = routeId ? [routeId] : []
    const visited = new Set(routeIds)
    let current: Handler | undefined = start
    let page = routeId
    while (current) {
      steps.push({
        kind: 'interaction',
        ...(page ? { routeId: page } : {}),
        componentId: current.componentId,
        event: current.event,
        loc: current.loc,
      })
      for (const site of current.requests) steps.push({ kind: 'request', siteId: site.id })
      const lastRequest = steps.length - 1
      if (current.onError.length > 0 && current.requests.length > 0) {
        branches.push({
          after: lastRequest,
          outcome: 'error',
          steps: current.onError.map((nav) => navigateStep(nav)),
        })
      }
      const nav = current.next.find((n) => n.targetRouteId) ?? current.next[0]
      if (!nav) break
      steps.push(navigateStep(nav))
      const target = nav.targetRouteId
      if (!target || visited.has(target) || routeIds.length >= MAX_PAGES) break
      visited.add(target)
      routeIds.push(target)
      page = target
      for (const site of loadRequests(target)) steps.push({ kind: 'request', siteId: site.id, onLoad: true })
      current = continuationOn(target, visited)
      if (current) {
        const by = continuedBy.get(current.key) ?? new Set()
        by.add(start.key)
        continuedBy.set(current.key, by)
      }
    }

    const component = components.get(start.componentId)
    flows.push({
      key: start.key,
      flow: {
        id: makeId('flw', start.key),
        name: `${component?.name ?? 'Component'} ${eventName(start.event)}`,
        ...(routeId ? { routeId } : {}),
        componentId: start.componentId,
        steps,
        branches,
        routeIds,
      },
    })
  }

  // A flow that only continues another one is part of it. When two flows lead into each
  // other (A -> B -> A), both stay.
  const kept = flows.filter(({ key }) => {
    const by = continuedBy.get(key)
    return !by || [...by].every((other) => continuedBy.get(other)?.has(key))
  })
  return uniqueNames(kept.map((f) => f.flow))
}

function addNav(h: Handler, nav: Navigation) {
  if (nav.outcome === 'error') h.onError.push(nav)
  else h.next.push(nav)
  h.next.sort((a, b) => compareLoc(a.loc, b.loc))
}

function navigateStep(nav: Navigation): FlowStep {
  return {
    kind: 'navigate',
    navigationId: nav.id,
    ...(nav.targetRouteId ? { routeId: nav.targetRouteId } : {}),
  }
}

/** Components a page renders below its page component (layouts stay mounted across navigation). */
function pageSubtrees(routes: Route[], components: Map<string, Component>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const route of routes) {
    const seen = new Set<string>()
    if (route.componentId) walk(route.componentId, components, seen)
    out.set(route.id, seen)
  }
  return out
}

/** Components rendered on a route: its layouts and its page, all the way down. */
function renderedOn(route: Route, components: Map<string, Component>): Set<string> {
  const seen = new Set<string>()
  if (route.kind !== 'page') return seen
  for (const id of [...route.layoutChain.map((l) => l.componentId), route.componentId]) {
    if (id) walk(id, components, seen)
  }
  return seen
}

function walk(id: string, components: Map<string, Component>, seen: Set<string>) {
  if (seen.has(id)) return
  seen.add(id)
  for (const child of components.get(id)?.children ?? []) {
    if (child.componentId) walk(child.componentId, components, seen)
  }
}

function uniqueNames(flows: Flow[]): Flow[] {
  const count = new Map<string, number>()
  return flows.map((flow) => {
    const n = (count.get(flow.name) ?? 0) + 1
    count.set(flow.name, n)
    return n === 1 ? flow : { ...flow, name: `${flow.name} (${n})` }
  })
}

/** `onSubmit` → `submit`, `action` → `submit` (a form action). */
function eventName(event: string): string {
  if (event === 'action' || event === 'formAction') return 'submit'
  return event.replace(/^on/, '').toLowerCase()
}

function isFormEvent(event: string): boolean {
  return event === 'onSubmit' || event === 'action' || event === 'formAction'
}

function actionKey(ref: { name: string; loc: SourceLoc }): string {
  return `${ref.loc.file}#${ref.name}`
}

function bySite(a: RequestSite, b: RequestSite): number {
  const fa = a.callStack[0]
  const fb = b.callStack[0]
  if (!fa || !fb) return compare(a.id, b.id)
  return compareLoc(fa, fb) || compare(a.id, b.id)
}

function compareLoc(a: SourceLoc, b: SourceLoc): number {
  return compare(a.file, b.file) || a.line - b.line || a.column - b.column
}

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}
