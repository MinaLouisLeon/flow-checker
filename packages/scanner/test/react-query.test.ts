// React Query keys and cache links (M13) on patterns the fixture apps don't cover, scanned from
// an in-memory project with a stub of the package.
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
    '  removeQueries(filters?: unknown): void',
    '  setQueryData(key: unknown, data: unknown): void',
    '  fetchQuery<T>(options: { queryKey: unknown; queryFn: () => Promise<T> }): Promise<T>',
    '  prefetchQuery(options: unknown, fn?: unknown): Promise<void>',
    '}',
    'export function useQueryClient(): QueryClient',
    'export function useQuery<T = unknown>(...args: unknown[]): { data?: T }',
    'export function useQueries(options: unknown): unknown[]',
    'export function useMutation(...args: unknown[]): { mutate(v?: unknown): void }',
    'export function queryOptions<T>(options: T): T',
  ),

  'src/api.ts': lines(
    `const API = 'https://api.example.com'`,
    `export const getItems = (page: number) => fetch(\`\${API}/items?page=\${page}\`).then((r) => r.json())`,
    `export const getItem = (id: string) => fetch(\`\${API}/items/\${id}\`).then((r) => r.json())`,
    `export const saveItem = (id: string) => fetch(\`\${API}/items/\${id}\`, { method: 'PUT' })`,
    `export const SCOPE = 'items'`,
    `export const keys = {`,
    `  all: [SCOPE] as const,`,
    // A block body with one return, a template literal and an object segment.
    `  page(page: number, sort: string) { return [...keys.all, \`page-\${page}\`, { sort, archived: false }] as const },`,
    `  item: (id: string) => [...keys.all, 'item', id, -1, null] as const,`,
    `}`,
    `export function itemQuery(id: string) {`,
    `  return queryOptionsLike(id)`,
    `}`,
    `function queryOptionsLike(id: string) {`,
    `  return { queryKey: keys.item(id), queryFn: () => getItem(id) }`,
    `}`,
  ),
  'src/app/page.tsx': lines(
    `'use client'`,
    `import { QueryClient, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'`,
    `import { getItems, itemQuery, keys, saveItem } from '@/api'`,
    `declare const extra: string[]`,
    `const fakeClient = { invalidateQueries: (_: unknown) => {} }`,
    `export default function Page({ page, sort }: { page: number; sort: string }) {`,
    `  const client = useQueryClient()`,
    `  useQuery({ queryKey: keys.page(page, sort), queryFn: () => getItems(page) })`,
    `  useQuery(itemQuery('a'))`,
    `  useQuery({ queryKey: [...extra, 'x'], queryFn: () => getItems(1) })`,
    `  useQueries({ queries: [itemQuery('b'), { queryKey: ['other'], queryFn: () => getItems(2) }] })`,
    `  const save = useMutation({`,
    `    mutationKey: ['save'],`,
    `    mutationFn: (id: string) => saveItem(id),`,
    `    onSuccess: (_data, id) => {`,
    `      client.invalidateQueries({ queryKey: keys.item(id), exact: true })`,
    `      client.setQueryData(keys.page(1, 'name'), [])`,
    `    },`,
    `    onError: () => client.removeQueries(),`,
    `  })`,
    `  fakeClient.invalidateQueries(keys.all)`,
    `  return (`,
    `    <div>`,
    `      <button onClick={() => save.mutate('a')}>Save</button>`,
    `      <button onClick={() => client.fetchQuery({ queryKey: ['items', 'item', 'c'], queryFn: () => getItems(3) })}>Load</button>`,
    `      <button onClick={() => client.refetchQueries({ queryKey: [keys.all[0]] })}>Refresh</button>`,
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
const keyOf = (s: RequestSite) => (s.queryKey ? formatQueryKey(s.queryKey) : undefined)
const site = (path: string, hook?: string) =>
  model.requests.find((s) => s.url?.path === path && (!hook || s.hook?.name === hook))

beforeAll(() => {
  model = scanProject({ root: '/proj', fileSystem: memoryProject(FILES) })
})

describe('React Query keys', () => {
  it('validates against the model schema', () => {
    expect(() => AppModelSchema.parse(model)).not.toThrow()
  })

  it('parses keys through factories, templates, objects and constants', () => {
    const keys = model.requests.map(keyOf).filter(Boolean).sort()
    expect(keys).toEqual([
      "['items', 'item', 'a', -1, null]",
      "['items', 'item', 'b', -1, null]",
      "['items', 'item', 'c']",
      "['items', `page-:page`, { sort: :sort, archived: false }]",
      "['other']",
      "['save']",
      "[...extra, 'x']",
    ])
  })

  it('follows functions that return query options', () => {
    const item = model.requests.find((s) => keyOf(s) === "['items', 'item', 'a', -1, null]")
    expect(item?.url?.path).toBe('/items/a')
    expect(item?.hook?.name).toBe('useQuery')
  })

  it('gives each useQueries entry its own site', () => {
    const entries = model.requests.filter((s) => s.hook?.name === 'useQueries')
    expect(entries.map(keyOf).sort()).toEqual(["['items', 'item', 'b', -1, null]", "['other']"])
    expect(new Set(entries.map((s) => s.id)).size).toBe(2)
  })

  it('treats queryClient.fetchQuery in a handler as an event-triggered query', () => {
    const fetchQuery = model.requests.find((s) => s.hook?.name === 'fetchQuery')
    expect(fetchQuery?.trigger).toMatchObject({ kind: 'event', event: 'onClick' })
    expect(keyOf(fetchQuery as RequestSite)).toBe("['items', 'item', 'c']")
  })

  it('keeps the mutation key on the mutation site', () => {
    expect(keyOf(site('/items/:id', 'useMutation') as RequestSite)).toBe("['save']")
  })
})

describe('React Query cache links', () => {
  const link = (method: string) => model.queryLinks.find((l) => l.method === method)
  const targets = (method: string) =>
    (link(method)?.targetSiteIds ?? [])
      .map((id) => model.requests.find((s) => s.id === id))
      .map((s) => s && keyOf(s))

  it('links an exact invalidation from the mutation to the query with that key', () => {
    const invalidate = link('invalidateQueries')
    expect(invalidate).toMatchObject({ kind: 'invalidate', exact: true, outcome: 'success' })
    expect(formatQueryKey(invalidate?.key ?? [])).toBe("['items', 'item', :id, -1, null]")
    expect(invalidate?.fromSiteIds).toEqual([site('/items/:id', 'useMutation')?.id])
    // `:id` may be any item: both item queries, not the fetchQuery one without `-1, null`.
    expect(targets('invalidateQueries').sort()).toEqual([
      "['items', 'item', 'a', -1, null]",
      "['items', 'item', 'b', -1, null]",
    ])
  })

  it('matches statics and objects in setQueryData keys', () => {
    // `'page-1'` fits the template `page-${page}`, which is only known at runtime.
    expect(link('setQueryData')).toMatchObject({ kind: 'set-data', exact: true })
    expect(targets('setQueryData')).toEqual(["['items', `page-:page`, { sort: :sort, archived: false }]"])
  })

  it('treats a call without a key as hitting every query, on the error path', () => {
    const remove = link('removeQueries')
    expect(remove?.key).toBeUndefined()
    expect(remove?.outcome).toBe('error')
    expect(remove?.targetSiteIds.length).toBe(
      model.requests.filter((s) => s.queryKey && s.hook?.name !== 'useMutation').length,
    )
  })

  it('resolves a key built from a constant element and links calls made in handlers', () => {
    const refetch = link('refetchQueries')
    expect(refetch?.trigger).toMatchObject({ kind: 'event', event: 'onClick' })
    expect(formatQueryKey(refetch?.key ?? [])).toBe("['items']")
    expect(refetch?.fromSiteIds).toEqual([])
    expect(targets('refetchQueries')).not.toContain("['other']")
    // A key that starts with an unresolved spread could be anything: it is not linked.
    expect(targets('refetchQueries')).not.toContain("[...extra, 'x']")
  })

  it('ignores lookalike methods on objects that are not a QueryClient', () => {
    expect(model.queryLinks.filter((l) => l.method === 'invalidateQueries')).toHaveLength(1)
  })
})
