// Navigation and flow patterns the fixture apps don't cover, scanned from an in-memory project.
import { type AppModel, AppModelSchema, formatFlows, type Navigation, urlText } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { beforeAll, describe, expect, it } from 'vitest'
import { scanProject } from '../src'

const lines = (...l: string[]) => `${l.join('\n')}\n`

const FILES: Record<string, string> = {
  'package.json': JSON.stringify({ dependencies: { next: '^16.0.0' } }),
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      jsx: 'preserve',
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
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
  ),
  'node_modules/next/link.d.ts': lines(
    'declare function Link(props: { href: string | object; children?: unknown }): unknown',
    'export default Link',
  ),
  'node_modules/next-intl/package.json': JSON.stringify({ name: 'next-intl' }),
  'node_modules/next-intl/navigation.d.ts': lines(
    'export function createNavigation(routing?: unknown): {',
    '  Link: (props: { href: unknown; children?: unknown }) => unknown',
    '  useRouter: () => { push(href: unknown): void; replace(href: unknown): void }',
    '  redirect: (args: { href: unknown; locale: string }) => never',
    '}',
  ),
  'node_modules/@tanstack/react-query/package.json': JSON.stringify({
    name: '@tanstack/react-query',
    types: 'index.d.ts',
  }),
  'node_modules/@tanstack/react-query/index.d.ts': lines(
    'export function useMutation<T>(options: {',
    '  mutationFn: (v: any) => Promise<T>',
    '  onSuccess?: (data: T) => void',
    '  onError?: (error: unknown) => void',
    '}): { mutate(v: any): void }',
  ),

  'src/i18n/navigation.ts': lines(
    `import { createNavigation } from 'next-intl/navigation'`,
    'export const { Link: IntlLink, useRouter: useIntlRouter, redirect: intlRedirect } = createNavigation()',
  ),

  'app/layout.tsx': lines(
    'export default function Root({ children }: { children: unknown }) { return children }',
  ),
  'app/done/page.tsx': lines('export default function Done() { return null }'),
  'app/error/page.tsx': lines('export default function Failed() { return null }'),
  'app/users/new/page.tsx': lines('export default function NewUser() { return null }'),
  'app/users/[id]/page.tsx': lines(
    `import { permanentRedirect } from 'next/navigation'`,
    'export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {',
    '  const { id } = await params',
    `  if (id === 'me') permanentRedirect('/users/new')`,
    '  return null',
    '}',
  ),
  'app/page.tsx': lines(
    `import Link from 'next/link'`,
    `import { Forms } from '@/Forms'`,
    `import { IntlLink } from '@/i18n/navigation'`,
    'export default function Home() {',
    '  return (',
    '    <main>',
    `      <Link href="/users/new">New</Link>`,
    `      <IntlLink href={{ pathname: '/users/[id]', params: { id: 1 } }}>One</IntlLink>`,
    '      <Forms />',
    '    </main>',
    '  )',
    '}',
  ),
  'src/Forms.tsx': lines(
    `'use client'`,
    `import { useMutation } from '@tanstack/react-query'`,
    `import { useRouter } from 'next/navigation'`,
    'export function Forms() {',
    '  const router = useRouter()',
    '  const save = useMutation({',
    `    mutationFn: (v: string) => fetch('/api/save', { method: 'POST', body: v }),`,
    `    onSuccess: () => router.push('/done'),`,
    `    onError: () => router.push('/error'),`,
    '  })',
    '  function goHome() {',
    `    router.replace('/')`,
    '  }',
    '  async function check() {',
    `    const res = await fetch('/api/check')`,
    `    if (!res.ok) router.push('/error')`,
    `    else router.push('/done')`,
    '  }',
    '  async function attempt() {',
    '    try {',
    `      await fetch('/api/attempt', { method: 'POST' })`,
    `      router.push('/done')`,
    '    } catch {',
    `      router.push('/error')`,
    '    }',
    '  }',
    '  return (',
    '    <div>',
    `      <form onSubmit={() => save.mutate('x')} />`,
    '      <button onClick={check}>Check</button>',
    '      <button onClick={attempt}>Attempt</button>',
    `      <button onClick={() => fetch('/api/ping').then(() => router.push('/done')).catch(() => router.push('/error'))}>`,
    '        Ping',
    '      </button>',
    '      <button onClick={goHome}>Home</button>',
    '    </div>',
    '  )',
    '}',
  ),
}

let model: AppModel
beforeAll(() => {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries(FILES)) fs.writeFileSync(`/project/${path}`, text)
  model = scanProject({ root: '/project', fileSystem: fs })
}, 60_000)

const routePath = (nav: Navigation) => model.routes.find((r) => r.id === nav.targetRouteId)?.path
const describeNav = (nav: Navigation) =>
  `${nav.kind} ${urlText(nav.href)} -> ${routePath(nav) ?? '?'} ${nav.trigger.kind}${
    nav.outcome ? ` ${nav.outcome}` : ''
  }`

describe('navigation', () => {
  it('produces a valid model', () => {
    expect(() => AppModelSchema.parse(model)).not.toThrow()
  })

  it('finds links, router calls and redirects with their targets and outcomes', () => {
    expect(model.navigations.map(describeNav)).toEqual([
      // app/page.tsx: a static segment beats `[id]`; next-intl `{ pathname, params }` objects.
      'link /users/new -> /users/new event',
      'link /users/:id -> /users/[id] event',
      // app/users/[id]/page.tsx: a server component redirect.
      'permanent-redirect /users/new -> /users/new server-render',
      // src/Forms.tsx
      'push /done -> /done event success',
      'push /error -> /error event error',
      'replace / -> / event',
      'push /error -> /error event error',
      'push /done -> /done event success',
      'push /done -> /done event success',
      'push /error -> /error event error',
      'push /done -> /done event success',
      'push /error -> /error event error',
    ])
    const intl = model.navigations.find((n) => n.api === 'next-intl')
    expect(intl?.kind).toBe('link')
  })

  it('builds flows with error branches', () => {
    expect(formatFlows(model).split('# Flows')[1]).toMatchInlineSnapshot(`
      "

      ## Forms submit  (/ -> /done)
      1. Forms onSubmit on /
      2. POST /api/save
         on error: push -> /error
      3. push -> /done

      ## Forms click  (/ -> /done)
      1. Forms onClick on /
      2. GET /api/check
         on error: push -> /error
      3. push -> /done

      ## Forms click (2)  (/ -> /done)
      1. Forms onClick on /
      2. POST /api/attempt
         on error: push -> /error
      3. push -> /done

      ## Forms click (3)  (/ -> /done)
      1. Forms onClick on /
      2. GET /api/ping
         on error: push -> /error
      3. push -> /done
      "
    `)
  })
})
