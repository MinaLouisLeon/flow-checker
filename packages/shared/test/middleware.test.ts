import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AppModelSchema,
  type Middleware,
  MODEL_VERSION,
  matcherRegExp,
  middlewareRunsOn,
  servedPaths,
} from '../src'

// Next's own copy of path-to-regexp v6, from a fixture app: the reference for matcher semantics.
const require = createRequire(join(import.meta.dirname, '../../../fixtures/basic/package.json'))
const reference = require('next/dist/compiled/path-to-regexp') as {
  pathToRegexp: (path: string) => RegExp
}

const SOURCES = [
  '/',
  '/about',
  '/about/:path',
  '/about/:path*',
  '/about/:path+',
  '/about/:path?',
  '/dashboard/:path*',
  '/users/:id(\\d+)',
  '/((?!api|_next/static|_next/image|favicon.ico).*)',
  '/((?!api|_next|_vercel|.*\\..*).*)',
  '/(en|de)/:path*',
  '/blog{/:slug}?',
  '/files/:name.:ext',
  '/shop/(.*)',
]

const PATHS = [
  '/',
  '/about',
  '/about/',
  '/about/team',
  '/about/team/x',
  '/dashboard',
  '/dashboard/settings',
  '/users/12',
  '/users/ada',
  '/api/users',
  '/_next/static/chunk.js',
  '/favicon.ico',
  '/en',
  '/en/login',
  '/fr/login',
  '/blog',
  '/blog/post',
  '/files/a.txt',
  '/shop/x',
  '/ABOUT',
]

describe('matcherRegExp', () => {
  it.each(SOURCES)('matches like path-to-regexp v6: %s', (source) => {
    const ours = matcherRegExp(source)
    const theirs = reference.pathToRegexp(source)
    expect(ours).toBeDefined()
    for (const path of PATHS) {
      expect([path, ours?.test(path)]).toEqual([path, theirs.test(path)])
    }
  })

  it('rejects sources that are not paths or do not parse', () => {
    expect(matcherRegExp('about')).toBeUndefined()
    expect(matcherRegExp('/about/(unclosed')).toBeUndefined()
    expect(matcherRegExp('/about/(group(capturing))')).toBeUndefined()
  })
})

function middleware(partial: Partial<Middleware>): Middleware {
  return {
    file: 'proxy.ts',
    convention: 'proxy',
    loc: { file: 'proxy.ts', line: 1, column: 1 },
    matchers: [],
    routes: [],
    rewrites: [],
    ...partial,
  }
}

describe('middlewareRunsOn', () => {
  it('runs everywhere without a matcher', () => {
    expect(middlewareRunsOn(middleware({}), '/anything')).toBe('yes')
  })

  it('follows the matchers, conditional with has / missing', () => {
    const mw = middleware({
      matchers: [
        { source: '/dashboard/:path*' },
        { source: '/login', has: [{ type: 'cookie', key: 'session' }] },
      ],
    })
    expect(middlewareRunsOn(mw, '/dashboard/settings')).toBe('yes')
    expect(middlewareRunsOn(mw, '/login')).toBe('conditional')
    expect(middlewareRunsOn(mw, '/')).toBe('no')
  })

  it('is conditional everywhere when the matcher could not be read', () => {
    expect(middlewareRunsOn(middleware({ matcherText: 'matchers' }), '/')).toBe('conditional')
  })
})

describe('servedPaths', () => {
  const rewrite = (from: { kind: 'prefix' | 'exact'; path: string }, path: string) => ({
    id: `rw-${path}`,
    href: { text: `'${path}'`, confidence: 'exact' as const, path },
    from,
    loc: { file: 'proxy.ts', line: 1, column: 1 },
  })

  it('puts rewrite targets first', () => {
    const mw = middleware({
      matchers: [{ source: '/shop/:path*' }],
      rewrites: [
        rewrite({ kind: 'prefix', path: '/shop' }, '/products'),
        rewrite({ kind: 'exact', path: '/x' }, '/y'),
      ],
    })
    expect(servedPaths(mw, '/shop')).toEqual(['/products', '/shop'])
    expect(servedPaths(mw, '/shop/sale')).toEqual(['/products', '/shop/sale'])
    expect(servedPaths(mw, '/shopping')).toEqual(['/shopping'])
    // Outside the matcher the middleware never runs.
    expect(servedPaths(mw, '/x')).toEqual(['/x'])
  })

  it('adds the default locale to paths without one (next-intl)', () => {
    const mw = middleware({ i18n: { locales: ['en', 'ar'], defaultLocale: 'en' } })
    expect(servedPaths(mw, '/login')).toEqual(['/en/login', '/login'])
    expect(servedPaths(mw, '/')).toEqual(['/en', '/'])
    expect(servedPaths(mw, '/ar/login')).toEqual(['/ar/login'])
  })

  it('keeps the path without middleware', () => {
    expect(servedPaths(undefined, '/a')).toEqual(['/a'])
  })
})

describe('model files from before M14', () => {
  it('load as the current version, without middleware', () => {
    const old = {
      version: 2,
      project: { appDir: 'app' },
      routeTree: {
        segment: { raw: 'app', kind: 'static', name: 'app' },
        dir: 'app',
        files: {},
        children: [],
      },
      routes: [],
      components: [],
      types: [],
    }
    const parsed = AppModelSchema.parse(old)
    expect(parsed.version).toBe(MODEL_VERSION)
    expect(parsed.middleware).toBeUndefined()
    expect(parsed.navigations).toEqual([])
  })
})
