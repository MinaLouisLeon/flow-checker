// Config options that change what the scan reads: `apiClients`, `include` and `exclude`.
import { type AppModel, AppModelSchema, type RequestSite, urlText } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { type ScanOptions, scanProject } from '../src'

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

  // An HTTP library the scanner knows nothing about.
  'node_modules/ky/package.json': JSON.stringify({ name: 'ky', types: 'index.d.ts' }),
  'node_modules/ky/index.d.ts': lines(
    'export interface Options { json?: unknown; method?: string; prefixUrl?: string; headers?: Record<string, string> }',
    'export interface ResponsePromise<T = unknown> extends Promise<Response> { json<J = T>(): Promise<J> }',
    'export interface KyInstance {',
    '  <T>(url: string, options?: Options): ResponsePromise<T>',
    '  get<T>(url: string, options?: Options): ResponsePromise<T>',
    '  post<T>(url: string, options?: Options): ResponsePromise<T>',
    '  delete<T>(url: string, options?: Options): ResponsePromise<T>',
    '  create(options?: Options): KyInstance',
    '}',
    'declare const ky: KyInstance',
    'export default ky',
  ),
  // A generated client published as a package: named functions.
  'node_modules/@acme/api/package.json': JSON.stringify({ name: '@acme/api', types: 'index.d.ts' }),
  'node_modules/@acme/api/index.d.ts': lines(
    'export interface Order { id: string; total: number }',
    'export function listOrders(path: string): Promise<Order[]>',
    'export function createOrder(path: string, body: { total: number }): Promise<Order>',
    'export function request(path: string, init: { method: string }): Promise<unknown>',
  ),

  'src/types.ts': lines('export interface Note { id: number; text: string }'),
  // A project client listed by its alias, imported here through a relative path and a barrel.
  'src/lib/rpc.ts': lines(
    `export const rpc = {`,
    `  get: async (path: string) => (await fetch('/rpc' + path)).json(),`,
    `  post: async (path: string, body: unknown) => (await fetch('/rpc' + path, { method: 'POST', body: JSON.stringify(body) })).json(),`,
    `}`,
  ),
  'src/lib/index.ts': lines(`export { rpc } from './rpc'`),
  'src/lib/http.ts': lines(
    `import ky from 'ky'`,
    `export const http = ky.create({ prefixUrl: 'https://api.example.com' })`,
  ),

  'src/app/page.tsx': lines(
    `'use client'`,
    `import ky from 'ky'`,
    `import { listOrders, createOrder, request } from '@acme/api'`,
    `import { http } from '@/lib/http'`,
    `import { rpc } from '../lib'`,
    `import type { Note } from '@/types'`,
    `import { Panel } from './Panel'`,
    `import { Draft } from './Draft.stories'`,
    `export default function Page() {`,
    `  async function onSave(text: string) {`,
    `    await ky.post('/api/notes', { json: { text } })`,
    `    await createOrder('/orders', { total: 1 })`,
    `    await rpc.post('/notes', { text })`,
    `  }`,
    `  async function onLoad() {`,
    `    const notes = await http.get<Note[]>('notes').json()`,
    `    await listOrders('/orders')`,
    `    await request('/orders/1', { method: 'DELETE' })`,
    `    await ky('/api/ping')`,
    `    await rpc.get('/me')`,
    `    return notes`,
    `  }`,
    `  return (`,
    `    <main>`,
    `      <button onClick={() => onSave('x')}>Save</button>`,
    `      <button onClick={onLoad}>Load</button>`,
    `      <Panel />`,
    `      <Draft />`,
    `    </main>`,
    `  )`,
    `}`,
  ),
  'src/app/Panel.tsx': lines(`export function Panel() { return <p>panel</p> }`),
  'src/app/Draft.stories.tsx': lines(
    `export function Draft() {`,
    `  return <button onClick={() => fetch('/api/draft')}>draft</button>`,
    `}`,
  ),
  'src/app/admin/page.tsx': lines(
    `export default async function Admin() {`,
    `  await fetch('https://api.example.com/admin')`,
    `  return null`,
    `}`,
  ),
}

function scan(options: Partial<ScanOptions> = {}): AppModel {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries(FILES)) fs.writeFileSync(`/proj/${path}`, text)
  return scanProject({ root: '/proj', fileSystem: fs, ...options })
}

