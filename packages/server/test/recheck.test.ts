// M9: when a request site's code changes, captures taken before are stale and the site needs a
// re-check. Code that only moved (new id, same hash) keeps its captures and manual matches.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
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
import { BEGINNING, CaptureStore, CodeHistory, createApp, ScanFeed } from '../src'

const NUMBER_ID = {
  text: '{ id: number }',
  shape: {
    kind: 'object' as const,
    properties: [{ name: 'id', type: { kind: 'primitive' as const, name: 'number' as const } }],
  },
}

function site(id: string, file: string, hash: string, over: Partial<RequestSite> = {}): RequestSite {
  return {
    id,
    origin: 'component',
    componentId: file.includes('Table') ? 'cmp_table' : 'cmp_sidebar',
    transport: 'fetch',
    method: 'GET',
    url: { text: "'/api/users'", confidence: 'exact', path: '/api/users' },
    trigger: { kind: 'effect' },
    callStack: [{ file, line: 5, column: 3, callee: 'fetch' }],
    hash,
    status: 'inferred',
    flags: [],
    ...over,
  }
}

const component = (id: string, name: string, file: string) => ({
  id,
  name,
  file,
  loc: { file, line: 1, column: 1 },
  kind: 'client' as const,
  clientBoundary: true,
  children: [],
  usedTypes: [],
})

const model = (requests: RequestSite[]): AppModel => ({
  version: MODEL_VERSION,
  project: { appDir: 'app' },
  routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'app', files: {}, children: [] },
  routes: [],
  components: [
    component('cmp_table', 'UsersTable', 'src/UsersTable.tsx'),
    component('cmp_sidebar', 'UsersSidebar', 'src/UsersSidebar.tsx'),
  ],
  types: [],
  requests,
  navigations: [],
  flows: [],
  queryLinks: [],
})

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString()

function capture(id: string, timestamp: string, over: Partial<Capture> = {}): Capture {
  return {
    id,
    sessionId: 'ses_1',
    origin: 'browser',
    transport: 'fetch',
    timestamp,
    durationMs: 3,
    pageUrl: 'http://localhost:3000/',
    request: { method: 'GET', url: 'http://localhost:3000/api/users', headers: {}, body: { kind: 'none' } },
    response: { status: 200, headers: {}, body: { kind: 'json', value: { id: 1 } } },
    stack: ['at UsersTable.useEffect (http://localhost:3000/_next/static/chunks/a.js:10:5)'],
    redacted: true,
    redactedPaths: [],
    ...over,
  }
}

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

function setup(requests: RequestSite[]) {
  const root = mkdtempSync(join(tmpdir(), 'flow-checker-recheck-'))
  dirs.push(root)
  const store = new CaptureStore({ root }).load()
  const scans = new ScanFeed()
  const app = createApp({
    root,
    model: model(requests),
    scans,
    capture: { store, token: 'tok', options: resolveCaptureOptions() },
  })
  const call = (path: string, init?: RequestInit) => app.request(`http://127.0.0.1:4400${path}`, init)
  const json = async <T>(path: string, init?: RequestInit) => (await (await call(path, init)).json()) as T
  const ingest = (...captures: Capture[]) =>
    call('/ingest', { method: 'POST', body: JSON.stringify({ token: 'tok', captures }) })
  const status = async () =>
    Object.fromEntries((await json<AppModel>('/api/model')).requests.map((s) => [s.id, s.status]))
  const rescan = (next: RequestSite[]) => scans.publish({ model: model(next), files: ['src/UsersTable.tsx'] })
  return { root, json, call, ingest, status, rescan }
}

const TABLE = 'src/UsersTable.tsx'
const SIDEBAR = 'src/UsersSidebar.tsx'

