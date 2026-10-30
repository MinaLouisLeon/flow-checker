// M14: captures sent from middleware (Next 16 proxy.ts, Node.js runtime), recorded from the
// `middleware` fixture. They match the middleware's site by its matcher and the stack, and a
// rewritten page URL resolves to the route that answered it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import type { AppModel, Capture, CaptureMatch } from '@flow-checker/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import { Matcher } from '../src/matcher'

const repo = join(import.meta.dirname, '..', '..', '..')

let model: AppModel
let captures: Capture[]

beforeAll(() => {
  model = scanProject({ root: join(repo, 'fixtures', 'middleware') })
  captures = JSON.parse(
    readFileSync(join(import.meta.dirname, 'recordings', 'middleware.json'), 'utf8'),
  ).captures
}, 60_000)

function match(capture: Capture, noStack = false): CaptureMatch {
  return new Matcher(model).match(noStack ? { ...capture, stack: [] } : capture, {
    frames: noStack ? [] : (capture.sourceStack ?? []),
    resolveAction: () => undefined,
  })
}

const middlewareSite = () => model.requests.find((s) => s.origin === 'middleware')
const sessionChecks = () => captures.filter((c) => c.request.url.endsWith('/me'))

describe('middleware captures', () => {
  it('are recorded with the incoming page request as their parent', () => {
    expect(sessionChecks().length).toBeGreaterThanOrEqual(3)
    for (const c of sessionChecks()) expect(c.parent?.url).toMatch(/^\/dashboard/)
  })

  it('match the middleware site, with middleware evidence', () => {
    const site = middlewareSite()
    for (const capture of sessionChecks()) {
      const result = match(capture)
      expect(result.status).toBe('matched')
      expect(result.siteId).toBe(site?.id)
      const signals = result.candidates[0]?.evidence.map((e) => e.signal) ?? []
      expect(signals).toContain('middleware')
    }
  })

  it('still match by the matcher without a stack', () => {
    for (const capture of sessionChecks()) {
      expect(match(capture, true).siteId).toBe(middlewareSite()?.id)
    }
  })

  it('cannot match the middleware site for a request its matcher skips', () => {
    const capture = sessionChecks()[0] as Capture
    const outside = { ...capture, parent: { method: 'GET', url: '/products' }, stack: [], sourceStack: [] }
    const result = new Matcher(model).match(outside, { frames: [], resolveAction: () => undefined })
    expect(result.candidates.map((c) => c.siteId)).not.toContain(middlewareSite()?.id)
  })

  it('resolve a rewritten page URL to the route that answered it', () => {
    const products = captures.find((c) => c.request.url.endsWith('/products'))
    expect(products?.parent?.url).toBe('/shop')
    const result = match(products as Capture, true)
    const site = model.requests.find((s) => s.id === result.siteId)
    expect(model.components.find((c) => c.id === site?.componentId)?.name).toBe('ProductsPage')
    expect(result.candidates[0]?.evidence.some((e) => e.signal === 'route' && e.detail === '/shop')).toBe(
      true,
    )
  })
})
