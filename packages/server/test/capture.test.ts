import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveCaptureOptions } from '@flow-checker/runtime/options'
import { type AppModel, type Capture, type CaptureSummary, MODEL_VERSION } from '@flow-checker/shared'
import { afterAll, describe, expect, it } from 'vitest'
import { CaptureStore, createApp, type ServerMeta, startServer, UNMATCHED_DIR } from '../src'

const model: AppModel = {
  version: MODEL_VERSION,
  project: { appDir: 'app' },
  routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'app', files: {}, children: [] },
  routes: [],
  components: [],
  types: [],
  requests: [],
  navigations: [],
  flows: [],
  queryLinks: [],
}

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

function tempRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'flow-checker-capture-'))
  dirs.push(dir)
  return dir
}

function capture(id: string, overrides: Partial<Capture> = {}): Capture {
  return {
    id,
    sessionId: 'ses_1',
    origin: 'browser',
    transport: 'fetch',
    timestamp: new Date().toISOString(),
    durationMs: 5,
    pageUrl: 'http://localhost:3000/login',
    request: {
      method: 'POST',
      url: 'http://localhost:4010/auth/login',
      headers: { 'content-type': 'application/json' },
      body: { kind: 'json', value: { email: 'a@b.c', password: 'hunter2' } },
    },
    response: { status: 200, headers: {}, body: { kind: 'json', value: { ok: true } } },
    stack: [],
    redacted: true,
    redactedPaths: [],
    ...overrides,
  }
}

function setup(storeRaw = false) {
  const root = tempRoot()
  const store = new CaptureStore({ root }).load()
  const app = createApp({
    root,
    model,
    capture: { store, token: 'tok', options: resolveCaptureOptions({ storeRaw }) },
  })
  const call = (path: string, init?: RequestInit) => app.request(`http://127.0.0.1:4400${path}`, init)
  const ingest = (body: unknown) =>
    call('/ingest', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'text/plain' } })
  return { root, store, call, ingest }
}

describe('ingest', () => {
  it('stores captures (redacted again), session events, and serves them', async () => {
    const { root, store, call, ingest } = setup()
    const res = await ingest({
      token: 'tok',
      sessionId: 'ses_1',
      captures: [capture('cap_a')],
      events: [
        { kind: 'navigation', at: new Date().toISOString(), how: 'load', url: 'http://localhost:3000/' },
      ],
    })
    expect(res.status).toBe(204)

    const file = join(root, '.flow-checker', 'captures', UNMATCHED_DIR, 'cap_a.json')
    expect(existsSync(file)).toBe(true)
    const saved = JSON.parse(readFileSync(file, 'utf8')) as Capture
    expect(saved.request.body).toEqual({
      kind: 'json',
      value: { email: 'a@b.c', password: '[REDACTED:string]' },
    })

    const list = (await (await call('/api/captures')).json()) as CaptureSummary[]
    expect(list).toMatchObject([{ id: 'cap_a', method: 'POST', status: 200, sessionId: 'ses_1' }])

    const detail = (await (await call('/api/captures/cap_a')).json()) as { capture: Capture }
    expect(detail.capture.redactedPaths).toContain('request.body.password')
    expect((await call('/api/captures/nope')).status).toBe(404)

    store.writeSessions()
    const sessionFiles = readdirSync(join(root, '.flow-checker', 'sessions'))
    expect(sessionFiles).toEqual(['ses_1.json'])
    expect((await (await call('/api/sessions/ses_1')).json()) as { events: unknown[] }).toMatchObject({
      events: [{ kind: 'navigation', how: 'load' }],
    })
  })

  it('keeps raw data with storeRaw', async () => {
    const { call, ingest } = setup(true)
    await ingest({ token: 'tok', captures: [capture('cap_raw', { redacted: false })] })
    const detail = (await (await call('/api/captures/cap_raw')).json()) as { capture: Capture }
    expect(detail.capture.request.body).toEqual({
      kind: 'json',
      value: { email: 'a@b.c', password: 'hunter2' },
    })
    expect(detail.capture.redacted).toBe(false)
    const meta = (await (await call('/api/meta')).json()) as ServerMeta
    expect(meta.capture).toEqual({ storeRaw: true })
  })

  it('rejects a wrong token, invalid JSON and invalid batches', async () => {
    const { ingest, call, store } = setup()
    expect((await ingest({ token: 'wrong', captures: [capture('cap_x')] })).status).toBe(403)
    expect((await call('/ingest', { method: 'POST', body: '{nope' })).status).toBe(400)
    expect((await ingest({ token: 'tok', captures: [{ id: 'bad' }] })).status).toBe(400)
    expect(store.size).toBe(0)
  })

  it('links server captures to the browser capture they came from', async () => {
    const { call, ingest } = setup()
    await ingest({
      token: 'tok',
      captures: [
        capture('cap_browser'),
        capture('cap_server', {
          origin: 'server',
          parent: { method: 'POST', url: '/api/products', captureId: 'cap_browser' },
        }),
      ],
    })
    const detail = (await (await call('/api/captures/cap_browser')).json()) as { children: CaptureSummary[] }
    expect(detail.children.map((c) => c.id)).toEqual(['cap_server'])
  })

  it('reloads captures from disk and clears them', async () => {
    const { root, ingest, call } = setup()
    await ingest({ token: 'tok', captures: [capture('cap_1'), capture('cap_2')] })
    const reloaded = new CaptureStore({ root }).load()
    expect(reloaded.list().map((c) => c.id)).toEqual(['cap_2', 'cap_1'])

    expect((await call('/api/captures', { method: 'DELETE' })).status).toBe(204)
    expect(await (await call('/api/captures')).json()).toEqual([])
    expect(existsSync(join(root, '.flow-checker', 'captures'))).toBe(false)
  })

  it('is off without capture options', async () => {
    const app = createApp({ root: tempRoot(), model })
    const res = await app.request('http://127.0.0.1:4400/api/captures')
    expect(res.status).toBe(404)
    const meta = (await (await app.request('http://127.0.0.1:4400/api/meta')).json()) as ServerMeta
    expect(meta.capture).toBeUndefined()
  })
})

describe('live feed', () => {
  it('streams new captures over server-sent events', async () => {
    const root = tempRoot()
    const store = new CaptureStore({ root })
    const server = await startServer({
      root,
      model,
      port: 0,
      capture: { store, token: 'tok', options: resolveCaptureOptions() },
    })
    try {
      const controller = new AbortController()
      const res = await fetch(`${server.url}/api/live`, { signal: controller.signal })
      expect(res.headers.get('content-type')).toContain('text/event-stream')
      const reader = (res.body as ReadableStream<Uint8Array>).getReader()
      const decoder = new TextDecoder()
      let text = ''
      const readUntil = async (needle: string) => {
        while (!text.includes(needle)) {
          const { value, done } = await reader.read()
          if (done) break
          text += decoder.decode(value)
        }
      }
      await readUntil('event: ready')
      store.add(capture('cap_live'))
      await readUntil('cap_live')
      expect(text).toContain('event: capture')
      controller.abort()
    } finally {
      await server.close()
    }
  })
})
