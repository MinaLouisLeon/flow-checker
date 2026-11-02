// Guarded pages (M31): what can stop each page from rendering. Middleware redirects and answers
// for the pages it runs on, and redirects / `notFound()`-like calls in the page, its layouts and the
// components they render. The label is about behavior: "redirects to `/login` when `!session`".
import {
  type Component,
  type Middleware,
  type MiddlewareMatcher,
  type MiddlewareRoute,
  makeId,
  matcherRegExp,
  type Navigation,
  type PageGuard,
  type Route,
  type RouteAccess,
} from '@flow-checker/shared'
import { routesUnder, samplePath } from './middleware'
import type { MiddlewareResponse, RenderExit, Unfollowed } from './requests'

export interface AccessInput {
  routes: Route[]
  components: Component[]
  navigations: Navigation[]
  middleware?: Middleware
  exits: RenderExit[]
  unfollowed: Unfollowed[]
  responses: MiddlewareResponse[]
}

/** Sets `access` on every page. */
export function addRouteAccess(input: AccessInput): void {
  const { routes, components, navigations, middleware } = input
  const pages = routes.filter((r) => r.kind === 'page')
  const navs = new Map(navigations.map((n) => [n.id, n]))
  const exits = groupBy(input.exits, (e) => e.componentId)
  const unfollowed = groupBy(input.unfollowed, (u) => u.componentId)
  const below = componentsBelow(components)
  const runsOn = new Map((middleware?.routes ?? []).map((r) => [r.routeId, r]))
  const factory = middleware?.factory
  const factoryReason =
    factory && !/^next-intl(\/|$)/.test(factory.module)
      ? `the middleware is made with \`${factory.name}\` from \`${factory.module}\`, which the scan can't read`
      : undefined

  for (const page of pages) {
    const guards = new Map<string, PageGuard>()
    const reasons: NonNullable<RouteAccess['reasons']> = []
    const ran = runsOn.get(page.id)
    if (middleware && ran) {
      for (const guard of middlewareGuards(middleware, ran, page, navigations, input.responses, pages))
        guards.set(guard.id, guard)
      if (factoryReason) reasons.push({ text: factoryReason, loc: middleware.loc })
    }
    const roots: { id: string; in: 'layout' | 'page' }[] = [
      ...page.layoutChain.flatMap((l) =>
        l.componentId ? [{ id: l.componentId, in: 'layout' as const }] : [],
      ),
      ...(page.componentId ? [{ id: page.componentId, in: 'page' as const }] : []),
    ]
    for (const root of roots) {
      for (const id of below(root.id)) {
        for (const exit of exits.get(id) ?? []) {
          if (guards.has(exit.id)) continue
          guards.set(exit.id, exitGuard(exit, id === root.id ? root.in : 'component', navs))
        }
        for (const call of unfollowed.get(id) ?? []) {
          const text =
            call.why === 'excluded'
              ? `calls \`${call.callee}\` from a file the config excludes`
              : `calls \`${call.callee}\`, whose import doesn't resolve`
          if (!reasons.some((r) => r.text === text)) reasons.push({ text, loc: call.loc })
        }
      }
    }
    const list = [...guards.values()]
    const sure = list.some((g) => !g.unclear && (g.condition || g.always))
    const status: RouteAccess['status'] = sure
      ? 'guarded'
      : list.length > 0 || reasons.length > 0
        ? 'unknown'
        : 'open'
    page.access = { status, guards: list, ...(reasons.length > 0 ? { reasons } : {}) }
  }
}

function exitGuard(exit: RenderExit, where: PageGuard['in'], navs: Map<string, Navigation>): PageGuard {
  const nav = exit.navigationId ? navs.get(exit.navigationId) : undefined
  return {
    id: exit.id,
    kind: exit.kind,
    in: where,
    componentId: exit.componentId,
    ...(exit.condition ? { condition: exit.condition } : {}),
    ...(!exit.condition && !exit.unclear ? { always: true as const } : {}),
    ...(exit.unclear ? { unclear: exit.unclear } : {}),
    ...(nav ? targetOf(nav) : {}),
    ...(exit.navigationId ? { navigationId: exit.navigationId } : {}),
    loc: exit.loc,
  }
}

