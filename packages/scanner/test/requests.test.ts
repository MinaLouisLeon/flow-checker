// Request patterns the fixture apps don't cover, scanned from an in-memory project.
// Packages are stubbed in node_modules with just enough types for detection.
import { type AppModel, AppModelSchema, type RequestSite, urlText } from '@flow-checker/shared'
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

  'node_modules/axios/package.json': JSON.stringify({ name: 'axios', types: 'index.d.ts' }),
  'node_modules/axios/index.d.ts': lines(
    'export interface AxiosResponse<T = any> { data: T; status: number }',
    'export interface AxiosRequestConfig { url?: string; method?: string; baseURL?: string; data?: unknown }',
    'export interface AxiosInstance {',
    '  (config: AxiosRequestConfig): Promise<AxiosResponse>',
    '  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>',
    '  post<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>',
    '}',
    'export interface AxiosStatic extends AxiosInstance { create(config?: AxiosRequestConfig): AxiosInstance }',
    'declare const axios: AxiosStatic',
    'export default axios',
  ),
  'node_modules/swr/package.json': JSON.stringify({ name: 'swr', types: 'index.d.ts' }),
  'node_modules/swr/index.d.ts': lines(
    'export default function useSWR<T = any>(key: unknown, fetcher?: (key: any) => Promise<T>): { data?: T }',
  ),
  'node_modules/react/package.json': JSON.stringify({ name: 'react', types: 'index.d.ts' }),
  'node_modules/react/index.d.ts': lines(
    'export function useEffect(fn: () => void, deps?: unknown[]): void',
    'export function useCallback<T>(fn: T, deps: unknown[]): T',
  ),

  'src/types.ts': lines(
    'export interface User { id: number; name: string }',
    'export interface Note { id: number; text: string }',
  ),
  'src/lib/client.ts': lines(
    `import axios from 'axios'`,
    `import type { User } from '@/types'`,
    `const BASE = 'https://api.example.com/v1'`,
    `export const client = axios.create({ baseURL: BASE })`,
    `export const getUser = (id: number) => client.get<User>(\`/users/\${id}\`)`,
    `export const saveUser = (user: User) => axios({ url: 'https://api.example.com/v1/users', method: 'post', data: user })`,
    `export function load(url: string, init?: RequestInit) { return fetch(url, init) }`,
    `export const fetcher = (url: string) => fetch(url).then((r) => r.json())`,
  ),
  'src/lib/actions.ts': lines(
    `'use server'`,
    `export async function addNote(text: string): Promise<{ ok: boolean }> {`,
    `  const notify = async () => fetch('https://hooks.example.com/note', { method: 'POST' })`,
    `  await notify()`,
    `  return { ok: true }`,
    `}`,
  ),
  'src/hooks/useNotes.ts': lines(
    `import { useEffect } from 'react'`,
    `import type { Note } from '@/types'`,
    `export function useNotes() {`,
    `  useEffect(() => {`,
    `    fetch('/api/notes').then((r) => r.json() as Promise<Note[]>)`,
    `  }, [])`,
    `}`,
  ),
  'src/components/Panel.tsx': lines(
    `'use client'`,
    `import { useCallback } from 'react'`,
    `import useSWR from 'swr'`,
    `import { fetcher, getUser, load, saveUser } from '@/lib/client'`,
    `import { addNote } from '@/lib/actions'`,
    `import { useNotes } from '@/hooks/useNotes'`,
    `import type { User } from '@/types'`,
    `async function onReset() { await fetch('/api/reset', { method: 'DELETE' }) }`,
    `export function Panel({ url, user }: { url: string; user: User }) {`,
    `  useNotes()`,
    `  const { data } = useSWR<User[]>('/api/users', fetcher)`,
    `  const refresh = useCallback(async () => { await getUser(user.id) }, [user.id])`,
    `  const opts = { method: 'PUT' }`,
    `  return (`,
    `    <div>`,
    `      <button onClick={refresh}>refresh</button>`,
    `      <button onClick={() => saveUser(user)}>save</button>`,
    `      <button onClick={() => load(url, opts)}>load</button>`,
    `      <button onClick={onReset}>reset</button>`,
    `      <button onClick={() => addNote('hi')}>note</button>`,
    `      {data?.length}`,
    `    </div>`,
    `  )`,
    `}`,
  ),
  'src/app/layout.tsx': lines(
    `export default function RootLayout({ children }: { children: unknown }) {`,
    `  return <html><body>{children as never}</body></html>`,
    `}`,
  ),
  'src/app/page.tsx': lines(
    `import { Panel } from '@/components/Panel'`,
    `export default async function Home() {`,
    `  async function save(form: FormData) {`,
    `    'use server'`,
    `    await fetch('https://api.example.com/v1/forms', { method: 'POST', body: form })`,
    `  }`,
    `  const items: string[] = await fetch(\`\${process.env.API}/items\`).then((r) => r.json())`,
    `  return (`,
    `    <main>`,
    `      <form action={save}><button>go</button></form>`,
    `      <Panel url="/x" user={{ id: 1, name: 'a' }} />`,
    `      {items.length}`,
    `    </main>`,
    `  )`,
    `}`,
  ),
  'src/app/api/users/[id]/route.ts': lines(`export async function GET() { return new Response('[]') }`),
}

