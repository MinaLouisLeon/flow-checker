// M22: the dev safety net that notices when server capture never starts.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveCaptureOptions } from '@flow-checker/runtime/options'
import {
  type AppModel,
  type Capture,
  MODEL_VERSION,
  type RequestSite,
  type Route,
  type ServerCaptureStatus,
} from '@flow-checker/shared'
import { afterAll, describe, expect, it } from 'vitest'
import { CaptureStore, createApp, ServerCaptureWatch } from '../src'

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

function route(id: string, path: string, kind: Route['kind'] = 'route-handler'): Route {
  return { id, path, kind, file: `app${path}/route.ts`, segments: [], layoutChain: [], methods: ['POST'] }
}

// Only the fields the watch reads.
const site = (routeId: string) => ({ id: `rs_${routeId}`, origin: 'route-handler', routeId }) as RequestSite

const model: AppModel = {
  version: MODEL_VERSION,
  project: { appDir: 'app' },
  routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'app', files: {}, children: [] },
  // `/api/login` sends a request upstream; `/api/health` only answers.
  routes: [
    route('r_login', '/api/login'),
    route('r_health', '/api/health'),
    route('r_users', '/api/users/[id]'),
  ],
  components: [],
  types: [],
  requests: [site('r_login'), site('r_users')],
  navigations: [],
  flows: [],
  queryLinks: [],
}

function capture(over: Partial<Capture> & { url?: string }): Capture {
  const { url = 'http://localhost:3000/api/login', ...rest } = over
  return {
    id: `cap_${Math.random().toString(36).slice(2)}`,
    sessionId: 'ses_1',
    origin: 'browser',
    transport: 'fetch',
    timestamp: new Date().toISOString(),
    durationMs: 5,
    pageUrl: 'http://localhost:3000/login',
    request: { method: 'POST', url, headers: {}, body: { kind: 'none' } },
    response: { status: 200, headers: {}, body: { kind: 'none' } },
    stack: [],
    redacted: true,
    redactedPaths: [],
    ...rest,
  }
}

function setup(waitMs = 30) {
  const root = mkdtempSync(join(tmpdir(), 'flow-checker-server-capture-'))
  dirs.push(root)
  const store = new CaptureStore({ root })
  const missing: ServerCaptureStatus[] = []
  const watch = new ServerCaptureWatch({ model, store, waitMs, onMissing: (s) => missing.push(s) })
  const changes: ServerCaptureStatus[] = []
  watch.subscribe((s) => changes.push(s))
  return { store, watch, missing, changes }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('server capture watch', () => {
  it('warns once when a route handler that sends requests is hit and no server capture follows', async () => {
    const { store, watch, missing, changes } = setup()
    expect(watch.status()).toEqual({ state: 'waiting' })
    store.add(capture({}))
    store.add(capture({ url: 'http://localhost:3000/api/users/7' }))
    await wait(80)
    expect(watch.status()).toEqual({ state: 'missing', request: 'POST /api/login' })
    expect(missing).toHaveLength(1)

    // A server capture arriving later clears it.
    store.add(capture({ origin: 'server', pageUrl: undefined, url: 'https://upstream.example/login' }))
    expect(watch.status()).toEqual({ state: 'running' })
    expect(changes.map((c) => c.state)).toEqual(['missing', 'running'])
    watch.close()
  })

  it('stays quiet when the server capture arrives in time', async () => {
    const { store, watch, missing } = setup()
    store.add(capture({}))
    store.add(capture({ origin: 'server', pageUrl: undefined, url: 'https://upstream.example/login' }))
    await wait(80)
    expect(watch.status().state).toBe('running')
    expect(missing).toEqual([])
    watch.close()
  })

  it("ignores handlers that send nothing, other origins, other methods and earlier runs' captures", async () => {
    const { store, watch, missing } = setup()
    store.add(capture({ url: 'http://localhost:3000/api/health' }))
    store.add(capture({ url: 'https://api.example.com/api/login' }))
    store.add(
      capture({
        request: {
          method: 'GET',
          url: 'http://localhost:3000/api/login',
          headers: {},
          body: { kind: 'none' },
        },
      }),
    )
    store.add(capture({ timestamp: new Date(Date.now() - 60_000).toISOString() }))
    await wait(80)
    expect(watch.status()).toEqual({ state: 'waiting' })
    expect(missing).toEqual([])
    watch.close()
  })

  it('is served at /api/server-capture', async () => {
    const root = mkdtempSync(join(tmpdir(), 'flow-checker-server-capture-'))
    dirs.push(root)
    const store = new CaptureStore({ root })
    // The verifier needs full sites, so no requests here.
    const app = createApp({
      root,
      model: { ...model, requests: [] },
      capture: { store, token: 'tok', options: resolveCaptureOptions({}) },
    })
    const res = await app.request('http://127.0.0.1:4400/api/server-capture')
    expect(await res.json()).toEqual({ state: 'waiting' })
  })
})
