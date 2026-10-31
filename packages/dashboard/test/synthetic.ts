// A synthetic model for the M23 dashboard fixes, built on top of a scanned fixture model: one page
// with many queries and cache calls that hit all of them, a navigation in a shared hook, a
// catch-all route handler with many callers, and generic type instantiations. Used by the unit
// tests and by the DOM budget e2e test (e2e/dashboard-limits.spec.ts), so it only has type imports.
import type {
  AppModel,
  Component,
  NamedType,
  Navigation,
  QueryLink,
  RequestSite,
  Route,
  SourceLoc,
} from '@flow-checker/shared'

export interface SyntheticOptions {
  /** The page that gets the queries and cache calls. */
  pagePath: string
  /** Query sites on that page. */
  queries?: number
  /** Components that use one hook with a `router.push` in it. */
  hookUsers?: number
}

export const SYNTHETIC = {
  handlerPath: '/api/[...path]',
  hookFile: 'src/hooks/use-go-home.ts',
  generic: 'Page',
}

const loc = (file: string, line: number, column = 3): SourceLoc => ({ file, line, column })

export function syntheticModel(base: AppModel, options: SyntheticOptions): AppModel {
  const model: AppModel = structuredClone(base)
  const queries = options.queries ?? 200
  const hookUsers = options.hookUsers ?? 12
  const page = model.routes.find((r) => r.kind === 'page' && r.path === options.pagePath)
  const pageComponent = model.components.find((c) => c.id === page?.componentId)
  if (!page || !pageComponent) throw new Error(`No page ${options.pagePath} with a component`)
  const file = pageComponent.loc.file

  // Components under the page that use the hook and call the catch-all handler.
  const users: Component[] = []
  for (let i = 0; i < hookUsers; i++) {
    const at = loc(`src/components/HookUser${i}.tsx`, 3)
    users.push({
      ...structuredClone(pageComponent),
      id: `cmp_syn_user_${i}`,
      name: `HookUser${i}`,
      kind: 'client',
      clientBoundary: true,
      loc: at,
      children: [],
      usedTypes: [],
      propsType: undefined,
    })
    pageComponent.children.push({
      name: `HookUser${i}`,
      resolution: 'project',
      componentId: `cmp_syn_user_${i}`,
      loc: loc(file, 100 + i),
    })
  }
  model.components.push(...users)

  // Query sites on the page, each with its own key under `items`.
  const query = (i: number): RequestSite => ({
    id: `req_syn_q${i}`,
    origin: 'component',
    componentId: pageComponent.id,
    transport: 'fetch',
    method: 'GET',
    url: { text: `'/api/items/${i}'`, confidence: 'exact', path: `/api/items/${i}` },
    trigger: { kind: 'page-load', loc: loc(file, 200 + i) },
    hook: { name: 'useQuery', module: '@tanstack/react-query' },
    queryKey: [
      { kind: 'static', value: 'items' },
      { kind: 'static', value: i },
    ],
    callStack: [
      { ...loc(file, 200 + i), callee: 'useQuery' },
      { ...loc('src/lib/api.ts', 5, 10), callee: 'fetch' },
    ],
    status: 'inferred',
    flags: [],
    hash: `syn${i}`,
  })
  const querySites = Array.from({ length: queries }, (_, i) => query(i))
  const mutation: RequestSite = {
    ...query(0),
    id: 'req_syn_mutation',
    method: 'POST',
    url: { text: "'/api/items'", confidence: 'exact', path: '/api/items' },
    trigger: { kind: 'event', event: 'onClick', loc: loc(file, 50) },
    hook: { name: 'useMutation', module: '@tanstack/react-query' },
    queryKey: undefined,
    callStack: [{ ...loc(file, 50), callee: 'useMutation' }],
  }
  model.requests.push(...querySites, mutation)

  // Cache calls after the mutation: by the `items` prefix (hit every query) and with no key.
  const link = (i: number, key: QueryLink['key']): QueryLink => ({
    id: `ql_syn_${i}`,
    kind: 'invalidate',
    method: 'invalidateQueries',
    origin: 'component',
    componentId: pageComponent.id,
    ...(key ? { key } : {}),
    fromSiteIds: [mutation.id],
    targetSiteIds: querySites.map((s) => s.id),
    trigger: { kind: 'event', event: 'onClick' },
    outcome: 'success',
    loc: loc(file, 60 + i),
    callStack: [{ ...loc(file, 60 + i), callee: 'invalidateQueries' }],
  })
  model.queryLinks.push(
    ...Array.from({ length: 8 }, (_, i) => link(i, [{ kind: 'static', value: 'items' }])),
    link(8, undefined),
  )

  // One `router.push` in a hook, found once per component that uses the hook.
  const hookNav = (user: Component, i: number): Navigation => ({
    id: `nav_syn_${i}`,
    origin: 'component',
    componentId: user.id,
    kind: 'push',
    api: 'next',
    href: { text: "'/'", confidence: 'exact', path: '/' },
    trigger: { kind: 'event', event: 'onClick', loc: loc(SYNTHETIC.hookFile, 8) },
    loc: loc(SYNTHETIC.hookFile, 9, 5),
    callStack: [
      { ...loc(user.loc.file, 5), callee: 'useGoHome' },
      { ...loc(SYNTHETIC.hookFile, 9, 5), callee: 'router.push' },
    ],
  })
  model.navigations.push(...users.map(hookNav))

  // A catch-all handler: login from every hook user (one line in a shared helper), reviews from
  // two components at their own lines.
  const handler: Route = {
    ...structuredClone(page),
    id: 'rt_syn_proxy',
    kind: 'route-handler',
    path: SYNTHETIC.handlerPath,
    file: 'src/app/api/[...path]/route.ts',
    methods: ['GET', 'POST'],
    componentId: undefined,
    layoutChain: [],
    segments: [
      { raw: 'api', kind: 'static', name: 'api' },
      { raw: '[...path]', kind: 'catch-all', name: 'path' },
    ] as Route['segments'],
  }
  model.routes.push(handler)
  const caller = (
    id: string,
    user: Component,
    method: RequestSite['method'],
    path: string,
    line: number,
  ): RequestSite => ({
    id,
    origin: 'component',
    componentId: user.id,
    transport: 'fetch',
    method,
    url: { text: `'${path}'`, confidence: 'exact', path },
    trigger: { kind: 'event', event: 'onSubmit', loc: loc(user.loc.file, 6) },
    targetRouteId: handler.id,
    callStack: [
      { ...loc(user.loc.file, 6), callee: 'send' },
      { ...loc('src/lib/send.ts', line, 10), callee: 'fetch' },
    ],
    status: 'inferred',
    flags: [],
    hash: id,
  })
  users.forEach((user, i) => {
    model.requests.push(caller(`req_syn_login_${i}`, user, 'POST', '/api/auth/login', 4))
  })
  model.requests.push(
    caller('req_syn_reviews_a', users[0] as Component, 'POST', '/api/reviews', 20),
    caller('req_syn_reviews_b', users[1] as Component, 'POST', '/api/reviews', 30),
  )
  // The handler forwards upstream.
  model.requests.push({
    ...caller('req_syn_upstream', users[0] as Component, 'GET', '/upstream', 1),
    origin: 'route-handler',
    componentId: undefined,
    routeId: handler.id,
    handlerMethod: 'GET',
    targetRouteId: undefined,
    url: { text: 'API + path', confidence: 'pattern', path: '/:path*', base: '{API}' },
    trigger: { kind: 'route-handler' },
    callStack: [{ ...loc(handler.file, 3, 10), callee: 'fetch' }],
  })

  // `Page<T>` instantiated three times (one unused), and an unused type.
  const typeAt = loc('src/lib/types.ts', 1, 18)
  const typ = (id: string, name: string, at = typeAt): NamedType => ({
    id,
    name,
    declarationKind: 'type-alias',
    definedAt: at,
    shape: { kind: 'object', properties: [{ name: 'total', type: { kind: 'primitive', name: 'number' } }] },
  })
  model.types.push(
    typ('typ_syn_page_user', `${SYNTHETIC.generic}<User>`),
    typ('typ_syn_page_post', `${SYNTHETIC.generic}<Post>`),
    typ('typ_syn_page_order', `${SYNTHETIC.generic}<Order>`),
    typ('typ_syn_unused', 'NeverUsed', loc('src/lib/types.ts', 9, 13)),
  )
  pageComponent.usedTypes.push('typ_syn_page_user', 'typ_syn_page_post')
  return model
}
