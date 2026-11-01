import { readFileSync } from 'node:fs'
import { AppModelSchema, type Component, MODEL_VERSION, type Route } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { layoutRoutes, parentOf } from '../src/graph-layout'
import { appUrl, buildIndex, editorUrl, typeRefs } from '../src/model-index'
import { href, parseHash, type Screen } from '../src/router'

const fixture = (name: string) =>
  AppModelSchema.parse(
    JSON.parse(
      readFileSync(new URL(`../../scanner/test/__snapshots__/${name}.model.json`, import.meta.url), 'utf8'),
    ),
  )

const route = (path: string, extra: Partial<Route> = {}): Route => ({
  id: `rt_${path}`,
  path,
  kind: 'page',
  file: `app${path}/page.tsx`,
  segments: path
    .split('/')
    .filter(Boolean)
    .map((raw) => ({ raw, kind: raw.startsWith('[') ? 'dynamic' : 'static', name: raw })),
  layoutChain: [],
  ...extra,
})

describe('buildIndex on fixtures', () => {
  it('draws navigation edges from the page that navigates (basic, server-actions)', () => {
    const edges = (name: string) => {
      const index = buildIndex(fixture(name))
      const path = (id: string) => index.routes.get(id)?.path
      return index.navEdges.map((e) => `${path(e.source)} -> ${path(e.target)} ${e.kinds.join(',')}`).sort()
    }
    // Root layout links start from `/` only, not from every page below the layout.
    expect(edges('basic')).toEqual(['/ -> /about link', '/ -> /users/[id] link', '/users/[id] -> / push'])
    // The create form's server action redirects to the new product.
    expect(edges('server-actions')).toContain('/products/new -> /products/[id] redirect')

    const flows = buildIndex(fixture('next-intl')).flowsByRoute
    expect([...flows.values()].map((list) => list.map((f) => f.name))).toEqual([
      ['LoginForm submit'],
      ['LoginForm submit'],
      ['LoginForm submit'],
    ])
  })

  it('links components to the pages that render them (bff)', () => {
    const index = buildIndex(fixture('bff'))
    const home = index.model.routes.find((r) => r.path === '/')
    const table = index.model.components.find((c) => c.name === 'ProductsTable')
    expect(home && table).toBeTruthy()
    expect(index.routesOf.get(table?.id ?? '')).toContain(home?.id)
    const parents = index.renderedBy.get(table?.id ?? '') ?? []
    expect(parents.map((p) => index.components.get(p.parentId)?.name)).toEqual(['HomePage'])
  })

  it('counts layouts as part of every page they wrap (next-intl)', () => {
    const index = buildIndex(fixture('next-intl'))
    const layout = index.model.components.find((c) => c.name === 'LocaleLayout')
    expect(index.routesOf.get(layout?.id ?? '')).toHaveLength(index.model.routes.length)
  })

  it('records where each type is used (react-query)', () => {
    const index = buildIndex(fixture('react-query'))
    const byName = (n: string) => index.model.types.find((t) => t.name === n)?.id ?? ''
    const name = (id: string) => index.components.get(id)?.name
    expect(index.typeUsage.get(byName('TodoDetailProps'))?.props.map(name)).toEqual(['TodoDetail'])
    expect(index.typeUsage.get(byName('Todo'))?.usedBy.map(name)).toEqual(
      expect.arrayContaining(['TodoDetail', 'TodoList']),
    )
  })

  it('indexes requests by component, route handler and type (bff)', () => {
    const index = buildIndex(fixture('bff'))
    const table = index.model.components.find((c) => c.name === 'ProductsTable')
    const handler = index.model.routes.find((r) => r.path === '/api/products')
    const product = index.model.types.find((t) => t.name === 'Product')
    const own = index.requestsByComponent.get(table?.id ?? '') ?? []
    expect(own.map((s) => s.url?.path)).toEqual(['/api/products'])
    expect((index.handlerRequests.get(handler?.id ?? '') ?? []).map((s) => s.handlerMethod)).toEqual([
      'GET',
      'POST',
    ])
    expect(index.handlerCallers.get(handler?.id ?? '')).toHaveLength(2)
    expect(index.typeUsage.get(product?.id ?? '')?.requests).toContain(own[0]?.id)
  })

  it('has no scan notes for the clean fixtures', () => {
    for (const name of ['basic', 'bff', 'next-intl', 'react-query', 'server-actions']) {
      expect(buildIndex(fixture(name)).notes, name).toEqual([])
    }
  })
})

