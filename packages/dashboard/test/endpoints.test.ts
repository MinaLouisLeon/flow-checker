// M29: the Endpoints screen's rows, filters and links.
import { readFileSync } from 'node:fs'
import { type AppModel, AppModelSchema, type RequestSite } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { endpointRows, endpointsOf, filterEndpoints } from '../src/lists'
import { buildIndex } from '../src/model-index'
import { href, parseHash, type Screen } from '../src/router'

const model = (name: string) =>
  AppModelSchema.parse(
    JSON.parse(
      readFileSync(new URL(`../../scanner/test/__snapshots__/${name}.model.json`, import.meta.url), 'utf8'),
    ),
  )

describe('endpoint filters', () => {
  const index = buildIndex(model('bff'))
  const rows = endpointRows(index)
  const labels = (list: typeof rows) => list.map((r) => `${r.endpoint.method} ${r.endpoint.pattern}`)

  it('filters by host, side and every word of the search', () => {
    const app = endpointsOf(index).hosts[0]?.key
    expect(labels(filterEndpoints(rows, { q: '', host: app }))).toEqual([
      'GET /api/products',
      'POST /api/products',
      'GET /api/products/:id',
    ])
    // The backend is only called by the route handlers.
    expect(labels(filterEndpoints(rows, { q: '', side: 'server' }))).toEqual([
      'GET /products',
      'POST /products',
      'GET /products/:id',
    ])
    expect(filterEndpoints(rows, { q: '', side: 'browser' })).toHaveLength(3)
    // Callers' names and pages are searchable: the backend call behind the form's handler.
    expect(labels(filterEndpoints(rows, { q: 'createproductform localhost' }))).toEqual(['POST /products'])
  })

  it('filters by status and transport', () => {
    expect(filterEndpoints(rows, { q: '', status: 'not-captured' })).toHaveLength(rows.length)
    expect(filterEndpoints(rows, { q: '', status: 'verified' })).toHaveLength(0)
    expect(filterEndpoints(rows, { q: '', transport: 'graphql' })).toHaveLength(0)
  })

  it('builds the list once per index', () => {
    expect(endpointsOf(index)).toBe(endpointsOf(index))
  })
})

describe('endpoint links', () => {
  it('round-trips the screen through the hash', () => {
    const screens: Screen[] = [
      { name: 'endpoints', q: '' },
      {
        name: 'endpoints',
        endpointId: 'ep_abc',
        q: 'users',
        host: 'env:API_URL',
        transport: 'trpc',
        status: 'verified',
        side: 'server',
      },
    ]
    for (const screen of screens) expect(parseHash(href(screen))).toEqual(screen)
  })

  it('ignores values it does not know', () => {
    expect(parseHash('#/endpoints?status=nope&side=x&transport=y')).toEqual({ name: 'endpoints', q: '' })
  })
})

/** A big app: `n` request sites over a few hosts, many pages and components. */
function bigModel(n: number): AppModel {
  const base = model('react-query')
  const sites = base.requests
  const out: RequestSite[] = []
  for (let i = 0; i < n; i++) {
    const s = sites[i % sites.length] as RequestSite
    out.push({
      ...s,
      id: `req_big_${i}`,
      method: (['GET', 'POST', 'PATCH', 'DELETE'] as const)[i % 4],
      url: {
        text: `url${i}`,
        confidence: 'pattern',
        ...(i % 3 === 0 ? {} : { baseEnv: `API_${i % 5}` }),
        path: `/feature-${Math.floor(i / 5)}/items/:id`,
      },
    })
  }
  return { ...base, requests: out }
}

describe('endpoint list on a big app', () => {
  it('filters in under 50 ms per keystroke', () => {
    const index = buildIndex(bigModel(1000))
    const rows = endpointRows(index)
    expect(rows.length).toBeGreaterThan(500)
    let slowest = 0
    for (const q of ['f', 'fe', 'feature-1', 'feature-12 get', 'delete api_3', 'x']) {
      const start = performance.now()
      filterEndpoints(rows, { q, side: 'browser' })
      slowest = Math.max(slowest, performance.now() - start)
    }
    expect(slowest).toBeLessThan(50)
  })
})
