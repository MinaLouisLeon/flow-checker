// M25: URLs built with `new URL()` and string methods, URLs taken from data, catch-all proxy
// route handlers, and requests a shared helper only sends under a condition.
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
      allowJs: true,
      lib: ['dom', 'esnext'],
      paths: { '@/*': ['./src/*'] },
    },
  }),
  'node_modules/next/package.json': JSON.stringify({ name: 'next' }),
  'node_modules/next/server.d.ts': lines(
    'export declare class NextRequest extends Request { nextUrl: URL }',
    'export declare class NextResponse extends Response {}',
  ),

  'src/lib/config.ts': lines(
    `export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.example.com'`,
    `export const CDN = 'https://cdn.example.com'`,
  ),
  'src/lib/config-reexport.ts': lines(`export { API_URL as SERVICE_URL } from './config'`),

  // `new URL(path, base)` with an env base, read as `.href`, in a JavaScript helper.
  'src/lib/http.js': lines(
    `export function api(path, init) {`,
    `  const url = new URL(path, process.env.NEXT_PUBLIC_API_URL)`,
    `  return fetch(url.href, init)`,
    `}`,
  ),
  // A leading slash stripped with a regex before joining.
  'src/lib/call.ts': lines(
    `import { SERVICE_URL } from './config-reexport'`,
    `export function call(endpoint: string) {`,
    `  const path = endpoint.replace(/^\\//, '')`,
    `  return fetch(\`\${SERVICE_URL}/\${path}\`)`,
    `}`,
  ),
  // A shared helper that refreshes the session first, only sometimes.
  'src/lib/authed.ts': lines(
    `let expiresAt = 0`,
    `export async function authed(url: string, init?: RequestInit) {`,
    `  if (Date.now() > expiresAt) {`,
    `    await fetch('/api/session/refresh', { method: 'POST' })`,
    `  }`,
    `  return fetch(url, init)`,
    `}`,
  ),

  'src/app/layout.tsx': lines(
    `export default function RootLayout({ children }: { children: unknown }) {`,
    `  return <html><body>{children as never}</body></html>`,
    `}`,
  ),
  'src/app/page.tsx': lines(
    `import { API_URL, CDN } from '@/lib/config'`,
    `import { api } from '@/lib/http'`,
    `import { call } from '@/lib/call'`,
    `export default async function Home({ id }: { id: string }) {`,
    `  const target = new URL('/v1/reports', process.env.REPORTS_URL)`,
    `  await fetch(target.href)`,
    `  const user = new URL(\`/v1/users/\${id}\`, CDN)`,
    `  await fetch(user.toString())`,
    `  await fetch(\`\${new URL('/v1/stats', API_URL)}\`)`,
    `  await fetch(String(new URL('teams', \`\${API_URL}/v2/\`)))`,
    `  await api('/v1/orders')`,
    `  await call('/orders')`,
    `  await fetch('/api/profile/me'.replace('/me', '/self'))`,
    `  await fetch('/api/v1/items'.slice(7))`,
    `  return null`,
    `}`,
  ),

  // URLs taken from an earlier response, and from props.
  'src/app/files/page.tsx': lines(
    `'use client'`,
    `type FileRef = { url: string; downloadUrl: string }`,
    `export default function Files({ endpoint }: { endpoint: string }) {`,
    `  async function open() {`,
    `    const res = await fetch('/api/files')`,
    `    const file: FileRef = await res.json()`,
    `    const blob = await (await fetch(file.url)).blob()`,
    `    const files: FileRef[] = await res.json()`,
    `    await Promise.all(files.map((f) => fetch(f.downloadUrl)))`,
    `    const { downloadUrl } = file`,
    `    await fetch(downloadUrl)`,
    `    await fetch(endpoint)`,
    `    return blob`,
    `  }`,
    `  return <button onClick={open} />`,
    `}`,
  ),
  'src/app/unknown/page.tsx': lines(
    `declare function makeUrl(): string`,
    `export default async function Unknown() {`,
    `  await fetch(makeUrl())`,
    `  return null`,
    `}`,
  ),

  // Catch-all proxies: the path from params, from nextUrl and from new URL(request.url).
  'src/app/api/[...path]/route.ts': lines(
    `import { API_URL } from '@/lib/config'`,
    `export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {`,
    `  const { path } = await params`,
    `  return fetch(\`\${API_URL}/\${path.join('/')}\`, { headers: request.headers })`,
    `}`,
    `export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {`,
    `  return forward(request, (await context.params).path)`,
    `}`,
    `function forward(request: Request, segments: string[]) {`,
    `  return fetch(API_URL + '/' + segments.join('/'), { method: 'POST', body: request.body })`,
    `}`,
  ),
  'src/app/bff/[[...rest]]/route.ts': lines(
    `import type { NextRequest } from 'next/server'`,
    `export const GET = async (request: NextRequest) => {`,
    `  const path = request.nextUrl.pathname.replace('/bff/', '')`,
    `  return fetch(\`\${process.env.BACKEND_URL}/\${path}\`)`,
    `}`,
    `export async function DELETE(request: Request) {`,
    `  const { pathname } = new URL(request.url)`,
    `  return fetch(\`\${process.env.BACKEND_URL}\${pathname.slice(4)}\`, { method: 'DELETE' })`,
    `}`,
  ),
  'src/app/reviews/page.tsx': lines(
    `'use client'`,
    `import { authed } from '@/lib/authed'`,
    `export default function Reviews({ id }: { id: string }) {`,
    `  return (`,
    `    <div>`,
    `      <button onClick={() => fetch('/api/reviews')} />`,
    `      <button onClick={() => fetch(\`/api/reviews/\${id}\`, { method: 'POST' })} />`,
    `      <button onClick={() => fetch('/bff/users/me')} />`,
    `      <button onClick={() => fetch('/bff/users/me', { method: 'DELETE' })} />`,
    `      <button onClick={() => authed('/api/me')} />`,
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
const url = (s: RequestSite | undefined) => (s?.url ? urlText(s.url) : undefined)
const inComponent = (name: string) => {
  const id = model.components.find((c) => c.name === name)?.id
  return model.requests.filter((s) => s.componentId === id)
}
const handlerSites = (path: string, method: string) => {
  const route = model.routes.find((r) => r.path === path && r.kind === 'route-handler')
  return model.requests.filter((s) => s.routeId === route?.id && s.handlerMethod === method)
}

beforeAll(() => {
  model = scanProject({ root: '/proj', fileSystem: memoryProject(FILES) })
})

describe('URLs built with new URL() and string methods', () => {
  it('validates against the model schema', () => {
    expect(() => AppModelSchema.parse(model)).not.toThrow()
  })

  it('reads new URL() through href, toString(), templates and String()', () => {
    const urls = inComponent('Home').map(url)
    expect(urls).toEqual([
      '{REPORTS_URL}/v1/reports',
      'https://cdn.example.com/v1/users/:id',
      '{NEXT_PUBLIC_API_URL ?? https://api.example.com}/v1/stats',
      '{NEXT_PUBLIC_API_URL ?? https://api.example.com}/v2/teams',
      '{NEXT_PUBLIC_API_URL}/v1/orders',
      '{NEXT_PUBLIC_API_URL ?? https://api.example.com}/orders',
      '/api/profile/self',
      '/items',
    ])
    const env = inComponent('Home').find((s) => s.url?.path === '/v1/reports')
    expect(env?.url).toMatchObject({ baseEnv: 'REPORTS_URL', confidence: 'exact' })
  })
})

describe('URLs taken from data', () => {
  it('marks them as runtime URLs, not unresolved ones', () => {
    const files = inComponent('Files').filter(
      (s) => s.url?.path !== '/api/files' && s.url?.text !== 'endpoint',
    )
    expect(files).toHaveLength(3)
    for (const site of files) {
      expect(site.flags.map((f) => f.kind)).toContain('runtime-url')
      expect(site.flags.map((f) => f.kind)).not.toContain('dynamic-url')
    }
  })

  it('still warns about a URL nothing explains, or one its callers decide (a prop)', () => {
    const [site] = inComponent('Unknown')
    expect(site?.flags.map((f) => f.kind)).toContain('dynamic-url')
    const prop = inComponent('Files').find((s) => s.url?.text === 'endpoint')
    expect(prop?.flags.map((f) => f.kind)).toContain('dynamic-url')
  })
})

describe('catch-all proxy route handlers', () => {
  it('forwards the incoming path', () => {
    expect(handlerSites('/api/[...path]', 'GET').map(url)).toEqual([
      '{NEXT_PUBLIC_API_URL ?? https://api.example.com}/:path*',
    ])
    expect(handlerSites('/api/[...path]', 'POST').map(url)).toEqual([
      '{NEXT_PUBLIC_API_URL ?? https://api.example.com}/:path*',
    ])
    expect(handlerSites('/bff/[[...rest]]', 'GET').map(url)).toEqual(['{BACKEND_URL}/:rest*'])
    expect(handlerSites('/bff/[[...rest]]', 'DELETE').map(url)).toEqual(['{BACKEND_URL}/:rest*'])
  })

  it('gives each caller its upstream URL', () => {
    const sites = inComponent('Reviews')
    const upstream = (m: string, p: string) =>
      url({ url: sites.find((s) => s.method === m && s.url?.path === p)?.upstream } as RequestSite)
    expect(upstream('GET', '/api/reviews')).toBe('{NEXT_PUBLIC_API_URL ?? https://api.example.com}/reviews')
    expect(upstream('POST', '/api/reviews/:id')).toBe(
      '{NEXT_PUBLIC_API_URL ?? https://api.example.com}/reviews/:id',
    )
    expect(upstream('GET', '/bff/users/me')).toBe('{BACKEND_URL}/users/me')
    expect(upstream('DELETE', '/bff/users/me')).toBe('{BACKEND_URL}/users/me')
  })
})

describe('conditional side requests', () => {
  it('marks a request a shared helper only sometimes sends', () => {
    const sites = inComponent('Reviews')
    const refresh = sites.find((s) => s.url?.path === '/api/session/refresh')
    const main = sites.find((s) => s.url?.path === '/api/me')
    expect(refresh?.conditional).toBe(true)
    expect(main?.conditional).toBeUndefined()
    // A condition in the component itself is the component's own choice, not a side request.
    expect(sites.filter((s) => s.conditional)).toHaveLength(1)
  })
})
