// M29: endpoints derived from the request sites.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type AppModel,
  AppModelSchema,
  buildEndpoints,
  buildIndex,
  type Component,
  endpointLabel,
  type RequestSite,
  type RequestUrl,
  type Route,
  routePattern,
} from '../src'

const snapshots = join(import.meta.dirname, '..', '..', 'scanner', 'test', '__snapshots__')
const FIXTURES = [
  'basic',
  'react-query',
  'react-query-v4',
  'server-actions',
  'bff',
  'next-intl',
  'mismatch',
  'middleware',
  'postman',
  'trpc-v10',
  'trpc',
  'graphql-apollo',
  'graphql-apollo-v3',
  'graphql-urql',
  'graphql-relay',
  'sse',
  'websocket',
]

function fixtureModel(name: string): AppModel {
  return AppModelSchema.parse(JSON.parse(readFileSync(join(snapshots, `${name}.model.json`), 'utf8')))
}

/** The rule from docs/PLAN.md, written out on its own: distinct (base, method, URL pattern). */
function distinctTargets(model: AppModel): number {
  const keys = new Set<string>()
  const base = (url: RequestUrl | undefined) =>
    url?.baseEnv ?? url?.base?.replace(/^ws/, 'http').toLowerCase() ?? (url?.path ? '' : '?')
  const path = (url: RequestUrl | undefined) =>
    url?.path ? url.path.replace(/:\w+\*?/g, ':').replace(/(.)\/+$/, '$1') : `? ${url?.text}`
  for (const s of model.requests) {
    if (s.transport === 'server-action')
      keys.add(`action ${s.serverAction?.name} ${s.serverAction?.loc.file}`)
    else if (s.transport === 'trpc' && s.procedure) keys.add(`${base(s.url)} trpc ${s.procedure.path}`)
    else if (s.transport === 'graphql' && s.operation)
      keys.add(`${base(s.url)} graphql ${s.operation.name || s.operation.id}`)
    else keys.add(`${base(s.url)} ${s.method ?? '?'} ${path(s.url)}`)
    if (s.upstream) keys.add(`${base(s.upstream)} ${s.method ?? '?'} ${path(s.upstream)}`)
  }
  // Route handler methods nobody calls are listed too.
  const called = new Set(model.requests.map((s) => `${s.targetRouteId} ${s.method}`))
  for (const r of model.routes) {
    if (r.kind !== 'route-handler') continue
    const viaRpc = model.requests.some(
      (s) => s.targetRouteId === r.id && (s.transport === 'trpc' || s.transport === 'graphql'),
    )
    for (const m of r.methods ?? [])
      if (!viaRpc && !called.has(`${r.id} ${m}`)) keys.add(`route ${r.id} ${m}`)
  }
  return keys.size
}

describe.each(FIXTURES)('endpoints of %s', (fixture) => {
  const model = fixtureModel(fixture)
  const list = buildEndpoints(buildIndex(model))

  it('has one endpoint per distinct (base, method, URL pattern)', () => {
    expect(list.endpoints.length).toBe(distinctTargets(model))
  })

  it('lists every site under an endpoint, once', () => {
    const listed = list.endpoints.flatMap((e) => e.siteIds)
    expect(new Set(listed).size).toBe(listed.length)
    expect(listed.sort()).toEqual(model.requests.map((s) => s.id).sort())
  })

  it('gives every endpoint a unique key and a host that lists it', () => {
    expect(list.byKey.size).toBe(list.endpoints.length)
    for (const host of list.hosts) for (const e of host.endpoints) expect(e.host).toBe(host.key)
  })
})

describe('endpoint grouping', () => {
  it('lists the BFF handlers as this app and their upstream calls under the backend', () => {
    const list = buildEndpoints(buildIndex(fixtureModel('bff')))
    expect(list.hosts.map((h) => [h.kind, h.label])).toEqual([
      ['app', "This app's API"],
      ['external', '{BACKEND_URL ?? http://localhost:4010}'],
    ])
    const upstream = list.hosts[1]?.endpoints.find((e) => endpointLabel(e) === 'GET /products')
    // Sent by a route handler, so server-side, but on the page whose component calls the handler.
    expect(upstream?.server).toBe(true)
    expect(upstream?.browser).toBe(false)
    expect(upstream?.routeIds.length).toBe(1)
    expect(upstream?.componentIds.length).toBe(1)
  })

  it('is one endpoint per tRPC procedure and per GraphQL operation', () => {
    const trpc = buildEndpoints(buildIndex(fixtureModel('trpc')))
    expect(trpc.hosts[0]?.endpoints.map((e) => e.pattern)).toContain('todo.byId')
    const gql = buildEndpoints(buildIndex(fixtureModel('graphql-apollo')))
    const app = gql.hosts.find((h) => h.kind === 'app')
    expect(app?.endpoints.every((e) => e.transport === 'graphql')).toBe(true)
    expect(app?.endpoints.map(endpointLabel)).toContain('query Todos')
  })

  it('lists a route handler nothing calls', () => {
    const list = buildEndpoints(buildIndex(fixtureModel('middleware')))
    const health = list.endpoints.find((e) => e.pattern === '/api/health')
    expect(health).toMatchObject({ host: 'app', siteIds: [], status: 'not-captured' })
  })
})

