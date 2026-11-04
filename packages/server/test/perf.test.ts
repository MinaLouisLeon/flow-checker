// M47: captures recorded from the perf fixture (each page loaded twice) confirm every finding of the
// scan with their timings: the waterfall's second request starts after the first ends, the N+1 sends
// one request per item, and the layout and page send the same settings request.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveCaptureOptions } from '@flow-checker/runtime/options'
import { scanProject } from '@flow-checker/scanner'
import { type AppModel, type Capture, perfFindings } from '@flow-checker/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { CaptureStore } from '../src/store'
import { Verifier } from '../src/verify'

const repo = join(import.meta.dirname, '..', '..', '..')
const root = join(repo, 'fixtures', 'perf')

let model: AppModel
let recording: { captures: Capture[] }

beforeAll(() => {
  model = scanProject({ root })
  recording = JSON.parse(readFileSync(join(import.meta.dirname, 'recordings', 'perf.json'), 'utf8'))
}, 60_000)

function verifier(captures: Capture[] = recording.captures): Verifier {
  const store = new CaptureStore({ root, readOnly: true })
  const v = new Verifier({ root, model, store, readOnly: true, resolveAction: () => undefined })
  v.ingest(captures)
  return v
}

describe('request performance at runtime (M47)', () => {
  it('records which page load each capture belongs to', () => {
    // The very first request after `dev` starts runs before `register()` hooked the server, so its
    // fetches have no incoming request; they are grouped by time instead.
    const loose = recording.captures.filter((c) => c.origin === 'server' && !c.parent)
    expect(loose.length).toBeLessThanOrEqual(2)
    for (const c of recording.captures) {
      if (c.origin === 'server' && c.parent) expect(c.parent.requestId, c.id).toMatch(/^in_/)
      else if (c.origin === 'browser') expect(c.view, c.id).toMatch(/^pv_/)
    }
  })

  it('confirms every finding of the fixture from the recorded timings', () => {
    const served = verifier().servedModel()
    const paths = new Map(served.routes.map((r) => [r.id, r.path]))
    const results = perfFindings(served).map(
      (f) => `${f.kind} ${f.routeIds.map((id) => paths.get(id)).join(',')} ${f.runtime?.status}`,
    )
    expect(results).toEqual([
      'n-plus-one /catalog confirmed',
      'waterfall / confirmed',
      'n-plus-one /products confirmed',
      'duplicate /settings confirmed',
      'n-plus-one /todos confirmed',
    ])
    for (const f of perfFindings(served)) {
      // Each page was loaded twice.
      expect(f.runtime?.confirmed, f.id).toBeGreaterThanOrEqual(2)
      expect(f.runtime?.captureId, f.id).toBeDefined()
    }
    const waterfall = perfFindings(served).find((f) => f.kind === 'waterfall')
    // The mock API answers each in about 80 ms: starting them together saves about one of them.
    expect(waterfall?.runtime?.savedMs).toBeGreaterThan(60)
    const rows = perfFindings(served).find((f) => f.loop?.kind === 'render')
    // Two todos, two requests (React's dev double effects not counted twice).
    expect(rows?.runtime?.maxCalls).toBe(2)
  })

  it('ranks the endpoints by p95, with each one timed from its captures', () => {
    const perf = verifier().perfResults()
    expect(perf.loads).toBeGreaterThanOrEqual(12)
    const p95 = perf.endpoints.map((e) => e.p95)
    expect(p95).toEqual([...p95].sort((a, b) => b - a))
    const products = perf.endpoints.find((e) => e.label === 'GET http://localhost:4010/products')
    expect(products?.count).toBe(9)
    // `?delay=80`: no call answered faster.
    expect(products?.p50).toBeGreaterThanOrEqual(80)
    for (const e of perf.endpoints) {
      expect(e.p50, e.label).toBeLessThanOrEqual(e.p95)
      expect(e.p95, e.label).toBeLessThanOrEqual(e.max)
      expect(
        recording.captures.some((c) => c.id === e.slowestCaptureId),
        e.label,
      ).toBe(true)
    }
  })

  it('serves the results at /api/perf and in the verification summary', async () => {
    // A temp root: the app's verifier saves its code history there.
    const tmp = mkdtempSync(join(tmpdir(), 'fc-perf-'))
    const store = new CaptureStore({ root: tmp, readOnly: true })
    for (const c of recording.captures) store.add(c)
    const app = createApp({
      root: tmp,
      model,
      capture: { store, token: 't', options: resolveCaptureOptions(undefined) },
    })
    const res = await app.request('http://127.0.0.1/api/perf')
    expect(res.status).toBe(200)
    const body = (await res.json()) as ReturnType<Verifier['perfResults']>
    expect(Object.values(body.findings).every((f) => f.status === 'confirmed')).toBe(true)
    const summary = (await (await app.request('http://127.0.0.1/api/verification')).json()) as ReturnType<
      Verifier['summary']
    >
    expect(summary.perf?.endpoints.length).toBe(body.endpoints.length)
    expect(verifier([]).summary().perf).toBeUndefined()
    rmSync(tmp, { recursive: true, force: true })
  })

  it('stays fast with many captures', () => {
    // 2,000 captures, as many as the store keeps in memory: over 600 loads of the fixture.
    const many: Capture[] = []
    for (let i = 0; i < 2000; i++) {
      const c = recording.captures[i % recording.captures.length] as Capture
      const n = Math.floor(i / recording.captures.length)
      many.push({
        ...c,
        id: `${c.id}-${i}`,
        ...(c.parent ? { parent: { ...c.parent, requestId: `${c.parent.requestId}-${n}` } } : {}),
        ...(c.view ? { view: `${c.view}-${n}` } : {}),
      })
    }
    const v = verifier(many)
    const started = performance.now()
    const perf = v.perfResults()
    const took = performance.now() - started
    expect(perf.loads).toBeGreaterThan(600)
    expect(Object.values(perf.findings).every((f) => f.status === 'confirmed')).toBe(true)
    expect(took).toBeLessThan(1000)
  })
})
