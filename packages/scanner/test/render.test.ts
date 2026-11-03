// Render mode (M38): each page is `static`, `isr`, `dynamic`, `partial` or `unknown`, with the
// reasons. The cases follow what `next build` (16.4) printed for the same pages, with and without
// Cache Components; each is written inline and through imported helpers (.ts and .js).
import { type AppModel, AppModelSchema, type Route, renderReasonLine } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { describe, expect, it } from 'vitest'
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
  'node_modules/next/headers.d.ts': lines(
    'export interface Store { get(name: string): { value: string } | undefined }',
    'export function cookies(): Promise<Store>',
    'export function headers(): Promise<Headers>',
    'export function draftMode(): Promise<{ isEnabled: boolean }>',
  ),
  'node_modules/next/server.d.ts': lines('export function connection(): Promise<void>'),
  'node_modules/next/cache.d.ts': lines(
    'export function unstable_noStore(): void',
    'export function cacheLife(profile: string | { revalidate?: number; expire?: number }): void',
  ),
  'node_modules/next/navigation.d.ts': lines('export function useSearchParams(): URLSearchParams'),
  'src/app/layout.tsx': lines(
    'export default function Root({ children }: { children: unknown }) {',
    '  return <html><body>{children as never}</body></html>',
    '}',
  ),
}

function scan(files: Record<string, string>, exclude?: string[]): AppModel {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries({ ...BASE, ...files })) fs.writeFileSync(`/p/${path}`, text)
  const model = scanProject({ root: '/p', fileSystem: fs, ...(exclude ? { exclude } : {}) })
  expect(() => AppModelSchema.parse(model)).not.toThrow()
  return model
}

function page(model: AppModel, path: string): Route {
  const route = model.routes.find((r) => r.kind === 'page' && r.path === path)
  if (!route) throw new Error(`no page ${path}: ${model.routes.map((r) => r.path).join(', ')}`)
  return route
}

const mode = (model: AppModel, path: string) => page(model, path).render?.mode
const why = (model: AppModel, path: string) => (page(model, path).render?.reasons ?? []).map(renderReasonLine)

const component = (body: string, imports = '', async = true) =>
  lines(imports, `export default ${async ? 'async ' : ''}function Page() {`, body, '  return <p>x</p>', '}')

