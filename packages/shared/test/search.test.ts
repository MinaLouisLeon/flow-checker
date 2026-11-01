// M33: global search over pages, route handlers, components, requests, endpoints, types, flows and
// areas, ranked exact > prefix > word match.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type AppModel,
  AppModelSchema,
  buildAreas,
  buildEndpoints,
  buildIndex,
  buildSearchIndex,
  type Component,
  type Flow,
  type NamedType,
  type RequestSite,
  type Route,
  SEARCH_KINDS,
  type SearchIndex,
  type SearchKind,
  search,
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

function indexOf(model: AppModel): SearchIndex {
  const index = buildIndex(model)
  const endpoints = buildEndpoints(index)
  return buildSearchIndex(index, { endpoints, areas: buildAreas(index, endpoints) })
}

/** `kind:label` of the results. */
const found = (si: SearchIndex, q: string, limit?: number) =>
  search(si, q, limit).items.map((i) => `${i.kind}:${i.label}`)

describe.each(FIXTURES)('search on %s', (name) => {
  const model = fixtureModel(name)
  const si = indexOf(model)

  it('finds every item by its own name', () => {
    const missing: string[] = []
    for (const e of si.entries) {
      const ids = search(si, e.item.label, Number.POSITIVE_INFINITY).items.map((i) => `${i.kind}:${i.id}`)
      if (!ids.includes(`${e.item.kind}:${e.item.id}`)) missing.push(`${e.item.kind}:${e.item.label}`)
    }
    expect(missing).toEqual([])
  })

  it('has one entry per page, handler, component, request, type and flow', () => {
    const count = (kind: SearchKind) => si.entries.filter((e) => e.item.kind === kind).length
    expect(count('page') + count('handler')).toBe(model.routes.length)
    expect(count('component')).toBe(model.components.length)
    expect(count('request')).toBe(model.requests.length)
    expect(count('type')).toBe(model.types.length)
    expect(count('flow')).toBe(model.flows.length)
  })
})

describe('search on next-intl', () => {
  const si = indexOf(fixtureModel('next-intl'))

  it('finds one item of each kind', () => {
    expect(found(si, 'LoginForm')[0]).toBe('component:LoginForm')
    expect(found(si, '/[locale]/login')[0]).toBe('page:/[locale]/login')
    expect(found(si, 'User')[0]).toBe('type:User')
    expect(found(si, 'LoginForm submit')[0]).toBe('flow:LoginForm submit')
    expect(found(si, 'verify')[0]).toBe('area:verify')
    expect(found(si, '/auth/login')).toContain('endpoint:POST /auth/login')
    expect(found(si, '/auth/login').some((r) => r.startsWith('request:POST'))).toBe(true)
  })

  it('finds requests by the file that sends them', () => {
    const kinds = new Set(search(si, 'auth-api.ts').items.map((i) => i.kind))
    expect(kinds).toEqual(new Set(['request']))
  })

  it('returns nothing for an empty query or a query that matches nothing', () => {
    expect(search(si, '   ')).toEqual({ items: [], total: 0 })
    expect(search(si, 'nothing-like-this-anywhere')).toEqual({ items: [], total: 0 })
  })
})

describe('ranking', () => {
  const base = fixtureModel('basic')
  const comp = (id: string, name: string, file: string): Component => ({
    id,
    name,
    file,
    loc: { file, line: 1, column: 1 },
    kind: 'client',
    clientBoundary: true,
    children: [],
    usedTypes: [],
  })
  const model: AppModel = {
    ...base,
    routes: [],
    requests: [],
    flows: [],
    navigations: [],
    queryLinks: [],
    types: [],
    components: [
      comp('c1', 'UserListItem', 'src/a.tsx'),
      comp('c2', 'User', 'src/b.tsx'),
      comp('c3', 'AdminUserPanel', 'src/c.tsx'),
      comp('c4', 'Superuser', 'src/d.tsx'),
      comp('c5', 'UserList', 'src/e.tsx'),
      comp('c6', 'Header', 'src/user/header.tsx'),
    ],
  }
  const si = indexOf(model)
  const names = (q: string) => search(si, q).items.map((i) => i.label)

  it('puts exact before prefix before word before substring', () => {
    expect(names('user')).toEqual([
      'User',
      'UserList',
      'UserListItem',
      'AdminUserPanel',
      'Header',
      'Superuser',
    ])
  })

  it('matches camelCase words and every word of the query', () => {
    expect(names('list item')).toEqual(['UserListItem'])
    expect(names('admin panel')).toEqual(['AdminUserPanel'])
    expect(names('userlist')).toEqual(['UserList', 'UserListItem'])
  })

  it('matches files and file names below names', () => {
    expect(names('header.tsx')).toEqual(['Header'])
    expect(names('src/user')).toEqual(['Header'])
  })

  it('caps the results and counts the rest', () => {
    const result = search(si, 'u', 2)
    expect(result.items).toHaveLength(2)
    expect(result.total).toBe(6)
  })

  it('orders the same match by kind, then shorter names', () => {
    const typed: AppModel = {
      ...model,
      components: [comp('c1', 'Order', 'src/a.tsx')],
      types: [type('t1', 'Order', 'src/types.ts')],
    }
    expect(found(indexOf(typed), 'order')).toEqual(['component:Order', 'type:Order'])
  })
})

