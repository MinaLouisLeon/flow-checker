// M47: the page view lists the waterfalls, N+1 and duplicate requests that slow a page down, with what
// capture timings showed; the Perf screen lists every finding (confirmed first) and the slowest endpoints.
import { readdirSync, readFileSync } from 'node:fs'
import {
  AppModelSchema,
  applyVerification,
  type ModelIndex,
  type PerfSummary,
  perfOn,
  type VerificationSummary,
} from '@flow-checker/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { DataContext } from '../src/context'
import { setShowDetails } from '../src/details'
import { buildIndex } from '../src/model-index'
import { href, parseHash } from '../src/router'
import { Overview } from '../src/screens/Overview'
import { PageView } from '../src/screens/PageView'
import { PerfScreen } from '../src/screens/PerfScreen'

const snapshots = new URL('../../scanner/test/__snapshots__/', import.meta.url)
const parse = (fixture: string) =>
  AppModelSchema.parse(JSON.parse(readFileSync(new URL(`${fixture}.model.json`, snapshots), 'utf8')))
const load = (fixture: string): ModelIndex => buildIndex(parse(fixture))
const FIXTURES = readdirSync(snapshots)
  .filter((f) => f.endsWith('.model.json'))
  .map((f) => f.replace('.model.json', ''))

function render(
  index: ModelIndex,
  view: ReturnType<typeof createElement>,
  verification?: VerificationSummary,
): string {
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } })
  if (verification) client.setQueryData(['verification'], verification)
  const meta = verification ? { canRescan: false, capture: { storeRaw: false } } : { canRescan: false }
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(DataContext.Provider, { value: { index, meta } }, view),
    ),
  )
}

const pageHtml = (index: ModelIndex, path: string) => {
  const route = index.model.routes.find((r) => r.kind === 'page' && r.path === path && !r.slot)
  if (!route) throw new Error(`no page ${path}`)
  return render(index, createElement(PageView, { routeId: route.id }))
}

afterEach(() => setShowDetails(false))

describe('request performance in the dashboard', () => {
  it('routes #/perf', () => {
    expect(href({ name: 'perf' })).toBe('#/perf')
    expect(parseHash('#/perf')).toEqual({ name: 'perf' })
  })

  it.each(FIXTURES)('shows the section only on pages with findings (%s)', (fixture) => {
    const index = load(fixture)
    for (const route of index.model.routes) {
      if (route.kind !== 'page') continue
      const html = render(index, createElement(PageView, { routeId: route.id }))
      const findings = perfOn(index.model, route.id)
      if (findings.length === 0) expect(html).not.toContain('<h2>Request performance</h2>')
      else expect(html.match(/data-perf=/g)?.length, `${fixture} ${route.path}`).toBe(findings.length)
    }
  })

  it('names each finding with its badge and sentence on its page', () => {
    const index = load('perf')
    const home = pageHtml(index, '/')
    expect(home).toContain('data-term="perf:waterfall"')
    expect(home).toContain('<code>getProducts()</code> waits for <code>getUser(1)</code>')
    const products = pageHtml(index, '/products')
    expect(products).toContain('data-term="perf:n-plus-one"')
    expect(products).toContain('data-term="perf:sequential"')
    expect(pageHtml(index, '/todos')).toContain('<code>&lt;TodoRow&gt;</code> is rendered once per item')
    expect(pageHtml(index, '/settings')).toContain('data-term="perf:duplicate"')
  })

  it('shows the steps and requests only with details on', () => {
    const index = load('perf')
    expect(pageHtml(index, '/')).not.toContain('await getUser(1)')
    setShowDetails(true)
    const home = pageHtml(index, '/')
    expect(home).toContain('<code>await getUser(1)</code>')
    expect(pageHtml(index, '/products')).toContain('list from')
    expect(pageHtml(index, '/catalog')).toContain('data-term="perf:loop-callback"')
  })

  it('shows what capture timings showed', () => {
    const model = parse('perf')
    const waterfall = model.perf?.findings.find((f) => f.kind === 'waterfall')
    const perf: PerfSummary = {
      findings: { [waterfall?.id ?? '']: { status: 'confirmed', loads: 2, confirmed: 2, savedMs: 82 } },
      endpoints: [],
      loads: 2,
    }
    const index = buildIndex(applyVerification(model, { sites: {}, perf }))
    const home = pageHtml(index, '/')
    expect(home).toContain('data-term="perf:confirmed"')
    expect(home).toContain('confirmed at runtime in 2 of 2 loads: about 82 ms to save')
  })

  it('lists the findings, confirmed first, and the slowest endpoints on the Perf screen', () => {
    const model = parse('perf')
    const duplicate = model.perf?.findings.find((f) => f.kind === 'duplicate')
    const site = model.requests.find((s) => s.id === duplicate?.siteIds[0])
    const perf: PerfSummary = {
      findings: {
        [duplicate?.id ?? '']: { status: 'confirmed', loads: 1, confirmed: 1, maxCalls: 2, totalMs: 45 },
      },
      endpoints: [
        {
          key: 'ep_x',
          label: 'GET http://localhost:4010/settings',
          siteIds: site ? [site.id] : [],
          count: 4,
          p50: 42,
          p95: 1250,
          max: 1250,
          errors: 1,
          browser: 0,
          server: 4,
          slowestCaptureId: 'cap_9',
        },
      ],
      loads: 3,
    }
    const index = buildIndex(applyVerification(model, { sites: {}, perf }))
    const html = render(index, createElement(PerfScreen), {
      sites: {},
      counts: { matched: 4, ambiguous: 0, unmatched: 0, manual: 0 },
      perf,
    })
    expect(html).toContain('1 waterfall · 3 N+1 · 1 duplicate')
    expect(html).toContain('1 confirmed at runtime')
    // The confirmed duplicate comes first.
    expect(html.indexOf('data-perf="duplicate"')).toBeLessThan(html.indexOf('data-perf="waterfall"'))
    const table = html.slice(html.indexOf('data-section="timings"'))
    expect(table).toContain('<td>42 ms</td><td>1.3 s</td>')
    expect(table).toContain('href="#/endpoints/ep_x"')
    expect(table).toContain('href="#/live/cap_9"')
    expect(table).toContain('1 failed')
  })

  it('says how to get timings without capture, and when nothing is found', () => {
    expect(render(load('perf'), createElement(PerfScreen))).toContain('Start the app with capture on')
    expect(render(load('basic'), createElement(PerfScreen))).toContain(
      'The scan found no waterfalls, N+1 requests or duplicate requests.',
    )
  })

  it('groups the findings under To check', () => {
    const overview = render(load('perf'), createElement(Overview))
    expect(overview).toContain(
      'Requests that wait for each other, run once per item, or are sent twice on one page load',
    )
    expect(overview).toContain('is sent from 2 places on one page load')
  })
})
