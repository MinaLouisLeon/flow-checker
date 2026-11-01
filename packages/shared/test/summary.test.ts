// M32: Start here, the summary shared by the dashboard, `flow-checker summary` and ONBOARDING.md.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type AppModel,
  AppModelSchema,
  buildAreas,
  buildEndpoints,
  buildIndex,
  buildSummary,
  type Component,
  type Flow,
  type FlowsSummary,
  formatSummary,
  type ModelIndex,
  type Navigation,
  type RequestSite,
  type Route,
  SUMMARY_LIMITS,
  type Summary,
  type SummaryLink,
  type SummarySectionId,
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

/** Whether a link points at something in the model. */
function resolves(link: SummaryLink, index: ModelIndex): boolean {
  switch (link.to) {
    case 'page':
      return index.routes.get(link.routeId)?.kind === 'page'
    case 'middleware':
      return !!index.model.middleware && (!link.routeId || index.routes.get(link.routeId)?.kind === 'page')
    case 'area':
      return buildAreas(index).byId.has(link.areaId)
    case 'flow':
      return index.flows.has(link.flowId)
    case 'component':
      return index.components.has(link.componentId)
    case 'type':
      return index.types.has(link.typeId)
    case 'endpoints':
      return !link.host || buildEndpoints(index).hosts.some((h) => h.key === link.host)
    case 'requests':
      if (link.siteId) return index.requests.has(link.siteId)
      // A filtered list must not be empty.
      return index.model.requests.some(
        (s) =>
          (!link.transport || s.transport === link.transport) &&
          (!link.q ||
            [s.callStack.at(-1)?.file, s.hook?.module, s.client?.module, s.socket?.api].includes(link.q)),
      )
    default:
      return true
  }
}

const section = (summary: Summary, id: SummarySectionId) => {
  const found = summary.sections.find((s) => s.id === id)
  if (!found) throw new Error(`no section ${id}`)
  return found
}