describe('kinds', () => {
  it('lists the kinds in their result order', () => {
    expect(SEARCH_KINDS).toEqual([
      'page',
      'handler',
      'area',
      'component',
      'flow',
      'endpoint',
      'request',
      'type',
    ])
  })
})

function type(id: string, name: string, file: string): NamedType {
  return {
    id,
    name,
    declarationKind: 'interface',
    definedAt: { file, line: 1, column: 1 },
    shape: { kind: 'object', properties: [] },
  } as NamedType
}

/**
 * The perf app's shape (scripts/perf/generate-app.mjs): per feature a list and a detail page, a
 * route handler, a form, a hook, requests from each, its types and a flow.
 */
function featureApp(features: number): AppModel {
  const base = fixtureModel('basic')
  const siteTemplate = base.requests[0] as RequestSite
  const routes: Route[] = []
  const components: Component[] = []
  const requests: RequestSite[] = []
  const types: NamedType[] = []
  const flows: Flow[] = []
  for (let i = 0; i < features; i++) {
    const dir = `src/features/f${i}`
    const page = (id: string, path: string, componentId: string): Route => ({
      id,
      path,
      kind: 'page',
      file: `src/app${path}/page.tsx`,
      segments: [],
      layoutChain: [],
      componentId,
    })
    routes.push(
      page(`rt_f${i}`, `/f${i}`, `cmp_f${i}_list`),
      page(`rt_f${i}_id`, `/f${i}/[id]`, `cmp_f${i}_detail`),
    )
    routes.push({
      id: `rt_f${i}_api`,
      path: `/api/f${i}/[...path]`,
      kind: 'route-handler',
      file: `src/app/api/f${i}/[...path]/route.ts`,
      segments: [],
      layoutChain: [],
      methods: ['GET', 'POST'],
    })
    const named: [string, string][] = [
      ['list', `F${i}ListPage`],
      ['detail', `F${i}DetailPage`],
      ['form', `F${i}Form`],
      ['row', `F${i}Row`],
      ['card', `F${i}Card`],
    ]
    for (const [suffix, name] of named) {
      components.push({
        id: `cmp_f${i}_${suffix}`,
        name,
        file: `${dir}/${name}.tsx`,
        loc: { file: `${dir}/${name}.tsx`, line: 1, column: 1 },
        kind: 'client',
        clientBoundary: true,
        children: [],
        usedTypes: [],
      })
    }
    for (let r = 0; r < 5; r++) {
      requests.push({
        ...siteTemplate,
        id: `req_f${i}_${r}`,
        origin: 'component',
        componentId: `cmp_f${i}_list`,
        method: r === 0 ? 'POST' : 'GET',
        url: { text: `/api/f${i}/items/${r}`, confidence: 'exact' },
        callStack: [{ file: `${dir}/api.ts`, line: r + 1, column: 1, callee: `getF${i}Items${r}` }],
        flags: [],
      })
    }
    types.push(
      type(`ty_f${i}_item`, `F${i}Item`, `${dir}/types.ts`),
      type(`ty_f${i}_input`, `F${i}Input`, `${dir}/types.ts`),
    )
    flows.push({
      id: `fl_f${i}`,
      name: `F${i}Form submit`,
      routeId: `rt_f${i}`,
      componentId: `cmp_f${i}_form`,
      steps: [],
      branches: [],
      routeIds: [`rt_f${i}`],
    })
  }
  return { ...base, routes, components, requests, types, flows, navigations: [], queryLinks: [] }
}

describe('search on a big app', () => {
  it('answers each keystroke in under 50 ms', () => {
    const model = featureApp(200)
    const start = performance.now()
    const si = indexOf(model)
    const built = performance.now() - start
    expect(si.entries.length).toBeGreaterThan(3000)
    expect(built).toBeLessThan(2000)

    let slowest = 0
    // Typing a component name, a URL and a file one key at a time.
    for (const text of ['F120Form', '/api/f12/items', 'src/features/f7/api.ts', 'form submit']) {
      for (let n = 1; n <= text.length; n++) {
        const t = performance.now()
        search(si, text.slice(0, n))
        slowest = Math.max(slowest, performance.now() - t)
      }
    }
    expect(slowest).toBeLessThan(50)
    expect(found(si, 'F120Form')[0]).toBe('component:F120Form')
    expect(found(si, 'F120Form submit')[0]).toBe('flow:F120Form submit')
  })
})
