// Request performance (M47): waterfalls (awaits that wait for each other for nothing), N+1 requests (one
// per item of a list) and duplicates (the same request from two places on one page load), found from
// each site's call path. The perf fixture's runs confirm them with capture timings (server tests).
import { type AppModel, AppModelSchema, formatModel, type PerfFinding } from '@flow-checker/shared'
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
      lib: ['dom', 'dom.iterable', 'esnext'],
      paths: { '@/*': ['./src/*'] },
    },
  }),
  'node_modules/react/package.json': JSON.stringify({ name: 'react', types: 'index.d.ts' }),
  'node_modules/react/index.d.ts': lines(
    'export function useState<T>(v: T): [T, (v: T) => void]',
    'export function useEffect(f: () => void, deps?: unknown[]): void',
    'export function cache<F extends (...a: never[]) => unknown>(f: F): F',
  ),
  'node_modules/next/package.json': JSON.stringify({ name: 'next' }),
  'node_modules/next/navigation.d.ts': lines('export function notFound(): never'),
  'node_modules/axios/package.json': JSON.stringify({ name: 'axios', types: 'index.d.ts' }),
  'node_modules/axios/index.d.ts': lines(
    'declare const axios: { get<T>(u: string): Promise<{ data: T }>; post<T>(u: string, d?: unknown): Promise<{ data: T }> }',
    'export default axios',
  ),
  'node_modules/@tanstack/react-query/package.json': JSON.stringify({
    name: '@tanstack/react-query',
    types: 'index.d.ts',
  }),
  'node_modules/@tanstack/react-query/index.d.ts': lines(
    'export function useQuery<T>(o: { queryKey: unknown[]; queryFn: () => Promise<T> }): { data: T | undefined }',
  ),
  'src/lib/api.ts': lines(
    "const API = 'https://api.test'",
    'export interface User { id: string; teamId: string }',
    'export async function getUser(id: string): Promise<User> {',
    '  const res = await fetch(`${API}/users/${id}`)',
    '  return res.json()',
    '}',
    'export async function getPosts(): Promise<{ id: string }[]> {',
    '  return (await fetch(`${API}/posts`)).json()',
    '}',
    'export function getTeam(id: string): Promise<{ id: string }> {',
    '  return fetch(`${API}/teams/${id}`).then((r) => r.json())',
    '}',
    'export async function getComments(postId: string): Promise<unknown[]> {',
    '  const res = await fetch(`${API}/posts/${postId}/comments`)',
    '  return res.json()',
    '}',
    'export async function savePost(title: string) {',
    "  await fetch(`${API}/posts`, { method: 'POST', body: title })",
    '}',
    'export async function getDashboard() {',
    '  const posts = await getPosts()',
    "  const team = await getTeam('t1')",
    '  return { posts, team }',
    '}',
  ),
  'src/lib/settings.ts': lines(
    "import axios from 'axios'",
    "import { cache } from 'react'",
    'export async function getSettings() {',
    "  return (await axios.get<{ theme: string }>('https://api.test/settings')).data",
    '}',
    'export async function getProfile(id: string) {',
    '  return (await axios.get<{ name: string }>(`https://api.test/profiles/${id}`)).data',
    '}',
    'export const getAccount = cache(async () => {',
    "  return (await axios.get<{ name: string }>('https://api.test/account')).data",
    '})',
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

/** A server page with these lines in its body, returning `<div />`. */
function page(...body: string[]) {
  return {
    'src/app/page.tsx': lines(
      "import { getUser, getPosts, getTeam, getComments, savePost, getDashboard } from '@/lib/api'",
      "import { notFound } from 'next/navigation'",
      'export default async function Home() {',
      ...body.map((l) => `  ${l}`),
      '  return <div />',
      '}',
    ),
  }
}

const findings = (model: AppModel, kind?: PerfFinding['kind']) =>
  (model.perf?.findings ?? []).filter((f) => !kind || f.kind === kind)

/** Each waterfall as `fn: step [needs] -> ...`. */
const waterfalls = (model: AppModel) =>
  findings(model, 'waterfall').map(
    (f) =>
      `${f.fn}: ${(f.steps ?? []).map((s) => `${s.text}${s.needs.length ? ` [${s.needs}]` : ''}`).join(' -> ')}`,
  )

const urls = (model: AppModel, ids: readonly string[] = []) =>
  ids.map((id) => model.requests.find((s) => s.id === id)?.url?.path)

describe('waterfalls', () => {
  it('flags independent awaits, and keeps the steps a later one needs', () => {
    const model = scan(
      page(
        "const user = await getUser('1')",
        'const posts = await getPosts()',
        'const team = await getTeam(user.teamId)',
      ),
    )
    expect(waterfalls(model)).toEqual(["Home: getUser('1') -> getPosts() -> getTeam(user.teamId) [0]"])
    const [f] = findings(model)
    expect(f?.side).toBe('server')
    expect(f?.loc.line).toBe(5)
    expect(f?.routeIds).toHaveLength(1)
  })

  it('leaves awaits that use the result, directly, destructured or through a variable', () => {
    for (const body of [
      ["const user = await getUser('1')", 'const team = await getTeam(user.teamId)'],
      ["const { teamId } = await getUser('1')", 'const team = await getTeam(teamId)'],
      ["const user = await getUser('1')", 'const id = user.teamId', 'const team = await getTeam(id)'],
      ["let id = ''", "id = (await getUser('1')).teamId", 'await getTeam(id)'],
    ]) {
      expect(waterfalls(scan(page(...body))), body.join('; ')).toEqual([])
    }
  })

  it('leaves an await that only runs after a check of the first result', () => {
    const model = scan(page("const user = await getUser('1')", 'if (!user) notFound()', 'await getPosts()'))
    expect(waterfalls(model)).toEqual([])
  })

  it('leaves awaits in other branches, after a short-circuit and in loops', () => {
    for (const body of [
      ["if (Math.random() > 0.5) { await getUser('1') } else { await getPosts() }"],
      ["const x = Math.random() > 0.5 ? await getUser('1') : await getPosts()"],
      ["const x = (await getUser('1')) || (await getPosts())"],
      ["try { await getUser('1') } catch { await getPosts() }"],
      ["await getUser('1')", "for (const id of ['a', 'b']) await getTeam(id)"],
    ]) {
      expect(waterfalls(scan(page(...body))), body.join('; ')).toEqual([])
    }
  })

  it('sees awaits in one statement and `Promise.all` as one step', () => {
    expect(
      waterfalls(scan(page("const data = { user: await getUser('1'), posts: await getPosts() }"))),
    ).toEqual(["Home: getUser('1') -> getPosts()"])
    expect(waterfalls(scan(page("const [u, p] = await Promise.all([getUser('1'), getPosts()])")))).toEqual([])
    expect(
      waterfalls(
        scan(page("const [u, p] = await Promise.all([getUser('1'), getPosts()])", "await getTeam('t')")),
      ),
    ).toEqual(["Home: Promise.all([getUser('1'), getPosts()]) -> getTeam('t')"])
  })

  it('finds one in a helper, for the pages that call it', () => {
    const model = scan(page('const d = await getDashboard()'))
    expect(waterfalls(model)).toEqual(["getDashboard: getPosts() -> getTeam('t1')"])
    expect(findings(model)[0]?.loc.file).toBe('src/lib/api.ts')
    expect(findings(model)[0]?.routeIds).toHaveLength(1)
  })

  it('leaves writes, which are usually ordered on purpose', () => {
    expect(waterfalls(scan(page("await savePost('a')", 'await getPosts()')))).toEqual([])
  })

  it('only looks on the server', () => {
    const model = scan({
      'src/app/page.tsx': lines(
        "'use client'",
        "import { useEffect } from 'react'",
        "import { getUser, getPosts } from '@/lib/api'",
        'export default function Home() {',
        "  useEffect(() => { void (async () => { await getUser('1'); await getPosts() })() }, [])",
        '  return <div />',
        '}',
      ),
    })
    expect(waterfalls(model)).toEqual([])
  })

  it('finds them in route handlers and server actions, for the pages that call them', () => {
    const model = scan({
      'src/app/api/summary/route.ts': lines(
        "import { getUser, getPosts } from '@/lib/api'",
        'export async function GET() {',
        "  const user = await getUser('1')",
        '  const posts = await getPosts()',
        '  return Response.json({ user, posts })',
        '}',
      ),
      'src/actions/load.ts': lines(
        "'use server'",
        "import { getUser, getPosts } from '@/lib/api'",
        'export async function load() {',
        "  const user = await getUser('1')",
        '  const posts = await getPosts()',
        '  return { user, posts }',
        '}',
      ),
      'src/app/page.tsx': lines(
        "'use client'",
        "import { load } from '@/actions/load'",
        'export default function Home() {',
        "  return <div><button onClick={() => fetch('/api/summary')} /><button onClick={() => load()} /></div>",
        '}',
      ),
    })
    const found = findings(model, 'waterfall')
    expect(found.map((f) => `${f.fn} ${f.loc.file}`)).toEqual([
      'load src/actions/load.ts',
      'GET src/app/api/summary/route.ts',
    ])
    for (const f of found) expect(f.routeIds, f.fn).toHaveLength(1)
    expect(found[1]?.routeId).toBeDefined()
  })
})

describe('N+1 requests', () => {
  const loops = (model: AppModel) =>
    findings(model, 'n-plus-one').map(
      (f) =>
        `${f.side} ${f.loop?.kind} ${f.loop?.text}${f.loop?.over ? ` over ${f.loop.over}` : ''}${f.sequential ? ' sequential' : ''}`,
    )

  it('flags an await in a for loop as sequential, with the request the list came from', () => {
    const model = scan(
      page('const posts = await getPosts()', 'for (const p of posts) await getComments(p.id)'),
    )
    expect(loops(model)).toEqual(['server for for (const p of posts) over posts sequential'])
    const [f] = findings(model, 'n-plus-one')
    expect(urls(model, f?.siteIds)).toEqual(['/posts/:postId/comments'])
    expect(urls(model, f?.listSiteIds)).toEqual(['/posts'])
  })

  it('flags array callbacks, `Array.from` and other loops', () => {
    expect(
      loops(
        scan(
          page('const posts = await getPosts()', 'await Promise.all(posts.map((p) => getComments(p.id)))'),
        ),
      ),
    ).toEqual(['server callback posts.map() over posts'])
    expect(
      loops(
        scan(
          page(
            'const posts = await getPosts()',
            'await Promise.all(Array.from(posts, (p) => getComments(p.id)))',
          ),
        ),
      ),
    ).toEqual(['server callback Array.from() over posts'])
    expect(loops(scan(page('for (let i = 0; i < 3; i++) await getTeam(String(i))')))).toEqual([
      'server for for (let i = 0; i < 3; i++) sequential',
    ])
    expect(loops(scan(page('let n = 0', 'while (n++ < 3) { await getTeam(String(n)) }')))).toEqual([
      'server while while (n++ < 3) sequential',
    ])
  })

  it('leaves loops over a list written in the code', () => {
    expect(loops(scan(page("await Promise.all(['a', 'b'].map((id) => getTeam(id)))")))).toEqual([])
    expect(loops(scan(page("const ids = ['a', 'b']", 'for (const id of ids) await getTeam(id)')))).toEqual([])
  })

  it('finds them in effects, and leaves event handlers', () => {
    const model = scan({
      'src/app/page.tsx': lines(
        "'use client'",
        "import { useEffect, useState } from 'react'",
        "import { getComments } from '@/lib/api'",
        'export default function Home({ ids }: { ids: string[] }) {',
        '  const [n, setN] = useState(0)',
        '  useEffect(() => { ids.forEach((id) => void getComments(id)) }, [ids])',
        '  return <button onClick={() => ids.forEach((id) => void getComments(id))}>{n}</button>',
        '}',
      ),
    })
    expect(loops(model)).toEqual(['client callback ids.forEach() over ids'])
  })

  it('flags a component rendered once per item that sends a request with the item', () => {
    const model = scan({
      'src/components/post-row.tsx': lines(
        "import { getComments } from '@/lib/api'",
        'export async function PostRow({ id }: { id: string }) {',
        '  const comments = await getComments(id)',
        '  return <li>{comments.length}</li>',
        '}',
      ),
      'src/components/banner.tsx': lines(
        "import { getPosts } from '@/lib/api'",
        'export async function Banner() {',
        '  const posts = await getPosts()',
        '  return <p>{posts.length}</p>',
        '}',
      ),
      'src/app/page.tsx': lines(
        "import { getPosts } from '@/lib/api'",
        "import { PostRow } from '@/components/post-row'",
        "import { Banner } from '@/components/banner'",
        'export default async function Home() {',
        '  const posts = await getPosts()',
        // `Banner` sends the same URL for every item: Next dedupes it, so it isn't one per item.
        '  return <ul>{posts.map((p) => <><PostRow key={p.id} id={p.id} /><Banner /></>)}</ul>',
        '}',
      ),
    })
    expect(loops(model)).toEqual(['server render <PostRow> over posts'])
    expect(findings(model, 'n-plus-one')[0]?.fn).toBe('Home')
  })
})

describe('duplicate requests', () => {
  const duplicates = (model: AppModel) =>
    findings(model, 'duplicate').map((f) => `${f.side} ${f.request} on ${f.routeIds.length} page(s)`)

  /** A layout and two pages below it with these lines each (the layout gets `layout`, the pages `page`). */
  function nested(layout: string[], pageBody: string[], extra: Record<string, string> = {}) {
    const imports = [
      "import { getUser } from '@/lib/api'",
      "import { getSettings, getProfile, getAccount } from '@/lib/settings'",
    ]
    const pageFile = lines(
      ...imports,
      'export default async function P() {',
      ...pageBody,
      '  return <div />',
      '}',
    )
    return {
      'src/app/admin/layout.tsx': lines(
        ...imports,
        'export default async function L({ children }: { children: unknown }) {',
        ...layout,
        '  return <section>{children as never}</section>',
        '}',
      ),
      'src/app/admin/page.tsx': pageFile,
      'src/app/admin/users/page.tsx': pageFile,
      ...extra,
    }
  }

  it('flags the same axios request in a layout and its pages, one pair per page', () => {
    const model = scan(nested(['  await getSettings()'], ['  await getSettings()']))
    expect(duplicates(model)).toEqual([
      'server GET https://api.test/settings on 1 page(s)',
      'server GET https://api.test/settings on 1 page(s)',
    ])
    for (const f of findings(model, 'duplicate')) expect(f.siteIds).toHaveLength(2)
  })

  it('flags it once for every page when a shared layout sends it twice', () => {
    const model = scan(nested(['  await getSettings()', '  await getSettings()'], []))
    expect(duplicates(model)).toEqual(['server GET https://api.test/settings on 2 page(s)'])
  })

  it('leaves what Next or React dedupe: a GET fetch, a `cache()` function', () => {
    expect(duplicates(scan(nested(["  await getUser('1')"], ["  await getUser('1')"])))).toEqual([])
    expect(duplicates(scan(nested(['  await getAccount()'], ['  await getAccount()'])))).toEqual([])
  })

  it('compares the arguments when the URL has a part only known at runtime', () => {
    const name = '  const name = (await getAccount()).name'
    const other = '  const other = String(Date.now())'
    expect(
      duplicates(scan(nested([name, '  await getProfile(name)'], [other, '  await getProfile(other)']))),
    ).toEqual([])
    expect(
      duplicates(scan(nested([name, '  await getProfile(name)'], [name, '  await getProfile(name)']))),
    ).toEqual([
      'server GET https://api.test/profiles/:id on 1 page(s)',
      'server GET https://api.test/profiles/:id on 1 page(s)',
    ])
    // Constant arguments are read into the URL: different values are different requests.
    expect(duplicates(scan(nested(["  await getProfile('a')"], ["  await getProfile('b')"])))).toEqual([])
  })

  it('flags plain requests in two client components, not a shared query key', () => {
    const client = (name: string, body: string) =>
      lines(
        "'use client'",
        "import { useEffect, useState } from 'react'",
        "import { useQuery } from '@tanstack/react-query'",
        `export function ${name}() {`,
        '  const [x, setX] = useState<unknown>(null)',
        body,
        '  return <div>{String(x)}</div>',
        '}',
      )
    const model = scan({
      'src/components/a.tsx': client('A', "  useEffect(() => { fetch('/api/me').then(setX) }, [])"),
      'src/components/b.tsx': client('B', "  useEffect(() => { fetch('/api/me').then(setX) }, [])"),
      'src/components/c.tsx': client(
        'C',
        "  useQuery({ queryKey: ['me'], queryFn: () => fetch('/api/team').then((r) => r.json()) })",
      ),
      'src/components/d.tsx': client(
        'D',
        "  useQuery({ queryKey: ['me'], queryFn: () => fetch('/api/team').then((r) => r.json()) })",
      ),
      'src/app/page.tsx': lines(
        "import { A } from '@/components/a'",
        "import { B } from '@/components/b'",
        "import { C } from '@/components/c'",
        "import { D } from '@/components/d'",
        'export default function Home() {',
        '  return <main><A /><B /><C /><D /></main>',
        '}',
      ),
    })
    expect(duplicates(model)).toEqual(['client GET /api/me on 1 page(s)'])
  })
})

describe('the tree text', () => {
  it('lists each finding with its steps and pages', () => {
    const text = formatModel(
      scan(
        page(
          "const user = await getUser('1')",
          'const posts = await getPosts()',
          'for (const p of posts) await getComments(p.id)',
        ),
      ),
    )
    expect(text).toContain('perf: waterfall in Home, n-plus-one in Home')
    expect(text).toContain('# Request performance')
    expect(text).toContain("  1. await getUser('1')")
    expect(text).toContain('  for for (const p of posts) over posts sequential')
    expect(text).toContain('  list from GET https://api.test/posts')
  })
})
