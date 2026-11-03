// Server cache map (M39): cached data (`fetch` cache options, `use cache`, `unstable_cache`), the
// calls that revalidate it, the pages each refreshes, and the flags for tags only one side has.
// Each pattern is written inline and through imported helpers (.ts and .js), in pages and layouts.
import {
  type AppModel,
  AppModelSchema,
  type CacheEntry,
  type CacheInvalidation,
  cacheKeyText,
  cacheOf,
} from '@flow-checker/shared'
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
  'node_modules/next/cache.d.ts': lines(
    'export function revalidateTag(tag: string, profile?: string | { expire?: number }): void',
    'export function updateTag(tag: string): void',
    "export function revalidatePath(path: string, type?: 'page' | 'layout'): void",
    'export function cacheTag(...tags: string[]): void',
    'export function unstable_cacheTag(...tags: string[]): void',
    'export function cacheLife(profile: string | { revalidate?: number; expire?: number }): void',
    'export function unstable_cache<T extends (...args: any[]) => Promise<any>>(',
    '  fn: T, keyParts?: string[], options?: { tags?: string[]; revalidate?: number | false }): T',
  ),
  'node_modules/react/package.json': JSON.stringify({ name: 'react' }),
  'node_modules/react/index.d.ts': lines('export function cache<T extends Function>(fn: T): T'),
  'src/app/layout.tsx': lines(
    'export default function Root({ children }: { children: unknown }) {',
    '  return <html><body>{children as never}</body></html>',
    '}',
  ),
  'src/lib/db.ts': lines(
    'export const db = { posts: { list: async () => [] as { id: string }[], get: async (id: string) => ({ id }) } }',
  ),
}

function scan(files: Record<string, string>): AppModel {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries({ ...BASE, ...files })) fs.writeFileSync(`/p/${path}`, text)
  const model = scanProject({ root: '/p', fileSystem: fs })
  expect(() => AppModelSchema.parse(model)).not.toThrow()
  return model
}

const pathOf = (model: AppModel, id: string) => model.routes.find((r) => r.id === id)?.path ?? id

/** Each entry as `kind name [tags] -> pages`. */
function entries(model: AppModel): string[] {
  return cacheOf(model).entries.map(
    (e) =>
      `${e.kind} ${e.name} [${e.tags.map(cacheKeyText).join(', ')}] -> ${[...e.pageIds, ...e.handlerIds]
        .map((id) => pathOf(model, id))
        .join(', ')}`,
  )
}

/** Each invalidation as `api(key) -> entries | pages`. */
function invalidations(model: AppModel): string[] {
  const names = new Map(cacheOf(model).entries.map((e) => [e.id, e.name]))
  return cacheOf(model).invalidations.map((i) => {
    const key = i.tag ?? i.path
    return `${i.api}(${key ? cacheKeyText(key) : ''}) -> ${i.entryIds.map((id) => names.get(id)).join(', ')} | ${[
      ...i.pageIds,
      ...i.handlerIds,
    ]
      .map((id) => pathOf(model, id))
      .join(', ')}`
  })
}

function flags(model: AppModel): string[] {
  const map = cacheOf(model)
  const text = (on: CacheEntry | CacheInvalidation) =>
    'api' in on
      ? `${on.api}(${cacheKeyText(on.tag ?? on.path ?? { text: '', confidence: 'unknown' })})`
      : `${on.kind} ${on.name}`
  return [
    ...map.invalidations.flatMap((i) => i.flags.map((f) => `${f.kind}: ${text(i)}`)),
    ...map.entries.flatMap((e) => e.flags.map((f) => `${f.kind}: ${text(e)}`)),
  ]
}