describe('render mode without Cache Components', () => {
  const model = scan(
    {
      'src/app/page.tsx': component('', '', false),
      'src/app/cookies/page.tsx': component(
        `  const c = await cookies()`,
        `import { cookies } from 'next/headers'`,
      ),
      'src/app/aliased/page.tsx': component(
        `  const h = await requestHeaders()`,
        `import { headers as requestHeaders } from 'next/headers'`,
      ),
      'src/app/draft/page.tsx': component(
        `  const d = await draftMode()`,
        `import { draftMode } from 'next/headers'`,
      ),
      'src/app/conn/page.tsx': component(`  await connection()`, `import { connection } from 'next/server'`),
      'src/app/nostore-call/page.tsx': component(
        `  unstable_noStore()`,
        `import { unstable_noStore } from 'next/cache'`,
      ),
      // Through helpers in other files, .ts and .js.
      'src/lib/session.ts': lines(
        `import { cookies } from 'next/headers'`,
        'export async function session() {',
        `  return (await cookies()).get('sid')?.value`,
        '}',
      ),
      'src/lib/agent.js': lines(
        `import { headers } from 'next/headers'`,
        'export const agent = async () => (await headers()).get("user-agent")',
      ),
      'src/app/helper/page.tsx': component(
        '  const s = await session()',
        `import { session } from '@/lib/session'`,
      ),
      'src/app/helper-js/page.tsx': component(
        '  const a = await agent()',
        `import { agent } from '@/lib/agent'`,
      ),
      // A server component below the page.
      'src/components/Greeting.tsx': lines(
        `import { cookies } from 'next/headers'`,
        'export async function Greeting() {',
        `  const name = (await cookies()).get('name')?.value`,
        '  return <p>{name}</p>',
        '}',
      ),
      'src/app/child/page.tsx': lines(
        `import { Greeting } from '@/components/Greeting'`,
        'export default function Page() {',
        '  return <Greeting />',
        '}',
      ),
      // searchParams: destructured, through `props.`, and in generateMetadata.
      'src/app/search/page.tsx': lines(
        'export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {',
        '  const { q } = await searchParams',
        '  return <p>{q}</p>',
        '}',
      ),
      'src/app/search-props/page.tsx': lines(
        'export default async function Page(props: { searchParams: Promise<{ q?: string }> }) {',
        '  const { q } = await props.searchParams',
        '  return <p>{q}</p>',
        '}',
      ),
      'src/app/search-meta/page.tsx': lines(
        'export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }) {',
        '  return { title: (await searchParams).q }',
        '}',
        'export default function Page() {',
        '  return <p>x</p>',
        '}',
      ),
      // A client component reading search params doesn't make the page dynamic.
      'src/app/client-search/page.tsx': lines(
        `import { Search } from './search'`,
        'export default function Page() {',
        '  return <Search />',
        '}',
      ),
      'src/app/client-search/search.tsx': lines(
        `'use client'`,
        `import { useSearchParams } from 'next/navigation'`,
        'export function Search() {',
        `  return <p>{useSearchParams().get('q')}</p>`,
        '}',
      ),
      // fetch cache options.
      'src/app/fetch-plain/page.tsx': component(`  await fetch('https://api.example.com/a')`),
      'src/app/fetch-nostore/page.tsx': component(
        `  await fetch('https://api.example.com/a', { cache: 'no-store' })`,
      ),
      'src/app/fetch-zero/page.tsx': component(
        `  await fetch('https://api.example.com/a', { next: { revalidate: 0 } })`,
      ),
      'src/app/fetch-reval/page.tsx': component(
        `  await fetch('https://api.example.com/a', { next: { revalidate: 60 } })`,
      ),
      'src/lib/api.ts': lines(
        'const OPTIONS = { next: { revalidate: 300 } } as const',
        'export async function getPosts() {',
        `  return fetch('https://api.example.com/posts', OPTIONS)`,
        '}',
        'export async function getLive(init?: RequestInit) {',
        `  return fetch('https://api.example.com/live', { ...init, cache: 'no-store' })`,
        '}',
      ),
      'src/app/fetch-helper/page.tsx': component(
        '  await getPosts()',
        `import { getPosts } from '@/lib/api'`,
      ),
      'src/app/fetch-helper-live/page.tsx': component(
        '  await getLive()',
        `import { getLive } from '@/lib/api'`,
      ),
      // Segment config.
      'src/app/seg-reval/page.tsx': lines('export const revalidate = 60', component('', '', false)),
      'src/app/seg-zero/page.tsx': lines('export const revalidate = 0', component('', '', false)),
      'src/app/seg-lowest/page.tsx': lines(
        'export const revalidate = 3600',
        component(`  await fetch('https://api.example.com/a', { next: { revalidate: 60 } })`),
      ),
      'src/app/forced/page.tsx': lines(`export const dynamic = 'force-dynamic'`, component('', '', false)),
      'src/app/forced-static/page.tsx': lines(
        `export const dynamic = 'force-static'`,
        component(`  const c = await cookies()`, `import { cookies } from 'next/headers'`),
      ),
      'src/app/as-const/page.tsx': lines(
        `export const dynamic = 'force-dynamic' as const`,
        component('', '', false),
      ),
      'src/app/unread/page.tsx': lines('export const revalidate = 60 * 10', component('', '', false)),
      'src/app/fetch-cache/page.tsx': lines(
        `export const fetchCache = 'force-no-store'`,
        component(`  await fetch('https://api.example.com/a', { next: { revalidate: 60 } })`),
      ),
      'src/app/(dyn)/layout.tsx': lines(
        `export const dynamic = 'force-dynamic'`,
        'export default function L({ children }: { children: unknown }) {',
        '  return <div>{children as never}</div>',
        '}',
      ),
      'src/app/(dyn)/under/page.tsx': component('', '', false),
      // Dynamic segments.
      'src/app/items/[id]/page.tsx': component('', '', false),
      'src/app/posts/[id]/page.tsx': lines(
        `export function generateStaticParams() { return [{ id: '1' }] }`,
        component('', '', false),
      ),
      'src/app/shop/[category]/layout.tsx': lines(
        `export const generateStaticParams = async () => [{ category: 'a' }]`,
        'export default function L({ children }: { children: unknown }) {',
        '  return <div>{children as never}</div>',
        '}',
      ),
      'src/app/shop/[category]/[product]/page.tsx': component('', '', false),
      'src/app/shop/[category]/page.tsx': component('', '', false),
      'src/app/docs/[...slug]/page.tsx': component('', '', false),
      // A server action reading cookies runs on a POST, not while the page renders.
      'src/app/action/page.tsx': lines(
        `import { cookies } from 'next/headers'`,
        'async function save() {',
        `  'use server'`,
        `  ;(await cookies()).get('sid')`,
        '}',
        'export default function Page() {',
        '  return <form action={save}><button>Save</button></form>',
        '}',
      ),
      // A helper in an excluded file might read the request.
      'src/legacy/auth.ts': lines('export async function who() { return "x" }'),
      'src/app/excluded/page.tsx': component('  await who()', `import { who } from '@/legacy/auth'`),
    },
    ['src/legacy/**'],
  )

  const cases: [string, string | undefined][] = [
    ['/', 'static'],
    ['/cookies', 'dynamic'],
    ['/aliased', 'dynamic'],
    ['/draft', 'dynamic'],
    ['/conn', 'dynamic'],
    ['/nostore-call', 'dynamic'],
    ['/helper', 'dynamic'],
    ['/helper-js', 'dynamic'],
    ['/child', 'dynamic'],
    ['/search', 'dynamic'],
    ['/search-props', 'dynamic'],
    ['/search-meta', 'dynamic'],
    ['/client-search', 'static'],
    ['/fetch-plain', 'static'],
    ['/fetch-nostore', 'dynamic'],
    ['/fetch-zero', 'dynamic'],
    ['/fetch-reval', 'isr'],
    ['/fetch-helper', 'isr'],
    ['/fetch-helper-live', 'dynamic'],
    ['/seg-reval', 'isr'],
    ['/seg-zero', 'dynamic'],
    ['/seg-lowest', 'isr'],
    ['/forced', 'dynamic'],
    ['/forced-static', 'static'],
    ['/as-const', 'dynamic'],
    ['/unread', 'unknown'],
    ['/fetch-cache', 'dynamic'],
    ['/under', 'dynamic'],
    ['/items/[id]', 'dynamic'],
    ['/posts/[id]', 'static'],
    ['/shop/[category]', 'static'],
    ['/shop/[category]/[product]', 'dynamic'],
    ['/docs/[...slug]', 'dynamic'],
    ['/action', 'static'],
    ['/excluded', 'unknown'],
  ]
  for (const [path, expected] of cases) {
    it(`labels ${path} ${expected}`, () =>
      expect(mode(model, path), why(model, path).join('\n')).toBe(expected))
  }

  it('says why, and where', () => {
    expect(why(model, '/cookies')).toEqual(['dynamic: calls `cookies()`, which reads the request (page)'])
    expect(why(model, '/aliased')).toEqual(['dynamic: calls `headers()`, which reads the request (page)'])
    expect(why(model, '/child')).toEqual(['dynamic: calls `cookies()`, which reads the request (component)'])
    expect(page(model, '/helper').render?.reasons[0]?.loc).toMatchObject({
      file: 'src/lib/session.ts',
      line: 3,
    })
    expect(why(model, '/fetch-nostore')).toEqual(["dynamic: fetches with `cache: 'no-store'` (page)"])
    expect(why(model, '/under')).toEqual(["dynamic: `export const dynamic = 'force-dynamic'` (layout)"])
    expect(why(model, '/items/[id]')).toEqual([
      'dynamic: has the dynamic segment `[id]` and no `generateStaticParams` (page)',
    ])
    expect(why(model, '/shop/[category]/[product]')[0]).toContain('`[product]`')
    expect(why(model, '/excluded')[0]).toContain('calls `who` from a file the config excludes')
    expect(why(model, '/unread')).toEqual([
      "not sure: the value of `export const revalidate` can't be read (page)",
    ])
  })

  it('takes the lowest ISR time', () => {
    expect(page(model, '/fetch-reval').render?.revalidate).toBe(60)
    expect(page(model, '/fetch-helper').render?.revalidate).toBe(300)
    expect(page(model, '/seg-lowest').render?.revalidate).toBe(60)
  })

  it('lets force-static win over request APIs', () => {
    expect(why(model, '/forced-static')).toEqual([
      "static: `export const dynamic = 'force-static'` (page)",
      'dynamic: calls `cookies()`, which reads the request (page)',
    ])
  })

  it('records no Cache Components flag', () => expect(model.project.cacheComponents).toBeUndefined())
})

