// Guarded pages (M31): wording, older models, and which guards a captured stop fits.
import { describe, expect, it } from 'vitest'
import {
  AppModelSchema,
  accessOf,
  guardText,
  MODEL_VERSION,
  type PageGuard,
  type Route,
  seenGuards,
} from '../src'

const loc = { file: 'app/page.tsx', line: 3, column: 1 }

const guard = (id: string, extra: Partial<PageGuard>): PageGuard => ({
  id,
  kind: 'redirect',
  in: 'page',
  condition: '!session',
  loc,
  ...extra,
})

const page = (id: string, guards: PageGuard[]): Route => ({
  id,
  path: `/${id}`,
  kind: 'page',
  file: `app/${id}/page.tsx`,
  segments: [],
  layoutChain: [],
  access: { status: guards.length > 0 ? 'guarded' : 'open', guards },
})

describe('guard wording', () => {
  it('says what happens, when and where', () => {
    expect(guardText(guard('a', { target: '/login', in: 'middleware' }))).toBe(
      'redirects to `/login` when `!session` (middleware)',
    )
    expect(guardText(guard('b', { kind: 'not-found', condition: undefined, always: true }))).toBe(
      'shows the not-found page (404) always (page)',
    )
    expect(guardText(guard('c', { kind: 'respond', status: 401, in: 'middleware' }))).toBe(
      'answers with status 401 when `!session` (middleware)',
    )
    expect(guardText(guard('d', { condition: undefined, unclear: 'it runs inside a loop' }))).toBe(
      "redirects under a condition the scan can't read (it runs inside a loop) (page)",
    )
  })

  it('reads a page from an older model as unknown', () => {
    const { access: _, ...old } = page('x', [])
    expect(accessOf(old as Route).status).toBe('unknown')
  })

  it('loads version 11 models without access', () => {
    const parsed = AppModelSchema.parse({
      version: 11,
      project: { appDir: 'app' },
      routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'app', files: {}, children: [] },
      routes: [{ id: 'rt_1', path: '/', kind: 'page', file: 'app/page.tsx', segments: [], layoutChain: [] }],
      components: [],
      types: [],
    })
    expect(parsed.version).toBe(MODEL_VERSION)
    expect(accessOf(parsed.routes[0] as Route).status).toBe('unknown')
  })
})

describe('seen guards', () => {
  const routes = [
    page('dash', [
      guard('to-login', { targetRouteId: 'login', in: 'middleware' }),
      guard('to-upgrade', { targetRouteId: 'upgrade' }),
      guard('somewhere', {}),
      guard('gone', { kind: 'not-found' }),
      guard('client', { kind: 'client-redirect', targetRouteId: 'login', in: 'component' }),
      guard('blocked', { kind: 'respond', status: 401, in: 'middleware' }),
    ]),
    page('login', []),
  ]

  it('fits a server redirect to guards with that target, or none resolved', () => {
    expect(seenGuards(routes, [{ routeId: 'dash', toRouteId: 'login' }])).toEqual({
      dash: ['to-login', 'somewhere'],
    })
  })

  it('fits a browser move to page and component redirects, not middleware ones', () => {
    expect(seenGuards(routes, [{ routeId: 'dash', toRouteId: 'login', inBrowser: true }])).toEqual({
      dash: ['somewhere', 'client'],
    })
  })

  it('fits error answers by status', () => {
    expect(seenGuards(routes, [{ routeId: 'dash', status: 404 }])).toEqual({ dash: ['gone'] })
    expect(seenGuards(routes, [{ routeId: 'dash', status: 401 }])).toEqual({ dash: ['blocked'] })
    expect(
      seenGuards(routes, [
        { routeId: 'login', status: 404 },
        { routeId: 'nope', status: 404 },
      ]),
    ).toEqual({})
  })
})