describe('fetch cache options', () => {
  it('reads `next.tags`, `next.revalidate` and `cache` on a fetch in a page', () => {
    const model = scan({
      'src/app/posts/page.tsx': lines(
        'export default async function Page() {',
        "  const posts = await fetch('https://api.test/posts', { next: { tags: ['posts'], revalidate: 60 } })",
        "  const tags = await fetch('https://api.test/tags', { cache: 'force-cache' })",
        "  const live = await fetch('https://api.test/live', { cache: 'no-store' })",
        '  return <p>{String(posts && tags && live)}</p>',
        '}',
      ),
    })
    expect(entries(model)).toEqual([
      'fetch https://api.test/posts [posts] -> /posts',
      'fetch https://api.test/tags [] -> /posts',
    ])
    const [posts, tags] = cacheOf(model).entries
    expect(posts?.revalidate).toBe(60)
    expect(tags?.cache).toBe('force-cache')
    expect(posts?.siteIds).toHaveLength(1)
  })

  it.each(['ts', 'js'])('reads tags through an imported .%s helper, per caller', (ext) => {
    const model = scan({
      [`src/lib/api.${ext}`]: lines(
        'export async function getPost(id) {',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source text of the scanned file
        "  const res = await fetch(`https://api.test/posts/${id}`, { next: { tags: ['posts', `post-${id}`] } })",
        '  return res.json()',
        '}',
      ),
      'src/app/posts/[id]/page.tsx': lines(
        "import { getPost } from '@/lib/api'",
        'export default async function Page({ params }: { params: Promise<{ id: string }> }) {',
        '  const { id } = await params',
        '  return <p>{(await getPost(id)).id}</p>',
        '}',
      ),
      'src/app/featured/page.tsx': lines(
        "import { getPost } from '@/lib/api'",
        "export default async function Page() { return <p>{(await getPost('1')).id}</p> }",
      ),
    })
    expect(entries(model)).toEqual([
      'fetch https://api.test/posts/:id [posts, post-{id}] -> /featured, /posts/[id]',
    ])
    expect(cacheOf(model).entries[0]?.siteIds).toHaveLength(2)
  })

  it('leaves out client fetches: the browser has no server cache', () => {
    const model = scan({
      'src/app/page.tsx': lines(
        "'use client'",
        "import { useEffect } from 'react'",
        'export default function Page() {',
        "  useEffect(() => { fetch('/api/x', { next: { tags: ['x'] } }) }, [])",
        '  return null',
        '}',
      ),
      'node_modules/react/index.d.ts': lines(
        'export function cache<T extends Function>(fn: T): T',
        'export function useEffect(fn: () => void, deps?: unknown[]): void',
      ),
    })
    expect(model.cache).toBeUndefined()
  })
})

describe('use cache', () => {
  it('finds a cached function with `cacheTag` and `cacheLife` that only reads a database', () => {
    const model = scan({
      'src/lib/posts.ts': lines(
        "import { cacheLife, cacheTag } from 'next/cache'",
        "import { db } from './db'",
        'export async function listPosts() {',
        "  'use cache'",
        "  cacheLife('hours')",
        "  cacheTag('posts')",
        '  return db.posts.list()',
        '}',
      ),
      'src/app/posts/page.tsx': lines(
        "import { listPosts } from '@/lib/posts'",
        'export default async function Page() { return <p>{(await listPosts()).length}</p> }',
      ),
    })
    expect(entries(model)).toEqual(['use-cache listPosts [posts] -> /posts'])
    const [entry] = cacheOf(model).entries
    expect(entry).toMatchObject({ directive: 'use cache', revalidate: 3600, life: "cacheLife('hours')" })
  })

  it('finds every function of a `use cache` file, through a helper (.js)', () => {
    const model = scan({
      'src/lib/data.js': lines(
        "'use cache'",
        "import { cacheTag } from 'next/cache'",
        "import { db } from './db'",
        'export async function getPost(id) {',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source text of the scanned file
        '  cacheTag(`post-${id}`)',
        '  return db.posts.get(id)',
        '}',
      ),
      'src/lib/view.ts': lines(
        "import { getPost } from './data'",
        'export async function postTitle(id: string) { return (await getPost(id)).id }',
      ),
      'src/app/posts/[id]/page.tsx': lines(
        "import { postTitle } from '@/lib/view'",
        "export default async function Page() { return <p>{await postTitle('1')}</p> }",
      ),
    })
    expect(entries(model)).toEqual(['use-cache getPost [post-{id}] -> /posts/[id]'])
    expect(cacheOf(model).entries[0]).toMatchObject({ inFile: true, revalidate: 900 })
  })

  it('finds a cached component in a layout, for every page below it', () => {
    const model = scan({
      'src/app/(shop)/layout.tsx': lines(
        "import { Nav } from './nav'",
        'export default function Shop({ children }: { children: unknown }) { return <div><Nav />{children as never}</div> }',
      ),
      'src/app/(shop)/nav.tsx': lines(
        "import { cacheTag } from 'next/cache'",
        'export async function Nav() {',
        "  'use cache: remote'",
        "  cacheTag('nav')",
        "  const res = await fetch('https://api.test/nav')",
        '  return <nav>{String(res.ok)}</nav>',
        '}',
      ),
      'src/app/(shop)/products/page.tsx': 'export default function Page() { return <p /> }\n',
      'src/app/(shop)/cart/page.tsx': 'export default function Page() { return <p /> }\n',
      'src/app/about/page.tsx': 'export default function Page() { return <p /> }\n',
    })
    expect(entries(model)).toEqual(['use-cache Nav [nav] -> /cart, /products'])
    expect(cacheOf(model).entries[0]).toMatchObject({ directive: 'use cache: remote' })
    expect(cacheOf(model).entries[0]?.siteIds).toHaveLength(1)
  })

  it('finds a page that is cached itself, with the Next 15 `unstable_cacheTag`', () => {
    const model = scan({
      'src/app/page.tsx': lines(
        "import { unstable_cacheTag as tag } from 'next/cache'",
        'export default async function Home() {',
        "  'use cache'",
        "  tag('home', 'posts')",
        '  return <p />',
        '}',
      ),
    })
    expect(entries(model)).toEqual(['use-cache Home [home, posts] -> /'])
  })
})

