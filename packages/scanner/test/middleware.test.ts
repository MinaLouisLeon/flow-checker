// Middleware patterns (M14) the fixture apps don't cover, scanned from in-memory projects:
// Next 15 `middleware.ts`, matcher forms, factories, helpers, rewrites and re-scans.
import {
  type AppModel,
  AppModelSchema,
  type Middleware,
  type Navigation,
  urlText,
} from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { createScanSession, scanProject } from '../src'

const lines = (...l: string[]) => `${l.join('\n')}\n`

const BASE: Record<string, string> = {
  'package.json': JSON.stringify({ dependencies: { next: '^15.5.0' } }),
  'tsconfig.json': JSON.stringify({
    compilerOptions: { jsx: 'preserve', module: 'esnext', moduleResolution: 'bundler', strict: true },
  }),
  'node_modules/next/package.json': JSON.stringify({ name: 'next' }),
  'node_modules/next/server.d.ts': lines(
    'export declare class NextRequest extends Request {',
    '  nextUrl: URL & { clone(): URL }',
    '  cookies: { get(name: string): { value: string } | undefined }',
    '}',
    'export declare class NextResponse extends Response {',
    '  static next(): NextResponse',
    '  static redirect(url: string | URL, status?: number): NextResponse',
    '  static rewrite(url: string | URL): NextResponse',
    '}',
  ),
  'node_modules/next-auth/package.json': JSON.stringify({ name: 'next-auth', types: 'index.d.ts' }),
  'node_modules/next-auth/index.d.ts': lines(
    `import type { NextRequest } from 'next/server'`,
    'export declare function auth(handler: (req: NextRequest) => unknown): (req: NextRequest) => unknown',
  ),
  'node_modules/next-intl/package.json': JSON.stringify({ name: 'next-intl' }),
  'node_modules/next-intl/middleware.d.ts': lines(
    'export default function createMiddleware(routing: unknown): (req: Request) => unknown',
  ),
  'node_modules/next-intl/routing.d.ts': lines('export declare function defineRouting<T>(config: T): T'),
}

const APP: Record<string, string> = {
  'src/app/layout.tsx':
    'export default function Root({ children }: { children: unknown }) { return children }\n',
  'src/app/page.tsx': 'export default function Home() { return null }\n',
  'src/app/login/page.tsx': 'export default function Login() { return null }\n',
  'src/app/admin/page.tsx': 'export default function Admin() { return null }\n',
  'src/app/admin/users/[id]/page.tsx': 'export default function AdminUser() { return null }\n',
  'src/app/api/session/route.ts': 'export function GET() { return Response.json({}) }\n',
}

function project(files: Record<string, string>): InMemoryFileSystemHost {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries({ ...BASE, ...APP, ...files }))
    fs.writeFileSync(`/p/${path}`, text)
  return fs
}

function scan(files: Record<string, string>): AppModel {
  const model = scanProject({ root: '/p', fileSystem: project(files) })
  expect(() => AppModelSchema.parse(model)).not.toThrow()
  return model
}

function mw(model: AppModel): Middleware {
  expect(model.middleware).toBeDefined()
  return model.middleware as Middleware
}

const pathOf = (model: AppModel) => (id: string | undefined) => model.routes.find((r) => r.id === id)?.path

/** `/admin  [conditional]` lines for the routes the middleware runs on. */
function runsOn(model: AppModel): string[] {
  const path = pathOf(model)
  return mw(model).routes.map((r) => `${path(r.routeId)}${r.conditional ? '  [conditional]' : ''}`)
}

function redirects(model: AppModel): string[] {
  const path = pathOf(model)
  return model.navigations
    .filter((n: Navigation) => n.origin === 'middleware')
    .map((n) => {
      const parts = [`${n.kind} ${urlText(n.href)} -> ${path(n.targetRouteId) ?? '?'}`]
      parts.push(`from ${(n.sourceRouteIds ?? []).map(path).join(', ') || '-'}`)
      if (n.condition) parts.push(`if ${n.condition}`)
      return parts.join('  ')
    })
}