// --- Hand-written models --------------------------------------------------------------------------

const loc = { file: 'src/x.ts', line: 1, column: 1 }

function url(text: string, parts: Partial<RequestUrl>): RequestUrl {
  return { text, confidence: 'pattern', ...parts }
}

function site(id: string, parts: Partial<RequestSite>): RequestSite {
  return {
    id,
    origin: 'component',
    componentId: 'cmp_client',
    transport: 'fetch',
    method: 'GET',
    trigger: { kind: 'event', event: 'onClick' },
    callStack: [{ ...loc, callee: 'fetch' }],
    status: 'inferred',
    flags: [],
    ...parts,
  }
}

function component(id: string, kind: Component['kind']): Component {
  return {
    id,
    name: id,
    file: `src/${id}.tsx`,
    loc,
    kind,
    clientBoundary: kind === 'client',
    children: [],
    usedTypes: [],
  }
}

function route(id: string, path: string, kind: Route['kind'], parts: Partial<Route> = {}): Route {
  return {
    id,
    path,
    kind,
    file: `src/app${path}/${kind === 'page' ? 'page' : 'route'}.ts`,
    segments: [],
    layoutChain: [],
    ...parts,
  }
}

function model(requests: RequestSite[], routes: Route[] = []): AppModel {
  return {
    version: 12 as never,
    project: { appDir: 'src/app' },
    routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'src/app', files: {}, children: [] },
    routes: [route('rt_page', '/', 'page', { componentId: 'cmp_client' }), ...routes],
    components: [component('cmp_client', 'client'), component('cmp_server', 'server')],
    types: [],
    requests,
    navigations: [],
    flows: [],
    queryLinks: [],
  }
}

