// Request performance (M47): the wording every surface shares, the runtime check (captures grouped per
// page load confirm the findings, endpoints get p50 / p95), the To check notes and older models.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  type AppModel,
  AppModelSchema,
  applyVerification,
  buildIndex,
  buildSummary,
  type Capture,
  endpointKeyOf,
  formatModel,
  groupLoads,
  ms,
  needlessWaits,
  type PerfFinding,
  percentile,
  perfOn,
  perfRuntimeText,
  perfText,
  summarizePerf,
} from '../src'

const snapshots = new URL('../../scanner/test/__snapshots__/', import.meta.url)
const load = (fixture: string): AppModel =>
  AppModelSchema.parse(JSON.parse(readFileSync(new URL(`${fixture}.model.json`, snapshots), 'utf8')))

const perfModel = load('perf')
const paths = new Map(perfModel.routes.map((r) => [r.id, r.path]))
const finding = (kind: PerfFinding['kind'], page: string): PerfFinding => {
  const found = perfModel.perf?.findings.find(
    (f) => f.kind === kind && f.routeIds.some((id) => paths.get(id) === page),
  )
  if (!found) throw new Error(`no ${kind} on ${page}`)
  return found
}

let n = 0
/** A matched capture of a site, started `at` ms after a fixed time and taking `took` ms. */
function capture(siteId: string, at: number, took: number, over: Partial<Capture> = {}): Capture {
  return {
    id: `cap_${n++}`,
    sessionId: 's1',
    origin: 'server',
    transport: 'fetch',
    timestamp: new Date(Date.UTC(2026, 10, 4, 12) + at).toISOString(),
    durationMs: took,
    request: { method: 'GET', url: `http://localhost:4010/x/${n}`, headers: {}, body: { kind: 'none' } },
    response: { status: 200, headers: {}, body: { kind: 'none' } },
    stack: [],
    redacted: true,
    redactedPaths: [],
    parent: { method: 'GET', url: '/', requestId: 'in_1' },
    match: { status: 'matched', by: 'auto', siteId, score: 90, candidates: [] },
    ...over,
  }
}

describe('performance wording', () => {
  it('says what each finding is', () => {
    expect(perfText(finding('waterfall', '/'), perfModel)).toBe(
      "`getProducts()` waits for `getUser(1)` in `Home` but doesn't use its result: they could start together",
    )
    expect(perfText(finding('n-plus-one', '/products'), perfModel)).toBe(
      '`GET http://localhost:4010/products/:id?delay=40` is sent once per item of `products` in `for (const product of products)` in `ProductsPage`, each waiting for the one before',
    )
    expect(perfText(finding('n-plus-one', '/catalog'), perfModel)).toBe(
      '`GET http://localhost:4010/products/:id?delay=40` is sent once per item of `products` in `products.map()` in `CatalogPage`',
    )
    expect(perfText(finding('n-plus-one', '/todos'), perfModel)).toBe(
      '`<TodoRow>` is rendered once per item of `todos` in `TodosPage`, and each sends `GET http://localhost:4010/todos/:id?delay=30`',
    )
    expect(perfText(finding('duplicate', '/settings'), perfModel)).toBe(
      '`GET http://localhost:4010/settings?delay=40` is sent from 2 places on one page load and nothing dedupes it',
    )
  })

  it('finds the steps a step waits for without using them, through the steps it needs', () => {
    const step = (needs: number[]) => ({
      text: 'x()',
      siteIds: [],
      needs,
      loc: { file: 'a', line: 1, column: 1 },
    })
    // a; b uses a; c uses b: no needless wait. d uses nothing: it waits for all three.
    expect(needlessWaits({ steps: [step([]), step([0]), step([1]), step([])] })).toEqual([
      [],
      [],
      [],
      [0, 1, 2],
    ])
  })

  it('says what captures showed', () => {
    expect(perfRuntimeText(undefined)).toBeUndefined()
    expect(perfRuntimeText({ status: 'not-seen', loads: 0, confirmed: 0 })).toBe('not seen at runtime yet')
    expect(perfRuntimeText({ status: 'not-confirmed', loads: 2, confirmed: 0 })).toBe(
      'not confirmed at runtime (0 of 2 loads)',
    )
    expect(perfRuntimeText({ status: 'confirmed', loads: 3, confirmed: 2, savedMs: 81 })).toBe(
      'confirmed at runtime in 2 of 3 loads: about 81 ms to save',
    )
    expect(perfRuntimeText({ status: 'confirmed', loads: 1, confirmed: 1, maxCalls: 4, totalMs: 1500 })).toBe(
      'confirmed at runtime in 1 of 1 load: up to 4 requests per load, 1.5 s together',
    )
    expect([ms(0.4), ms(999), ms(1234), ms(12_345)]).toEqual(['0 ms', '999 ms', '1.2 s', '12 s'])
  })

  it('lists a page only its findings', () => {
    const home = perfModel.routes.find((r) => r.path === '/')
    expect(perfOn(perfModel, home?.id ?? '').map((f) => f.kind)).toEqual(['waterfall'])
  })
})

