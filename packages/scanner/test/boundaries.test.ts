// Special files and boundaries (M41): what covers each page, the gaps, and its metadata. The cases
// follow what `next build` (16.4.3) did with the same files: a folder's `loading` / `error` cover its
// page and the layouts below it but not its own layout; with Cache Components request data outside
// `<Suspense>` fails the build; slots need a page or `default` for every URL; titles follow
// `title.template` the way Next's `resolveTitle` does.
import { type AppModel, AppModelSchema, type BoundaryGap, type Route } from '@flow-checker/shared'
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
  ),
  'node_modules/next/navigation.d.ts': lines(
    'export function notFound(): never',
    'export function forbidden(): never',
    'export function unauthorized(): never',
  ),
  'src/app/layout.tsx': lines(
    'export default function Root({ children }: { children: unknown }) {',
    '  return <html><body>{children as never}</body></html>',
    '}',
  ),
}

function scan(files: Record<string, string>): AppModel {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries({ ...BASE, ...files })) fs.writeFileSync(`/p/${path}`, text)
  const model = scanProject({ root: '/p', fileSystem: fs })
  expect(() => AppModelSchema.parse(model)).not.toThrow()
  return model
}

function page(model: AppModel, path: string, slot?: string): Route {
  const route = model.routes.find(
    (r) => r.kind === 'page' && r.path === path && r.slot === slot && !r.intercepting,
  )
  if (!route) throw new Error(`no page ${path}: ${model.routes.map((r) => r.path).join(', ')}`)
  return route
}

const gaps = (model: AppModel, path: string, slot?: string) =>
  (page(model, path, slot).boundaries?.gaps ?? []).map(gapText)
const gapText = (g: BoundaryGap) =>
  `${g.kind} ${g.detail ?? ''}${g.in ? ` (${g.in})` : ''}${g.more ? ` +${g.more}` : ''}`.trim()
const items = (model: AppModel, path: string) =>
  (page(model, path).boundaries?.items ?? []).map(
    (i) => `${i.kind}${i.nearest ? '*' : ''} ${i.in}${i.wraps ? ` [${i.wraps.join(', ')}]` : ''}`,
  )

const COOKIES = `import { cookies } from 'next/headers'`
const fetchPage = (extra = '', imports = '') =>
  lines(
    COOKIES,
    imports,
    'export default async function Page() {',
    '  await cookies()',
    `  const r = await fetch('http://api.test/items', { cache: 'no-store' })`,
    extra,
    '  return <p>{r.status}</p>',
    '}',
  )
const simple = (name = 'Page') => lines(`export default function ${name}() {`, '  return <p>x</p>', '}')
const loading = lines('export default function Loading() {', '  return <p>…</p>', '}')
const error = lines(`'use client'`, 'export default function Failed() {', '  return <p>failed</p>', '}')

