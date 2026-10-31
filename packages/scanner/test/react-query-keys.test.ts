// React Query keys (M24): enum and constant segments, unreadable segments, and keys passed
// through the project's own query hooks. Scanned from an in-memory project with a stub of the
// package; each pattern has variants (declaration vs. arrow, local vs. imported, re-exported or
// aliased, `.ts` and `.js`).
import { type AppModel, AppModelSchema, formatQueryKey, type RequestSite } from '@flow-checker/shared'
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
      allowJs: true,
      lib: ['dom', 'esnext'],
      paths: { '@/*': ['./src/*'] },
    },
  }),
  'node_modules/@tanstack/react-query/package.json': JSON.stringify({
    name: '@tanstack/react-query',
    types: 'index.d.ts',
  }),
  'node_modules/@tanstack/react-query/index.d.ts': lines(
    'export declare class QueryClient {',
    '  invalidateQueries(filters?: unknown, options?: unknown): Promise<void>',
    '  refetchQueries(filters?: unknown): Promise<void>',
    '}',
    'export function useQueryClient(): QueryClient',
    'export function useQuery<T = unknown>(...args: unknown[]): { data?: T }',
    'export function useInfiniteQuery<T = unknown>(...args: unknown[]): { data?: T }',
    'export function useMutation(...args: unknown[]): { mutate(v?: unknown): void }',
  ),
  'node_modules/key-lib/package.json': JSON.stringify({ name: 'key-lib', types: 'index.d.ts' }),
  'node_modules/key-lib/index.d.ts': lines(
    'export declare const libKey: string',
    'export declare const libKeys: { feed: string }',
    'export declare function makeKey(): string',
  ),

  'src/api.ts': lines(
    `const API = 'https://api.example.com'`,
    `export const getFeed = () => fetch(\`\${API}/feed\`).then((r) => r.json())`,
    `export const getPosts = () => fetch(\`\${API}/posts\`).then((r) => r.json())`,
    `export const getDrafts = () => fetch(\`\${API}/drafts\`).then((r) => r.json())`,
    `export const getProfile = () => fetch(\`\${API}/profile\`).then((r) => r.json())`,
    `export const getArchive = () => fetch(\`\${API}/archive\`).then((r) => r.json())`,
    `export const getStats = () => fetch(\`\${API}/stats\`).then((r) => r.json())`,
    `export const getLib = () => fetch(\`\${API}/lib\`).then((r) => r.json())`,
    `export const getItem = (id: string) => fetch(\`\${API}/items/\${id}\`).then((r) => r.json())`,
    `export const getPage = (page: number) => fetch(\`\${API}/pages/\${page}\`).then((r) => r.json())`,
  ),

  // Key constants: string enums, a const enum, a numeric enum, `as const` objects and strings.
  'src/keys/enums.ts': lines(
    `export enum QueryKeys {`,
    `  feed = 'feed',`,
    `  profile = 'profile',`,
    `}`,
    `export const enum Scope {`,
    `  Items = 'items',`,
    `}`,
    `export enum Level {`,
    `  Low,`,
    `  High,`,
    `}`,
  ),
  'src/keys/consts.ts': lines(
    `export const KEYS = { posts: 'posts', nested: { drafts: 'drafts' } } as const`,
    `export const COMMENTS = 'comments'`,
  ),
  // Re-exported: `export *` and an aliased named re-export.
  'src/keys/index.ts': lines(`export * from './enums'`, `export { KEYS as K, COMMENTS } from './consts'`),
  'src/keys/legacy.js': lines(`export const LEGACY = { archive: 'archive' }`, `export const STATS = 'stats'`),

  // The project's own query hooks: destructured options (declaration), a spread options object
  // (arrow), positional arguments, a `.js` hook, and defaults in the pattern.
  'src/hooks/useList.ts': lines(
    `import { useInfiniteQuery, useQuery } from '@tanstack/react-query'`,
    `export function useInfiniteList<T>({ queryKey, queryFn }: { queryKey: readonly unknown[]; queryFn: () => Promise<T> }) {`,
    `  return useInfiniteQuery({ queryKey, queryFn, initialPageParam: 0, getNextPageParam: () => undefined })`,
    `}`,
    `export const useCached = (options: { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }) =>`,
    `  useQuery({ ...options, staleTime: 1000 })`,
    `export const usePaged = (name: string, fetcher: () => Promise<unknown>) =>`,
    `  useQuery({ queryKey: ['paged', name], queryFn: fetcher })`,
    `export function useWithDefaults({ key, load, enabled = true }: { key: string; load: () => Promise<unknown>; enabled?: boolean }) {`,
    `  const { data } = useQuery({ queryKey: [key, 'defaults'], queryFn: load, enabled })`,
    `  return data`,
    `}`,
    `export function useOptions(options: { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }) {`,
    `  const { queryKey, queryFn } = options`,
    `  return useQuery({ queryKey: [...queryKey, 'options'], queryFn })`,
    `}`,
  ),
  'src/hooks/useLegacy.js': lines(
    `import { useQuery } from '@tanstack/react-query'`,
    `export function useLegacy({ queryKey, queryFn }) {`,
    `  return useQuery({ queryKey, queryFn })`,
    `}`,
  ),
  'src/hooks/index.ts': lines(
    `export { useInfiniteList as useList, useCached, usePaged, useWithDefaults, useOptions } from './useList'`,
    `export * from './useLegacy'`,
  ),

  'src/app/page.tsx': lines(
    `'use client'`,
    `import { useQuery, useQueryClient } from '@tanstack/react-query'`,
    `import { libKey, libKeys, makeKey } from 'key-lib'`,
    `import { getArchive, getDrafts, getFeed, getItem, getLib, getPage, getPosts, getProfile, getStats } from '@/api'`,
    `import { useCached, useLegacy, useList, useOptions, usePaged, useWithDefaults } from '@/hooks'`,
    `import { COMMENTS, K, Level, QueryKeys, Scope } from '@/keys'`,
    `import { LEGACY, STATS } from '@/keys/legacy'`,
    `enum Local {`,
    `  Mine = 'mine',`,
    `}`,
    `const PREFIX = 'pre'`,
    `export default function Page({ id }: { id: string }) {`,
    `  const client = useQueryClient()`,
    `  useQuery({ queryKey: [QueryKeys.feed], queryFn: getFeed })`,
    `  useQuery({ queryKey: [Scope.Items, Level.High, id], queryFn: () => getItem(id) })`,
    `  useQuery({ queryKey: [K.posts, K.nested.drafts], queryFn: getDrafts })`,
    `  useQuery({ queryKey: [\`\${QueryKeys.profile}-\${COMMENTS}\`, \`\${PREFIX}-\${id}\`], queryFn: getProfile })`,
    `  useQuery({ queryKey: [LEGACY.archive, Local.Mine, QueryKeys['profile']], queryFn: getArchive })`,
    `  useQuery({ queryKey: [STATS], queryFn: getStats })`,
    `  useQuery({ queryKey: [libKey, 'lib'], queryFn: getLib })`,
    `  useQuery({ queryKey: [QueryKeys.feed, libKeys.feed], queryFn: getLib })`,
    `  useQuery({ queryKey: [\`\${makeKey()}-x\`], queryFn: getLib })`,
    `  useList({ queryKey: [QueryKeys.feed, 'infinite'], queryFn: getFeed })`,
    `  useList({ queryKey: [K.posts, 'infinite'], queryFn: getPosts })`,
    `  useCached({ queryKey: ['cached', id], queryFn: () => getPage(1) })`,
    `  usePaged('drafts', getDrafts)`,
    `  useWithDefaults({ key: 'withDefaults', load: getStats })`,
    `  useOptions({ queryKey: ['opts'], queryFn: getArchive })`,
    `  useLegacy({ queryKey: ['legacy'], queryFn: getArchive })`,
    `  return (`,
    `    <div>`,
    `      <button onClick={() => client.invalidateQueries({ queryKey: [QueryKeys.feed] })}>Feed</button>`,
    `      <button onClick={() => client.invalidateQueries({ queryKey: [libKey] })}>Lib</button>`,
    `      <button onClick={() => client.refetchQueries({ queryKey: [K.posts, libKeys.feed, 'x'] })}>Posts</button>`,
    `      <button onClick={() => client.invalidateQueries({ queryKey: makeKey() })}>Unknown</button>`,
    `      <button onClick={() => client.invalidateQueries({ queryKey: ['cached'] })}>Cached</button>`,
    `    </div>`,
    `  )`,
    `}`,
  ),
}