describe('captures per page load', () => {
  it('groups by page view and incoming request, and splits older captures by time', () => {
    const loads = groupLoads([
      capture('a', 0, 10, { parent: { method: 'GET', url: '/', requestId: 'in_1' } }),
      capture('a', 5, 10, { parent: { method: 'GET', url: '/', requestId: 'in_2' } }),
      capture('a', 0, 10, { origin: 'browser', view: 'pv_1', pageUrl: 'http://app/' }),
      capture('a', 9000, 10, { origin: 'browser', view: 'pv_1', pageUrl: 'http://app/' }),
      // No ids: one load until a 3 s gap.
      capture('a', 0, 10, { parent: { method: 'GET', url: '/old' } }),
      capture('a', 100, 10, { parent: { method: 'GET', url: '/old' } }),
      capture('a', 5000, 10, { parent: { method: 'GET', url: '/old' } }),
      // Event streams take as long as they stay open.
      capture('a', 0, 60_000, { transport: 'eventsource', stream: { state: 'open', count: 0, bytes: 0 } }),
    ])
    expect(loads.map((l) => l.length).sort()).toEqual([1, 1, 1, 2, 2])
  })
})

describe('the runtime check', () => {
  const waterfall = finding('waterfall', '/')
  const [userSite, productsSite] = (waterfall.steps ?? []).map((s) => s.siteIds[0] as string)

  it('confirms a waterfall when the second request starts after the first ended', () => {
    const summary = summarizePerf(perfModel, [
      capture(userSite as string, 0, 85),
      capture(productsSite as string, 86, 84),
      // Another load where they overlapped.
      capture(userSite as string, 0, 85, { parent: { method: 'GET', url: '/', requestId: 'in_2' } }),
      capture(productsSite as string, 1, 84, { parent: { method: 'GET', url: '/', requestId: 'in_2' } }),
    ])
    expect(summary.findings[waterfall.id]).toMatchObject({
      status: 'confirmed',
      loads: 2,
      confirmed: 1,
      savedMs: 85,
    })
    expect(summary.loads).toBe(2)
  })

  it('does not confirm a waterfall whose requests overlapped', () => {
    const summary = summarizePerf(perfModel, [
      capture(userSite as string, 0, 85),
      capture(productsSite as string, 1, 84),
    ])
    expect(summary.findings[waterfall.id]).toEqual({ status: 'not-confirmed', loads: 1, confirmed: 0 })
  })

  it('confirms an N+1 from different URLs, not from the same request twice', () => {
    const loop = finding('n-plus-one', '/todos')
    const site = loop.siteIds[0] as string
    const url = (id: number) => ({
      method: 'GET',
      url: `http://localhost:4010/todos/${id}?delay=30`,
      headers: {},
      body: { kind: 'none' as const },
    })
    const browser = { origin: 'browser' as const, view: 'pv_1', pageUrl: 'http://app/todos' }
    // React's dev double effects send each row's request twice.
    const twice = summarizePerf(perfModel, [
      capture(site, 0, 30, { ...browser, request: url(1) }),
      capture(site, 2, 30, { ...browser, request: url(1) }),
    ])
    expect(twice.findings[loop.id]?.status).toBe('not-confirmed')
    const rows = summarizePerf(perfModel, [
      capture(site, 0, 30, { ...browser, request: url(1) }),
      capture(site, 1, 31, { ...browser, request: url(2) }),
      capture(site, 3, 30, { ...browser, request: url(1) }),
    ])
    // Distinct requests: the repeated first row doesn't count twice.
    expect(rows.findings[loop.id]).toMatchObject({ status: 'confirmed', maxCalls: 2, totalMs: 33 })
  })

  it('confirms a duplicate when two of its sites sent the same URL in one load', () => {
    const duplicate = finding('duplicate', '/settings')
    const [layout, page] = duplicate.siteIds as [string, string]
    const same = {
      method: 'GET',
      url: 'http://localhost:4010/settings?delay=40',
      headers: {},
      body: { kind: 'none' as const },
    }
    const summary = summarizePerf(perfModel, [
      capture(layout, 0, 40, { request: same }),
      capture(page, 2, 41, { request: same }),
    ])
    expect(summary.findings[duplicate.id]).toMatchObject({ status: 'confirmed', maxCalls: 2 })
    expect(summarizePerf(perfModel, []).findings[duplicate.id]?.status).toBe('not-seen')
  })

  it('counts captures that are ambiguous between the sites of a duplicate', () => {
    const duplicate = finding('duplicate', '/settings')
    const [layout, page] = duplicate.siteIds as [string, string]
    const same = {
      method: 'GET',
      url: 'http://localhost:4010/settings?delay=40',
      headers: {},
      body: { kind: 'none' as const },
    }
    // The same call in two files: the stack after an await can't tell them apart.
    const tied = {
      status: 'ambiguous' as const,
      by: 'auto' as const,
      score: 73,
      candidates: [
        { siteId: layout, score: 73, evidence: [] },
        { siteId: page, score: 73, evidence: [] },
      ],
    }
    const summary = summarizePerf(perfModel, [
      capture(layout, 0, 40, { request: same, match: tied }),
      capture(page, 1, 40, { request: same, match: tied }),
    ])
    expect(summary.findings[duplicate.id]).toMatchObject({ status: 'confirmed', maxCalls: 2 })
    // Both calls go to one endpoint, so its timings count them.
    expect(summary.endpoints.map((e) => [e.label, e.count])).toEqual([
      ['GET http://localhost:4010/settings', 2],
    ])
  })

  it('ranks endpoints by p95 with their p50, errors and sides', () => {
    const site = perfModel.requests.find((s) => s.id === userSite)
    const slow = Array.from({ length: 20 }, (_, i) =>
      capture(productsSite as string, i * 1000, i === 19 ? 900 : 100 + i),
    )
    const summary = summarizePerf(perfModel, [
      ...slow,
      capture(userSite as string, 0, 50),
      capture(userSite as string, 10, 70, { response: { status: 500, headers: {}, body: { kind: 'none' } } }),
      capture(userSite as string, 20, 60, { origin: 'browser', view: 'pv_9' }),
    ])
    expect(summary.endpoints.map((e) => [e.label, e.count, e.p50, e.p95, e.max])).toEqual([
      ['GET http://localhost:4010/products', 20, 109, 118, 900],
      ['GET http://localhost:4010/users/1', 3, 60, 70, 70],
    ])
    const user = summary.endpoints[1]
    expect(user).toMatchObject({ errors: 1, browser: 1, server: 2 })
    expect(user?.key).toBe(site && endpointKeyOf(site))
    expect(summary.endpoints[0]?.slowestCaptureId).toBe(slow[19]?.id)
  })

  it('takes nearest-rank percentiles', () => {
    expect(percentile([], 50)).toBe(0)
    expect(percentile([5], 95)).toBe(5)
    expect(percentile([1, 2, 3, 4], 50)).toBe(2)
    expect(percentile([1, 2, 3, 4], 95)).toBe(4)
  })

  it('puts the results on the served model', () => {
    const summary = summarizePerf(perfModel, [
      capture(userSite as string, 0, 85),
      capture(productsSite as string, 90, 84),
    ])
    const served = applyVerification(perfModel, { sites: {}, perf: summary })
    const result = served.perf?.findings.find((f) => f.id === waterfall.id)?.runtime
    expect(result?.status).toBe('confirmed')
    expect(applyVerification(served, { sites: {}, perf: summary })).toBe(served)
    const note = buildIndex(served).notes.find((n) => n.kind === 'perf' && n.file === 'src/app/page.tsx')
    expect(note?.message).toContain('; confirmed at runtime in 1 of 1 load: about 89 ms to save')
  })
})

