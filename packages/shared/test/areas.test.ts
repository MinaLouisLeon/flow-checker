// M30: pages, components, requests and flows grouped by feature.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type AppModel,
  AppModelSchema,
  type AreaList,
  buildAreas,
  buildIndex,
  type Component,
  type Flow,
  type ModelIndex,
  type RequestSite,
  type Route,
  routeKey,
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

/** One block per area: what it holds, by name. */
function areasText(list: AreaList, index: ModelIndex): string {
  const names = (ids: string[], name: (id: string) => string | undefined) =>
    ids.map((id) => name(id) ?? id).join(', ') || '-'
  const component = (id: string) => index.components.get(id)?.name
  const lines = [`by ${list.by}`]
  for (const area of list.areas) {
    lines.push(
      '',
      `${area.name}${area.name === area.key ? '' : ` (${area.key})`} from ${area.from.join(', ')}`,
      `  pages: ${names(area.routeIds, (id) => index.routes.get(id)?.path)}`,
      `  components: ${names(area.componentIds, component)}`,
      `  shared components: ${names(area.sharedComponentIds, component)}`,
      `  requests: ${area.requestIds.length}, endpoints: ${area.endpointKeys.length}, notes: ${area.notes.length}`,
      `  flows: ${names(area.flowIds, (id) => index.flows.get(id)?.name)}`,
    )
  }
  lines.push(
    '',
    `shared components: ${names(list.sharedComponentIds, component)}`,
    `shared requests: ${list.sharedRequestIds.length}`,
  )
  return `${lines.join('\n')}\n`
}

describe.each(FIXTURES)('areas of %s', (fixture) => {
  const model = fixtureModel(fixture)
  const index = buildIndex(model)
  const list = buildAreas(index)

  it('puts every page in exactly one area', () => {
    const pages = model.routes.filter((r) => r.kind === 'page')
    const listed = list.areas.flatMap((a) => a.routeIds)
    expect(listed.sort()).toEqual(pages.map((r) => r.id).sort())
    for (const page of pages) expect(list.byRoute.get(page.id)?.routeIds).toContain(page.id)
  })

  it('puts each flow in at most one area', () => {
    const flows = list.areas.flatMap((a) => a.flowIds)
    expect(new Set(flows).size).toBe(flows.length)
  })

  it('matches the snapshot', async () => {
    await expect(areasText(list, index)).toMatchFileSnapshot(`__snapshots__/areas/${fixture}.txt`)
  })
})

// --- Hand-written models ---------------------------------------------------------------------

const loc = { file: 'src/app/page.tsx', line: 1, column: 1 }

function component(id: string, file: string, children: string[] = []): Component {
  return {
    id,
    name: id,
    file,
    loc: { ...loc, file },
    kind: 'client',
    clientBoundary: true,
    children: children.map((c) => ({
      name: c,
      componentId: c,
      loc: { ...loc, file },
      resolution: 'project',
    })),
    usedTypes: [],
  }
}

function page(id: string, path: string, componentId: string, parts: Partial<Route> = {}): Route {
  return {
    id,
    path,
    kind: 'page',
    file: `src/app${path === '/' ? '' : path}/page.tsx`,
    segments: [],
    layoutChain: [],
    componentId,
    ...parts,
  }
}

function site(id: string, componentId: string, parts: Partial<RequestSite> = {}): RequestSite {
  return {
    id,
    origin: 'component',
    componentId,
    transport: 'fetch',
    method: 'GET',
    url: { text: `/api/${id}`, path: `/api/${id}`, confidence: 'exact' },
    trigger: { kind: 'event', event: 'onClick' },
    callStack: [{ ...loc, callee: 'fetch' }],
    status: 'inferred',
    flags: [],
    ...parts,
  }
}

function flow(id: string, routeId: string | undefined, componentId: string): Flow {
  return { id, name: id, componentId, steps: [], branches: [], routeIds: [], ...(routeId ? { routeId } : {}) }
}

function model(parts: Partial<AppModel>): AppModel {
  return {
    version: 11,
    project: { appDir: 'src/app' },
    routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'src/app', files: {}, children: [] },
    routes: [],
    components: [],
    types: [],
    requests: [],
    navigations: [],
    flows: [],
    queryLinks: [],
    ...parts,
  }
}

const areasOf = (m: AppModel) => buildAreas(buildIndex(m))
const summary = (list: AreaList) =>
  Object.fromEntries(list.areas.map((a) => [a.key, a.routeIds.map((id) => id.replace(/^rt_/, ''))]))