describe('middleware file', () => {
  it('finds Next 15 src/middleware.ts with a named export, running everywhere without a matcher', () => {
    const model = scan({
      'src/middleware.ts': lines(
        `import { NextResponse, type NextRequest } from 'next/server'`,
        'export function middleware(request: NextRequest) {',
        '  return NextResponse.next()',
        '}',
      ),
    })
    expect(mw(model)).toMatchObject({
      file: 'src/middleware.ts',
      convention: 'middleware',
      exportName: 'middleware',
    })
    expect(mw(model).matchers).toEqual([])
    expect(runsOn(model)).toEqual(['/', '/admin', '/admin/users/[id]', '/api/session', '/login'])
  })

  it('prefers proxy.ts over middleware.ts, and finds a default-exported arrow function', () => {
    const model = scan({
      'src/middleware.ts': 'export function middleware() {}\n',
      'src/proxy.ts': 'export default () => {}\n',
    })
    expect(mw(model)).toMatchObject({ file: 'src/proxy.ts', convention: 'proxy', exportName: 'default' })
  })

  it('finds a root middleware file next to a root app directory only', () => {
    const files: Record<string, string> = {
      'proxy.ts': 'export function proxy() {}\n',
      'app/page.tsx': 'export default function Home() { return null }\n',
    }
    const fs = project(files)
    for (const path of Object.keys(APP)) fs.deleteSync(`/p/${path}`)
    const model = scanProject({ root: '/p', fileSystem: fs })
    expect(model.middleware?.file).toBe('proxy.ts')
  })

  it('has no middleware section without a file', () => {
    expect(scan({}).middleware).toBeUndefined()
  })
})

describe('config.matcher', () => {
  it('reads strings, objects with has / missing, and constants', () => {
    const model = scan({
      'src/proxy.ts': lines(
        'export function proxy() {}',
        `const ADMIN = '/admin/:path*'`,
        'export const config = {',
        '  matcher: [',
        '    ADMIN,',
        `    { source: '/login', missing: [{ type: 'cookie', key: 'session' }] },`,
        `    { source: '/api/:path*', has: [{ type: 'header', key: 'x-debug', value: '1' }] },`,
        '  ],',
        '} as const',
      ),
    })
    expect(mw(model).matchers).toEqual([
      { source: '/admin/:path*' },
      { source: '/login', missing: [{ type: 'cookie', key: 'session' }] },
      { source: '/api/:path*', has: [{ type: 'header', key: 'x-debug', value: '1' }] },
    ])
    expect(runsOn(model)).toEqual([
      '/admin',
      '/admin/users/[id]',
      '/api/session  [conditional]',
      '/login  [conditional]',
    ])
  })

  it('marks a dynamic segment that only some values match as conditional', () => {
    const model = scan({
      'src/app/[lang]/about/page.tsx': 'export default function About() { return null }\n',
      'src/proxy.ts': lines(
        'export function proxy() {}',
        `export const config = { matcher: '/(en|de)/:path*' }`,
      ),
    })
    expect(runsOn(model)).toEqual(['/[lang]/about  [conditional]'])
  })

  it('keeps a matcher it cannot read as text, and treats every route as conditional', () => {
    const model = scan({
      'src/proxy.ts': lines(
        'export function proxy() {}',
        'declare function build(): string[]',
        'export const config = { matcher: build() }',
      ),
    })
    expect(mw(model).matcherText).toBe('build()')
    expect(runsOn(model).every((line) => line.endsWith('[conditional]'))).toBe(true)
  })
})

