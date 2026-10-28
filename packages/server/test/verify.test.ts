import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveCaptureOptions } from '@flow-checker/runtime/options'
import {
  type AppModel,
  type Capture,
  type CaptureSummary,
  MODEL_VERSION,
  type Overrides,
  type RequestSite,
  type VerificationSummary,
} from '@flow-checker/shared'
import { afterAll, describe, expect, it } from 'vitest'
import { CaptureStore, createApp } from '../src'

// Two components on the same page send the same request: only the stack or the interaction
// can tell them apart.
function site(id: string, componentId: string, file: string, over: Partial<RequestSite> = {}): RequestSite {
  return {
    id,
    origin: 'component',
    componentId,
    transport: 'fetch',
    method: 'GET',
    url: { text: "'/api/users'", confidence: 'exact', path: '/api/users' },
    trigger: { kind: 'effect' },
    callStack: [{ file, line: 5, column: 3, callee: 'fetch' }],
    status: 'inferred',
    flags: [],
    ...over,
  }
}

const component = (id: string, name: string, file: string, children: string[] = []) => ({
  id,
  name,
  file,
  loc: { file, line: 1, column: 1 },
  kind: 'client' as const,
  clientBoundary: true,
  children: children.map((c) => ({
    name: c,
    resolution: 'project' as const,
    componentId: c,
    loc: { file, line: 2, column: 1 },
  })),
  usedTypes: [],
})

const model = (requests: RequestSite[]): AppModel => ({
  version: MODEL_VERSION,
  project: { appDir: 'app' },
  routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'app', files: {}, children: [] },
  routes: [
    {
      id: 'rt_home',
      path: '/',
      kind: 'page',
      file: 'app/page.tsx',
      segments: [],
      layoutChain: [],
      componentId: 'cmp_page',
    },
  ],
  components: [
    component('cmp_page', 'HomePage', 'app/page.tsx', ['cmp_table', 'cmp_sidebar']),
    component('cmp_table', 'UsersTable', 'src/UsersTable.tsx'),
    component('cmp_sidebar', 'UsersSidebar', 'src/UsersSidebar.tsx'),
  ],
  types: [],
  requests,
})

const SITES = [
  site('req_table', 'cmp_table', 'src/UsersTable.tsx'),
  site('req_sidebar', 'cmp_sidebar', 'src/UsersSidebar.tsx'),
]

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

function capture(id: string, over: Partial<Capture> = {}): Capture {
  return {
    id,
    sessionId: 'ses_1',
    origin: 'browser',
    transport: 'fetch',
    timestamp: new Date().toISOString(),
    durationMs: 3,
    pageUrl: 'http://localhost:3000/',
    request: { method: 'GET', url: 'http://localhost:3000/api/users', headers: {}, body: { kind: 'none' } },
    response: { status: 200, headers: {}, body: { kind: 'json', value: [] } },
    stack: [],
    redacted: true,
    redactedPaths: [],
    ...over,
  }
}

function setup(requests = SITES) {
  const root = mkdtempSync(join(tmpdir(), 'flow-checker-verify-'))
  dirs.push(root)
  const store = new CaptureStore({ root }).load()
  let current = model(requests)
  const app = createApp({
    root,
    model: current,
    rescan: () => current,
    capture: { store, token: 'tok', options: resolveCaptureOptions() },
  })
  const call = (path: string, init?: RequestInit) => app.request(`http://127.0.0.1:4400${path}`, init)
  const json = async <T>(path: string, init?: RequestInit) => (await (await call(path, init)).json()) as T
  const ingest = (...captures: Capture[]) =>
    call('/ingest', { method: 'POST', body: JSON.stringify({ token: 'tok', captures }) })
  const assign = (id: string, siteId: string | null) =>
    call(`/api/captures/${id}/match`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ siteId }),
    })
  const setModel = (next: AppModel) => {
    current = next
  }
  return { root, store, call, json, ingest, assign, setModel }
}

const file = (root: string, folder: string, id: string) =>
  join(root, '.flow-checker', 'captures', folder, `${id}.json`)