describe('unstable_cache', () => {
  it('finds a wrapped function, its tags and `revalidate`', () => {
    const model = scan({
      'src/lib/users.ts': lines(
        "import { unstable_cache } from 'next/cache'",
        "import { db } from './db'",
        "const TAGS = ['users']",
        "export const getUsers = unstable_cache(async () => db.posts.list(), ['users'], { tags: TAGS, revalidate: 120 })",
        'async function load(id: string) { return db.posts.get(id) }',
        "export const getUser = unstable_cache(load, ['user'], { tags: ['users', 'user'] })",
      ),
      'src/app/users/page.tsx': lines(
        "import { getUser, getUsers } from '@/lib/users'",
        "export default async function Page() { return <p>{(await getUsers()).length}{(await getUser('1')).id}</p> }",
      ),
    })
    expect(entries(model)).toEqual([
      'unstable-cache getUsers [users] -> /users',
      'unstable-cache getUser [users, user] -> /users',
    ])
    expect(cacheOf(model).entries[0]?.revalidate).toBe(120)
  })

  it('finds `unstable_cache` written inline in a page, and a fetch inside it', () => {
    const model = scan({
      'src/app/page.tsx': lines(
        "import { unstable_cache } from 'next/cache'",
        'export default async function Page() {',
        "  const get = unstable_cache(async () => (await fetch('https://api.test/stats')).json(), ['stats'], { tags: ['stats'] })",
        '  return <p>{String(await get())}</p>',
        '}',
      ),
    })
    expect(entries(model)).toEqual(['unstable-cache get [stats] -> /'])
    expect(cacheOf(model).entries[0]?.siteIds).toHaveLength(1)
  })

  it("follows React's `cache()` to a tagged fetch", () => {
    const model = scan({
      'src/lib/api.ts': lines(
        "import { cache } from 'react'",
        "export const getMe = cache(async () => (await fetch('https://api.test/me', { next: { tags: ['me'] } })).json())",
      ),
      'src/app/page.tsx': lines(
        "import { getMe } from '@/lib/api'",
        'export default async function Page() { return <p>{String(await getMe())}</p> }',
      ),
    })
    expect(entries(model)).toEqual(['fetch https://api.test/me [me] -> /'])
  })
})