function middlewareGuards(
  middleware: Middleware,
  ran: MiddlewareRoute,
  page: Route,
  navigations: Navigation[],
  responses: MiddlewareResponse[],
  pages: Route[],
): PageGuard[] {
  const matcher = matcherCondition(middleware, ran, page)
  const when = (condition: string | undefined) => {
    const parts = [matcher.text, condition].filter((p): p is string => !!p)
    if (matcher.unclear)
      return { unclear: matcher.unclear, ...(parts.length ? { condition: parts.join(' && ') } : {}) }
    return parts.length > 0 ? { condition: parts.join(' && ') } : { always: true as const }
  }
  const out: PageGuard[] = []
  for (const nav of navigations) {
    if (nav.origin !== 'middleware' || !nav.sourceRouteIds?.includes(page.id)) continue
    out.push({
      id: makeId('gd', nav.id),
      kind: 'redirect',
      in: 'middleware',
      ...when(nav.condition),
      ...targetOf(nav),
      navigationId: nav.id,
      loc: nav.loc,
    })
  }
  for (const response of responses) {
    const candidates = response.from ? routesUnder(response.from, pages, [page.id]) : [page.id]
    if (!candidates.includes(page.id)) continue
    if (response.exclude.some((check) => routesUnder(check, pages, [page.id]).length > 0)) continue
    out.push({
      id: response.id,
      kind: 'respond',
      in: 'middleware',
      ...when(response.condition),
      ...(response.status !== undefined ? { status: response.status } : {}),
      loc: response.loc,
    })
  }
  return out
}

/** When the middleware runs on a page only for some requests: the matcher's `has` / `missing`. */
function matcherCondition(
  middleware: Middleware,
  ran: MiddlewareRoute,
  page: Route,
): { text?: string; unclear?: string } {
  if (!ran.conditional) return {}
  if (middleware.matcherText !== undefined) return { unclear: "the middleware matcher can't be read" }
  const sample = samplePath(page.path, 'x')
  const matching = middleware.matchers.filter((m) => matcherRegExp(m.source)?.test(sample))
  if (matching.length === 0) {
    return { text: `the path matches ${middleware.matchers.map((m) => `\`${m.source}\``).join(' or ')}` }
  }
  return { text: matching.map(describeMatcher).join(' || ') }
}

function describeMatcher(m: MiddlewareMatcher): string {
  const item = (c: { type: string; key: string; value?: string }) =>
    `${c.type} ${c.key}${c.value !== undefined ? ` is ${c.value}` : ' is set'}`
  const missing = (c: { type: string; key: string }) => `${c.type} ${c.key} is missing`
  return [...(m.has ?? []).map(item), ...(m.missing ?? []).map(missing)].join(' && ')
}

function targetOf(nav: Navigation): Pick<PageGuard, 'target' | 'targetRouteId'> {
  const { href } = nav
  const target = href.path ? `${href.path}${href.query ? `?${href.query}` : ''}` : href.text
  return { ...(target ? { target } : {}), ...(nav.targetRouteId ? { targetRouteId: nav.targetRouteId } : {}) }
}

/** Every component rendered below one (itself first), cached. */
function componentsBelow(components: Component[]): (id: string) => string[] {
  const byId = new Map(components.map((c) => [c.id, c]))
  const cache = new Map<string, string[]>()
  return (id) => {
    const known = cache.get(id)
    if (known) return known
    const seen = new Set<string>([id])
    const stack = [id]
    while (stack.length > 0) {
      const current = stack.pop() as string
      for (const child of byId.get(current)?.children ?? []) {
        if (child.componentId && !seen.has(child.componentId)) {
          seen.add(child.componentId)
          stack.push(child.componentId)
        }
      }
    }
    const list = [...seen]
    cache.set(id, list)
    return list
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = out.get(k)
    if (list) list.push(item)
    else out.set(k, [item])
  }
  return out
}
