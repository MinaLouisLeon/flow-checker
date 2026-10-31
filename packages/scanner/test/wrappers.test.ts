// Request wrappers and component patterns from a real app (jobseekk) that the fixtures don't cover:
// a URL helper with a ternary, a wrapper with a multipart branch, a custom hook around useMutation,
// aliased library components, compound components (`Card.Header = ...`) and an `as` prop.
import { type AppModel, AppModelSchema, type Component, type RequestSite } from '@flow-checker/shared'
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
    'export function useQuery<T = unknown>(...args: unknown[]): { data?: T }',
    'export function useMutation<T = unknown, V = void>(options: { mutationFn: (v: V) => Promise<T> }): {',
    '  mutate(v: V): void',
    '  mutateAsync(v: V): Promise<T>',
    '}',
  ),
  'node_modules/react-hook-form/package.json': JSON.stringify({
    name: 'react-hook-form',
    types: 'index.d.ts',
  }),
  'node_modules/react-hook-form/index.d.ts': lines(
    'export declare const FormProvider: (props: { children?: unknown }) => unknown',
  ),
  'node_modules/@radix-ui/react-dialog/package.json': JSON.stringify({
    name: '@radix-ui/react-dialog',
    types: 'index.d.ts',
  }),
  'node_modules/@radix-ui/react-dialog/index.d.ts': lines(
    'export declare const Root: (props: { children?: unknown }) => unknown',
  ),
  'node_modules/next/package.json': JSON.stringify({ name: 'next' }),
  'node_modules/next/navigation.d.ts': lines(
    'export function redirect(url: string): never',
    'export interface Router { push(href: string): void }',
    'export function useRouter(): Router',
  ),
  'src/hooks/useGoTo.ts': lines(
    `import { useRouter } from 'next/navigation'`,
    `export function useGoTo() {`,
    `  const router = useRouter()`,
    `  const goTo = (slug: string) => router.push(\`/people/\${slug}\`)`,
    `  return { goTo }`,
    `}`,
  ),

  'src/services/client.ts': lines(
    `export async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {`,
    `  return fetch(url, { ...options, credentials: 'include' })`,
    `}`,
  ),
  'src/services/request.ts': lines(
    `import { secureFetch } from './client'`,
    `export const authEndpoints = ['/login', '/register']`,
    `const proxyUrl = (endpoint: string) =>`,
    `  authEndpoints.includes(endpoint) ? \`/api/auth\${endpoint}\` : \`/api\${endpoint}\``,
    `const run = async <T>(url: string, options: RequestInit) => {`,
    `  const res = await secureFetch(url, options)`,
    `  return (await res.json()) as T`,
    `}`,
    `export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {`,
    `  const isMultipart = options.body instanceof FormData`,
    `  const requestUrl = proxyUrl(endpoint)`,
    `  if (isMultipart) {`,
    `    const method = (options.method ?? 'POST').toUpperCase()`,
    `    return run<T>(requestUrl, { ...options, method })`,
    `  }`,
    `  const method = options.method ?? 'GET'`,
    `  const requestOptions: RequestInit = method !== 'GET' ? { ...options, headers: { 'X-Key': '1' } } : options`,
    `  return run<T>(requestUrl, requestOptions)`,
    `}`,
  ),
  'src/api.ts': lines(
    `import { request } from '@/services/request'`,
    `export const login = (body: { email: string }) =>`,
    `  request<{ token: string }>('/login', { method: 'POST', body: JSON.stringify(body) })`,
    `export const listJobs = () => request<{ id: number }[]>('/jobs')`,
    `export const follow = (id: number) => request<null>(\`/users/\${id}/follow\`, { method: 'post' })`,
    `export const unfollow = (id: number) => request<null>(\`/users/\${id}/unfollow\`, { method: 'DELETE' })`,
    `export const getProfile = (slug: string) => request<{ name: string }>(\`/user-profile/\${slug}\`)`,
    // An optional query added by a helper with two returns, and by a ternary.
    `const withCursor = (url: string, cursor?: string): string => {`,
    `  if (!cursor) return url`,
    `  const separator = url.includes('?') ? '&' : '?'`,
    `  return \`\${url}\${separator}cursor=\${cursor}\``,
    `}`,
    `export const latestFeeds = (cursor?: string) => request<{ id: number }[]>(withCursor('/latest-feeds', cursor))`,
    `export const userJobs = (slug: string, cursor?: string) =>`,
    `  request<{ id: number }[]>(withCursor(\`/users/\${slug}/jobs\`, cursor))`,
    `export const faqs = (cursor: string | null) => request<{ q: string }[]>(cursor ? \`/faqs?cursor=\${cursor}\` : '/faqs')`,
  ),
  'node_modules/react/package.json': JSON.stringify({ name: 'react', types: 'index.d.ts' }),
  'node_modules/react/index.d.ts': lines('export function useCallback<T>(fn: T, deps: unknown[]): T'),
  'src/hooks/useFollow.ts': lines(
    `import { useCallback } from 'react'`,
    `import { useMutation } from '@tanstack/react-query'`,
    `import { follow, unfollow } from '@/api'`,
    `const guard = <T,>(fn: T): T => fn`,
    `export function useFollow() {`,
    `  const { mutateAsync } = useMutation({ mutationFn: (id: number) => follow(id) })`,
    // Called in a local callback the hook returns; the dependency list is not a call.
    `  const submit = useCallback(async (id: number) => { await mutateAsync(id) }, [mutateAsync])`,
    `  const unfollowMutation = useMutation({ mutationFn: (id: number) => unfollow(id) })`,
    `  return { submit, unfollow: guard(unfollowMutation.mutate) }`,
    `}`,
  ),
  'src/app/people/page.tsx': lines(
    `'use client'`,
    `import { useQuery } from '@tanstack/react-query'`,
    `import { faqs, getProfile, latestFeeds, userJobs } from '@/api'`,
    `import { useFollow } from '@/hooks/useFollow'`,
    `import { useGoTo } from '@/hooks/useGoTo'`,
    `export default function People({ slug }: { slug: string }) {`,
    `  const { submit, unfollow } = useFollow()`,
    `  const { goTo } = useGoTo()`,
    `  const profile = useQuery({ queryKey: ['profile', slug], queryFn: () => getProfile(slug) })`,
    `  useQuery({ queryKey: ['feeds'], queryFn: () => latestFeeds() })`,
    `  useQuery({ queryKey: ['jobs', slug], queryFn: () => userJobs(slug) })`,
    `  useQuery({ queryKey: ['faqs', slug], queryFn: () => faqs(slug) })`,
    `  return (`,
    `    <div>`,
    `      <button onClick={() => submit(1)}>{String(profile.data)}</button>`,
    `      <button onMouseDown={() => unfollow(2)} />`,
    `      <a onClick={() => goTo(slug)}>Profile</a>`,
    `    </div>`,
    `  )`,
    `}`,
  ),
  'src/hooks/useLogin.ts': lines(
    `import { useMutation } from '@tanstack/react-query'`,
    `import { login } from '@/api'`,
    `export function useLogin() {`,
    `  const mutation = useMutation({ mutationFn: login })`,
    `  return { callLogin: mutation.mutate }`,
    `}`,
  ),

  'src/ui/form.tsx': lines(
    `import { FormProvider } from 'react-hook-form'`,
    `const Form = FormProvider`,
    `export { Form }`,
  ),
  'src/ui/dialog.tsx': lines(
    `import * as DialogPrimitive from '@radix-ui/react-dialog'`,
    `const Dialog = DialogPrimitive.Root`,
    `export { Dialog }`,
  ),
  'src/ui/Card.tsx': lines(
    `function CardHeader() { return <h2 /> }`,
    `const CardBody = () => <div />`,
    `const Card = ({ children }: { children?: unknown }) => <section>{children as never}</section>`,
    `Card.Header = CardHeader`,
    `Card.Body = CardBody`,
    `export default Card`,
  ),
  'src/ui/Heading.tsx': lines(
    `export const Heading = ({ as: Tag = 'h1', title }: { as?: 'h1' | 'h2'; title: string }) => <Tag>{title}</Tag>`,
  ),

  'src/app/layout.tsx': lines(
    `export default function RootLayout({ children }: { children: unknown }) {`,
    `  return <html><body>{children as never}</body></html>`,
    `}`,
  ),
  'src/app/page.tsx': lines(
    `'use client'`,
    `import { useMutation, useQuery } from '@tanstack/react-query'`,
    `import { follow, listJobs } from '@/api'`,
    `import { useLogin } from '@/hooks/useLogin'`,
    `import { Form } from '@/ui/form'`,
    `import { Dialog } from '@/ui/dialog'`,
    `import Card from '@/ui/Card'`,
    `import { Heading } from '@/ui/Heading'`,
    `export default function Home() {`,
    `  const jobs = useQuery({ queryKey: ['jobs'], queryFn: listJobs })`,
    `  const { callLogin } = useLogin()`,
    // Never called here: its trigger is unknown, but it is not a page-load request.
    `  const followMutation = useMutation({ mutationFn: () => follow(1) })`,
    `  return (`,
    `    <Form>`,
    `      <Heading title="Jobs" />`,
    `      <Dialog />`,
    `      <Card><Card.Header /><Card.Body /></Card>`,
    `      <button onClick={() => callLogin({ email: 'a' })}>Log in</button>`,
    `      <p>{String(jobs.data)}{String(followMutation)}</p>`,
    `    </Form>`,
    `  )`,
    `}`,
  ),
  'src/app/jobs/page.tsx': lines(
    `import { redirect } from 'next/navigation'`,
    `export default async function Jobs({ params }: { params: Promise<{ owner: string }> }) {`,
    `  const { owner } = await params`,
    `  return redirect(\`/jobs/\${owner ? 'published' : 'applied'}\`)`,
    `}`,
  ),
}