describe('performance in the fixture', () => {
  it('puts one note per finding under To check, after env notes', () => {
    const index = buildIndex(perfModel)
    const notes = index.notes.filter((n) => n.kind === 'perf')
    expect(notes.map((n) => `${n.file}:${n.line}`)).toEqual([
      'src/app/catalog/page.tsx:6',
      'src/app/page.tsx:6',
      'src/app/products/page.tsx:8',
      'src/app/settings/page.tsx:5',
      'src/app/todos/page.tsx:10',
    ])
    expect(notes.every((n) => n.routeId && n.componentId)).toBe(true)
    const check = buildSummary(index).sections.find((s) => s.id === 'check')
    expect(check?.items.map((i) => i.label)).toContain('Performance')
  })

  it('lists the findings in the tree text, on each page and at the end', () => {
    const text = formatModel(perfModel)
    expect(text).toContain('perf: waterfall in Home')
    expect(text).toContain('# Request performance')
    expect(text).toContain('duplicate (server) src/app/settings/page.tsx:5')
  })

  it('loads models written before M47 with no findings', () => {
    const model = JSON.parse(readFileSync(new URL('perf.model.json', snapshots), 'utf8'))
    model.version = 19
    delete model.perf
    const parsed = AppModelSchema.parse(model)
    expect(parsed.perf).toBeUndefined()
    expect(buildIndex(parsed).notes.filter((n) => n.kind === 'perf')).toEqual([])
    expect(formatModel(parsed)).not.toContain('# Request performance')
  })
})
