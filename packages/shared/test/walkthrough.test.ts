// M35: the guided walk-through (flows as a checklist) and the coverage numbers.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type AppModel,
  AppModelSchema,
  buildCoverage,
  buildIndex,
  buildWalkthrough,
  type Component,
  type Flow,
  type FlowStatus,
  type FlowsSummary,
  fillPath,
  type Navigation,
  pathParams,
  type RequestSite,
  type Route,
  shortRequest,
  type Walkthrough,
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

/** The walk-through as text, one flow per block: what a reviewer reads in the snapshot. */
function text(walk: Walkthrough): string {
  const lines: string[] = []
  const params = walk.params.map((p) => `[${p.name}]${p.suggested ? ` = ${p.suggested}` : ''}`)
  if (params.length > 0) lines.push(`params: ${params.join(', ')}`, '')
  for (const item of [...walk.todo, ...walk.walked]) {
    const requests = `${item.requests} request${item.requests === 1 ? '' : 's'}`
    lines.push(`## ${item.name}  ${item.path ?? '(no page)'}${item.entry ? '  entry' : ''}  ${requests}`)
    for (const [i, s] of item.steps.entries())
      lines.push(`${i + 1}. ${s.text}${s.checkable ? '' : '  (not seen)'}`)
    lines.push('')
  }
  return `${lines.join('\n').trimEnd()}\n`
}