describe('boundaries without Cache Components', () => {
  const model = scan({
    // Rendered per request, nothing to show meanwhile or catch a failure.
    'src/app/plain/page.tsx': fetchPage(),
    // `loading` and `error` in the page's folder cover it.
    'src/app/covered/page.tsx': fetchPage(),
    'src/app/covered/loading.tsx': loading,
    'src/app/covered/error.tsx': error,
    // ...but not the layout in their own folder.
    'src/app/own/layout.tsx': lines(
      `export default async function OwnLayout({ children }: { children: unknown }) {`,
      `  const r = await fetch('http://api.test/menu', { cache: 'no-store' })`,
      '  return <div>{children as never}</div>',
      '}',
    ),
    'src/app/own/loading.tsx': loading,
    'src/app/own/error.tsx': error,
    'src/app/own/page.tsx': lines(
      COOKIES,
      'export default async function Own() {',
      '  await cookies()',
      '  return <p>x</p>',
      '}',
    ),
    // A parent folder's files cover the layouts below it.
    'src/app/parent/loading.tsx': loading,
    'src/app/parent/error.tsx': error,
    'src/app/parent/child/layout.tsx': lines(
      `export default async function ChildLayout({ children }: { children: unknown }) {`,
      `  const r = await fetch('http://api.test/menu', { cache: 'no-store' })`,
      '  return <div>{children as never}</div>',
      '}',
    ),
    'src/app/parent/child/page.tsx': fetchPage(),
    // `<Suspense>` and an error boundary around the part that fetches; the fallback isn't inside.
    'src/app/wrapped/page.tsx': lines(
      COOKIES,
      `import { Suspense as Wait } from 'react'`,
      `import { ErrorBoundary } from 'react-error-boundary'`,
      `import { Data } from '@/components/data'`,
      `import { Spinner } from '@/components/spinner'`,
      'export default async function Wrapped() {',
      '  await cookies()',
      '  return (',
      '    <Wait fallback={<Spinner />}>',
      '      <ErrorBoundary fallback={<p>!</p>}>',
      '        <Data />',
      '      </ErrorBoundary>',
      '    </Wait>',
      '  )',
      '}',
    ),
    'src/components/data.tsx': lines(
      'export async function Data() {',
      `  const r = await fetch('http://api.test/data', { cache: 'no-store' })`,
      '  return <p>{r.status}</p>',
      '}',
    ),
    'src/components/spinner.js': lines(
      'export async function Spinner() {',
      `  const r = await fetch('http://api.test/spin', { cache: 'no-store' })`,
      '  return <p>{r.status}</p>',
      '}',
    ),
    // A layout that wraps `children` in `<Suspense>` and a class error boundary.
    'src/app/shell/layout.tsx': lines(
      `import * as React from 'react'`,
      `import { Catch } from '@/components/catch'`,
      'export default function Shell({ children }: { children: React.ReactNode }) {',
      '  return <React.Suspense fallback={null}><Catch>{children}</Catch></React.Suspense>',
      '}',
    ),
    'src/app/shell/page.tsx': fetchPage(),
    'src/components/catch.tsx': lines(
      `'use client'`,
      `import { Component, type ReactNode } from 'react'`,
      'export class Catch extends Component<{ children: ReactNode }, { failed: boolean }> {',
      '  state = { failed: false }',
      '  static getDerivedStateFromError() { return { failed: true } }',
      '  render() { return this.state.failed ? null : this.props.children }',
      '}',
    ),
    // Rendered inside `<Suspense>` once and outside once: not covered.
    'src/app/twice/page.tsx': lines(
      COOKIES,
      `import { Suspense } from 'react'`,
      `import { Data } from '@/components/data'`,
      'export default async function Twice() {',
      '  await cookies()',
      '  return <><Suspense><Data /></Suspense><Data /></>',
      '}',
    ),
    // Cached data, and a static page, wait for nothing per request.
    'src/app/cached/page.tsx': lines(
      COOKIES,
      'export default async function Cached() {',
      '  await cookies()',
      `  const r = await fetch('http://api.test/items', { cache: 'force-cache' })`,
      `  const s = await fetch('http://api.test/stats', { next: { revalidate: 60 } })`,
      '  return <p>{r.status}{s.status}</p>',
      '}',
    ),
    'src/app/static/page.tsx': lines(
      'export default async function Static() {',
      `  const r = await fetch('http://api.test/items')`,
      '  return <p>{r.status}</p>',
      '}',
    ),
    // Two uncached requests: one gap, with the other counted.
    'src/app/two/page.tsx': fetchPage(`  await fetch('http://api.test/more', { cache: 'no-store' })`),
  })

  it('flags a page rendered per request with nothing around its request', () => {
    expect(gaps(model, '/plain')).toEqual(['no-fallback fetch (page)', 'no-error-boundary fetch (page)'])
  })

  it('counts the folder files for its page, marked as the ones Next shows', () => {
    expect(gaps(model, '/covered')).toEqual([])
    expect(items(model, '/covered')).toEqual(['loading* segment', 'error* segment'])
  })

  it('does not count a folder file for the layout in the same folder', () => {
    expect(gaps(model, '/own')).toEqual(['no-fallback fetch (layout)', 'no-error-boundary fetch (layout)'])
  })

  it('counts a parent folder file for the layouts below it', () => {
    expect(gaps(model, '/parent/child')).toEqual([])
  })

  it('finds `<Suspense>` (also renamed) and react-error-boundary, and leaves the fallback outside', () => {
    // `Data` is covered; the `Spinner` in `fallback` fetches outside both boundaries.
    expect(gaps(model, '/wrapped')).toEqual([
      'no-fallback fetch (component)',
      'no-error-boundary fetch (component)',
    ])
    expect(page(model, '/wrapped').boundaries?.gaps[0]?.loc?.file).toBe('src/components/spinner.js')
    expect(items(model, '/wrapped')).toEqual([
      'suspense page [ErrorBoundary, Data]',
      'error-boundary page [Data]',
    ])
  })

  it("counts a layout's `<Suspense>` and class error boundary around `children`", () => {
    expect(gaps(model, '/shell')).toEqual([])
    expect(items(model, '/shell')).toEqual([
      'suspense layout [Catch, children]',
      'error-boundary layout [children]',
    ])
  })

  it('needs every place a component is rendered to be inside', () => {
    expect(gaps(model, '/twice')).toEqual([
      'no-fallback fetch (component)',
      'no-error-boundary fetch (component)',
    ])
  })

  it('leaves out cached data and static pages', () => {
    expect(gaps(model, '/cached')).toEqual([])
    expect(page(model, '/static').render?.mode).toBe('static')
    expect(gaps(model, '/static')).toEqual([])
  })

  it('reports one gap per page, with the count of the others', () => {
    expect(gaps(model, '/two')).toEqual(['no-fallback fetch (page) +1', 'no-error-boundary fetch (page) +1'])
  })

  it('counts `global-error` for every page, the root layout included', () => {
    const rootFetch = lines(
      COOKIES,
      'export default async function Root({ children }: { children: unknown }) {',
      '  await cookies()',
      `  const r = await fetch('http://api.test/nav', { cache: 'no-store' })`,
      '  return <html><body data-s={r.status}>{children as never}</body></html>',
      '}',
    )
    const withGlobal = scan({
      'src/app/layout.tsx': rootFetch,
      'src/app/plain/page.tsx': fetchPage(),
      'src/app/global-error.tsx': error,
    })
    expect(gaps(withGlobal, '/plain')).toEqual(['no-fallback fetch (layout) +1'])
    expect(items(withGlobal, '/plain')).toEqual(['global-error* segment'])
    const without = scan({ 'src/app/layout.tsx': rootFetch, 'src/app/plain/page.tsx': fetchPage() })
    expect(gaps(without, '/plain')).toEqual([
      'no-fallback fetch (layout) +1',
      'no-error-boundary fetch (layout) +1',
    ])
  })
})

