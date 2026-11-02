// M36: the impact check (what changing a file affects).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type AppModel,
  AppModelSchema,
  buildImpact,
  buildIndex,
  type Component,
  type Flow,
  formatImpact,
  type Impact,
  type RequestSite,
  type Route,
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

/** Every file the model mentions. */
function modelFiles(model: AppModel): string[] {
  const files = new Set<string>()
  for (const r of model.routes) files.add(r.file)
  for (const c of model.components) files.add(c.file)
  for (const t of model.types) files.add(t.definedAt.file)
  for (const s of model.requests) for (const f of s.callStack) files.add(f.file)
  for (const [file, targets] of Object.entries(model.imports ?? {}))
    for (const f of [file, ...targets]) files.add(f)
  return [...files].sort()
}

const ids = (items: { id: string }[]) => items.map((i) => i.id)

describe.each(FIXTURES)('impact on %s', (fixture) => {
  const model = fixtureModel(fixture)
  const index = buildIndex(model)
  const impactOf = (file: string) => buildImpact(index, [{ file }])

  it('reaches every request from each file on its call path', () => {
    for (const site of model.requests) {
      for (const frame of site.callStack)
        expect(ids(impactOf(frame.file).requests), frame.file).toContain(site.id)
    }
  })

  it('reaches every page that renders a component from its file', () => {
    for (const c of model.components) {
      const pages = (index.routesOf.get(c.id) ?? []).filter((id) => index.routes.get(id)?.kind === 'page')
      const impact = impactOf(c.file)
      for (const id of pages) expect(ids(impact.pages), `${c.name} on ${id}`).toContain(id)
    }
  })

  it('reaches every flow from the file it starts in', () => {
    for (const flow of model.flows) {
      const file = index.components.get(flow.componentId)?.file as string
      expect(ids(impactOf(file).flows), flow.name).toContain(flow.id)
    }
  })

  it('reaches the importers of every file that is only imported', () => {
    for (const file of modelFiles(model)) {
      const impact = impactOf(file)
      const [info] = impact.files
      if (info?.found !== 'imported') continue
      for (const via of info.via) expect(model.imports?.[via] ?? [], via).toBeDefined()
      expect(
        impact.pages.length + impact.handlers.length + impact.requests.length + impact.components.length,
      ).toBeGreaterThan(0)
    }
  })

  it('puts every page, route handler, flow and request in exactly one group', () => {
    for (const file of modelFiles(model)) {
      const impact = impactOf(file)
      const grouped = impact.groups.flatMap((g) => g.items.map((i) => `${i.kind}:${i.id}`)).sort()
      const listed = [...impact.pages, ...impact.handlers, ...impact.flows, ...impact.requests]
        .map((i) => `${i.kind}:${i.id}`)
        .sort()
      expect(grouped, file).toEqual(listed)
      for (const item of listed) expect(item).toMatch(/^(page|handler|flow|request):/)
    }
  })

  it('matches the snapshot of what each file affects', async () => {
    const lines = modelFiles(model).map((file) => {
      const impact = impactOf(file)
      const [info] = impact.files
      const counts = `${impact.pages.length}p ${impact.handlers.length}h ${impact.flows.length}f ${impact.requests.length}r ${impact.components.length}c ${impact.types.length}t`
      return `${file}  ${info?.found}${info?.via.length ? ` via ${info.via.join(', ')}` : ''}  ${counts}`
    })
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot(`__snapshots__/impact/${fixture}.txt`)
  })
})

describe('basic impact as text', () => {
  it('matches the text snapshot for a type, an API client and a constants file', async () => {
    const index = buildIndex(fixtureModel('basic'))
    const text = ['types/user.ts', 'lib/api.ts', 'lib/config.ts']
      .map((file) => formatImpact(buildImpact(index, [{ file }])))
      .join('\n---\n\n')
    await expect(text).toMatchFileSnapshot('__snapshots__/impact/basic.text.txt')
  })
})

// --- Hand-written models ----------------------------------------------------------------------