function memoryProject(files: Record<string, string>): InMemoryFileSystemHost {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries(files)) fs.writeFileSync(`/proj/${path}`, text)
  return fs
}

let model: AppModel
const keyOf = (s: RequestSite | undefined) => (s?.queryKey ? formatQueryKey(s.queryKey) : undefined)
const byKey = (key: string) => model.requests.filter((s) => keyOf(s) === key)
const byPath = (path: string) => model.requests.filter((s) => s.url?.path === path)

beforeAll(() => {
  model = scanProject({ root: '/proj', fileSystem: memoryProject(FILES) })
})

describe('React Query keys from enums and constants (M24)', () => {
  it('validates against the model schema', () => {
    expect(() => AppModelSchema.parse(model)).not.toThrow()
  })

  it('reads string enum members, imported through `export *`, as static segments', () => {
    expect(byKey("['feed']")).toHaveLength(1)
  })

  it('reads const enums and numeric enum members', () => {
    expect(byKey("['items', 1, :id]")).toHaveLength(1)
  })

  it('reads `as const` object properties through an aliased re-export, nested too', () => {
    expect(byKey("['posts', 'drafts']")).toHaveLength(1)
  })

  it('reads enum members and constants inside template literals', () => {
    expect(byKey("['profile-comments', `pre-:id`]")).toHaveLength(1)
  })

  it('reads constants from `.js` files, local enums and element access on an enum', () => {
    expect(byKey("['archive', 'mine', 'profile']")).toHaveLength(1)
    expect(byKey("['stats']")).toHaveLength(1)
  })
})