describe('not-found, forbidden and unauthorized', () => {
  const nav = `import { forbidden, notFound, unauthorized } from 'next/navigation'`
  const model = scan({
    'src/app/missing/[id]/page.tsx': lines(
      nav,
      'export default async function Item({ params }: { params: Promise<{ id: string }> }) {',
      '  const { id } = await params',
      `  if (id === '0') notFound()`,
      '  return <p>{id}</p>',
      '}',
    ),
    'src/app/found/[id]/page.tsx': lines(
      nav,
      'export default async function Item({ params }: { params: Promise<{ id: string }> }) {',
      '  const { id } = await params',
      `  if (id === '0') notFound()`,
      '  return <p>{id}</p>',
      '}',
    ),
    'src/app/found/not-found.tsx': simple('NotFound'),
    // In a layout, a `not-found` in the same folder doesn't catch it; one in a parent folder does.
    'src/app/shop/layout.tsx': lines(
      nav,
      `import { check } from '@/lib/check'`,
      'export default function Shop({ children }: { children: unknown }) {',
      '  check()',
      '  return <div>{children as never}</div>',
      '}',
    ),
    'src/lib/check.js': lines(nav, 'export function check() {', `  if (Math.random() > 2) notFound()`, '}'),
    'src/app/shop/not-found.tsx': simple('NotFound'),
    'src/app/shop/page.tsx': simple(),
    'src/app/outer/not-found.tsx': simple('NotFound'),
    'src/app/outer/inner/layout.tsx': lines(
      nav,
      'export default function Inner({ children }: { children: unknown }) {',
      `  if (Math.random() > 2) notFound()`,
      '  return <div>{children as never}</div>',
      '}',
    ),
    'src/app/outer/inner/page.tsx': simple(),
    'src/app/admin/page.tsx': lines(
      nav,
      COOKIES,
      'export default async function Admin() {',
      `  const role = (await cookies()).get('role')?.value`,
      '  if (!role) unauthorized()',
      `  if (role !== 'admin') forbidden()`,
      '  return <p>admin</p>',
      '}',
    ),
    'src/app/admin/unauthorized.tsx': simple('Unauthorized'),
  })

  it('flags `notFound()` with no `not-found` file above it', () => {
    expect(gaps(model, '/missing/[id]')).toEqual(['no-not-found notFound (page)'])
    expect(page(model, '/missing/[id]').boundaries?.gaps[0]?.file).toBe('not-found')
    expect(gaps(model, '/found/[id]')).toEqual([])
  })

  it('needs the file above a layout, not beside it (through a .js helper)', () => {
    expect(gaps(model, '/shop')).toEqual(['no-not-found notFound (layout)'])
    expect(gaps(model, '/outer/inner')).toEqual([])
  })

  it('checks `forbidden()` and `unauthorized()` against their own files', () => {
    expect(gaps(model, '/admin')).toEqual(['no-not-found forbidden (page)'])
  })
})

