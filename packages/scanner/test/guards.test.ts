// Guarded pages (M31): each page is `guarded`, `open` or `unknown`, from middleware redirects and
// answers, and from redirects / `notFound()`-like calls in its layouts, the page and the components
// they render, written inline or in imported helpers (.ts and .js).
import { type AppModel, AppModelSchema, guardText, type Route } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { beforeAll, describe, expect, it } from 'vitest'
import { scanProject } from '../src'

const lines = (...l: string[]) => `${l.join('\n')}\n`

const BASE: Record<string, string> = {
  'package.json': JSON.stringify({ dependencies: { next: '^16.0.0' } }),
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      jsx: 'preserve',
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
      allowJs: true,
      lib: ['dom', 'esnext'],
      paths: { '@/*': ['./src/*'] },
    },
  }),
  'node_modules/next/package.json': JSON.stringify({ name: 'next' }),
  'node_modules/next/navigation.d.ts': lines(
    'export interface Router { push(href: string): void; replace(href: string): void }',
    'export function useRouter(): Router',
    'export function redirect(url: string): never',
    'export function permanentRedirect(url: string): never',
    'export function notFound(): never',
    'export function forbidden(): never',
    'export function unauthorized(): never',
  ),
  'node_modules/next/server.d.ts': lines(
    'export declare class NextRequest extends Request {',
    '  nextUrl: URL & { clone(): URL }',
    '  cookies: { get(name: string): { value: string } | undefined }',
    '}',
    'export declare class NextResponse extends Response {',
    '  static next(): NextResponse',
    '  static json(body: unknown, init?: ResponseInit): NextResponse',
    '  static redirect(url: string | URL, status?: number): NextResponse',
    '  static rewrite(url: string | URL): NextResponse',
    '}',
  ),
  'node_modules/next-auth/package.json': JSON.stringify({ name: 'next-auth', types: 'index.d.ts' }),
  'node_modules/next-auth/index.d.ts': lines(
    `import type { NextRequest } from 'next/server'`,
    'export declare function auth(handler: (req: NextRequest & { auth?: unknown }) => unknown): (req: NextRequest) => unknown',
  ),
  'node_modules/next-intl/package.json': JSON.stringify({ name: 'next-intl' }),
  'node_modules/next-intl/middleware.d.ts': lines(
    'export default function createMiddleware(routing: unknown): (req: Request) => unknown',
  ),
  'src/app/layout.tsx': lines(
    'export default function Root({ children }: { children: unknown }) {',
    '  return <html><body>{children as never}</body></html>',
    '}',
  ),
  'src/lib/session.ts': lines(
    'export interface User { id: string; role: string }',
    'export async function readSession(): Promise<User | null> {',
    '  return null',
    '}',
  ),
}

function project(files: Record<string, string>): InMemoryFileSystemHost {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries({ ...BASE, ...files })) fs.writeFileSync(`/p/${path}`, text)
  return fs
}

function scan(files: Record<string, string>, exclude?: string[]): AppModel {
  const model = scanProject({ root: '/p', fileSystem: project(files), ...(exclude ? { exclude } : {}) })
  expect(() => AppModelSchema.parse(model)).not.toThrow()
  return model
}

function page(model: AppModel, path: string): Route {
  const route = model.routes.find((r) => r.kind === 'page' && r.path === path)
  expect(route, path).toBeDefined()
  return route as Route
}

/** `guarded: redirects to `/login` when `!session` (page)` lines for one page. */
function access(model: AppModel, path: string): string[] {
  const a = page(model, path).access
  if (!a) return ['(none)']
  return [a.status, ...a.guards.map(guardText), ...(a.reasons ?? []).map((r) => `? ${r.text}`)]
}

