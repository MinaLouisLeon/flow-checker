import { readFileSync } from 'node:fs'
import { AppModelSchema, type RequestSite } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import {
  componentRows,
  countWhen,
  filterComponents,
  filterRequests,
  groupSame,
  requestWhen,
  siteOwner,
  sortComponents,
} from '../src/lists'
import { buildIndex } from '../src/model-index'
import { href, parseHash, type Screen } from '../src/router'

const index = (name: string) =>
  buildIndex(
    AppModelSchema.parse(
      JSON.parse(
        readFileSync(new URL(`../../scanner/test/__snapshots__/${name}.model.json`, import.meta.url), 'utf8'),
      ),
    ),
  )

const label = (s: RequestSite) => `${s.method} ${s.url?.path}`

describe('component rows', () => {
  it('counts pages, requests and notes per component', () => {
    const rows = componentRows(index('bff'))
    const form = rows.find((r) => r.component.name === 'CreateProductForm')
    expect(form).toMatchObject({ requests: 1 })
    expect(form?.pages).toBeGreaterThan(0)
    expect(rows.find((r) => r.component.name === 'RootLayout')?.requests).toBe(0)
  })

  it('filters by kind, what they have, and every word of the search', () => {
    const rows = componentRows(index('next-intl'))
    const names = (list: typeof rows) => list.map((r) => r.component.name).sort()
    expect(names(filterComponents(rows, { q: '', kind: 'client' }))).toEqual([
      'DashboardProfile',
      'LoginForm',
      'VerifyOtpForm',
    ])
    expect(names(filterComponents(rows, { q: '', has: 'requests' }))).toEqual([
      'DashboardProfile',
      'LoginForm',
      'VerifyOtpForm',
    ])
    // Words can match different fields: the name and the file.
    expect(names(filterComponents(rows, { q: 'form login' }))).toEqual(['LoginForm'])
    expect(filterComponents(rows, { q: 'nothing-like-this' })).toEqual([])
  })

  it('sorts by name, or by most requests with the name as tie-break', () => {
    const rows = componentRows(index('bff'))
    expect(sortComponents(rows).map((r) => r.component.name)).toEqual([
      'CreateProductForm',
      'HomePage',
      'ProductPage',
      'ProductsTable',
      'RootLayout',
    ])
    const byRequests = sortComponents(rows, 'requests')
    expect(byRequests.slice(-2).map((r) => r.requests)).toEqual([0, 0])
    expect(byRequests[0]?.requests).toBeGreaterThan(0)
    // Sorting returns a new array.
    expect(rows.map((r) => r.component.name)).not.toEqual(byRequests.map((r) => r.component.name))
  })
})

describe('request filters', () => {
  it('splits requests by when they are sent, like the overview card', () => {
    const bff = index('bff')
    expect(countWhen(bff.model.requests)).toEqual({ load: 2, event: 1, server: 3, unknown: 0 })
    const sites = bff.model.requests
    expect(sites.filter((s) => requestWhen(s) === 'server').every((s) => s.origin !== 'component')).toBe(true)
    expect(filterRequests(bff, { q: '', when: 'event' }).map(label)).toEqual(['POST /api/products'])
  })

  it('filters by transport, flags and status', () => {
    const basic = index('basic')
    expect(filterRequests(basic, { q: '', transport: 'axios' }).map(label)).toEqual(['DELETE /users/:id'])
    expect(filterRequests(basic, { q: '', flagged: true })).toEqual([])
    expect(filterRequests(basic, { q: '', status: 'inferred' })).toHaveLength(basic.model.requests.length)
    expect(filterRequests(basic, { q: '', status: 'verified' })).toEqual([])
  })

  it('searches method and URL, the component and the file', () => {
    const intl = index('next-intl')
    expect(filterRequests(intl, { q: 'post login' }).map(label)).toEqual(['POST /auth/login'])
    expect(filterRequests(intl, { q: 'VerifyOtpForm' }).map(label)).toEqual(['POST /auth/verify-otp'])
    expect(filterRequests(intl, { q: 'GET /me' }).map(label)).toEqual(['GET /me'])
  })

  it('names where a site runs', () => {
    const bff = index('bff')
    const handler = bff.model.requests.find((s) => s.origin === 'route-handler' && s.method === 'POST')
    expect(handler && siteOwner(handler, bff)).toBe('POST /api/products')
    const form = bff.model.requests.find((s) => s.trigger.kind === 'event')
    expect(form && siteOwner(form, bff)).toBe('CreateProductForm')
  })

  it('folds the same request sent from several places', () => {
    const sites = index('bff').model.requests
    const copy = { ...sites[3], id: 'copy' } as RequestSite
    const groups = groupSame([...sites, copy])
    expect(groups).toHaveLength(sites.length)
    expect(groups.find((g) => g.length === 2)?.map((s) => s.id)).toEqual([sites[3]?.id, 'copy'])
  })
})

describe('routes for the M21 screens', () => {
  const roundTrip = (screen: Screen) => parseHash(href(screen))

  it('round-trips the component list with its filters and selection', () => {
    const screen: Screen = {
      name: 'components',
      componentId: 'cmp_1',
      q: 'login form',
      kind: 'client',
      has: 'requests',
      sort: 'pages',
    }
    expect(href(screen)).toBe('#/components/cmp_1?q=login+form&kind=client&has=requests&sort=pages')
    expect(roundTrip(screen)).toEqual(screen)
    // Name order is the default and stays out of the URL.
    expect(href({ name: 'components', q: '', sort: 'name' })).toBe('#/components')
  })

  it('round-trips the request list with its filters and selection', () => {
    const screen: Screen = {
      name: 'requests',
      siteId: 'req_1',
      q: 'users',
      status: 'mismatch',
      when: 'event',
      transport: 'axios',
      flagged: true,
    }
    expect(href(screen)).toBe('#/requests/req_1?q=users&status=mismatch&when=event&transport=axios&flags=1')
    expect(roundTrip(screen)).toEqual(screen)
  })

  it('ignores filter values it does not know', () => {
    expect(parseHash('#/requests?when=later&status=done&transport=carrier-pigeon&flags=yes')).toEqual({
      name: 'requests',
      siteId: undefined,
      q: '',
      status: undefined,
      when: undefined,
      transport: undefined,
      flagged: undefined,
    })
    expect(parseHash('#/components?kind=robot&sort=size')).toMatchObject({ kind: undefined, sort: undefined })
  })
})