describe('redirects, rewrites and requests', () => {
  it('finds redirects with their path checks and conditions, also inside helpers', () => {
    const model = scan({
      'src/lib/guard.ts': lines(
        `import { NextResponse, type NextRequest } from 'next/server'`,
        'export function requireAuth(req: NextRequest) {',
        `  if (!req.cookies.get('token')) return NextResponse.redirect(new URL('/login', req.url))`,
        '  return NextResponse.next()',
        '}',
      ),
      'src/middleware.ts': lines(
        `import { NextResponse, type NextRequest } from 'next/server'`,
        `import { requireAuth } from './lib/guard'`,
        'export default function middleware(req: NextRequest) {',
        '  const { pathname } = req.nextUrl',
        `  if (pathname.startsWith('/admin')) return requireAuth(req)`,
        `  if (pathname === '/old') return Response.redirect(new URL('/', req.url), 301)`,
        `  if (pathname === '/legacy') return NextResponse.redirect(new URL('/', req.url), 308)`,
        '}',
      ),
    })
    expect(redirects(model)).toEqual([
      "redirect /login -> /login  from /admin, /admin/users/[id]  if !req.cookies.get('token')",
      'permanent-redirect / -> /  from -',
      'permanent-redirect / -> /  from -',
    ])
    const old = model.navigations.find((n) => n.from?.path === '/old')
    expect(old?.from).toEqual({ kind: 'exact', path: '/old' })
  })

  it('reads the target of a cloned request URL', () => {
    const model = scan({
      'src/proxy.ts': lines(
        `import { NextResponse, type NextRequest } from 'next/server'`,
        'export function proxy(request: NextRequest) {',
        '  const url = request.nextUrl.clone()',
        `  url.pathname = '/login'`,
        '  return NextResponse.redirect(url)',
        '}',
        `export const config = { matcher: ['/admin/:path*'] }`,
      ),
    })
    expect(redirects(model)).toEqual(['redirect /login -> /login  from /admin, /admin/users/[id]'])
  })

  it('finds factories (next-auth style) with a handler, and next-intl locales', () => {
    const auth = scan({
      'src/proxy.ts': lines(
        `import { auth } from 'next-auth'`,
        `import { NextResponse } from 'next/server'`,
        'export default auth((req) => {',
        `  if (!req.cookies.get('session')) return NextResponse.redirect(new URL('/login', req.url))`,
        '})',
      ),
    })
    expect(mw(auth).factory).toEqual({ module: 'next-auth', name: 'auth' })
    expect(redirects(auth)).toHaveLength(1)

    const intl = scan({
      'src/i18n/routing.ts': lines(
        `import { defineRouting } from 'next-intl/routing'`,
        `export const routing = defineRouting({ locales: ['en', 'fr'], defaultLocale: 'en', localePrefix: 'as-needed' })`,
      ),
      'src/proxy.ts': lines(
        `import createMiddleware from 'next-intl/middleware'`,
        `import { routing } from './i18n/routing'`,
        'export default createMiddleware(routing)',
      ),
    })
    expect(mw(intl).factory).toEqual({ module: 'next-intl/middleware', name: 'createMiddleware' })
    expect(mw(intl).i18n).toEqual({ locales: ['en', 'fr'], defaultLocale: 'en', localePrefix: 'as-needed' })
  })

  it('records rewrites with where they apply and the route that answers', () => {
    const model = scan({
      'src/proxy.ts': lines(
        `import { NextResponse, type NextRequest } from 'next/server'`,
        'export function proxy(request: NextRequest) {',
        `  if (request.nextUrl.pathname === '/me') return NextResponse.rewrite(new URL('/admin', request.url))`,
        `  return NextResponse.rewrite(new URL('/api/session', request.url))`,
        '}',
      ),
    })
    const path = pathOf(model)
    expect(mw(model).rewrites.map((r) => [r.from, urlText(r.href), path(r.targetRouteId)])).toEqual([
      [{ kind: 'exact', path: '/me' }, '/admin', '/admin'],
      [undefined, '/api/session', '/api/session'],
    ])
  })

  it('finds requests in middleware with a middleware trigger, linked to the app route handler', () => {
    const model = scan({
      'src/proxy.ts': lines(
        'export async function proxy(request: Request) {',
        `  await fetch(new URL('/api/session', request.url))`,
        `  await fetch('https://flags.example.com/v1/flags', { method: 'POST' })`,
        '}',
      ),
    })
    const sites = model.requests.filter((s) => s.origin === 'middleware')
    expect(sites.map((s) => [s.method, s.url && urlText(s.url), s.trigger.kind])).toEqual([
      ['GET', '/api/session', 'middleware'],
      ['POST', 'https://flags.example.com/v1/flags', 'middleware'],
    ])
    const handler = model.routes.find((r) => r.path === '/api/session')
    expect(sites[0]?.targetRouteId).toBe(handler?.id)
  })
})

describe('re-scans', () => {
  it('notices a middleware file being added, changed and removed', () => {
    const fs = project({})
    const session = createScanSession({ root: '/p', fileSystem: fs })
    expect(session.model.middleware).toBeUndefined()

    fs.writeFileSync(
      '/p/src/proxy.ts',
      `export function proxy() {}\nexport const config = { matcher: '/admin' }\n`,
    )
    let model = session.update({ added: ['src/proxy.ts'] })
    expect(runsOn(model)).toEqual(['/admin'])

    fs.writeFileSync(
      '/p/src/proxy.ts',
      `export function proxy() {}\nexport const config = { matcher: '/login' }\n`,
    )
    model = session.update({ changed: ['src/proxy.ts'] })
    expect(runsOn(model)).toEqual(['/login'])

    fs.deleteSync('/p/src/proxy.ts')
    model = session.update({ removed: ['src/proxy.ts'] })
    expect(model.middleware).toBeUndefined()
  })
})