describe('render mode with Cache Components', () => {
  const config = lines(
    `const config = { cacheComponents: true, partialPrefetching: true }`,
    'export default config',
  )
  const model = scan({
    'next.config.ts': config,
    'src/app/page.tsx': component('', '', false),
    'src/app/cookies/page.tsx': component(
      `  const c = await cookies()`,
      `import { cookies } from 'next/headers'`,
    ),
    'src/app/uncached/page.tsx': component(`  await fetch('https://api.example.com/a')`),
    'src/app/cached/page.tsx': component(
      `  'use cache'\n  cacheLife('hours')\n  await fetch('https://api.example.com/a')`,
      `import { cacheLife } from 'next/cache'`,
    ),
    'src/app/cached-default/page.tsx': component(`  'use cache'\n  await fetch('https://api.example.com/a')`),
    'src/lib/data.ts': lines(
      `'use cache'`,
      `import { cacheLife } from 'next/cache'`,
      'export async function getPosts() {',
      '  cacheLife({ revalidate: 120 })',
      `  return fetch('https://api.example.com/posts')`,
      '}',
    ),
    'src/lib/data-fn.js': lines(
      'export async function getUsers() {',
      `  'use cache'`,
      `  return fetch('https://api.example.com/users')`,
      '}',
    ),
    'src/app/cached-file/page.tsx': component('  await getPosts()', `import { getPosts } from '@/lib/data'`),
    'src/app/cached-fn/page.tsx': component('  await getUsers()', `import { getUsers } from '@/lib/data-fn'`),
    'src/app/items/[id]/page.tsx': component('', '', false),
    'src/app/posts/[id]/page.tsx': lines(
      `export function generateStaticParams() { return [{ id: '1' }] }`,
      component('', '', false),
    ),
    // Segment config isn't allowed with Cache Components, so it's not read.
    'src/app/seg/page.tsx': lines('export const revalidate = 60', component('', '', false)),
  })

  const cases: [string, string][] = [
    ['/', 'static'],
    ['/cookies', 'partial'],
    ['/uncached', 'partial'],
    ['/cached', 'isr'],
    ['/cached-default', 'isr'],
    ['/cached-file', 'isr'],
    ['/cached-fn', 'isr'],
    ['/items/[id]', 'partial'],
    ['/posts/[id]', 'static'],
    ['/seg', 'static'],
  ]
  for (const [path, expected] of cases) {
    it(`labels ${path} ${expected}`, () =>
      expect(mode(model, path), why(model, path).join('\n')).toBe(expected))
  }

  it('reads cacheLife profiles and objects', () => {
    expect(page(model, '/cached').render?.revalidate).toBe(3600)
    expect(page(model, '/cached-default').render?.revalidate).toBe(900)
    expect(page(model, '/cached-file').render?.revalidate).toBe(120)
    expect(why(model, '/cached')).toEqual(["ISR 1h: caches with `use cache` and `cacheLife('hours')` (page)"])
    expect(why(model, '/uncached')).toEqual(['dynamic: requests data outside `use cache` (`fetch`) (page)'])
  })

  it('records the flag', () => expect(model.project.cacheComponents).toBe(true))
})