describe('scan notes', () => {
  it('flags unresolved components, partial types and pages without a component', () => {
    const loc = { file: 'app/page.tsx', line: 3, column: 5 }
    const page: Component = {
      id: 'cmp_page',
      name: 'Page',
      file: 'app/page.tsx',
      loc,
      kind: 'server',
      clientBoundary: false,
      children: [{ name: 'Mystery', resolution: 'unresolved', loc }],
      propsType: { text: 'Props', shape: { kind: 'unresolved', text: 'Deep<...>', reason: 'depth' } },
      usedTypes: [],
    }
    const index = buildIndex({
      version: MODEL_VERSION,
      project: { appDir: 'app' },
      routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'app', files: {}, children: [] },
      routes: [route('/', { componentId: 'cmp_page' }), route('/empty')],
      components: [page],
      types: [],
      requests: [
        {
          id: 'req_1',
          origin: 'component',
          componentId: 'cmp_page',
          transport: 'fetch',
          url: { text: 'url', confidence: 'unknown' },
          trigger: { kind: 'server-render' },
          callStack: [{ ...loc, callee: 'fetch' }],
          status: 'inferred',
          flags: [{ kind: 'dynamic-url', message: 'The URL could not be resolved: url' }],
        },
        {
          id: 'req_2',
          origin: 'component',
          componentId: 'cmp_page',
          transport: 'fetch',
          url: { text: 'url', confidence: 'unknown' },
          trigger: { kind: 'unknown' },
          callStack: [{ ...loc, callee: 'fetch' }],
          status: 'inferred',
          flags: [
            { kind: 'dynamic-url', message: 'The URL could not be resolved: url' },
            { kind: 'unknown-method', message: 'The HTTP method could not be resolved.' },
            { kind: 'unknown-trigger', message: 'Could not find what starts this request.' },
          ],
        },
      ],
      navigations: [],
      flows: [],
      queryLinks: [],
    })
    expect(index.notes.map((n) => n.kind)).toEqual([
      'missing-page-component',
      'unresolved-component',
      'unresolved-type',
      'request',
      'request',
    ])
    expect(index.notes[1]?.message).toContain('<Mystery>')
    expect(index.notes[3]).toMatchObject({
      message: '? ? url: The URL could not be resolved: url',
      componentId: 'cmp_page',
      requestId: 'req_1',
    })
    // Every gap of one request is one note.
    expect(index.notes[4]?.message).toBe(
      '? ? url: The URL could not be resolved: url · The HTTP method could not be resolved · Could not find what starts this request',
    )
  })
})

describe('typeRefs', () => {
  it('finds refs at any depth, once each', () => {
    const ref = (typeId: string) => ({ kind: 'ref' as const, typeId, name: typeId })
    expect(
      typeRefs({
        kind: 'object',
        properties: [
          { name: 'a', type: { kind: 'array', element: ref('A') } },
          { name: 'b', type: { kind: 'union', types: [ref('B'), ref('A')] } },
          {
            name: 'c',
            type: { kind: 'external', name: 'Promise', typeArguments: [ref('C')] },
          },
        ],
      }),
    ).toEqual(['A', 'B', 'C'])
  })
})