describe('endpoint rules', () => {
  it('folds sites whose path params are named differently, and keeps their query strings', () => {
    const list = buildEndpoints(
      buildIndex(
        model([
          site('a', { url: url('a', { base: 'https://api.test', path: '/users/:id', query: 'x=:x' }) }),
          site('b', { url: url('b', { base: 'https://API.test/', path: '/users/:userId/' }) }),
          site('c', { method: 'DELETE', url: url('c', { base: 'https://api.test', path: '/users/:id' }) }),
        ]),
      ),
    )
    expect(list.endpoints.map((e) => [endpointLabel(e), e.siteIds])).toEqual([
      ['GET /users/:id', ['a', 'b']],
      ['DELETE /users/:id', ['c']],
    ])
    expect(list.endpoints[0]?.queries).toEqual(['x=:x'])
    expect(list.hosts).toHaveLength(1)
  })

  it('groups ws:// and http:// on the same server, and one host per env variable', () => {
    const list = buildEndpoints(
      buildIndex(
        model([
          site('ws', {
            transport: 'websocket',
            url: url('ws', { base: 'ws://localhost:4011', path: '/live' }),
          }),
          site('io', {
            transport: 'websocket',
            url: url('io', { base: 'http://localhost:4011', path: '/socket.io/' }),
          }),
          site('e1', { url: url('e1', { baseEnv: 'API_URL', base: 'http://localhost:1', path: '/a' }) }),
          site('e2', { url: url('e2', { baseEnv: 'API_URL', base: 'http://other', path: '/b' }) }),
        ]),
      ),
    )
    expect(list.hosts.map((h) => [h.label, h.endpoints.length])).toEqual([
      ['http://localhost:4011', 2],
      ['{API_URL ?? http://localhost:1}', 2],
    ])
  })

  it('lists a URL the scan could not read under "URL not known", one per expression', () => {
    const list = buildEndpoints(
      buildIndex(
        model([
          site('u1', { url: { text: 'endpoint', confidence: 'unknown' } }),
          site('u2', { url: { text: 'endpoint', confidence: 'unknown' } }),
          site('u3', { url: { text: 'other()', confidence: 'unknown' } }),
        ]),
      ),
    )
    expect(list.hosts.map((h) => h.kind)).toEqual(['unknown'])
    expect(list.endpoints.map((e) => [e.pattern, e.siteIds.length])).toEqual([
      ['? endpoint', 2],
      ['? other()', 1],
    ])
  })

  it('lists a catch-all proxy call under this app and under the host it is forwarded to', () => {
    const proxy = route('rt_proxy', '/api/[...path]', 'route-handler', {
      methods: ['GET', 'POST'],
      segments: [
        { raw: 'api', kind: 'static', name: 'api' },
        { raw: '[...path]', kind: 'catch-all', name: 'path' },
      ],
    })
    const list = buildEndpoints(
      buildIndex(
        model(
          [
            site('call', {
              url: url('/api/orders', { path: '/api/orders' }),
              targetRouteId: 'rt_proxy',
              upstream: url('up', { baseEnv: 'API_URL', path: '/orders' }),
            }),
            site('handler', {
              origin: 'route-handler',
              componentId: undefined,
              routeId: 'rt_proxy',
              handlerMethod: 'GET',
              trigger: { kind: 'route-handler' },
              url: url('h', { baseEnv: 'API_URL', path: '/:path*' }),
            }),
          ],
          [proxy],
        ),
      ),
    )
    const labels = list.hosts.map((h) => [h.label, h.endpoints.map(endpointLabel)])
    // The catch-all serves whatever is sent to it: POST is not listed as an uncalled endpoint.
    expect(labels).toEqual([
      ["This app's API", ['GET /api/orders']],
      ['{API_URL}', ['GET /:path*', 'GET /orders']],
    ])
    const forwarded = list.endpoints.find((e) => e.pattern === '/orders')
    expect(forwarded).toMatchObject({ siteIds: [], forwardedSiteIds: ['call'], server: true, browser: false })
    expect(list.bySite.get('call')?.map((e) => e.pattern)).toEqual(['/api/orders', '/orders'])
    // The handler's own call is on the pages whose components call the proxy.
    expect(list.endpoints.find((e) => e.pattern === '/:path*')?.routeIds).toEqual(['rt_page'])
  })

  it('tells browser calls from server calls', () => {
    const list = buildEndpoints(
      buildIndex(
        model([
          site('render', {
            componentId: 'cmp_server',
            trigger: { kind: 'server-render' },
            url: url('r', { path: '/r' }),
          }),
          site('server-event', { componentId: 'cmp_server', url: url('s', { path: '/s' }) }),
          site('click', { url: url('c', { path: '/c' }) }),
          site('action', {
            componentId: 'cmp_server',
            transport: 'server-action',
            method: 'POST',
            url: undefined,
            trigger: { kind: 'event', event: 'action' },
            serverAction: { name: 'save', loc },
          }),
          site('mw', {
            origin: 'middleware',
            componentId: undefined,
            trigger: { kind: 'middleware' },
            url: url('m', { path: '/m' }),
          }),
        ]),
      ),
    )
    const side = (pattern: string) => {
      const e = list.endpoints.find((x) => x.pattern === pattern)
      return [e?.browser, e?.server]
    }
    expect(side('/r')).toEqual([false, true])
    expect(side('/s')).toEqual([false, true])
    expect(side('/c')).toEqual([true, false])
    // A form posting a server action is sent by the browser.
    expect(side('save')).toEqual([true, false])
    expect(side('/m')).toEqual([false, true])
  })

  it('takes the status from the call sites', () => {
    const status = (...statuses: RequestSite['status'][]) =>
      buildEndpoints(
        buildIndex(
          model(statuses.map((s, i) => site(`s${i}`, { status: s, url: url('x', { path: '/x' }) }))),
        ),
      ).endpoints[0]
    expect(status('inferred')?.status).toBe('not-captured')
    expect(status('inferred', 'verified')).toMatchObject({ status: 'verified', verifiedSites: 1 })
    expect(status('verified', 'needs-recheck')?.status).toBe('needs-recheck')
    expect(status('verified', 'mismatch', 'needs-recheck')).toMatchObject({
      status: 'mismatch',
      verifiedSites: 2,
    })
  })

  it('keeps the same key across scans', () => {
    const one = buildEndpoints(buildIndex(fixtureModel('basic')))
    const two = buildEndpoints(buildIndex(fixtureModel('basic')))
    expect(one.endpoints.map((e) => e.key)).toEqual(two.endpoints.map((e) => e.key))
    expect(one.endpoints[0]?.key).toMatch(/^ep_/)
  })

  it('writes route paths as URL patterns', () => {
    expect(routePattern({ path: '/api/items/[id]/[...rest]' })).toBe('/api/items/:id/:rest*')
    expect(routePattern({ path: '/docs/[[...slug]]' })).toBe('/docs/:slug*')
  })
})