describe('guards in pages, layouts, components and helpers', () => {
  let model: AppModel
  beforeAll(() => {
    model = scan(
      {
        // Open: navigation from an event handler and a link don't stop the page.
        'src/app/page.tsx': lines(
          `'use client'`,
          `import Link from 'next/link'`,
          `import { useRouter } from 'next/navigation'`,
          `export default function Home() {`,
          `  const router = useRouter()`,
          `  return <div><Link href="/inline">go</Link><button onClick={() => router.push('/login')} /></div>`,
          `}`,
        ),
        'node_modules/next/link.d.ts': lines(
          'declare function Link(props: { href: string; children?: unknown }): unknown',
          'export default Link',
        ),
        // Inline in the page.
        'src/app/inline/page.tsx': lines(
          `import { redirect } from 'next/navigation'`,
          `import { readSession } from '@/lib/session'`,
          `export default async function InlinePage() {`,
          `  const session = await readSession()`,
          `  if (!session) redirect('/login')`,
          `  return <main>{session.id}</main>`,
          `}`,
        ),
        // `return redirect()`, an arrow page.
        'src/app/returned/page.tsx': lines(
          `import { redirect } from 'next/navigation'`,
          `import { readSession } from '@/lib/session'`,
          `const ReturnedPage = async () => {`,
          `  const user = await readSession()`,
          `  if (user === null) {`,
          `    return redirect('/login?next=/returned')`,
          `  }`,
          `  return <main>{user.id}</main>`,
          `}`,
          `export default ReturnedPage`,
        ),
        // An imported .ts helper that redirects.
        'src/lib/auth.ts': lines(
          `import { redirect } from 'next/navigation'`,
          `import { readSession } from './session'`,
          `export async function requireUser() {`,
          `  const current = await readSession()`,
          `  if (!current) redirect('/login')`,
          `  return current`,
          `}`,
        ),
        'src/app/helper/page.tsx': lines(
          `import { requireUser } from '@/lib/auth'`,
          `export default async function HelperPage() {`,
          `  const user = await requireUser()`,
          `  return <main>{user.id}</main>`,
          `}`,
        ),
        // An imported .js arrow helper with notFound().
        'src/lib/roles.js': lines(
          `import { notFound } from 'next/navigation'`,
          `export const ensureAdmin = (user) => {`,
          `  if (user.role !== 'admin') notFound()`,
          `}`,
        ),
        'src/app/helper-js/page.jsx': lines(
          `import { ensureAdmin } from '@/lib/roles'`,
          `import { readSession } from '@/lib/session'`,
          `export default async function HelperJsPage() {`,
          `  const user = await readSession()`,
          `  ensureAdmin(user)`,
          `  return <main />`,
          `}`,
        ),
        // A layout guard: every page under it.
        'src/app/admin/layout.tsx': lines(
          `import { forbidden } from 'next/navigation'`,
          `import { readSession } from '@/lib/session'`,
          `export default async function AdminLayout({ children }: { children: unknown }) {`,
          `  const user = await readSession()`,
          `  if (user?.role !== 'admin') forbidden()`,
          `  return <section>{children as never}</section>`,
          `}`,
        ),
        'src/app/admin/page.tsx': 'export default function AdminPage() { return <main /> }\n',
        'src/app/admin/users/page.tsx': 'export default function AdminUsers() { return <main /> }\n',
        // A client component a group layout renders: it redirects from an effect.
        'src/components/AuthGate.tsx': lines(
          `'use client'`,
          `import { useEffect } from 'react'`,
          `import { useRouter } from 'next/navigation'`,
          `export function AuthGate({ user, children }: { user: unknown; children: unknown }) {`,
          `  const router = useRouter()`,
          `  useEffect(() => {`,
          `    if (!user) router.replace('/login')`,
          `  }, [user, router])`,
          `  return <>{children as never}</>`,
          `}`,
        ),
        'node_modules/react/package.json': JSON.stringify({ name: 'react', types: 'index.d.ts' }),
        'node_modules/react/index.d.ts': lines(
          'export function useEffect(fn: () => void, deps?: unknown[]): void',
        ),
        'src/app/(account)/layout.tsx': lines(
          `import { AuthGate } from '@/components/AuthGate'`,
          `export default function AccountLayout({ children }: { children: unknown }) {`,
          `  return <AuthGate user={null}>{children as never}</AuthGate>`,
          `}`,
        ),
        'src/app/(account)/profile/page.tsx': 'export default function Profile() { return <main /> }\n',
        // `||` short circuit, `switch` case, a ternary, and an unconditional redirect.
        'src/app/or/page.tsx': lines(
          `import { notFound } from 'next/navigation'`,
          `export default function OrPage({ ready }: { ready: boolean }) {`,
          `  ready || notFound()`,
          `  return <main />`,
          `}`,
        ),
        'src/app/plan/page.tsx': lines(
          `import { redirect } from 'next/navigation'`,
          `export default function PlanPage({ plan }: { plan: string }) {`,
          `  switch (plan) {`,
          `    case 'free':`,
          `      redirect('/upgrade')`,
          `  }`,
          `  return <main />`,
          `}`,
        ),
        'src/app/token/page.tsx': lines(
          `import { unauthorized } from 'next/navigation'`,
          `export default function TokenPage({ token }: { token?: string }) {`,
          `  const value = token ? token : unauthorized()`,
          `  return <main>{value}</main>`,
          `}`,
        ),
        'src/app/moved/page.tsx': lines(
          `import { permanentRedirect } from 'next/navigation'`,
          `export default function Moved() {`,
          `  permanentRedirect('/inline')`,
          `}`,
        ),
        // Unknown: a guard in a loop, and a helper in an excluded file.
        'src/app/loop/page.tsx': lines(
          `import { redirect } from 'next/navigation'`,
          `export default function LoopPage({ rules }: { rules: { blocks: boolean }[] }) {`,
          `  for (const rule of rules) {`,
          `    if (rule.blocks) redirect('/blocked')`,
          `  }`,
          `  return <main />`,
          `}`,
        ),
        'src/vendor/check.ts': lines(
          `import { redirect } from 'next/navigation'`,
          `export function checkAccess() {`,
          `  redirect('/login')`,
          `}`,
        ),
        'src/app/excluded/page.tsx': lines(
          `import { checkAccess } from '@/vendor/check'`,
          `export default function ExcludedPage() {`,
          `  checkAccess()`,
          `  return <main />`,
          `}`,
        ),
        // Open: a server action that redirects after a form post.
        'src/app/actions/page.tsx': lines(
          `import { redirect } from 'next/navigation'`,
          `export default function ActionsPage() {`,
          `  async function save() {`,
          `    'use server'`,
          `    redirect('/inline')`,
          `  }`,
          `  return <form action={save} />`,
          `}`,
        ),
      },
      ['src/vendor/**'],
    )
  })

  it('leaves pages open when they only navigate on events, links or server actions', () => {
    expect(access(model, '/')).toEqual(['open'])
    expect(access(model, '/actions')).toEqual(['open'])
  })

  it('reads a guard written in the page, with or without return', () => {
    expect(access(model, '/inline')).toEqual(['guarded', 'redirects to `/login` when `!session` (page)'])
    expect(access(model, '/returned')).toEqual([
      'guarded',
      'redirects to `/login?next=/returned` when `user === null` (page)',
    ])
  })

  it('follows imported helpers in .ts and .js', () => {
    expect(access(model, '/helper')).toEqual(['guarded', 'redirects to `/login` when `!current` (page)'])
    expect(access(model, '/helper-js')).toEqual([
      'guarded',
      "shows the not-found page (404) when `user.role !== 'admin'` (page)",
    ])
  })

  it('puts a layout guard on every page under the layout', () => {
    const text = "shows the forbidden page (403) when `user?.role !== 'admin'` (layout)"
    expect(access(model, '/admin')).toEqual(['guarded', text])
    expect(access(model, '/admin/users')).toEqual(['guarded', text])
    const [a, b] = ['/admin', '/admin/users'].map((p) => page(model, p).access?.guards[0]?.id)
    expect(a).toBe(b)
  })

  it('finds a client redirect from an effect in a component the layout renders', () => {
    expect(access(model, '/profile')).toEqual([
      'guarded',
      'redirects in the browser to `/login` when `!user` (component)',
    ])
  })

  it('reads ||, switch, ternary and unconditional forms', () => {
    expect(access(model, '/or')).toEqual(['guarded', 'shows the not-found page (404) when `!ready` (page)'])
    expect(access(model, '/plan')).toEqual([
      'guarded',
      "redirects to `/upgrade` when `plan === 'free'` (page)",
    ])
    expect(access(model, '/token')).toEqual([
      'guarded',
      'shows the unauthorized page (401) when `!token` (page)',
    ])
    expect(access(model, '/moved')).toEqual(['guarded', 'redirects to `/inline` always (page)'])
  })

  it('says unknown when the condition or the helper can not be read, never open', () => {
    expect(access(model, '/loop')).toEqual([
      'unknown',
      "redirects to `/blocked` under a condition the scan can't read (it runs inside a loop) (page)",
    ])
    expect(access(model, '/excluded')).toEqual([
      'unknown',
      '? calls `checkAccess` from a file the config excludes',
    ])
  })
})