describe('links', () => {
  it('builds editor links that survive spaces and brackets', () => {
    expect(editorUrl('C:/Users/Jo Doe/app', 'src/app/[id]/page.tsx', 4, 2)).toBe(
      'vscode://file/C:/Users/Jo%20Doe/app/src/app/%5Bid%5D/page.tsx:4:2',
    )
    expect(editorUrl('/home/jo/app', 'a#b.ts')).toBe('vscode://file/home/jo/app/a%23b.ts:1:1')
    expect(editorUrl(undefined, 'a.ts')).toBeUndefined()
  })

  it('only opens static pages in the app', () => {
    expect(appUrl(route('/about'), 3000)).toBe('http://localhost:3000/about')
    expect(appUrl(route('/users/[id]'), 3000)).toBeUndefined()
    expect(appUrl(route('/about'), undefined)).toBeUndefined()
    expect(appUrl(route('/api', { kind: 'route-handler' }), 3000)).toBeUndefined()
  })
})

describe('graph layout', () => {
  it('nests routes under their closest parent path', () => {
    const routes = [
      route('/'),
      route('/users'),
      route('/users/[id]'),
      route('/users/[id]/edit'),
      route('/api/users', { kind: 'route-handler' }),
    ]
    const graph = layoutRoutes(routes)
    const edges = graph.edges.map((e) => `${e.source} -> ${e.target}`)
    expect(edges).toEqual(
      expect.arrayContaining([
        'rt_/ -> rt_/users',
        'rt_/users -> rt_/users/[id]',
        'rt_/users/[id] -> rt_/users/[id]/edit',
        'rt_/ -> rt_/api/users',
      ]),
    )
    expect(graph.nodes).toHaveLength(routes.length)
    // Every node has its own position.
    const positions = new Set(graph.nodes.map((n) => `${n.x},${n.y}`))
    expect(positions.size).toBe(routes.length)
  })

  it('wraps many leaf pages under one route into grid columns', () => {
    const leaves = Array.from({ length: 20 }, (_, i) => route(`/p${String(i).padStart(2, '0')}`))
    const graph = layoutRoutes([route('/'), route('/a'), route('/a/b'), ...leaves])
    const xs = new Set(graph.nodes.filter((n) => n.route.path.startsWith('/p')).map((n) => n.x))
    // 20 leaves at 8 per column: 3 columns, not one column of 20.
    expect(xs.size).toBe(3)
    const positions = new Set(graph.nodes.map((n) => `${n.x},${n.y}`))
    expect(positions.size).toBe(graph.nodes.length)
    expect(graph.edges.filter((e) => e.grid)).toHaveLength(12)
  })

  it('prefers a plain page over a slot at the same path', () => {
    const slot = route('/', { id: 'slot', slot: 'modal' })
    const page = route('/', { id: 'page' })
    expect(parentOf(route('/x'), [slot, page])?.id).toBe('page')
  })

  it('lays out every fixture with one node per route', () => {
    for (const name of ['basic', 'bff', 'next-intl', 'react-query', 'server-actions']) {
      const model = fixture(name)
      expect(layoutRoutes(model.routes).nodes, name).toHaveLength(model.routes.length)
    }
  })
})

describe('router', () => {
  it('round-trips every screen through the hash', () => {
    const screens: Screen[] = [
      { name: 'start' },
      { name: 'overview' },
      { name: 'map', view: 'graph', q: '' },
      { name: 'map', view: 'tree', q: 'users' },
      { name: 'page', routeId: 'rt_1', componentId: 'cmp_2' },
      { name: 'page', routeId: 'rt_1' },
      { name: 'component', componentId: 'cmp_2' },
      { name: 'types', q: 'User Id' },
      { name: 'types', typeId: 'typ_3', q: '' },
    ]
    for (const screen of screens) {
      expect(parseHash(href(screen))).toEqual(
        screen.name === 'page' && !screen.componentId ? { ...screen, componentId: undefined } : screen,
      )
    }
  })

  it('treats unknown paths as not found', () => {
    expect(parseHash('#/nope')).toEqual({ name: 'not-found' })
    expect(parseHash('#/page')).toEqual({ name: 'not-found' })
    // Start here is the first screen (M32); the overview moved to #/overview.
    expect(parseHash('')).toEqual({ name: 'start' })
    expect(parseHash('#/')).toEqual({ name: 'start' })
    expect(parseHash('#/overview')).toEqual({ name: 'overview' })
  })
})