describe('revalidation', () => {
  const posts = {
    'src/lib/posts.ts': lines(
      "import { cacheTag } from 'next/cache'",
      "import { db } from './db'",
      'export async function listPosts() {',
      "  'use cache'",
      "  cacheTag('posts')",
      '  return db.posts.list()',
      '}',
      'export async function getPost(id: string) {',
      "  'use cache'",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: source text of the scanned file
      '  cacheTag(`post-${id}`)',
      '  return db.posts.get(id)',
      '}',
    ),
    'src/app/posts/page.tsx': lines(
      "import { listPosts } from '@/lib/posts'",
      "import { createPost } from '@/actions/posts'",
      'export default async function Page() {',
      '  const list = await listPosts()',
      '  return <form action={createPost}>{list.length}</form>',
      '}',
    ),
    'src/app/posts/[id]/page.tsx': lines(
      "import { getPost } from '@/lib/posts'",
      'export default async function Page({ params }: { params: Promise<{ id: string }> }) {',
      '  const { id } = await params',
      '  return <p>{(await getPost(id)).id}</p>',
      '}',
    ),
  }

  it('links tags in a server action to the entries and pages, exact and pattern tags', () => {
    const model = scan({
      ...posts,
      'src/actions/posts.ts': lines(
        "'use server'",
        "import { revalidateTag, updateTag } from 'next/cache'",
        'export async function createPost(form: FormData) {',
        "  const id = String(form.get('id'))",
        "  revalidateTag('posts', 'max')",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source text of the scanned file
        '  updateTag(`post-${id}`)',
        "  revalidateTag('post-1', { expire: 0 })",
        '}',
      ),
    })
    expect(invalidations(model)).toEqual([
      'revalidateTag(posts) -> listPosts | /posts',
      'updateTag(post-{id}) -> getPost | /posts/[id]',
      'revalidateTag(post-1) -> getPost | /posts/[id]',
    ])
    expect(cacheOf(model).invalidations[0]).toMatchObject({
      origin: 'server-action',
      serverAction: { name: 'createPost' },
      profile: "'max'",
    })
    expect(flags(model)).toEqual([])
  })

  it.each(['ts', 'js'])('follows a .%s helper the action calls, and a route handler', (ext) => {
    const model = scan({
      ...posts,
      [`src/lib/refresh.${ext}`]: lines(
        "import { revalidateTag as refresh } from 'next/cache'",
        "export function refreshPosts() { refresh('posts', 'max') }",
      ),
      'src/actions/posts.ts': lines(
        "'use server'",
        "import { refreshPosts } from '@/lib/refresh'",
        'export async function createPost() { refreshPosts() }',
      ),
      'src/app/api/hook/route.ts': lines(
        "import { refreshPosts } from '@/lib/refresh'",
        'export async function POST() { refreshPosts(); return Response.json({ ok: true }) }',
      ),
    })
    expect(invalidations(model)).toEqual([
      'revalidateTag(posts) -> listPosts | /posts',
      'revalidateTag(posts) -> listPosts | /posts',
    ])
    expect(
      cacheOf(model)
        .invalidations.map((i) => i.origin)
        .sort(),
    ).toEqual(['route-handler', 'server-action'])
    // `post-{id}` is set but nothing revalidates it.
    expect(flags(model)).toEqual(['tag-never-revalidated: use-cache getPost'])
  })

  it('links `revalidatePath` to pages: literal, pattern, `layout`, groups and route handlers', () => {
    const model = scan({
      ...posts,
      'src/app/(shop)/products/page.tsx': 'export default function Page() { return <p /> }\n',
      'src/app/api/data/route.ts': 'export async function GET() { return Response.json({}) }\n',
      'src/actions/posts.ts': lines(
        "'use server'",
        "import { revalidatePath } from 'next/cache'",
        'export async function createPost(form: FormData) {',
        "  revalidatePath('/posts')",
        "  revalidatePath('/posts/[id]', 'page')",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source text of the scanned file
        "  revalidatePath(`/posts/${form.get('id')}`)",
        "  revalidatePath('/posts', 'layout')",
        "  revalidatePath('/(shop)/products')",
        "  revalidatePath('/api/data')",
        "  revalidatePath('/', 'layout')",
        '}',
      ),
    })
    expect(invalidations(model)).toEqual([
      'revalidatePath(/posts) ->  | /posts',
      'revalidatePath(/posts/[id]) ->  | /posts/[id]',
      'revalidatePath(/posts/{param}) ->  | /posts/[id]',
      'revalidatePath(/posts) ->  | /posts, /posts/[id]',
      'revalidatePath(/(shop)/products) ->  | /products',
      'revalidatePath(/api/data) ->  | /api/data',
      'revalidatePath(/) ->  | /posts, /posts/[id], /products, /api/data',
    ])
    // Paths say nothing about tags: both tags are set but never revalidated.
    expect(flags(model)).toEqual([
      'tag-never-revalidated: use-cache listPosts',
      'tag-never-revalidated: use-cache getPost',
    ])
  })
})