describe.each(FIXTURES)('walk-through of %s', (fixture) => {
  const index = buildIndex(fixtureModel(fixture))
  const walk = buildWalkthrough(index, undefined)

  it('lists every flow once, all to walk, with the steps in the flow order', () => {
    const items = [...walk.todo, ...walk.walked]
    expect(walk.walked).toEqual([])
    expect(items.map((i) => i.flowId).sort()).toEqual(index.model.flows.map((f) => f.id).sort())
    for (const item of items) {
      const flow = index.flows.get(item.flowId) as Flow
      expect(item.steps.map((s) => s.kind)).toEqual(flow.steps.map((s) => s.kind))
      expect(item.done).toBe(0)
      expect(item.percent).toBe(0)
      for (const step of item.steps) {
        expect(step.text.split('`').length % 2, step.text).toBe(1)
        expect(step.text).not.toContain('?`')
      }
    }
  })

  it('opens every start page once its dynamic segments are filled in', () => {
    const values = Object.fromEntries(walk.params.map((p) => [p.name, p.suggested ?? 'x']))
    for (const item of walk.todo) {
      if (!item.path) continue
      const filled = fillPath(item.path, values)
      expect(filled.missing, item.path).toEqual([])
      expect(filled.path).not.toMatch(/\[/)
    }
  })

  it('matches the text snapshot', async () => {
    await expect(text(walk)).toMatchFileSnapshot(`__snapshots__/walkthrough/${fixture}.txt`)
  })
})

describe('next-intl walk-through', () => {
  const index = buildIndex(fixtureModel('next-intl'))
  const login = index.model.flows.find((f) => f.name === 'LoginForm submit') as Flow

  it('says what to do in plain words and suggests the default locale', () => {
    const walk = buildWalkthrough(index, undefined)
    const item = walk.todo.find((i) => i.flowId === login.id)
    expect(item?.path).toBe('/[locale]/login')
    expect(item?.steps.map((s) => s.text)).toEqual([
      'Submit the form in `LoginForm` on `/[locale]/login`',
      'It sends `POST /auth/login`',
      'It goes to `/[locale]/verify`',
      'Submit the form in `VerifyOtpForm` on `/[locale]/verify`',
      'It sends `POST /auth/verify-otp`',
      'It goes to `/[locale]/dashboard`',
      'The page loads `GET /me`',
    ])
    expect(walk.params).toEqual([{ name: 'locale', suggested: 'en' }])
    expect(fillPath('/[locale]/login', { locale: 'en' }).path).toBe('/en/login')
  })

  it('ticks the steps of the best run and moves a confirmed flow to walked', () => {
    const partial = buildWalkthrough(index, summary({ [login.id]: status('partial', 3) }))
    const item = partial.todo.find((i) => i.flowId === login.id)
    expect(item?.steps.map((s) => s.done)).toEqual([true, true, true, false, false, false, false])
    expect(item?.percent).toBe(42)

    const confirmed = buildWalkthrough(index, summary({ [login.id]: status('confirmed', 7) }))
    expect(confirmed.todo.some((i) => i.flowId === login.id)).toBe(false)
    const walked = confirmed.walked.find((i) => i.flowId === login.id)
    expect(walked?.percent).toBe(100)
    expect(walked?.steps.every((s) => s.done)).toBe(true)
    expect(confirmed.coverage.flows).toEqual({ done: 1, total: index.model.flows.length, percent: 100 })
  })
})

// --- Hand-written models ---------------------------------------------------------------------

const loc = { file: 'src/app/page.tsx', line: 1, column: 1 }

function component(id: string): Component {
  return {
    id,
    name: id,
    file: `src/components/${id}.tsx`,
    loc,
    kind: 'client',
    clientBoundary: true,
    children: [],
    usedTypes: [],
  }
}

function page(id: string, path: string, parts: Partial<Route> = {}): Route {
  return {
    id,
    path,
    kind: 'page',
    file: `src/app${path === '/' ? '' : path}/page.tsx`,
    segments: [],
    layoutChain: [],
    componentId: `cmp_${id}`,
    ...parts,
  }
}

function site(id: string, parts: Partial<RequestSite> = {}): RequestSite {
  return {
    id,
    origin: 'component',
    componentId: 'cmp_form',
    transport: 'fetch',
    method: 'POST',
    url: { text: `/api/${id}`, path: `/api/${id}`, confidence: 'exact' },
    trigger: { kind: 'event', event: 'onSubmit' },
    callStack: [{ ...loc, callee: 'fetch' }],
    status: 'inferred',
    flags: [],
    ...parts,
  }
}

function link(id: string, from: string, to: string): Navigation {
  return {
    id,
    origin: 'component',
    componentId: `cmp_${from}`,
    kind: 'link',
    api: 'next',
    href: { text: '/x', confidence: 'exact' },
    targetRouteId: to,
    trigger: { kind: 'event', event: 'onClick' },
    loc,
    callStack: [],
  }
}

/** A flow on `routeId`: an interaction, then `requests` request steps. */
function flow(id: string, routeId: string, requests: string[], event = 'onSubmit'): Flow {
  return {
    id,
    name: id,
    componentId: 'cmp_form',
    routeId,
    steps: [
      { kind: 'interaction', routeId, componentId: 'cmp_form', event, loc },
      ...requests.map((siteId) => ({ kind: 'request' as const, siteId })),
    ],
    branches: [],
    routeIds: [routeId],
  }
}

function model(parts: Partial<AppModel>): AppModel {
  return {
    version: 12,
    project: { appDir: 'src/app', nextVersion: '16.0.0' },
    routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'src/app', files: {}, children: [] },
    routes: [],
    components: [component('cmp_form')],
    types: [],
    requests: [],
    navigations: [],
    flows: [],
    queryLinks: [],
    ...parts,
  }
}

function status(s: FlowStatus['status'], steps: number): FlowStatus {
  return {
    status: s,
    source: s === 'confirmed' ? 'both' : 'inferred',
    runs: 1,
    best: { sessionId: 's', startedAt: '2026-11-02T10:00:00.000Z', steps, complete: s === 'confirmed' },
    branches: [],
  }
}

function summary(flows: Record<string, FlowStatus>): FlowsSummary {
  return { flows, recorded: [] }
}