function memoryProject(files: Record<string, string>): InMemoryFileSystemHost {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries(files)) fs.writeFileSync(`/proj/${path}`, text)
  return fs
}

let model: AppModel
const component = (name: string): Component => {
  const found = model.components.find((c) => c.name === name)
  if (!found) throw new Error(`no component ${name}`)
  return found
}
const sitesTo = (path: string): RequestSite[] => model.requests.filter((s) => s.url?.path === path)

beforeAll(() => {
  model = scanProject({ root: '/proj', fileSystem: memoryProject(FILES) })
})

describe('request wrappers', () => {
  it('validates against the model schema', () => {
    expect(() => AppModelSchema.parse(model)).not.toThrow()
  })

  it('follows the URL through a helper function with a ternary', () => {
    expect(model.requests.map((s) => `${s.method} ${s.url?.path}`).sort()).toEqual([
      'DELETE /api/users/:id/unfollow',
      'GET /api/faqs',
      'GET /api/jobs',
      'GET /api/latest-feeds',
      'GET /api/user-profile/:slug',
      'GET /api/users/:slug/jobs',
      'POST /api/auth/login',
      'POST /api/users/1/follow',
      'POST /api/users/:id/follow',
    ])
    expect(sitesTo('/api/auth/login')[0]?.url?.confidence).toBe('exact')
  })

  it('rules out list entries a URL pattern cannot be', () => {
    // `['/login', '/register'].includes(\`/user-profile/\${slug}\`)` is false: no `/api/auth` prefix.
    expect(sitesTo('/api/user-profile/:slug')[0]?.url?.confidence).toBe('pattern')
  })

  it('follows a mutation through a returned callback and a wrapper', () => {
    expect(sitesTo('/api/users/:id/follow')[0]?.trigger).toMatchObject({ kind: 'event', event: 'onClick' })
    expect(sitesTo('/api/users/:id/unfollow')[0]?.trigger).toMatchObject({
      kind: 'event',
      event: 'onMouseDown',
    })
  })

  it('keeps one site per call when a wrapper reaches fetch on several branches', () => {
    expect(sitesTo('/api/jobs')).toHaveLength(1)
    expect(sitesTo('/api/auth/login')).toHaveLength(1)
    // The unconditional branch is kept: the default `GET`, not the multipart branch's `POST` fallback.
    expect(sitesTo('/api/jobs')[0]?.callStack.map((f) => f.line)).toEqual([10, 4, 18, 6, 2])
  })

  it('finds the trigger of a mutation wrapped in a custom hook', () => {
    expect(sitesTo('/api/auth/login')[0]?.trigger).toMatchObject({ kind: 'event', event: 'onClick' })
  })

  it('never calls a mutation a page-load request', () => {
    const site = sitesTo('/api/users/1/follow')[0]
    expect(site?.hook?.name).toBe('useMutation')
    expect(site?.trigger.kind).toBe('unknown')
    expect(sitesTo('/api/jobs')[0]?.trigger.kind).toBe('page-load')
  })
})