describe('flags', () => {
  it('flags each case and nothing else', () => {
    const model = scan({
      'src/lib/data.ts': lines(
        "import { cacheTag } from 'next/cache'",
        'export async function getPosts() {',
        "  'use cache'",
        "  cacheTag('posts', 'orphan')",
        '  return []',
        '}',
      ),
      'src/app/page.tsx': lines(
        "import { getPosts } from '@/lib/data'",
        "import { save } from '@/actions/save'",
        'export default async function Page() { return <form action={save}>{(await getPosts()).length}</form> }',
      ),
      'src/actions/save.ts': lines(
        "'use server'",
        "import { revalidatePath, revalidateTag } from 'next/cache'",
        'export async function save() {',
        "  revalidateTag('posts', 'max')",
        "  revalidateTag('postz', 'max')",
        "  revalidatePath('/nowhere')",
        "  revalidatePath('/')",
        '}',
      ),
      'src/app/api/posts/route.ts': lines(
        "import { updateTag } from 'next/cache'",
        "export async function POST() { updateTag('posts'); return Response.json({}) }",
      ),
    })
    expect(flags(model)).toEqual([
      'tag-never-set: revalidateTag(postz)',
      'path-no-route: revalidatePath(/nowhere)',
      'update-tag-outside-action: updateTag(posts)',
      'tag-never-revalidated: use-cache getPosts',
    ])
    const [never] = cacheOf(model).entries.flatMap((e) => e.flags)
    expect(never?.message).toContain('`orphan`')
  })

  it("doesn't flag tags when a revalidated tag can't be read", () => {
    const model = scan({
      'src/lib/data.ts': lines(
        "import { cacheTag } from 'next/cache'",
        "export async function getPosts() { 'use cache'; cacheTag('posts'); return [] }",
      ),
      'src/app/page.tsx': lines(
        "import { getPosts } from '@/lib/data'",
        'export default async function Page() { return <p>{(await getPosts()).length}</p> }',
      ),
      'src/app/api/revalidate/route.ts': lines(
        "import { revalidateTag } from 'next/cache'",
        "import type { NextRequest } from 'next/server'",
        'export async function GET(request: NextRequest) {',
        "  const tag = request.nextUrl.searchParams.get('tag')",
        "  if (tag) revalidateTag(tag, 'max')",
        '  return Response.json({ ok: true })',
        '}',
      ),
      'node_modules/next/server.d.ts': lines('export interface NextRequest extends Request { nextUrl: URL }'),
    })
    expect(invalidations(model)).toEqual(['revalidateTag(tag) ->  | '])
    expect(cacheOf(model).invalidations[0]?.tag?.confidence).toBe('unknown')
    expect(flags(model)).toEqual([])
  })

  it("doesn't flag a revalidated tag when a set tag can't be read", () => {
    const model = scan({
      'src/lib/data.ts': lines(
        "import { cacheTag } from 'next/cache'",
        "export async function getPosts(tags: string[]) { 'use cache'; cacheTag(...tags); return [] }",
      ),
      'src/app/page.tsx': lines(
        "import { getPosts } from '@/lib/data'",
        "import { save } from '@/actions/save'",
        "export default async function Page() { return <form action={save}>{(await getPosts(['a'])).length}</form> }",
      ),
      'src/actions/save.ts': lines(
        "'use server'",
        "import { revalidateTag } from 'next/cache'",
        "export async function save() { revalidateTag('posts', 'max') }",
      ),
    })
    expect(flags(model)).toEqual([])
  })
})

describe('model', () => {
  it('has no cache map when the app caches and revalidates nothing', () => {
    const model = scan({ 'src/app/page.tsx': 'export default function Page() { return <p /> }\n' })
    expect(model.cache).toBeUndefined()
  })

  it('loads a version 13 model without a cache map', () => {
    const model = scan({ 'src/app/page.tsx': 'export default function Page() { return <p /> }\n' })
    const parsed = AppModelSchema.parse({ ...model, version: 13 })
    expect(cacheOf(parsed)).toEqual({ entries: [], invalidations: [] })
  })
})