describe('verification', () => {
  it('matches on ingest, files the capture under its site and marks the site verified', async () => {
    const { root, json, ingest } = setup()
    await ingest(
      capture('cap_table', {
        stack: ['at UsersTable.useEffect (http://localhost:3000/_next/static/chunks/a.js:10:5)'],
      }),
    )
    const [summary] = await json<CaptureSummary[]>('/api/captures')
    expect(summary?.match).toMatchObject({ status: 'matched', by: 'auto', siteId: 'req_table' })
    expect(existsSync(file(root, 'req_table', 'cap_table'))).toBe(true)

    const served = await json<AppModel>('/api/model')
    expect(served.requests.map((s) => [s.id, s.status])).toEqual([
      ['req_table', 'verified'],
      ['req_sidebar', 'inferred'],
    ])
    const verification = await json<VerificationSummary>('/api/verification')
    expect(verification.sites.req_table).toMatchObject({ captures: 1, lastCaptureId: 'cap_table' })
    expect(verification.counts).toEqual({ matched: 1, ambiguous: 0, unmatched: 0, manual: 0 })
    expect((await json<CaptureSummary[]>('/api/sites/req_table/captures')).map((c) => c.id)).toEqual([
      'cap_table',
    ])
  })

  it('uses the interaction component chain', async () => {
    const { json, ingest } = setup()
    await ingest(
      capture('cap_click', {
        interaction: {
          type: 'click',
          target: 'button',
          componentChain: ['UsersSidebar', 'HomePage'],
          at: '',
        },
      }),
    )
    const [summary] = await json<CaptureSummary[]>('/api/captures')
    expect(summary?.match).toMatchObject({ status: 'matched', siteId: 'req_sidebar' })
  })

  it('flags close calls as ambiguous and remembers a manual choice for similar captures', async () => {
    const { root, json, ingest, assign } = setup()
    await ingest(capture('cap_1'))
    const detail = await json<{ capture: Capture }>('/api/captures/cap_1')
    expect(detail.capture.match?.status).toBe('ambiguous')
    expect(detail.capture.match?.candidates.map((c) => c.siteId).sort()).toEqual(['req_sidebar', 'req_table'])
    expect(existsSync(file(root, '_unmatched', 'cap_1'))).toBe(true)

    const res = await assign('cap_1', 'req_sidebar')
    expect(res.status).toBe(200)
    expect(((await res.json()) as CaptureSummary).match).toMatchObject({
      status: 'matched',
      by: 'manual',
      siteId: 'req_sidebar',
    })
    // The file moved to the site's folder, and the decision is saved.
    expect(existsSync(file(root, '_unmatched', 'cap_1'))).toBe(false)
    expect(existsSync(file(root, 'req_sidebar', 'cap_1'))).toBe(true)
    const overrides = JSON.parse(
      readFileSync(join(root, '.flow-checker', 'overrides.json'), 'utf8'),
    ) as Overrides
    expect(overrides.matches).toMatchObject([{ siteId: 'req_sidebar' }])

    // A later capture like it gets the same site.
    await ingest(capture('cap_2'))
    const second = await json<{ capture: Capture }>('/api/captures/cap_2')
    expect(second.capture.match).toMatchObject({ status: 'matched', by: 'manual', siteId: 'req_sidebar' })
    expect((await json<VerificationSummary>('/api/verification')).counts.manual).toBe(2)

    // Back to automatic.
    const reset = await json<CaptureSummary>('/api/captures/cap_1/match', { method: 'DELETE' })
    expect(reset.match).toMatchObject({ status: 'ambiguous', by: 'auto' })
    expect(existsSync(file(root, '_unmatched', 'cap_2'))).toBe(true)
  })

  it('marks captures as matching no site, and rejects unknown sites', async () => {
    const { json, ingest, assign } = setup()
    await ingest(capture('cap_x'))
    expect((await assign('cap_x', 'req_nope')).status).toBe(400)
    expect((await assign('cap_missing', 'req_table')).status).toBe(404)
    const none = (await (await assign('cap_x', null)).json()) as CaptureSummary
    expect(none.match).toMatchObject({ status: 'unmatched', by: 'manual' })
    expect((await json<AppModel>('/api/model')).requests.every((s) => s.status === 'inferred')).toBe(true)
  })

  it('reports captures no site fits as unmatched', async () => {
    const { json, ingest } = setup()
    await ingest(
      capture('cap_other', {
        request: {
          method: 'POST',
          url: 'http://localhost:3000/api/other',
          headers: {},
          body: { kind: 'none' },
        },
      }),
    )
    const [summary] = await json<CaptureSummary[]>('/api/captures')
    expect(summary?.match).toMatchObject({ status: 'unmatched', by: 'auto' })
  })

  it('matches again after a re-scan and resets on clear', async () => {
    const { call, json, ingest, setModel } = setup([SITES[0] as RequestSite])
    await ingest(capture('cap_1'))
    expect((await json<CaptureSummary[]>('/api/captures'))[0]?.match?.siteId).toBe('req_table')

    // The re-scan finds a second site that fits as well.
    setModel(model(SITES))
    const rescanned = await json<AppModel>('/api/scan', { method: 'POST' })
    expect(rescanned.requests.every((s) => s.status === 'inferred')).toBe(true)
    expect((await json<CaptureSummary[]>('/api/captures'))[0]?.match?.status).toBe('ambiguous')

    setModel(model([SITES[0] as RequestSite]))
    await call('/api/scan', { method: 'POST' })
    expect((await json<AppModel>('/api/model')).requests[0]?.status).toBe('verified')
    await call('/api/captures', { method: 'DELETE' })
    expect((await json<AppModel>('/api/model')).requests[0]?.status).toBe('inferred')
  })

  it('ignores a match sent by the runtime', async () => {
    const { json, ingest } = setup()
    await ingest(
      capture('cap_forged', {
        match: { status: 'matched', by: 'manual', siteId: 'req_table', score: 999, candidates: [] },
      }),
    )
    expect((await json<CaptureSummary[]>('/api/captures'))[0]?.match).toMatchObject({
      status: 'ambiguous',
      by: 'auto',
    })
  })
})