describe('parallel and intercepting routes', () => {
  const twoSlots = lines(
    'export default function L({ children, modal }: { children: unknown; modal: unknown }) {',
    '  return <div>{children as never}{modal as never}</div>',
    '}',
  )
  const side = lines(
    'export default function L({ children, side }: { children: unknown; side: unknown }) {',
    '  return <div>{children as never}{side as never}</div>',
    '}',
  )
  const model = scan({
    // A slot with no default and no page for `/nodefault`.
    'src/app/nodefault/layout.tsx': twoSlots,
    'src/app/nodefault/page.tsx': simple(),
    'src/app/nodefault/@modal/(.)photo/[id]/page.tsx': simple('Modal'),
    'src/app/nodefault/photo/[id]/page.tsx': simple('Photo'),
    // The usual modal: a default that renders nothing, and a canonical page.
    'src/app/gallery/layout.tsx': twoSlots,
    'src/app/gallery/page.tsx': simple(),
    'src/app/gallery/@modal/default.tsx': lines('export default function D() {', '  return null', '}'),
    'src/app/gallery/@modal/(.)photo/[id]/page.tsx': simple('Modal'),
    'src/app/gallery/photo/[id]/page.tsx': simple('Photo'),
    // A slot page for `/split`, a children page for `/split/sub` with nothing in the slot, and a slot
    // page for `/split/extra` with nothing in `children`.
    'src/app/split/layout.tsx': side,
    'src/app/split/page.tsx': simple(),
    'src/app/split/@side/page.tsx': simple('Side'),
    'src/app/split/sub/page.tsx': simple('Sub'),
    'src/app/split/@side/extra/page.tsx': simple('Extra'),
    // An intercepting route with no plain page at its URL.
    'src/app/feed/layout.tsx': twoSlots,
    'src/app/feed/page.tsx': simple(),
    'src/app/feed/@modal/default.tsx': lines('export default function D() {', '  return null', '}'),
    'src/app/feed/@modal/(..)post/[id]/page.tsx': simple('PostModal'),
  })

  it('flags each layout slot with no page and no default for the URL', () => {
    expect(gaps(model, '/nodefault')).toEqual(['slot-no-match @modal (layout)'])
    expect(gaps(model, '/nodefault/photo/[id]')).toEqual(['slot-no-match @modal (layout)'])
    expect(page(model, '/nodefault').boundaries?.gaps[0]?.dir).toBe('src/app/nodefault/@modal')
    expect(gaps(model, '/gallery')).toEqual([])
    expect(gaps(model, '/gallery/photo/[id]')).toEqual([])
  })

  it('checks `children` for pages in a slot, and slots for pages in `children`', () => {
    expect(gaps(model, '/split')).toEqual([])
    expect(gaps(model, '/split', 'side')).toEqual([])
    expect(gaps(model, '/split/sub')).toEqual(['slot-no-match @side (layout)'])
    expect(gaps(model, '/split/extra', 'side')).toEqual(['slot-no-match children (layout)'])
  })

  it('flags an intercepting route with no plain page at its URL', () => {
    const intercepting = (path: string) =>
      model.routes.find((r) => r.intercepting && r.path === path)?.boundaries?.gaps.map(gapText)
    expect(intercepting('/post/[id]')).toEqual(['no-canonical /post/[id] (page)'])
    expect(intercepting('/gallery/photo/[id]')).toEqual([])
  })
})