describe('order', () => {
  // `/` links to `/settings`; `/admin` has no link to it.
  const routes = [page('rt_home', '/'), page('rt_settings', '/settings'), page('rt_admin', '/admin')]
  const requests = ['a', 'b', 'c', 'd'].map((id) => site(id))
  const navigations = [link('nv_1', 'rt_home', 'rt_settings')]

  it('puts flows on entry pages first, then the ones with more requests', () => {
    const m = model({
      routes,
      requests,
      navigations,
      flows: [
        flow('settings save', 'rt_settings', ['a', 'b', 'c']),
        flow('home one', 'rt_home', ['a']),
        flow('admin two', 'rt_admin', ['a', 'b']),
        flow('home two', 'rt_home', ['c', 'd']),
      ],
    })
    const walk = buildWalkthrough(buildIndex(m), undefined)
    expect(walk.todo.map((i) => `${i.name}${i.entry ? ' (entry)' : ''}`)).toEqual([
      'admin two (entry)',
      'home two (entry)',
      'home one (entry)',
      'settings save',
    ])
  })

  it('counts a flow that starts in a layout as entry when any of its pages is', () => {
    const f = { ...flow('menu', 'rt_settings', ['a']), startRouteIds: ['rt_settings', 'rt_home'] }
    const walk = buildWalkthrough(buildIndex(model({ routes, requests, navigations, flows: [f] })), undefined)
    expect(walk.todo[0]?.entry).toBe(true)
  })

  it('keeps the order when a flow is walked and splits todo from walked', () => {
    const flows = [flow('one', 'rt_admin', ['a', 'b']), flow('two', 'rt_admin', ['c'])]
    const m = model({ routes, requests, navigations, flows })
    const walk = buildWalkthrough(
      buildIndex(m),
      summary({ one: status('confirmed', 3), two: status('partial', 1) }),
    )
    expect(walk.todo.map((i) => [i.name, i.status, i.done])).toEqual([['two', 'partial', 1]])
    expect(walk.walked.map((i) => [i.name, i.percent])).toEqual([['one', 100]])
  })
})

describe('step wording', () => {
  const routes = [page('rt_p', '/p')]

  it('names the event, the request and what capture cannot see', () => {
    const m = model({
      routes,
      requests: [
        site('save'),
        site('load', { method: 'GET', trigger: { kind: 'server-render' } }),
        site('act', { transport: 'server-action', serverAction: { name: 'createItem', loc } }),
      ],
      flows: [
        {
          ...flow('f', 'rt_p', ['save', 'act']),
          steps: [
            { kind: 'interaction', routeId: 'rt_p', componentId: 'cmp_form', event: 'onClick', loc },
            { kind: 'request', siteId: 'save' },
            { kind: 'request', siteId: 'act' },
            { kind: 'request', siteId: 'load', onLoad: true },
            { kind: 'navigate', navigationId: 'nv_none' },
            { kind: 'query-update', linkId: 'ql_none' },
          ],
        },
      ],
    })
    const item = buildWalkthrough(buildIndex(m), undefined).todo[0]
    expect(item?.steps.map((s) => [s.text, s.checkable])).toEqual([
      ['Click in `cmp_form` on `/p`', true],
      ['It sends `POST /api/save`', true],
      ['It sends `action createItem`', true],
      ['The server sends `GET /api/load` while it renders the page', false],
      ['It goes to another page', true],
      ['It updates the cache', false],
    ])
  })

  it('writes short request names for each transport', () => {
    expect(
      shortRequest(site('x', { url: { text: '/u', path: '/u', query: 'id=:id', confidence: 'exact' } })),
    ).toBe('POST /u?id=:id')
    expect(
      shortRequest(site('x', { transport: 'trpc', procedure: { path: 'todo.add', type: 'mutation' } })),
    ).toBe('tRPC todo.add')
    expect(
      shortRequest(site('x', { transport: 'graphql', operation: { id: 'op', name: '', type: 'query' } })),
    ).toBe('GraphQL anonymous operation')
    expect(shortRequest(site('x', { url: { text: 'base + path', confidence: 'unknown' } }))).toBe(
      'POST base + path',
    )
    expect(
      shortRequest(
        site('x', { transport: 'websocket', url: { text: '/ws', path: '/ws', confidence: 'exact' } }),
      ),
    ).toBe('WebSocket /ws')
    expect(
      shortRequest(site('x', { transport: 'sse', url: { text: '/s', path: '/s', confidence: 'exact' } })),
    ).toBe('event stream /s')
  })
})

