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
  navigations: [],
  flows: [],
  queryLinks: [],
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
    expect(verification.counts).toEqual({ matched: 1, ambiguous: 0, unmatched: 0, manual: 0, thirdParty: 0 })
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

describe('type comparison', () => {
  const userType = (idType: 'number' | 'string') => ({
    text: 'User[]',
    shape: {
      kind: 'array' as const,
      element: {
        kind: 'object' as const,
        properties: [
          { name: 'id', type: { kind: 'primitive' as const, name: idType } },
          { name: 'name', type: { kind: 'primitive' as const, name: 'string' as const } },
        ],
      },
    },
  })
  const typed = (idType: 'number' | 'string') => [
    site('req_table', 'cmp_table', 'src/UsersTable.tsx', { responseType: userType(idType) }),
  ]
  const users = capture('cap_users', {
    response: { status: 200, headers: {}, body: { kind: 'json', value: [{ id: '1', name: 'Ada' }] } },
  })

  it('flags a site whose captured response does not fit its type, and clears it after a fix', async () => {
    const { call, json, ingest, setModel } = setup(typed('number'))
    await ingest(users)

    const [summary] = await json<CaptureSummary[]>('/api/captures')
    expect(summary).toMatchObject({ match: { status: 'matched' }, typeCheck: 'mismatch' })
    const { capture: stored } = await json<{ capture: Capture }>('/api/captures/cap_users')
    expect(stored.typeCheck?.parts).toEqual([
      {
        part: 'response',
        type: 'User[]',
        status: 'mismatch',
        mismatches: [
          { kind: 'wrong-type', path: 'response.body[].id', expected: 'number', actual: 'string "1"' },
        ],
      },
    ])
    // The runtime can't send its own result.
    expect(stored.typeCheck?.siteId).toBe('req_table')

    const served = await json<AppModel>('/api/model')
    expect(served.requests[0]).toMatchObject({
      status: 'mismatch',
      flags: [
        { kind: 'type-mismatch', message: expect.stringContaining('[].id is string "1" (expected number)') },
      ],
    })
    const verification = await json<VerificationSummary>('/api/verification')
    expect(verification.sites.req_table?.typeCheck).toMatchObject({ checked: 1, mismatched: 1 })

    // The type is fixed in the code: a re-scan checks the stored capture again.
    setModel(model(typed('string')))
    const rescanned = await json<AppModel>('/api/scan', { method: 'POST' })
    expect(rescanned.requests[0]).toMatchObject({ status: 'verified', flags: [] })
    expect((await json<CaptureSummary[]>('/api/captures'))[0]?.typeCheck).toBe('ok')
    await call('/api/captures', { method: 'DELETE' })
  })

  it('ignores a type check sent by the runtime', async () => {
    const { json, ingest } = setup(typed('string'))
    await ingest({
      ...users,
      typeCheck: {
        siteId: 'req_table',
        parts: [{ part: 'response', type: 'x', status: 'mismatch', mismatches: [] }],
      },
    })
    expect((await json<CaptureSummary[]>('/api/captures'))[0]?.typeCheck).toBe('ok')
  })
})

describe('event streams (M18)', () => {
  const shape = (n: 'number' | 'string') => ({
    text: 'Tick',
    shape: {
      kind: 'object' as const,
      properties: [{ name: 'n', type: { kind: 'primitive' as const, name: n } }],
    },
  })
  const streamSite = (over: Partial<RequestSite> = {}) =>
    site('req_clock', 'cmp_table', 'src/UsersTable.tsx', {
      transport: 'sse',
      url: { text: "'/api/clock'", confidence: 'exact', path: '/api/clock' },
      stream: {
        api: 'event-source',
        events: [
          { name: 'tick', dataType: shape('number'), typeFrom: 'code', listened: true },
          { name: 'done', listened: true },
        ],
      },
      ...over,
    })
  const clock = (over: Partial<Capture> = {}) =>
    capture('cap_clock', {
      transport: 'eventsource',
      request: { method: 'GET', url: 'http://localhost:3000/api/clock', headers: {}, body: { kind: 'none' } },
      response: { status: 200, headers: { 'content-type': 'text/event-stream' }, body: { kind: 'none' } },
      ...over,
    })
  const tick = (n: unknown) => ({
    direction: 'in' as const,
    event: 'tick',
    at: '2026-10-30T10:00:00.000Z',
    size: 7,
    body: { kind: 'json' as const, value: { n } },
  })

  it('appends stream updates, matches the EventSource site and checks each event', async () => {
    const { json, ingest } = setup([
      streamSite(),
      site('req_plain', 'cmp_sidebar', 'src/UsersSidebar.tsx', {
        url: { text: "'/api/clock'", confidence: 'exact', path: '/api/clock' },
      }),
    ])
    await ingest(clock({ stream: { state: 'open', count: 0, bytes: 0 }, messages: [] }))
    await ingest(
      clock({ stream: { state: 'open', count: 2, bytes: 14, from: 0 }, messages: [tick(1), tick(2)] }),
    )
    await ingest(
      clock({
        stream: { state: 'closed', count: 3, bytes: 23, from: 2 },
        messages: [tick('3'), { direction: 'in', event: 'done', at: '2026-10-30T10:00:01.000Z', size: 2 }],
      }),
    )

    const { capture: stored } = await json<{ capture: Capture }>('/api/captures/cap_clock')
    expect(stored.stream).toEqual({ state: 'closed', count: 3, bytes: 23 })
    expect(stored.messages?.map((m) => m.event)).toEqual(['tick', 'tick', 'tick', 'done'])
    expect(stored.match).toMatchObject({ status: 'matched', siteId: 'req_clock' })
    expect(stored.match?.candidates[0]?.evidence).toContainEqual({
      signal: 'stream',
      points: 10,
      detail: 'listens to tick, done',
    })
    // An EventSource can't come from a plain fetch site.
    expect(stored.match?.candidates.map((c) => c.siteId)).toEqual(['req_clock'])
    expect(stored.typeCheck?.parts).toEqual([
      {
        part: 'message',
        event: 'tick',
        type: 'Tick',
        status: 'mismatch',
        messages: 3,
        mismatches: [
          { kind: 'wrong-type', path: 'messages[tick].body.n', expected: 'number', actual: 'string "3"' },
        ],
      },
    ])
    const served = await json<AppModel>('/api/model')
    expect(served.requests.find((s) => s.id === 'req_clock')).toMatchObject({
      status: 'mismatch',
      flags: [
        {
          kind: 'type-mismatch',
          message: expect.stringContaining(
            'Event "tick" doesn\'t match Tick: n is string "3" (expected number)',
          ),
        },
      ],
    })
  })

  it('rules out a streamed fetch on an EventSource site, and lowers a plain response on a stream site', async () => {
    const { json, ingest } = setup([streamSite()])
    await ingest(
      clock({
        id: 'cap_fetch',
        transport: 'fetch',
        stream: { state: 'closed', count: 0, bytes: 0 },
        messages: [],
      }),
      capture('cap_json', {
        request: {
          method: 'GET',
          url: 'http://localhost:3000/api/clock',
          headers: {},
          body: { kind: 'none' },
        },
      }),
    )
    const fetched = await json<{ capture: Capture }>('/api/captures/cap_fetch')
    expect(fetched.capture.match?.status).toBe('unmatched')
    const plain = await json<{ capture: Capture }>('/api/captures/cap_json')
    expect(plain.capture.match?.candidates[0]?.evidence).toContainEqual({
      signal: 'stream',
      points: -15,
      detail: 'not an event stream',
    })
  })
})