describe('components', () => {
  const child = (parent: string, name: string) => component(parent).children.find((c) => c.name === name)

  it('resolves aliases of library components as external', () => {
    expect(child('Home', 'Form')).toMatchObject({ resolution: 'external', module: '@/ui/form' })
    expect(child('Home', 'Dialog')).toMatchObject({ resolution: 'external', module: '@/ui/dialog' })
  })

  it('resolves compound components assigned as static properties', () => {
    expect(child('Home', 'Card.Header')).toMatchObject({
      resolution: 'project',
      componentId: component('CardHeader').id,
    })
    expect(child('Home', 'Card.Body')).toMatchObject({
      resolution: 'project',
      componentId: component('CardBody').id,
    })
  })

  it('marks a component passed in as a prop', () => {
    expect(child('Heading', 'Tag')).toMatchObject({ resolution: 'prop' })
  })
})

describe('navigation', () => {
  it('records the redirect a page makes while it renders', () => {
    const page = model.routes.find((r) => r.path === '/jobs')
    const navs = model.navigations.filter((n) => n.componentId === page?.componentId)
    expect(navs.map((n) => `${n.kind} ${n.href.path}`)).toEqual(['redirect /jobs/:param'])
  })

  it('places a router call in a function a custom hook returns', () => {
    const push = model.navigations.find((n) => n.kind === 'push')
    expect(push?.href.path).toBe('/people/:slug')
    expect(push?.trigger).toMatchObject({ kind: 'event', event: 'onClick' })
  })
})