describe('needs-recheck', () => {
  it('marks a site whose code changed, and verifies it again with a new capture', async () => {
    const { json, ingest, status, rescan } = setup([
      site('req_table', TABLE, 'h1'),
      site('req_sidebar', SIDEBAR, 's1'),
    ])
    await ingest(capture('cap_old', minutesAgo(5)))
    expect(await status()).toEqual({ req_table: 'verified', req_sidebar: 'inferred' })

    rescan([site('req_table', TABLE, 'h2'), site('req_sidebar', SIDEBAR, 's1')])
    const served = await json<AppModel>('/api/model')
    expect(served.requests[0]).toMatchObject({ status: 'needs-recheck', flags: [{ kind: 'stale' }] })
    expect(served.requests[0]?.flags[0]?.message).toContain('1 capture from before the change')
    const verification = await json<VerificationSummary>('/api/verification')
    expect(verification.sites.req_table).toMatchObject({ captures: 1, stale: 1 })
    expect(verification.sites.req_table?.changedAt).toBeDefined()
    const [old] = await json<CaptureSummary[]>('/api/sites/req_table/captures')
    expect(old).toMatchObject({ id: 'cap_old', stale: true })
    expect((await json<CaptureSummary[]>('/api/captures'))[0]?.stale).toBe(true)

    await ingest(capture('cap_new', new Date(Date.now() + 1000).toISOString()))
    expect(await status()).toEqual({ req_table: 'verified', req_sidebar: 'inferred' })
    const served2 = await json<AppModel>('/api/model')
    expect(served2.requests[0]?.flags).toEqual([])
    const list = await json<CaptureSummary[]>('/api/sites/req_table/captures')
    expect(list.map((c) => [c.id, c.stale ?? false])).toEqual([
      ['cap_new', false],
      ['cap_old', true],
    ])
  })

  it('leaves sites whose code did not change alone', async () => {
    const { ingest, status, rescan } = setup([site('req_table', TABLE, 'h1')])
    await ingest(capture('cap_old', minutesAgo(5)))
    rescan([site('req_table', TABLE, 'h1', { flags: [{ kind: 'dynamic-url', message: 'x' }] })])
    expect(await status()).toEqual({ req_table: 'verified' })
  })

  it('judges types by captures of the current code', async () => {
    const typed = (hash: string) => site('req_table', TABLE, hash, { responseType: NUMBER_ID })
    const { ingest, status, rescan } = setup([typed('h1')])
    // The old code got a string id back.
    await ingest(
      capture('cap_old', minutesAgo(5), {
        response: { status: 200, headers: {}, body: { kind: 'json', value: { id: 'one' } } },
      }),
    )
    expect(await status()).toEqual({ req_table: 'mismatch' })

    rescan([typed('h2')])
    expect(await status()).toEqual({ req_table: 'needs-recheck' })

    await ingest(capture('cap_new', new Date(Date.now() + 1000).toISOString()))
    expect(await status()).toEqual({ req_table: 'verified' })
  })

  it('moves captures and manual matches with code that only moved', async () => {
    // Same URL from two components: ambiguous without the stack, so pick one by hand.
    const { root, json, ingest, call, status, rescan } = setup([
      site('req_table', TABLE, 'h1'),
      site('req_sidebar', SIDEBAR, 's1'),
    ])
    const click = { type: 'click', target: 'button', componentChain: ['UsersTable'], at: '' }
    await ingest(
      capture('cap_auto', minutesAgo(5), { interaction: click }),
      capture('cap_manual', minutesAgo(5), { stack: [] }),
    )
    await call('/api/captures/cap_manual/match', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ siteId: 'req_sidebar' }),
    })
    expect(await status()).toEqual({ req_table: 'verified', req_sidebar: 'verified' })

    // Lines were added above both: new ids, same code.
    rescan([site('req_table2', TABLE, 'h1'), site('req_sidebar2', SIDEBAR, 's1')])
    expect(await status()).toEqual({ req_table2: 'verified', req_sidebar2: 'verified' })
    const auto = await json<{ capture: Capture }>('/api/captures/cap_auto')
    expect(auto.capture.match).toMatchObject({ status: 'matched', by: 'auto', siteId: 'req_table2' })
    const manual = await json<{ capture: Capture }>('/api/captures/cap_manual')
    expect(manual.capture.match).toMatchObject({ status: 'matched', by: 'manual', siteId: 'req_sidebar2' })
    const overrides = JSON.parse(
      readFileSync(join(root, '.flow-checker', 'overrides.json'), 'utf8'),
    ) as Overrides
    expect(overrides.matches.map((m) => m.siteId)).toEqual(['req_sidebar2'])
  })

  it('marks a site whose code changed and moved', async () => {
    const { ingest, status, rescan } = setup([site('req_table', TABLE, 'h1')])
    await ingest(capture('cap_old', minutesAgo(5)))
    // Old captures point at line 5; the request is now far below and its code is different.
    const moved = site('req_table2', TABLE, 'h2', {
      callStack: [{ file: TABLE, line: 40, column: 3, callee: 'fetch' }],
    })
    rescan([moved])
    expect(await status()).toEqual({ req_table2: 'needs-recheck' })
  })

  it('sends a scan event on the live feed', async () => {
    const { call, ingest, rescan } = setup([site('req_table', TABLE, 'h1')])
    await ingest(capture('cap_old', minutesAgo(5)))
    const res = await call('/api/live')
    const reader = res.body?.pipeThrough(new TextDecoderStream()).getReader()
    if (!reader) throw new Error('no stream')
    let text = ''
    while (!text.includes('event: ready')) text += (await reader.read()).value ?? ''

    rescan([site('req_table', TABLE, 'h2')])
    while (!text.includes('event: scan')) text += (await reader.read()).value ?? ''
    await reader.cancel()
    const data = /event: scan\ndata: (.*)\n/.exec(text)?.[1]
    expect(JSON.parse(data ?? '{}')).toMatchObject({
      files: ['src/UsersTable.tsx'],
      changedCode: ['req_table'],
      needsRecheck: ['req_table'],
      changes: { requests: { added: 0, removed: 0, changed: 1 } },
    })
  })
})

describe('code history', () => {
  it('sets a baseline on the first scan and dates later code from when it was seen', () => {
    const root = mkdtempSync(join(tmpdir(), 'flow-checker-history-'))
    dirs.push(root)
    const first = new CodeHistory(root)
    first.update(model([site('req_a', TABLE, 'h1')]))
    expect(first.since('h1')).toBe(BEGINNING)

    // A new process reads the file: unchanged code keeps its date, new code gets "now".
    const second = new CodeHistory(root)
    const now = new Date('2026-10-29T12:00:00.000Z')
    expect([...second.update(model([site('req_a', TABLE, 'h2')]), now)]).toEqual(['h2'])
    expect(second.since('h2')).toBe(now.toISOString())
    expect(second.since('h1')).toBeUndefined()
  })
})