describe('WebSockets (M19)', () => {
  const chat = {
    text: 'Chat',
    shape: {
      kind: 'object' as const,
      properties: [{ name: 'text', type: { kind: 'primitive' as const, name: 'string' as const } }],
    },
  }
  const socketIoSite = (id: string, file: string, names: string[]) =>
    site(id, 'cmp_table', file, {
      transport: 'websocket',
      url: {
        text: "'http://localhost:4011'",
        confidence: 'exact',
        base: 'http://localhost:4011',
        path: '/socket.io/',
      },
      socket: {
        api: 'socket.io',
        messages: names.map((n) => ({
          direction: n.startsWith('>') ? ('out' as const) : ('in' as const),
          name: n.replace('>', ''),
          dataType: chat,
        })),
      },
    })
  const message = (direction: 'in' | 'out', event: string, text: unknown) => ({
    direction,
    event,
    at: '2026-10-30T10:00:00.000Z',
    size: 20,
    body: { kind: 'json' as const, value: { text } },
  })
  const socket = (over: Partial<Capture> = {}) =>
    capture('cap_ws', {
      transport: 'websocket',
      request: {
        method: 'GET',
        url: 'ws://localhost:4011/socket.io/?EIO=4&transport=websocket',
        headers: {},
        body: { kind: 'none' },
      },
      response: { status: 101, headers: {}, body: { kind: 'none' } },
      ...over,
    })

  it('matches socket.io captures by their event names over ws, merges updates and checks both ways', async () => {
    const { json, ingest } = setup([
      socketIoSite('req_chat', 'src/UsersTable.tsx', ['chat', '>chat']),
      socketIoSite('req_feed', 'src/UsersTable.tsx', ['joined']),
    ])
    await ingest(socket({ stream: { state: 'open', count: 0, bytes: 0, socketIo: true }, messages: [] }))
    await ingest(
      socket({
        stream: { state: 'closed', count: 2, bytes: 40, socketIo: true, closeCode: 1000, from: 0 },
        messages: [message('out', 'chat', 5), message('in', 'chat', 'hi')],
      }),
    )
    const { capture: stored } = await json<{ capture: Capture }>('/api/captures/cap_ws')
    expect(stored.messages).toHaveLength(2)
    expect(stored.match).toMatchObject({ status: 'matched', siteId: 'req_chat' })
    expect(stored.match?.candidates[0]?.evidence).toContainEqual({
      signal: 'socket',
      points: 10,
      detail: 'sends chat, receives chat',
    })
    expect(stored.typeCheck?.parts.map((p) => [p.direction ?? 'in', p.event, p.status])).toEqual([
      ['in', 'chat', 'ok'],
      ['out', 'chat', 'mismatch'],
    ])
  })

  it('keeps WebSocket captures and sites apart from other requests and APIs', async () => {
    const { json, ingest } = setup([
      site('req_native', 'cmp_table', 'src/UsersTable.tsx', {
        transport: 'websocket',
        url: { text: "'/socket.io/'", confidence: 'exact', path: '/socket.io/' },
        socket: { api: 'websocket', messages: [] },
      }),
      site('req_http', 'cmp_sidebar', 'src/UsersSidebar.tsx', {
        url: { text: "'/socket.io/'", confidence: 'exact', path: '/socket.io/' },
      }),
    ])
    await ingest(socket({ stream: { state: 'closed', count: 0, bytes: 0, socketIo: true } }))
    const { capture: stored } = await json<{ capture: Capture }>('/api/captures/cap_ws')
    // A socket.io capture fits neither the native WebSocket site nor the HTTP one.
    expect(stored.match?.status).toBe('unmatched')
    expect(stored.match?.candidates).toEqual([])
  })
})
