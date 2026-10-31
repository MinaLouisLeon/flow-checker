// tRPC (M16) on patterns the fixture apps don't cover, scanned from an in-memory project with
// stubs of the packages. The proxies are typed `any` here: the scanner reads them by syntax.
import { type AppModel, AppModelSchema, type RequestSite } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { beforeAll, describe, expect, it } from 'vitest'
import { scanProject } from '../src'

const lines = (...l: string[]) => `${l.join('\n')}\n`

const stub = (name: string, ...body: string[]): Record<string, string> => ({
  [`node_modules/${name}/package.json`]: JSON.stringify({ name, types: 'index.d.ts' }),
  [`node_modules/${name}/index.d.ts`]: lines(...body),
})

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
  ...stub('@trpc/server', 'export declare const initTRPC: any'),
  ...stub(
    '@trpc/client',
    'export declare function createTRPCClient<T>(options: unknown): any',
    'export declare function httpBatchLink(options: { url: string }): unknown',
  ),
  ...stub('@trpc/react-query', 'export declare function createTRPCReact<T>(): any'),
  ...stub(
    '@trpc/tanstack-react-query',
    'export declare function createTRPCOptionsProxy<T>(options: unknown): any',
  ),
  ...stub(
    '@tanstack/react-query',
    'export declare class QueryClient {',
    '  invalidateQueries(filters?: unknown): Promise<void>',
    '  prefetchQuery(options: unknown): Promise<void>',
    '}',
    'export function useQueries(options: unknown): unknown[]',
    'export function useQueryClient(): QueryClient',
  ),

  // No route handler: the router comes from the client's type argument, the endpoint from the link.
  'src/server/api.ts': lines(
    `import { initTRPC } from '@trpc/server'`,
    `const t = initTRPC.create()`,
    `export interface Item { id: string; name: string }`,
    `const items = t.router({`,
    `  byId: t.procedure.query((): Item => ({ id: '1', name: 'x' })),`,
    `  save: t.procedure.mutation(async (): Promise<Item> => ({ id: '1', name: 'x' })),`,
    `})`,
    `export const appRouter = t.router({`,
    `  items,`,
    `  admin: t.router({ stats: { count: t.procedure.query(() => 3) } }),`,
    `})`,
    `export type AppRouter = typeof appRouter`,
  ),
  'src/trpc.ts': lines(
    `import { createTRPCClient, httpBatchLink } from '@trpc/client'`,
    `import { createTRPCReact } from '@trpc/react-query'`,
    `import { QueryClient } from '@tanstack/react-query'`,
    `import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'`,
    `import type { AppRouter } from './server/api'`,
    `import { appRouter } from './server/api'`,
    `const getBaseUrl = () => 'http://localhost:3000'`,
    `export const api = createTRPCReact<AppRouter>()`,
    `const client = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: \`\${getBaseUrl()}/rpc\` })] })`,
    `export const queryClient = new QueryClient()`,
    `export const options = createTRPCOptionsProxy<AppRouter>({ client, queryClient })`,
    // Calls the router directly: no HTTP request.
    `export const server = createTRPCOptionsProxy<AppRouter>({ router: appRouter, ctx: {}, queryClient })`,
  ),
  'src/app/page.tsx': lines(
    `'use client'`,
    `import { useQueries, useQueryClient } from '@tanstack/react-query'`,
    `import { api, options, server } from '@/trpc'`,
    `export default function Page() {`,
    `  const utils = api.useUtils()`,
    `  const queryClient = useQueryClient()`,
    `  const many = useQueries({ queries: ['1', '2'].map(() => options.items.byId.queryOptions()) })`,
    `  const count = api.admin.stats.count.useQuery()`,
    `  void server.items.byId.queryOptions()`,
    `  return (`,
    `    <div>`,
    `      <button onClick={() => utils.items.byId.prefetch()}>Prefetch</button>`,
    `      <button onClick={() => utils.invalidate()}>All</button>`,
    `      <button onClick={() => utils.admin.invalidate()}>Admin</button>`,
    `      <button onClick={() => queryClient.prefetchQuery(options.admin.stats.count.queryOptions())}>Stats</button>`,
    `      <button onClick={() => queryClient.invalidateQueries({ queryKey: options.items.pathKey() })}>Items</button>`,
    `      {String(many.length)}{String(count)}`,
    `    </div>`,
    `  )`,
    `}`,
  ),
}

let model: AppModel

beforeAll(() => {
  const fileSystem = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries(FILES)) fileSystem.writeFileSync(`/project/${path}`, text)
  model = scanProject({ root: '/project', fileSystem })
}, 60_000)

const callsTo = (path: string): RequestSite[] => model.requests.filter((s) => s.procedure?.path === path)

describe('tRPC', () => {
  it('produces a valid model', () => {
    expect(() => AppModelSchema.parse(model)).not.toThrow()
  })

  it('finds the router from the client type and the endpoint from the link', () => {
    expect(model.trpc?.endpoint).toBe('/rpc')
    expect(model.trpc?.routeId).toBeUndefined()
    expect(model.trpc?.router).toMatchObject({ name: 'appRouter', loc: { file: 'src/server/api.ts' } })
    expect(model.trpc?.procedures.map((p) => `${p.type} ${p.path} ${p.outputType?.text ?? '-'}`)).toEqual([
      'query admin.stats.count number',
      'query items.byId Item',
      'mutation items.save Item',
    ])
  })

  it('detects calls through each proxy, and none through a server-side proxy', () => {
    const byId = callsTo('items.byId')
    // Two `useQueries` entries share one written entry, and the `utils.prefetch()` call.
    expect(byId.map((s) => `${s.hook?.name} ${s.trigger.kind} ${s.url?.path}`)).toEqual([
      'useQueries page-load /rpc/items.byId',
      'prefetch event /rpc/items.byId',
    ])
    expect(callsTo('admin.stats.count').map((s) => `${s.hook?.name} ${s.trigger.kind}`)).toEqual([
      'useQuery page-load',
      'prefetchQuery event',
    ])
    expect(byId.every((s) => s.responseType?.text === 'Item')).toBe(true)
    expect(model.trpc?.procedures.find((p) => p.path === 'items.save')?.siteIds).toEqual([])
  })

  it('links cache calls to the procedures they hit', () => {
    const links = model.queryLinks.map((l) => ({
      procedure: l.procedure,
      method: l.method,
      hits: l.targetSiteIds.map((id) => model.requests.find((s) => s.id === id)?.procedure?.path).sort(),
    }))
    // Client-side prefetches fill the cache too, so they count as hit (like plain React Query).
    const count = ['admin.stats.count', 'admin.stats.count']
    expect(links).toEqual([
      { procedure: '', method: 'invalidate', hits: [...count, 'items.byId', 'items.byId'] },
      { procedure: 'admin', method: 'invalidate', hits: count },
      { procedure: 'items', method: 'invalidateQueries', hits: ['items.byId', 'items.byId'] },
    ])
  })
})