describe('area rules', () => {
  it('groups by the first static segment, after groups, dynamic segments and locales', () => {
    expect(routeKey({ path: '/' })).toBe('home')
    expect(routeKey({ path: '/billing/invoices/[id]' })).toBe('billing')
    expect(routeKey({ path: '/[locale]/billing' })).toBe('billing')
    expect(routeKey({ path: '/[team]/[project]/settings' })).toBe('settings')
    expect(routeKey({ path: '/[...slug]' })).toBe('home')
    // Static locale prefixes from next-intl's routing.
    expect(routeKey({ path: '/en/billing' }, new Set(['en', 'de']))).toBe('billing')

    const list = areasOf(
      model({
        components: [component('cmp_a', 'src/app/a.tsx')],
        routes: [
          page('rt_root', '/', 'cmp_a'),
          page('rt_about', '/about', 'cmp_a', { file: 'src/app/(marketing)/about/page.tsx' }),
          page('rt_inv', '/[locale]/billing/invoices', 'cmp_a'),
          page('rt_bill', '/[locale]/billing', 'cmp_a'),
          // An intercepting route's path is the URL it intercepts.
          page('rt_photo', '/photos/[id]', 'cmp_a', { intercepting: { marker: '(.)', from: '/' } }),
        ],
      }),
    )
    expect(list.by).toBe('route')
    expect(summary(list)).toEqual({
      home: ['root'],
      about: ['about'],
      billing: ['bill', 'inv'],
      photos: ['photo'],
    })
    expect(list.areas.find((a) => a.key === 'billing')?.from).toEqual(['/[locale]/billing'])
  })

  // Pages whose URLs give one area, with their code in feature folders under different base names.
  const folderModel = (base: string, ext: string) =>
    model({
      components: [
        component('cmp_inv_page', 'src/app/[slug]/page.tsx', ['cmp_inv_list', 'cmp_inv_row', 'cmp_button']),
        component('cmp_inv_list', `${base}/invoices/components/List.${ext}`),
        component('cmp_inv_row', `${base}/invoices/components/Row.${ext}`),
        component('cmp_usr_page', 'src/app/[slug]/b/page.tsx', ['cmp_usr_form', 'cmp_button']),
        component('cmp_usr_form', `${base}/users/UserForm.${ext}`),
        component('cmp_other_page', 'src/app/page.tsx', ['cmp_button']),
        component('cmp_button', `src/ui/Button.${ext}`),
      ],
      routes: [
        page('rt_inv', '/[slug]', 'cmp_inv_page'),
        page('rt_usr', '/[slug]/[id]', 'cmp_usr_page'),
        page('rt_other', '/', 'cmp_other_page'),
      ],
    })

  it.each([
    ['src/features', 'tsx'],
    ['src/modules', 'jsx'],
    ['lib/domains', 'tsx'],
  ])('falls back to the feature folder (%s, .%s) when URLs give one area', (base, ext) => {
    const list = areasOf(folderModel(base, ext))
    expect(list.by).toBe('folder')
    // The button every page uses doesn't decide; the page with only it keeps its route key.
    expect(summary(list)).toEqual({ home: ['other'], invoices: ['inv'], users: ['usr'] })
    expect(list.areas.find((a) => a.key === 'invoices')?.from).toEqual([`${base}/invoices`])
  })

  it('keeps one area when neither URLs nor folders split the pages', () => {
    const list = areasOf(
      model({
        components: [component('cmp_a', 'src/components/A.tsx')],
        routes: [page('rt_a', '/[id]', 'cmp_a'), page('rt_b', '/', 'cmp_a')],
      }),
    )
    expect(list.by).toBe('route')
    expect(summary(list)).toEqual({ home: ['b', 'a'] })
    expect(list.sharedComponentIds).toEqual([])
  })

  const featureModel = () =>
    model({
      components: [
        component('cmp_layout', 'src/app/layout.tsx', ['cmp_header']),
        component('cmp_header', 'src/components/Header.tsx'),
        component('cmp_users', 'src/app/users/page.tsx', ['cmp_table']),
        component('cmp_table', 'src/components/Table.tsx'),
        component('cmp_orders', 'src/app/orders/page.tsx', ['cmp_table']),
        component('cmp_home', 'src/app/page.tsx'),
        component('cmp_cart', 'src/app/cart/page.tsx'),
      ],
      routes: [
        page('rt_home', '/', 'cmp_home', {
          layoutChain: [{ kind: 'layout', file: 'src/app/layout.tsx', componentId: 'cmp_layout' }],
        }),
        page('rt_users', '/users', 'cmp_users', {
          layoutChain: [{ kind: 'layout', file: 'src/app/layout.tsx', componentId: 'cmp_layout' }],
        }),
        page('rt_orders', '/orders', 'cmp_orders', {
          layoutChain: [{ kind: 'layout', file: 'src/app/layout.tsx', componentId: 'cmp_layout' }],
        }),
        page('rt_cart', '/cart', 'cmp_cart', {
          layoutChain: [{ kind: 'layout', file: 'src/app/layout.tsx', componentId: 'cmp_layout' }],
        }),
      ],
      requests: [
        site('req_users', 'cmp_users'),
        site('req_table', 'cmp_table'),
        site('req_header', 'cmp_header', {
          flags: [{ kind: 'dynamic-url', message: 'URL built at runtime.' }],
        }),
      ],
      flows: [flow('flw_users', 'rt_users', 'cmp_users'), flow('flw_header', 'rt_home', 'cmp_header')],
    })

  it('lists components in every area that uses them, and shares those most areas use', () => {
    const list = areasOf(featureModel())
    const area = (key: string) => list.areas.find((a) => a.key === key)
    // The layout and its header are on every page: shared.
    expect(list.sharedComponentIds.sort()).toEqual(['cmp_header', 'cmp_layout'])
    expect(area('cart')?.sharedComponentIds.sort()).toEqual(['cmp_header', 'cmp_layout'])
    // The table is on 2 of 4 areas: not more than half, so in both.
    expect(area('users')?.componentIds.sort()).toEqual(['cmp_table', 'cmp_users'])
    expect(area('orders')?.componentIds.sort()).toEqual(['cmp_orders', 'cmp_table'])
    expect(list.byComponent.get('cmp_table')?.map((a) => a.key)).toEqual(['orders', 'users'])
  })

  it('follows requests and flows to their component and start page', () => {
    const list = areasOf(featureModel())
    const area = (key: string) => list.areas.find((a) => a.key === key)
    expect(area('users')?.requestIds.sort()).toEqual(['req_table', 'req_users'])
    expect(area('orders')?.requestIds).toEqual(['req_table'])
    // The header is shared, so is its request (and its note).
    expect(list.sharedRequestIds).toEqual(['req_header'])
    expect(list.areas.flatMap((a) => a.notes)).toEqual([])
    expect(area('users')?.endpointKeys).toHaveLength(2)
    expect(area('users')?.flowIds).toEqual(['flw_users'])
    expect(area('home')?.flowIds).toEqual(['flw_header'])
  })

  it('follows a route handler request to the pages that call the handler', () => {
    const m = featureModel()
    m.routes.push({
      id: 'rt_api',
      path: '/api/users',
      kind: 'route-handler',
      file: 'src/app/api/users/route.ts',
      segments: [],
      layoutChain: [],
      methods: ['GET'],
    })
    m.requests.push(
      site('req_call', 'cmp_users', { targetRouteId: 'rt_api' }),
      site('req_upstream', '', {
        origin: 'route-handler',
        componentId: undefined,
        routeId: 'rt_api',
        handlerMethod: 'GET',
        trigger: { kind: 'server-render' },
      }),
    )
    const list = areasOf(m)
    expect(list.areas.find((a) => a.key === 'users')?.requestIds).toContain('req_upstream')
  })

  it('counts the open notes on the pages, components and requests of an area', () => {
    const m = featureModel()
    m.requests.push(
      site('req_bad', 'cmp_orders', { flags: [{ kind: 'dynamic-url', message: 'Runtime URL.' }] }),
    )
    m.routes.push(page('rt_empty', '/orders/empty', undefined as never))
    const list = areasOf(m)
    const orders = list.areas.find((a) => a.key === 'orders')
    expect(orders?.notes.map((n) => n.kind).sort()).toEqual(['missing-page-component', 'request'])
  })

  it('renames and merges areas from the config', () => {
    const m = featureModel()
    m.areas = { merge: { shop: ['orders', 'cart'], nope: ['missing'] }, rename: { shop: 'Shop', ghost: 'G' } }
    const list = areasOf(m)
    expect(summary(list)).toEqual({ home: ['home'], shop: ['cart', 'orders'], users: ['users'] })
    expect(list.areas.find((a) => a.key === 'shop')).toMatchObject({
      name: 'Shop',
      from: ['/cart', '/orders'],
    })
    expect(list.unknownConfig.sort()).toEqual(['ghost', 'missing'])
    // Two of three areas use the table now: shared.
    expect(list.sharedComponentIds).toContain('cmp_table')
  })

  it('keeps the same ids across scans', () => {
    const a = areasOf(featureModel()).areas.map((x) => x.id)
    const b = areasOf(featureModel()).areas.map((x) => x.id)
    expect(a).toEqual(b)
    expect(a.every((id) => id.startsWith('ar_'))).toBe(true)
  })
})