function model(parts: Partial<AppModel>): AppModel {
  return {
    version: 12,
    project: { appDir: 'app' },
    routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'app', files: {}, children: [] },
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

function page(id: string, path: string, file: string, componentId?: string, layouts: string[] = []): Route {
  return {
    id,
    path,
    kind: 'page',
    file,
    segments: [],
    layoutChain: layouts.map((l) => ({ kind: 'layout', file: `${l}.tsx`, componentId: l })),
    ...(componentId ? { componentId } : {}),
  }
}

function component(id: string, file: string, line = 1, children: string[] = []): Component {
  return {
    id,
    name: id,
    file,
    loc: { file, line, column: 1 },
    kind: 'server',
    clientBoundary: false,
    children: children.map((c) => ({
      name: c,
      resolution: 'project',
      componentId: c,
      loc: { file, line, column: 1 },
    })),
    usedTypes: [],
  }
}

function site(id: string, frames: [string, number][], parts: Partial<RequestSite> = {}): RequestSite {
  return {
    id,
    origin: 'component',
    transport: 'fetch',
    method: 'GET',
    url: { text: `/${id}`, confidence: 'exact', path: `/${id}` },
    trigger: { kind: 'page-load' },
    callStack: frames.map(([file, line]) => ({ file, line, column: 1, callee: 'fetch' })),
    status: 'inferred',
    flags: [],
    ...parts,
  }
}

const labels = (impact: Impact) => ({
  pages: impact.pages.map((p) => p.label),
  requests: impact.requests.map((r) => r.label),
  flows: impact.flows.map((f) => f.label),
})

describe('patterns', () => {
  it('reaches every page under a changed layout', () => {
    const m = model({
      routes: [
        page('rt_a', '/a', 'app/a/page.tsx', 'A', ['Root']),
        page('rt_b', '/b', 'app/b/page.tsx', 'B', ['Root']),
        page('rt_c', '/c', 'app/c/page.tsx', 'C'),
      ],
      components: [
        component('Root', 'Root.tsx'),
        component('A', 'app/a/page.tsx'),
        component('B', 'app/b/page.tsx'),
        component('C', 'app/c/page.tsx'),
      ],
    })
    const impact = buildImpact(buildIndex(m), [{ file: 'Root.tsx' }])
    expect(labels(impact).pages).toEqual(['/a', '/b'])
    expect(impact.pages[0]?.reason).toBe('inside Root.tsx')
  })

  it('reaches the pages below a loading or error file', () => {
    const m = model({
      routeTree: {
        segment: { raw: '', kind: 'static', name: '' },
        dir: 'app',
        files: {},
        children: [
          {
            segment: { raw: 'users', kind: 'static', name: 'users' },
            dir: 'app/users',
            files: { loading: 'app/users/loading.tsx', page: 'app/users/page.tsx' },
            children: [],
          },
        ],
      },
      routes: [
        page('rt_u', '/users', 'app/users/page.tsx'),
        page('rt_d', '/users/[id]', 'app/users/[id]/page.tsx'),
        page('rt_h', '/', 'app/page.tsx'),
      ],
    })
    const impact = buildImpact(buildIndex(m), [{ file: 'app/users/loading.tsx' }])
    expect(labels(impact).pages).toEqual(['/users', '/users/[id]'])
    expect(impact.files[0]).toMatchObject({ found: 'code', facts: ['2 routes'] })
  })

  it('reaches the pages the middleware runs on', () => {
    const m = model({
      routes: [page('rt_a', '/a', 'app/a/page.tsx'), page('rt_b', '/b', 'app/b/page.tsx')],
      middleware: {
        file: 'middleware.ts',
        convention: 'middleware',
        loc: { file: 'middleware.ts', line: 1, column: 1 },
        matchers: [],
        routes: [{ routeId: 'rt_b' }],
        rewrites: [],
      },
      requests: [site('me', [['middleware.ts', 4]], { origin: 'middleware' })],
    })
    const impact = buildImpact(buildIndex(m), [{ file: 'middleware.ts' }])
    expect(labels(impact)).toEqual({ pages: ['/b'], requests: ['GET /me'], flows: [] })
  })

  it('follows imports through files with nothing of their own, cycles included', () => {
    const m = model({
      routes: [page('rt_a', '/a', 'app/a/page.tsx', 'A')],
      components: [component('A', 'app/a/page.tsx')],
      requests: [
        site(
          'users',
          [
            ['app/a/page.tsx', 3],
            ['lib/api.ts', 5],
          ],
          { componentId: 'A' },
        ),
      ],
      imports: {
        'app/a/page.tsx': ['lib/api.ts'],
        'lib/api.ts': ['lib/util.ts'],
        'lib/util.ts': ['lib/constants.ts', 'lib/other.ts'],
        'lib/other.ts': ['lib/util.ts'],
      },
    })
    const impact = buildImpact(buildIndex(m), [{ file: 'lib/constants.ts' }])
    expect(impact.files[0]).toEqual({
      file: 'lib/constants.ts',
      found: 'imported',
      facts: [],
      via: ['lib/api.ts'],
    })
    expect(labels(impact)).toEqual({ pages: ['/a'], requests: ['GET /users'], flows: [] })
    expect(impact.requests[0]?.reason).toBe('sent through lib/api.ts (imports lib/constants.ts)')
  })

  it('says a file is not in the scan when nothing imports it (or the model is older)', () => {
    const m = model({ routes: [page('rt_a', '/a', 'app/a/page.tsx')] })
    const impact = buildImpact(buildIndex(m), [{ file: 'lib/constants.ts' }])
    expect(impact.files[0]).toEqual({ file: 'lib/constants.ts', found: 'none', facts: [], via: [] })
    expect(impact.groups).toEqual([])
    expect(formatImpact(impact)).toContain('Affects no pages, flows or requests.')
  })

  it('narrows to the lines given, else uses the whole file', () => {
    const m = model({
      routes: [page('rt_a', '/a', 'app/a/page.tsx', 'A'), page('rt_b', '/b', 'app/b/page.tsx', 'B')],
      components: [component('A', 'app/a/page.tsx'), component('B', 'app/b/page.tsx')],
      requests: [
        site(
          'one',
          [
            ['app/a/page.tsx', 2],
            ['lib/api.ts', 3],
          ],
          { componentId: 'A' },
        ),
        site(
          'two',
          [
            ['app/b/page.tsx', 2],
            ['lib/api.ts', 9],
          ],
          { componentId: 'B' },
        ),
      ],
    })
    const index = buildIndex(m)
    const one = buildImpact(index, [{ file: 'lib/api.ts', lines: { from: 1, to: 5 } }])
    expect(labels(one)).toEqual({ pages: ['/a'], requests: ['GET /one'], flows: [] })
    expect(one.files[0]?.wholeFile).toBeUndefined()
    const blank = buildImpact(index, [{ file: 'lib/api.ts', lines: { from: 6, to: 6 } }])
    expect(blank.files[0]?.wholeFile).toBe(true)
    expect(labels(blank).requests).toEqual(['GET /one', 'GET /two'])
  })

  it('spreads a type to the types, components and requests that use it', () => {
    const ref = (typeId: string) => ({ kind: 'ref' as const, typeId, name: typeId })
    const m = model({
      routes: [page('rt_a', '/a', 'app/a/page.tsx', 'A'), page('rt_b', '/b', 'app/b/page.tsx', 'B')],
      components: [
        { ...component('A', 'app/a/page.tsx'), propsType: { text: 'Props', shape: ref('typ_props') } },
        component('B', 'app/b/page.tsx'),
      ],
      types: [
        {
          id: 'typ_user',
          name: 'User',
          declarationKind: 'interface',
          definedAt: { file: 'types.ts', line: 1, column: 1 },
          shape: { kind: 'object', properties: [] },
        },
        {
          id: 'typ_props',
          name: 'Props',
          declarationKind: 'interface',
          definedAt: { file: 'app/a/page.tsx', line: 1, column: 1 },
          shape: { kind: 'object', properties: [{ name: 'user', type: ref('typ_user'), optional: false }] },
        },
      ],
      requests: [
        site('me', [['app/b/page.tsx', 2]], {
          componentId: 'B',
          responseType: { text: 'User', shape: ref('typ_user') },
        }),
      ],
    })
    const impact = buildImpact(buildIndex(m), [{ file: 'types.ts' }])
    expect(labels(impact)).toEqual({ pages: ['/a', '/b'], requests: ['GET /me'], flows: [] })
    expect(impact.types.map((t) => [t.label, t.reason])).toEqual([
      ['Props', 'uses type User'],
      ['User', 'defined in types.ts:1'],
    ])
    expect(impact.pages.map((p) => p.reason)).toEqual(['its page component changed', 'sends GET /me'])
  })

  it('follows a server action or route handler back to the request that leads to it', () => {
    const m = model({
      routes: [page('rt_a', '/a', 'app/a/page.tsx', 'Form')],
      components: [component('Form', 'app/a/Form.tsx')],
      requests: [
        site('save', [['app/a/Form.tsx', 4]], {
          componentId: 'Form',
          transport: 'server-action',
          method: 'POST',
          chain: ['upstream'],
          serverAction: { name: 'save', loc: { file: 'app/actions.ts', line: 1, column: 1 } },
        }),
        site('upstream', [['app/actions.ts', 3]], { origin: 'server-action', method: 'POST' }),
      ],
      flows: [
        {
          id: 'flw_save',
          name: 'Form submit',
          routeId: 'rt_a',
          componentId: 'Form',
          steps: [
            {
              kind: 'interaction',
              componentId: 'Form',
              event: 'onSubmit',
              loc: { file: 'app/a/Form.tsx', line: 4, column: 1 },
            },
            { kind: 'request', siteId: 'save' },
          ],
          branches: [],
          routeIds: ['rt_a'],
        } satisfies Flow,
      ],
    })
    const impact = buildImpact(buildIndex(m), [{ file: 'app/actions.ts' }])
    expect(labels(impact)).toEqual({
      pages: ['/a'],
      requests: ['POST /upstream', 'POST save (server action)'],
      flows: ['Form submit'],
    })
    expect(impact.requests.find((r) => r.id === 'save')?.reason).toBe('leads to POST /upstream')
    expect(impact.flows[0]?.reason).toBe('sends POST save (server action)')
  })

  it('reaches the requests of a tRPC procedure from the router file', () => {
    const m = model({
      routes: [page('rt_a', '/a', 'app/a/page.tsx', 'A')],
      components: [component('A', 'app/a/page.tsx')],
      requests: [
        site('list', [['app/a/page.tsx', 3]], {
          componentId: 'A',
          transport: 'trpc',
          procedure: { path: 'todo.list', type: 'query' },
        }),
      ],
      trpc: {
        endpoint: '/api/trpc',
        procedures: [
          {
            id: 'trpc_list',
            path: 'todo.list',
            type: 'query',
            loc: { file: 'server/router.ts', line: 8, column: 3 },
            siteIds: ['list'],
          },
        ],
      },
    })
    const impact = buildImpact(buildIndex(m), [{ file: 'server/router.ts' }])
    expect(labels(impact)).toEqual({ pages: ['/a'], requests: ['GET /list'], flows: [] })
    expect(impact.requests[0]?.reason).toBe('calls procedure todo.list, defined in server/router.ts:8')
  })

  it('combines several files, each with its own facts', () => {
    const m = model({
      routes: [page('rt_a', '/a', 'app/a/page.tsx', 'A'), page('rt_b', '/b', 'app/b/page.tsx', 'B')],
      components: [component('A', 'app/a/page.tsx'), component('B', 'app/b/page.tsx')],
    })
    const impact = buildImpact(buildIndex(m), [{ file: 'app/a/page.tsx' }, { file: 'app/b/page.tsx' }])
    expect(impact.files.map((f) => f.facts)).toEqual([['1 component'], ['1 component']])
    expect(labels(impact).pages).toEqual(['/a', '/b'])
  })
})

describe('a large app', () => {
  it('answers for a util every feature imports in under 100 ms', () => {
    const routes: Route[] = []
    const components: Component[] = []
    const requests: RequestSite[] = []
    const imports: Record<string, string[]> = { 'lib/api.ts': ['lib/util.ts'] }
    for (let i = 0; i < 200; i++) {
      const file = `app/f${i}/page.tsx`
      routes.push(page(`rt_${i}`, `/f${i}`, file, `P${i}`))
      components.push(
        component(`P${i}`, file, 1, [`C${i}a`, `C${i}b`]),
        component(`C${i}a`, `src/f${i}/a.tsx`),
        component(`C${i}b`, `src/f${i}/b.tsx`),
      )
      for (let k = 0; k < 5; k++)
        requests.push(
          site(
            `r${i}_${k}`,
            [
              [`src/f${i}/a.tsx`, k + 2],
              ['lib/api.ts', 10],
            ],
            { componentId: `C${i}a` },
          ),
        )
      imports[file] = [`src/f${i}/a.tsx`, `src/f${i}/b.tsx`]
      imports[`src/f${i}/a.tsx`] = ['lib/api.ts']
      imports[`src/f${i}/b.tsx`] = ['lib/util.ts']
    }
    const index = buildIndex(model({ routes, components, requests, imports }))
    buildImpact(index, [{ file: 'lib/util.ts' }]) // warm up
    const start = performance.now()
    const impact = buildImpact(index, [{ file: 'lib/util.ts' }])
    const took = performance.now() - start
    expect(impact.pages).toHaveLength(200)
    expect(impact.requests).toHaveLength(1000)
    expect(impact.files[0]?.via).toHaveLength(201)
    expect(took).toBeLessThan(100)
  })
})