describe('Unreadable key segments (M24)', () => {
  const link = (text: string) =>
    model.queryLinks.find((l) => l.loc && l.callStack.length && keyText(l.key) === text)
  const keyText = (key: RequestSite['queryKey']) => (key ? formatQueryKey(key) : undefined)
  const targets = (text: string) =>
    (link(text)?.targetSiteIds ?? []).map((id) => keyOf(model.requests.find((s) => s.id === id))).sort()

  it('marks values from outside the project as unknown, not as runtime params', () => {
    const lib = byPath('/lib').map((s) => s.queryKey)
    expect(lib).toContainEqual([
      { kind: 'param', name: 'libKey', unknown: true },
      { kind: 'static', value: 'lib' },
    ])
    expect(lib).toContainEqual([
      { kind: 'static', value: 'feed' },
      { kind: 'param', name: 'feed', unknown: true },
    ])
    expect(lib.some((k) => k?.[0]?.kind === 'param' && k[0].unknown)).toBe(true)
  })

  it('keeps runtime values as params', () => {
    const item = byPath('/items/:id')[0]
    expect(item?.queryKey?.[2]).toEqual({ kind: 'param', name: 'id' })
  })

  it('links a known key by prefix, never through an unknown segment of the query', () => {
    // `['feed', ?feed]` is hit by the prefix `['feed']`; the unknown segment comes after it.
    expect(targets("['feed']")).toEqual(["['feed', 'infinite']", "['feed', ?feed]", "['feed']"].sort())
  })

  it('gives a link whose first segment is unknown no targets', () => {
    const lib = model.queryLinks.find((l) => l.key && formatQueryKey(l.key) === '[?libKey]')
    expect(lib?.targetSiteIds).toEqual([])
    const whole = model.queryLinks.find((l) => l.key?.[0]?.kind === 'rest')
    expect(whole?.targetSiteIds).toEqual([])
  })

  it('links by the known prefix when a later segment is unknown', () => {
    const posts = model.queryLinks.find((l) => l.method === 'refetchQueries')
    const hit = (posts?.targetSiteIds ?? [])
      .map((id) => keyOf(model.requests.find((s) => s.id === id)))
      .sort()
    expect(hit).toEqual(["['posts', 'drafts']", "['posts', 'infinite']"])
  })
})

describe('Keys through the project query hooks (M24)', () => {
  it('gives each call of a destructuring hook its own query site, re-exported under an alias', () => {
    const feed = byKey("['feed', 'infinite']")
    const posts = byKey("['posts', 'infinite']")
    expect(feed).toHaveLength(1)
    expect(posts).toHaveLength(1)
    expect(feed[0]?.hook?.name).toBe('useInfiniteQuery')
    expect(feed[0]?.url?.path).toBe('/feed')
    expect(posts[0]?.url?.path).toBe('/posts')
  })

  it('follows a spread options parameter (arrow)', () => {
    const cached = byKey("['cached', :id]")
    expect(cached).toHaveLength(1)
    expect(cached[0]?.url?.path).toBe('/pages/1')
  })

  it('follows positional arguments', () => {
    expect(byKey("['paged', 'drafts']")[0]?.url?.path).toBe('/drafts')
  })

  it('follows defaults in the pattern and a destructured local variable', () => {
    expect(byKey("['withDefaults', 'defaults']")[0]?.url?.path).toBe('/stats')
    expect(byKey("['opts', 'options']")[0]?.url?.path).toBe('/archive')
  })

  it('follows a `.js` hook', () => {
    expect(byKey("['legacy']")[0]?.hook?.name).toBe('useQuery')
  })

  it('leaves no plain fetch sites for the query functions passed to the hooks', () => {
    const plain = model.requests.filter((s) => !s.hook)
    expect(plain.map((s) => s.url?.path)).toEqual([])
  })

  it('links an invalidation to the query sent through a hook', () => {
    const cached = model.queryLinks.find((l) => l.key && formatQueryKey(l.key) === "['cached']")
    expect(cached?.targetSiteIds).toEqual(byKey("['cached', :id]").map((s) => s.id))
  })
})