describe('boundaries with Cache Components', () => {
  const model = scan({
    'next.config.ts': 'export default { cacheComponents: true }\n',
    'src/app/blocking/page.tsx': lines(
      COOKIES,
      'export default async function P() {',
      '  await cookies()',
      '  return <p>x</p>',
      '}',
    ),
    'src/app/loaded/page.tsx': lines(
      COOKIES,
      'export default async function P() {',
      '  await cookies()',
      '  return <p>x</p>',
      '}',
    ),
    'src/app/loaded/loading.tsx': loading,
    'src/app/own/layout.tsx': lines(
      COOKIES,
      'export default async function L({ children }: { children: unknown }) {',
      '  await cookies()',
      '  return <div>{children as never}</div>',
      '}',
    ),
    'src/app/own/loading.tsx': loading,
    'src/app/own/page.tsx': simple(),
    'src/app/streamed/page.tsx': lines(
      COOKIES,
      `import { Suspense } from 'react'`,
      'async function Inner() {',
      '  await cookies()',
      `  const r = await fetch('http://api.test/x')`,
      '  return <p>{r.status}</p>',
      '}',
      'export default function P() {',
      '  return <Suspense fallback={null}><Inner /></Suspense>',
      '}',
    ),
    'src/app/uncached/page.tsx': lines(
      'export default async function P() {',
      `  const r = await fetch('http://api.test/x')`,
      '  return <p>{r.status}</p>',
      '}',
    ),
    'src/app/allowed/page.tsx': lines(
      COOKIES,
      'export const instant = false',
      'export default async function P() {',
      '  await cookies()',
      '  return <p>x</p>',
      '}',
    ),
    'src/app/search/page.tsx': lines(
      'export default async function P(props: { searchParams: Promise<{ q?: string }> }) {',
      '  const { q } = await props.searchParams',
      '  return <p>{q}</p>',
      '}',
    ),
    'src/app/passed/[id]/page.tsx': lines(
      `import { Suspense } from 'react'`,
      `import { Detail } from '@/components/detail'`,
      'export default function P({ params }: { params: Promise<{ id: string }> }) {',
      '  return <Suspense fallback={null}><Detail params={params} /></Suspense>',
      '}',
    ),
    'src/components/detail.tsx': lines(
      'export async function Detail({ params }: { params: Promise<{ id: string }> }) {',
      '  const { id } = await params',
      '  return <p>{id}</p>',
      '}',
    ),
    'src/app/awaited/[id]/page.tsx': lines(
      'export default async function P({ params }: { params: Promise<{ id: string }> }) {',
      '  const { id } = await params',
      '  return <p>{id}</p>',
      '}',
    ),
    'src/app/listed/[id]/page.tsx': lines(
      `export function generateStaticParams() { return [{ id: '1' }] }`,
      'export default async function P({ params }: { params: Promise<{ id: string }> }) {',
      '  const { id } = await params',
      '  return <p>{id}</p>',
      '}',
    ),
  })

  it('fails the build for request data outside `<Suspense>`', () => {
    expect(gaps(model, '/blocking')).toEqual(['blocking-route cookies (page)'])
    expect(gaps(model, '/uncached')).toEqual([
      'blocking-route fetch (page)',
      'no-error-boundary fetch (page)',
    ])
  })

  it('counts `loading` for its page but not for the layout beside it', () => {
    expect(gaps(model, '/loaded')).toEqual([])
    expect(gaps(model, '/own')).toEqual(['blocking-route cookies (layout)'])
  })

  it('counts `<Suspense>` around the component that reads', () => {
    expect(gaps(model, '/streamed')).toEqual(['no-error-boundary fetch (component)'])
  })

  it('lets `instant = false` block, and renders the page per request', () => {
    expect(gaps(model, '/allowed')).toEqual([])
    expect(page(model, '/allowed').render?.mode).toBe('dynamic')
  })

  it('flags awaited `searchParams` and `params`, not params handed on', () => {
    expect(gaps(model, '/search')).toEqual(['blocking-route searchParams (page)'])
    expect(gaps(model, '/awaited/[id]')).toEqual(['blocking-route params (page)'])
    expect(gaps(model, '/passed/[id]')).toEqual([])
    expect(gaps(model, '/listed/[id]')).toEqual([])
  })
})