describe('page links', () => {
  it('lists dynamic segments in order', () => {
    expect(pathParams('/[locale]/shop/[id]/[...rest]/[[...opt]]')).toEqual(['locale', 'id', 'rest', 'opt'])
    expect(pathParams('/about')).toEqual([])
  })

  it('fills in values, encodes them and keeps catch-all slashes', () => {
    expect(fillPath('/users/[id]', { id: 'a b' })).toEqual({ path: '/users/a%20b', missing: [] })
    expect(fillPath('/docs/[...slug]', { slug: '/guides/start/' }).path).toBe('/docs/guides/start')
    expect(fillPath('/shop/[[...filters]]', {}).path).toBe('/shop')
    expect(fillPath('/', {}).path).toBe('/')
  })

  it('lists the missing values instead of a broken link', () => {
    expect(fillPath('/[locale]/users/[id]', { locale: 'en', id: ' ' })).toEqual({ missing: ['id'] })
  })

  it('suggests a locale only for the first segment of a next-intl app', () => {
    const routes = [page('rt_a', '/[lang]/items/[lang2]')]
    const m = model({
      routes,
      requests: [site('a')],
      flows: [flow('f', 'rt_a', ['a'])],
      middleware: {
        file: 'src/proxy.ts',
        convention: 'proxy',
        matchers: [],
        routes: [],
        navigations: [],
        rewrites: [],
        i18n: { locales: ['de', 'fr'] },
      } as unknown as AppModel['middleware'],
    })
    expect(buildWalkthrough(buildIndex(m), undefined).params).toEqual([
      { name: 'lang', suggested: 'de' },
      { name: 'lang2' },
    ])
  })
})

describe('coverage', () => {
  it('counts confirmed flows and request sites with captures, rounded down', () => {
    const m = model({
      routes: [page('rt_p', '/p')],
      requests: [
        site('a', { status: 'verified' }),
        site('b', { status: 'mismatch' }),
        site('c', { status: 'needs-recheck' }),
        site('d'),
        site('e'),
        site('f'),
      ],
      flows: [flow('one', 'rt_p', ['a']), flow('two', 'rt_p', ['b']), flow('three', 'rt_p', ['c'])],
    })
    const coverage = buildCoverage(
      buildIndex(m),
      summary({ one: status('confirmed', 2), two: status('partial', 1) }),
    )
    expect(coverage.flows).toEqual({ done: 1, total: 3, percent: 33 })
    expect(coverage.requests).toEqual({ done: 3, total: 6, percent: 50 })
  })

  it('is 0 of 0 on an app with nothing to walk', () => {
    expect(buildCoverage(buildIndex(model({})), undefined)).toEqual({
      flows: { done: 0, total: 0, percent: 0 },
      requests: { done: 0, total: 0, percent: 0 },
    })
  })
})

describe('a large app', () => {
  it('builds the walk-through for 200 features in under 50 ms', () => {
    const routes: Route[] = [page('rt_home', '/')]
    const requests: RequestSite[] = []
    const flows: Flow[] = []
    const navigations: Navigation[] = []
    for (let i = 0; i < 200; i++) {
      routes.push(page(`rt_f${i}`, `/f${i}`), page(`rt_f${i}_d`, `/f${i}/[id]`))
      navigations.push(link(`nv_${i}`, 'rt_home', `rt_f${i}`), link(`nv_${i}_d`, `rt_f${i}`, `rt_f${i}_d`))
      const ids = Array.from({ length: 5 }, (_, k) => `req_${i}_${k}`)
      requests.push(...ids.map((id) => site(id)))
      flows.push(flow(`f${i}`, `rt_f${i}_d`, ids))
    }
    const index = buildIndex(model({ routes, requests, navigations, flows }))
    const start = performance.now()
    const walk = buildWalkthrough(index, undefined)
    const took = performance.now() - start
    expect(walk.todo).toHaveLength(200)
    expect(walk.params).toEqual([{ name: 'id' }])
    expect(took).toBeLessThan(50)
  })
})