describe.each(FIXTURES)('summary of %s', (fixture) => {
  const model = fixtureModel(fixture)
  const index = buildIndex(model)
  const summary = buildSummary(index)

  it('has every section, in order', () => {
    expect(summary.sections.map((s) => s.id)).toEqual([
      'stack',
      'areas',
      'entry',
      'flows',
      'backends',
      'places',
      'check',
    ])
  })

  it('links every item to something in the model', () => {
    for (const s of summary.sections) {
      expect(resolves(s.link, index), `${s.id} section`).toBe(true)
      for (const item of s.items)
        expect(resolves(item.link, index), `${s.id}: ${item.label} ${item.value}`).toBe(true)
    }
  })

  it('lists each entry page once', () => {
    const ids = section(summary, 'entry').items.map((i) => (i.link.to === 'page' ? i.link.routeId : ''))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('matches the snapshots (screen data and CLI text)', async () => {
    await expect(`${JSON.stringify(summary, null, 2)}\n`).toMatchFileSnapshot(
      `__snapshots__/summary/${fixture}.json`,
    )
    await expect(formatSummary(summary, fixture)).toMatchFileSnapshot(`__snapshots__/summary/${fixture}.txt`)
  })
})

// --- Hand-written models ---------------------------------------------------------------------

const loc = { file: 'src/app/page.tsx', line: 1, column: 1 }

function component(id: string, parts: Partial<Component> = {}): Component {
  return {
    id,
    name: id,
    file: `src/components/${id}.tsx`,
    loc,
    kind: 'client',
    clientBoundary: true,
    children: [],
    usedTypes: [],
    ...parts,
  }
}

function page(id: string, path: string, parts: Partial<Route> = {}): Route {
  return {
    id,
    path,
    kind: 'page',
    file: `src/app${path === '/' ? '' : path}/page.tsx`,
    segments: [],
    layoutChain: [{ kind: 'layout', file: 'src/app/layout.tsx', componentId: 'cmp_layout' }],
    componentId: `cmp_${id}`,
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

function link(id: string, componentId: string, targetRouteId: string): Navigation {
  return {
    id,
    origin: 'component',
    componentId,
    kind: 'link',
    api: 'next',
    href: { text: '/x', confidence: 'exact' },
    targetRouteId,
    trigger: { kind: 'event', event: 'onClick' },
    loc,
    callStack: [],
  }
}

function flow(id: string, routeIds: string[], steps: number): Flow {
  return {
    id,
    name: id,
    componentId: 'cmp_a',
    routeId: routeIds[0],
    steps: Array.from({ length: steps }, (_, i) => ({ kind: 'request' as const, siteId: `req_${i}` })),
    branches: [],
    routeIds,
  }
}

function model(parts: Partial<AppModel>): AppModel {
  return {
    version: 12,
    project: { appDir: 'src/app', nextVersion: '16.0.0' },
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

/** Pages with a component each, the given extra parts merged in. */
function app(paths: string[], parts: Partial<AppModel> = {}): AppModel {
  const routes = paths.map((p, i) => page(`rt_${i}`, p))
  const components = [component('cmp_layout'), ...routes.map((r) => component(r.componentId ?? ''))]
  return model({ routes, components, ...parts })
}

const summaryOf = (m: AppModel, flows?: FlowsSummary) => buildSummary(buildIndex(m), { flows })
const values = (s: Summary, id: SummarySectionId) => section(s, id).items.map((i) => `${i.label}: ${i.value}`)

describe('entry pages', () => {
  it('starts at /, then the most linked pages, then pages nothing links to', () => {
    const m = app(['/', '/a', '/b', '/c', '/d'])
    // Every page links to /a; /root and /b link to /b... /c and /d are linked from nowhere but /d links to /b.
    m.navigations = [
      link('n1', 'cmp_rt_0', 'rt_1'),
      link('n2', 'cmp_rt_2', 'rt_1'),
      link('n3', 'cmp_rt_4', 'rt_1'),
      link('n4', 'cmp_rt_1', 'rt_2'),
      // A self-link doesn't count.
      link('n5', 'cmp_rt_3', 'rt_3'),
    ]
    const s = summaryOf(m)
    expect(values(s, 'entry')).toEqual([
      'Start page: /',
      'Most linked: /a',
      'Not linked: /c',
      'Not linked: /d',
    ])
    expect(section(s, 'entry').items[1]?.detail).toBe('3 pages link here')
  })

  it('uses the locale page as the start page and leaves out slots and intercepted views', () => {
    const m = app(['/[locale]', '/[locale]/login', '/[locale]/photos/[id]', '/[locale]/feed'])
    m.routes[2] = { ...(m.routes[2] as Route), intercepting: { marker: '(.)', from: '/[locale]/feed' } }
    m.routes[3] = { ...(m.routes[3] as Route), slot: 'modal' }
    expect(values(summaryOf(m), 'entry')).toEqual(['Start page: /[locale]', 'Not linked: /[locale]/login'])
  })

  it('caps the pages nothing links to', () => {
    const paths = ['/', ...Array.from({ length: 20 }, (_, i) => `/p${String(i).padStart(2, '0')}`)]
    const s = section(summaryOf(app(paths)), 'entry')
    expect(s.items).toHaveLength(SUMMARY_LIMITS.entry)
    expect(s.more).toBe(20 - (SUMMARY_LIMITS.entry - 1))
    expect(s.note).toBe(`20 pages nothing links to, ${SUMMARY_LIMITS.entry - 1} shown`)
  })
})

describe('stack', () => {
  it('names the data libraries the requests use, with their counts', () => {
    const m = app(['/'])
    m.requests = [
      site('r1', 'cmp_rt_0', { hook: { name: 'useQuery', module: '@tanstack/react-query' } }),
      site('r2', 'cmp_rt_0', { hook: { name: 'useSWR', module: 'swr' } }),
      site('r3', 'cmp_rt_0', { transport: 'axios' }),
      site('r4', 'cmp_rt_0', { transport: 'api-client', client: { module: '@/lib/http', name: 'get' } }),
      site('r5', 'cmp_rt_0', {
        transport: 'websocket',
        socket: { api: 'socket.io', messages: [] },
      }),
    ]
    m.navigations = [{ ...link('n1', 'cmp_rt_0', 'rt_0'), api: 'next-intl' }]
    expect(values(summaryOf(m), 'stack')).toEqual([
      'Next.js: 16.0.0',
      'Rendering: 0 server, 2 client, 0 shared',
      'Data: React Query',
      'Data: SWR',
      'Data: axios',
      'Data: fetch',
      'Data: socket.io',
      'API client: @/lib/http',
      'i18n: next-intl',
    ])
  })

  it('says when the Next.js version is not known', () => {
    const m = app(['/'])
    m.project = { appDir: 'app' }
    expect(section(summaryOf(m), 'stack').items[0]).toMatchObject({
      value: 'version not known',
      detail: 'App Router in app/, 1 page, 0 route handlers',
    })
  })
})

describe('main flows', () => {
  const m = app(['/', '/a', '/b'])
  m.flows = [flow('short', ['rt_0'], 1), flow('long', ['rt_0', 'rt_1', 'rt_2'], 4), flow('tie', ['rt_0'], 4)]

  it('lists the longest first, with the pages they pass through', () => {
    const s = section(summaryOf(m), 'flows')
    expect(s.items.map((i) => i.label)).toEqual(['long', 'tie', 'short'])
    expect(s.items[0]).toMatchObject({ value: '/ → /a → /b', detail: '4 steps' })
  })

  it('shows which were confirmed by captures', () => {
    const runs: FlowsSummary = {
      flows: { short: { status: 'confirmed', source: 'inferred', runs: 1, branches: [] } },
      recorded: [],
    }
    const s = section(summaryOf(m, runs), 'flows')
    expect(s.note).toBe('3 flows, 1 confirmed')
    expect(s.items[2]?.detail).toBe('1 step, confirmed')
  })
})

describe('where things live', () => {
  it('finds the root layout, the files that send the most requests and the most-used types', () => {
    const m = app(['/', '/a'])
    const helper = (callee: string, file: string) => [
      { ...loc, callee },
      { file, line: 3, column: 1, callee: 'fetch' },
    ]
    m.requests = [
      site('r1', 'cmp_rt_0', { callStack: helper('getA', 'src/lib/api.ts') }),
      site('r2', 'cmp_rt_1', { callStack: helper('getB', 'src/lib/api.ts') }),
      site('r3', 'cmp_rt_1', { callStack: helper('getC', 'src/lib/other.ts') }),
      // A fetch written in the component itself isn't an API client.
      site('r4', 'cmp_rt_1'),
      site('r5', 'cmp_rt_1'),
    ]
    m.routes.push({ ...page('rt_h', '/api/x'), kind: 'route-handler', file: 'src/app/api/x/route.ts' })
    expect(values(summaryOf(m), 'places')).toEqual([
      'Root layout: src/app/layout.tsx',
      'Sends requests: src/lib/api.ts',
      'Route handlers: src/app/api/',
    ])
  })
})

describe('size', () => {
  /** The perf app's shape: a list and a detail page per feature, each linked from its list. */
  function featureApp(features: number): AppModel {
    const paths = ['/']
    for (let i = 0; i < features; i++) paths.push(`/f${i}`, `/f${i}/[id]`)
    const m = app(paths)
    for (let i = 0; i < features; i++) {
      const list = `rt_${1 + i * 2}`
      const detail = `rt_${2 + i * 2}`
      m.navigations.push(link(`n${i}`, `cmp_${list}`, detail))
      m.requests.push(
        site(`a${i}`, `cmp_${list}`, {
          url: { text: '', base: 'http://api.test', path: `/f${i}`, confidence: 'exact' },
        }),
      )
      m.flows.push(flow(`flow${i}`, [list, detail], 3))
    }
    return m
  }

  it('prints under 60 lines for 200 features', () => {
    const text = formatSummary(summaryOf(featureApp(200)), 'perf-app')
    expect(text.trimEnd().split('\n').length).toBeLessThan(60)
    expect(section(summaryOf(featureApp(200)), 'areas').more).toBe(201 - SUMMARY_LIMITS.areas)
  })
})