function memoryProject(files: Record<string, string>): InMemoryFileSystemHost {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries(files)) fs.writeFileSync(`/proj/${path}`, text)
  return fs
}

let model: AppModel
const summary = (s: RequestSite) =>
  `${s.method ?? '?'} ${s.url ? urlText(s.url) : `action ${s.serverAction?.name}`}`
const find = (text: string): RequestSite => {
  const site = model.requests.find((s) => summary(s) === text)
  if (!site) throw new Error(`no request "${text}" in:\n${model.requests.map(summary).join('\n')}`)
  return site
}
const trigger = (s: RequestSite) =>
  s.trigger.event ? `${s.trigger.kind} ${s.trigger.event}` : s.trigger.kind

beforeAll(() => {
  model = scanProject({ root: '/proj', fileSystem: memoryProject(FILES) })
})

describe('request sites', () => {
  it('validates against the model schema', () => {
    expect(() => AppModelSchema.parse(model)).not.toThrow()
  })

  it('finds every request once', () => {
    expect(model.requests.map(summary).sort()).toEqual(
      [
        'DELETE /api/reset',
        'GET /api/notes',
        'GET /api/users',
        'GET https://api.example.com/v1/users/:id',
        'GET {API}/items',
        'POST action addNote',
        'POST action save',
        'POST https://api.example.com/v1/forms',
        'POST https://api.example.com/v1/users',
        'POST https://hooks.example.com/note',
        'PUT ? url',
      ].sort(),
    )
  })

  it('resolves axios instances with a baseURL and the response generic', () => {
    const site = find('GET https://api.example.com/v1/users/:id')
    expect(site.transport).toBe('axios')
    expect(site.url?.confidence).toBe('pattern')
    expect(site.responseType?.text).toBe('User')
    // useCallback(fn) passed to onClick.
    expect(trigger(site)).toBe('event onClick')
  })

  it('reads method, url and data from an axios config object', () => {
    const site = find('POST https://api.example.com/v1/users')
    expect(site.url?.confidence).toBe('exact')
    expect(site.bodyType?.text).toBe('User')
  })

  it('flags a URL known only at runtime but keeps a method passed through a variable', () => {
    const site = find('PUT ? url')
    expect(site.url?.confidence).toBe('unknown')
    expect(site.flags.map((f) => f.kind)).toContain('dynamic-url')
  })

  it('binds the SWR key to the fetcher and takes the hook generic as the response', () => {
    const site = find('GET /api/users')
    expect(site.hook).toMatchObject({ name: 'useSWR', module: 'swr', key: "'/api/users'" })
    expect(site.responseType?.text).toBe('User[]')
    expect(trigger(site)).toBe('page-load')
  })

  it('follows custom hooks into their effects', () => {
    const site = find('GET /api/notes')
    expect(trigger(site)).toBe('effect')
    expect(site.responseType?.text).toBe('Note[]')
    expect(site.callStack.map((f) => f.callee)).toEqual(['useNotes', 'fetch'])
  })

  it('follows a module-level handler passed to an event prop', () => {
    expect(trigger(find('DELETE /api/reset'))).toBe('event onClick')
  })

  it('treats a server action called from a client component as a request, with its own server hop', () => {
    const call = find('POST action addNote')
    const hop = find('POST https://hooks.example.com/note')
    expect(trigger(call)).toBe('event onClick')
    expect(call.responseType?.text).toBe('{ ok: boolean }')
    expect(call.bodyType?.text).toBe('string')
    expect(hop.origin).toBe('server-action')
    expect(call.chain).toEqual([hop.id])
  })

  it('treats an inline server action used as a form action in a server component as a request', () => {
    const call = find('POST action save')
    const hop = find('POST https://api.example.com/v1/forms')
    expect(call.componentId).toBe(model.components.find((c) => c.name === 'Home')?.id)
    expect(trigger(call)).toBe('event action')
    expect(hop.origin).toBe('server-action')
    expect(hop.bodyType?.text).toBe('FormData')
    expect(call.chain).toEqual([hop.id])
  })

  it('takes the env var base and a typed variable for a server component fetch', () => {
    const site = find('GET {API}/items')
    expect(site.url).toMatchObject({ base: '{API}', baseEnv: 'API', path: '/items', confidence: 'exact' })
    expect(trigger(site)).toBe('server-render')
    expect(site.responseType?.text).toBe('string[]')
  })

  it('gives stable ids', () => {
    const again = scanProject({ root: '/proj', fileSystem: memoryProject(FILES) })
    expect(again.requests.map((s) => s.id)).toEqual(model.requests.map((s) => s.id))
  })
})