describe('metadata', () => {
  const model = scan({
    'src/app/layout.tsx': lines(
      `const SITE = 'Shop'`,
      `export const metadata = { title: { template: '%s | Shop', default: SITE }, description: 'x' }`,
      'export default function Root({ children }: { children: unknown }) {',
      '  return <html><body>{children as never}</body></html>',
      '}',
    ),
    'src/app/page.tsx': simple(),
    'src/app/about/page.tsx': lines(`export const metadata = { title: 'About' }`, simple()),
    'src/app/post/[slug]/page.js': lines(
      'export async function generateMetadata({ params }) {',
      '  const { slug } = await params',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: source text of the fixture
      '  return { title: `Post ${slug}`, openGraph: { title: slug } }',
      '}',
      'export default function Post() {',
      '  return <p>x</p>',
      '}',
    ),
    // The layout beside the page doesn't pass its template to it; a plain title resets the template.
    'src/app/docs/layout.tsx': lines(
      `export const metadata = { title: { template: '%s · Docs', default: 'Docs' } }`,
      'export default function Docs({ children }: { children: unknown }) {',
      '  return <div>{children as never}</div>',
      '}',
    ),
    'src/app/docs/page.tsx': lines(`export const metadata = { title: 'Index' }`, simple()),
    'src/app/docs/guide/page.tsx': lines(`export const metadata = { title: 'Guide' }`, simple()),
    'src/app/plain/layout.tsx': lines(
      `export const metadata = { title: 'Plain' }`,
      'export default function Plain({ children }: { children: unknown }) {',
      '  return <div>{children as never}</div>',
      '}',
    ),
    'src/app/plain/inner/page.tsx': lines(`export const metadata = { title: 'Inner' }`, simple()),
    'src/app/absolute/page.tsx': lines(`export const metadata = { title: { absolute: 'Alone' } }`, simple()),
    'src/app/unread/page.tsx': lines(
      `import { titleFor } from '@/lib/title'`,
      `export const metadata = { title: titleFor('x') }`,
      simple(),
    ),
    'src/lib/title.ts': 'export const titleFor = (s: string) => s\n',
    'src/app/spread/page.tsx': lines(
      `const base = { title: 'B' }`,
      'export const metadata = { ...base }',
      simple(),
    ),
  })
  const meta = (path: string) => page(model, path).metadata

  it('uses the layout default when the page sets no title', () => {
    expect(meta('/')?.title).toBe('Shop')
    expect(meta('/')?.sources).toEqual([
      expect.objectContaining({
        kind: 'metadata',
        in: 'layout',
        title: 'Shop',
        template: '%s | Shop',
        fields: ['title', 'description'],
      }),
    ])
  })

  it('puts page titles into the template above, from `metadata` and `generateMetadata` (.js)', () => {
    expect(meta('/about')?.title).toBe('About | Shop')
    expect(meta('/post/[slug]')?.title).toBe('Post {slug} | Shop')
    expect(meta('/post/[slug]')?.sources.at(-1)).toEqual(
      expect.objectContaining({ kind: 'generateMetadata', in: 'page', fields: ['title', 'openGraph'] }),
    )
  })

  it("skips the template of the layout in the page's own folder", () => {
    expect(meta('/docs')?.title).toBe('Index | Shop')
    expect(meta('/docs/guide')?.title).toBe('Guide · Docs')
  })

  it('resets the template after a plain title, and keeps absolute titles', () => {
    expect(meta('/plain/inner')?.title).toBe('Inner')
    expect(meta('/absolute')?.title).toBe('Alone')
  })

  it("says when the title can't be read", () => {
    expect(meta('/unread')).toEqual(expect.objectContaining({ titleUnread: true }))
    expect(meta('/unread')?.title).toBeUndefined()
    expect(meta('/spread')).toEqual(expect.objectContaining({ titleUnread: true }))
    expect(meta('/spread')?.sources.at(-1)?.fields).toBeUndefined()
  })
})