const summary = (s: RequestSite) => `${s.method ?? '?'} ${s.url ? urlText(s.url) : '?'}`

describe('apiClients', () => {
  const model = scan({
    apiClients: [
      { module: 'ky', methods: ['default', 'get', 'post', 'delete'] },
      { module: '@acme/api', methods: ['listOrders', 'createOrder', 'request'] },
      { module: '@/lib/rpc', methods: ['get', 'post'] },
    ],
  })

  it('validates against the model schema', () => {
    expect(() => AppModelSchema.parse(model)).not.toThrow()
  })

  it('finds calls to the configured modules as requests', () => {
    const clients = model.requests
      .filter((s) => s.transport === 'api-client')
      .map((s) => `${summary(s)} ${s.client?.module}#${s.client?.name}`)
      .sort()
    expect(clients).toEqual(
      [
        // Method from the name, URL from the first argument.
        'POST /api/notes ky#post',
        // Calling the default import: GET unless the options say otherwise.
        'GET /api/ping ky#default',
        // An instance from ky.create({ prefixUrl }).
        'GET https://api.example.com/notes ky#get',
        // Named functions of a package: GET by default, or the options' method.
        'GET /orders @acme/api#listOrders',
        'GET /orders @acme/api#createOrder',
        'DELETE /orders/1 @acme/api#request',
        // A project module, imported through a barrel and a relative path.
        'POST /notes @/lib/rpc#post',
        'GET /me @/lib/rpc#get',
      ].sort(),
    )
  })

  it('takes the trigger, body and response type like other requests', () => {
    const post = model.requests.find((s) => s.client?.name === 'post' && s.client.module === 'ky')
    expect(post?.trigger).toMatchObject({ kind: 'event', event: 'onClick' })
    expect(post?.bodyType?.shape).toMatchObject({ kind: 'object' })
    const typed = model.requests.find((s) => s.client?.name === 'get' && s.client.module === 'ky')
    expect(typed?.responseType?.shape).toMatchObject({ kind: 'array' })
    // `api.post(url, body)`: the second argument is the body.
    const rpcPost = model.requests.find((s) => s.client?.module === '@/lib/rpc' && s.client.name === 'post')
    expect(rpcPost?.bodyType).toBeDefined()
  })

  it('treats a configured project module as the request, without entering it', () => {
    expect(model.requests.some((s) => s.url && urlText(s.url).startsWith('/rpc'))).toBe(false)
  })

  it('finds nothing extra without the config', () => {
    const plain = scan()
    expect(plain.requests.some((s) => s.transport === 'api-client')).toBe(false)
    // The project module is still followed into its fetch calls.
    expect(plain.requests.map(summary)).toEqual(expect.arrayContaining(['POST /rpc/notes', 'GET /rpc/me']))
  })
})

describe('include / exclude', () => {
  it('skips stories by default: their components are marked excluded and not walked', () => {
    const model = scan()
    const page = model.components.find((c) => c.file === 'src/app/page.tsx')
    const draft = page?.children.find((c) => c.name === 'Draft')
    expect(draft).toMatchObject({ resolution: 'excluded' })
    expect(model.components.some((c) => c.name === 'Draft')).toBe(false)
    expect(model.requests.map(summary)).not.toContain('GET /api/draft')
    expect(page?.children.find((c) => c.name === 'Panel')).toMatchObject({ resolution: 'project' })
  })

  it('scans everything with an empty exclude', () => {
    const model = scan({ exclude: [] })
    expect(model.requests.map(summary)).toContain('GET /api/draft')
  })

  it('drops excluded pages', () => {
    const model = scan({ exclude: ['src/app/admin/**'] })
    expect(model.routes.map((r) => r.path)).not.toContain('/admin')
    expect(model.requests.map(summary)).not.toContain('GET https://api.example.com/admin')
  })

  it('keeps only included files', () => {
    const model = scan({ include: ['src/app/**', 'src/types.ts'] })
    // lib/ is outside include, so rpc calls stop at the call into it.
    expect(model.requests.some((s) => s.url && urlText(s.url).startsWith('/rpc'))).toBe(false)
    expect(model.routes.map((r) => r.path).sort()).toEqual(['/', '/admin'])
  })
})