describe('guards in middleware', () => {
  const pages = {
    'src/app/page.tsx': 'export default function Home() { return null }\n',
    'src/app/app/page.tsx': 'export default function AppHome() { return null }\n',
    'src/app/app/settings/page.tsx': 'export default function Settings() { return null }\n',
    'src/app/login/page.tsx': 'export default function Login() { return null }\n',
  }

  it('reads an answer with an error status, only on the pages it runs on', () => {
    const model = scan({
      ...pages,
      'src/proxy.ts': lines(
        `import { type NextRequest, NextResponse } from 'next/server'`,
        `export function proxy(req: NextRequest) {`,
        `  if (!req.cookies.get('token')) return NextResponse.json({ error: 'signed out' }, { status: 401 })`,
        `  return NextResponse.next()`,
        `}`,
        `export const config = { matcher: ['/app/:path*'] }`,
      ),
    })
    const text = "answers with status 401 when `!req.cookies.get('token')` (middleware)"
    expect(access(model, '/app')).toEqual(['guarded', text])
    expect(access(model, '/app/settings')).toEqual(['guarded', text])
    expect(access(model, '/')).toEqual(['open'])
  })

  it('reads redirects in an imported .js helper and a matcher with has / missing', () => {
    const model = scan({
      ...pages,
      'src/lib/gate.js': lines(
        `import { NextResponse } from 'next/server'`,
        `export function gate(req) {`,
        `  if (req.nextUrl.pathname.startsWith('/app') && !req.cookies.get('sid')) {`,
        `    return NextResponse.redirect(new URL('/login', req.url))`,
        `  }`,
        `  if (req.nextUrl.pathname === '/login') return NextResponse.redirect(new URL('/app', req.url))`,
        `}`,
      ),
      'src/proxy.ts': lines(
        `import { type NextRequest, NextResponse } from 'next/server'`,
        `import { gate } from './lib/gate'`,
        `export function proxy(req: NextRequest) {`,
        `  return gate(req) ?? NextResponse.next()`,
        `}`,
        `export const config = {`,
        `  matcher: ['/app/:path*', { source: '/login', has: [{ type: 'cookie', key: 'sid' }] }],`,
        `}`,
      ),
    })
    expect(access(model, '/app')).toEqual([
      'guarded',
      "redirects to `/login` when `!req.cookies.get('sid')` (middleware)",
    ])
    expect(access(model, '/login')).toEqual([
      'guarded',
      'redirects to `/app` when `cookie sid is set` (middleware)',
    ])
    expect(access(model, '/')).toEqual(['open'])
  })

  it('says unknown where a factory it can not read runs, but keeps guards it read', () => {
    const model = scan({
      ...pages,
      'src/proxy.ts': lines(
        `import { auth } from 'next-auth'`,
        `import { NextResponse } from 'next/server'`,
        `export default auth((req) => {`,
        `  if (!req.auth && req.nextUrl.pathname.startsWith('/app')) {`,
        `    return NextResponse.redirect(new URL('/login', req.url))`,
        `  }`,
        `})`,
      ),
    })
    const reason = "? the middleware is made with `auth` from `next-auth`, which the scan can't read"
    expect(access(model, '/')).toEqual(['unknown', reason])
    expect(access(model, '/app')).toEqual([
      'guarded',
      'redirects to `/login` when `!req.auth` (middleware)',
      reason,
    ])
  })

  it('treats next-intl middleware as locale handling, not a guard', () => {
    const model = scan({
      ...pages,
      'src/proxy.ts': lines(
        `import createMiddleware from 'next-intl/middleware'`,
        `export default createMiddleware({ locales: ['en', 'de'], defaultLocale: 'en' })`,
      ),
    })
    for (const path of Object.keys(pages).map((f) => f.replace(/^src\/app|\/?page\.tsx$/g, '') || '/'))
      expect(access(model, path)).toEqual(['open'])
  })

  it('says unknown when the matcher can not be read', () => {
    const model = scan({
      ...pages,
      'src/lib/paths.ts': "export const protectedPaths = () => ['/app/:path*']\n",
      'src/proxy.ts': lines(
        `import { type NextRequest, NextResponse } from 'next/server'`,
        `import { protectedPaths } from './lib/paths'`,
        `export function proxy(req: NextRequest) {`,
        `  if (!req.cookies.get('token')) return NextResponse.redirect(new URL('/login', req.url))`,
        `}`,
        `export const config = { matcher: protectedPaths() }`,
      ),
    })
    expect(access(model, '/app')[0]).toBe('unknown')
    expect(access(model, '/app')[1]).toContain("the middleware matcher can't be read")
  })
})
