// Flow confirmation from session timelines, on the real next-intl fixture model:
// login -> OTP -> dashboard, as the browser runtime reports it.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveCaptureOptions } from '@flow-checker/runtime/options'
import { scanProject } from '@flow-checker/scanner'
import type {
  AppModel,
  Capture,
  FlowsSummary,
  Overrides,
  RecordedFlow,
  SessionEvent,
} from '@flow-checker/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CaptureStore, createApp } from '../src'

const APP = 'http://localhost:3000'
const API = 'http://localhost:4010'

let model: AppModel
beforeAll(() => {
  model = scanProject({ root: join(import.meta.dirname, '..', '..', '..', 'fixtures', 'next-intl') })
}, 60_000)

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'flow-checker-flows-'))
  dirs.push(root)
  const store = new CaptureStore({ root })
  const app = createApp({ root, model, capture: { store, token: 'tok', options: resolveCaptureOptions() } })
  const call = (path: string, init?: RequestInit) => app.request(`http://127.0.0.1:4400${path}`, init)
  const json = async <T>(path: string, init?: RequestInit) => (await (await call(path, init)).json()) as T
  return { root, call, json }
}

/** Builds one session's events and captures, a second apart. */
class Session {
  readonly events: SessionEvent[] = []
  readonly captures: Capture[] = []
  #t = Date.parse('2026-10-28T10:00:00Z')
  #page = `${APP}/en/login`
  #last: string[] = []

  constructor(readonly id: string) {}

  #at() {
    this.#t += 1000
    return new Date(this.#t).toISOString()
  }

  go(path: string, how: 'load' | 'push' | 'replace' = 'push') {
    this.#page = `${APP}${path}`
    this.events.push({ kind: 'navigation', at: this.#at(), how, url: this.#page })
    return this
  }

  submit(component: string) {
    this.#last = [component, 'LocaleLayout']
    this.events.push({
      kind: 'interaction',
      at: this.#at(),
      type: 'submit',
      target: 'form',
      componentChain: this.#last,
      url: this.#page,
    })
    return this
  }

  request(method: string, path: string, status = 200, withInteraction = true) {
    const at = this.#at()
    const id = `cap_${this.id}_${this.captures.length}`
    this.captures.push({
      id,
      sessionId: this.id,
      origin: 'browser',
      transport: 'fetch',
      timestamp: at,
      durationMs: 5,
      pageUrl: this.#page,
      request: { method, url: `${API}${path}`, headers: {}, body: { kind: 'none' } },
      response: { status, headers: {}, body: { kind: 'json', value: {} } },
      ...(withInteraction
        ? { interaction: { type: 'submit', target: 'form', componentChain: this.#last, at } }
        : {}),
      stack: [],
      redacted: true,
      redactedPaths: [],
    })
    this.events.push({ kind: 'capture', at, captureId: id })
    return this
  }

  batch() {
    return JSON.stringify({ token: 'tok', sessionId: this.id, captures: this.captures, events: this.events })
  }
}

const login = (id: string) =>
  new Session(id)
    .go('/en/login', 'load')
    .submit('LoginForm')
    .request('POST', '/auth/login')
    .go('/en/verify?challenge=c1')

const loginFlow = () => {
  const flow = model.flows.find((f) => f.name === 'LoginForm submit')
  if (!flow) throw new Error('LoginForm submit flow missing')
  return flow
}

describe('flow tracking', () => {
  it('infers login -> OTP -> dashboard as one flow', () => {
    const paths = loginFlow().routeIds.map((id) => model.routes.find((r) => r.id === id)?.path)
    expect(paths).toEqual(['/[locale]/login', '/[locale]/verify', '/[locale]/dashboard'])
    expect(model.flows.map((f) => f.name)).toEqual(['LoginForm submit'])
  })

  it('confirms a flow walked end to end', async () => {
    const { call, json } = setup()
    const session = login('ses_ok')
      .submit('VerifyOtpForm')
      .request('POST', '/auth/verify-otp')
      .go('/en/dashboard', 'replace')
      .request('GET', '/me', 200, false)
    expect((await call('/ingest', { method: 'POST', body: session.batch() })).status).toBe(204)

    const summary = await json<FlowsSummary>('/api/flows')
    const status = summary.flows[loginFlow().id]
    expect(status).toMatchObject({ status: 'confirmed', source: 'both', runs: 1 })
    expect(status?.best).toMatchObject({
      sessionId: 'ses_ok',
      steps: loginFlow().steps.length,
      complete: true,
    })
    expect(summary.recorded).toEqual([])
  })

  it('reports a flow stopped early as partial', async () => {
    const { call, json } = setup()
    await call('/ingest', { method: 'POST', body: login('ses_partial').batch() })
    const status = (await json<FlowsSummary>('/api/flows')).flows[loginFlow().id]
    // Interaction, login request and the navigation to /verify.
    expect(status).toMatchObject({
      status: 'partial',
      source: 'inferred',
      best: { steps: 3, complete: false },
    })
  })

  it('keeps an unexpected path as a recorded variant', async () => {
    const { call, json } = setup()
    const session = new Session('ses_odd')
      .go('/en/login', 'load')
      .submit('LoginForm')
      .request('POST', '/auth/login')
      .go('/en')
    await call('/ingest', { method: 'POST', body: session.batch() })
    const summary = await json<FlowsSummary>('/api/flows')
    expect(summary.flows[loginFlow().id]?.status).toBe('partial')
    expect(summary.recorded).toMatchObject([
      { kind: 'variant', flowId: loginFlow().id, divergedAt: 2, name: 'LoginForm submit → /[locale]' },
    ])
    expect(summary.recorded[0]?.steps.map((s) => s.kind)).toEqual(['interaction', 'request', 'navigate'])
  })

  it('renames flows and saves named recordings in overrides.json', async () => {
    const { root, call, json } = setup()
    const id = loginFlow().id
    expect(
      (
        await call(`/api/flows/${id}/name`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Sign in with OTP' }),
        })
      ).status,
    ).toBe(204)
    expect((await json<AppModel>('/api/model')).flows[0]?.name).toBe('Sign in with OTP')

    const started = await json<{ id: string }>('/api/recordings', {
      method: 'POST',
      body: JSON.stringify({ name: 'Happy path' }),
    })
    expect((await json<FlowsSummary>('/api/flows')).recording?.name).toBe('Happy path')
    // Recorded with today's clock, so the session needs current times.
    const now = Date.now()
    const events: SessionEvent[] = [
      { kind: 'navigation', at: new Date(now).toISOString(), how: 'load', url: `${APP}/en/login` },
    ]
    await call('/ingest', {
      method: 'POST',
      body: JSON.stringify({ token: 'tok', sessionId: 'ses_rec', captures: [], events }),
    })
    const saved = await json<RecordedFlow>('/api/recordings/stop', { method: 'POST' })
    expect(saved).toMatchObject({ id: started.id, kind: 'named', name: 'Happy path' })
    expect(saved.steps).toMatchObject([{ kind: 'navigate', path: '/en/login' }])

    const overrides = JSON.parse(
      readFileSync(join(root, '.flow-checker', 'overrides.json'), 'utf8'),
    ) as Overrides
    expect(overrides.flowNames[id]).toBe('Sign in with OTP')
    expect(overrides.recordings.map((r) => r.id)).toEqual([started.id])
    expect((await call('/api/recordings/stop', { method: 'POST' })).status).toBe(409)
    expect((await call(`/api/recordings/${started.id}`, { method: 'DELETE' })).status).toBe(204)
    expect((await json<FlowsSummary>('/api/flows')).recorded).toEqual([])
  })
})
