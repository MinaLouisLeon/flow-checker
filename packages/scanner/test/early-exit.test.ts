// M27: a request a shared helper sends only after an early `return` / `throw` didn't happen
// (`if (res.status !== 401) return res`, then a token refresh) is a side request, like one inside
// an `if` block (M25).
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

  // Function declaration: refresh and retry after a 401 check that returns early.
  'src/lib/request.ts': lines(
    `export async function request(url: string, init?: RequestInit) {`,
    `  const res = await fetch(url, init)`,
    `  if (res.status !== 401) return res`,
    `  await fetch('/api/auth/refresh', { method: 'POST' })`,
    `  return fetch(url, init)`,
    `}`,
  ),
  // Arrow function in JavaScript: a block that throws, then an audit request.
  'src/lib/audited.js': lines(
    `export const audited = async (url) => {`,
    `  const res = await fetch(url)`,
    `  if (!res.ok) {`,
    `    throw new Error('failed')`,
    `  }`,
    `  await fetch('/api/audit', { method: 'POST' })`,
    `  return res`,
    `}`,
  ),
  // A block with other statements before its return, re-exported under another name.
  'src/lib/cached.ts': lines(
    `const cache = new Map<string, Response>()`,
    `export async function cachedGet(url: string) {`,
    `  const res = await fetch(url)`,
    `  if (res.headers.get('x-fresh')) {`,
    `    cache.set(url, res)`,
    `    return res`,
    `  }`,
    `  await fetch('/api/cache/warm', { method: 'POST' })`,
    `  return res`,
    `}`,
  ),
  'src/lib/index.ts': lines(`export { cachedGet as getCached } from './cached'`),
  // Not side requests: a return inside a callback, and two alternatives.
  'src/lib/plain.ts': lines(
    `export async function plain(url: string, items: number[]) {`,
    `  const res = await fetch(url)`,
    `  items.forEach((i) => {`,
    `    if (i > 1) return`,
    `  })`,
    `  await fetch('/api/plain/log', { method: 'POST' })`,
    `  return res`,
    `}`,
    `export async function send(url: string, upload: boolean) {`,
    `  if (upload) return fetch('/api/upload', { method: 'POST' })`,
    `  return fetch(url)`,
    `}`,
  ),

  'src/app/layout.tsx': lines(
    `export default function RootLayout({ children }: { children: unknown }) {`,
    `  return <html><body>{children as never}</body></html>`,
    `}`,
  ),
  'src/app/page.tsx': lines(
    `'use client'`,
    `import { request } from '@/lib/request'`,
    `import { audited } from '@/lib/audited'`,
    `import { getCached } from '@/lib'`,
    `import { plain, send } from '@/lib/plain'`,
    `export default function Home({ ready }: { ready: boolean }) {`,
    `  async function load() {`,
    `    if (!ready) return`,
    `    await fetch('/api/own/first')`,
    `    await request('/api/me')`,
    `    await audited('/api/orders')`,
    `    await getCached('/api/settings')`,
    `    await plain('/api/items', [1, 2])`,
    `    await send('/api/send', ready)`,
    `  }`,
    `  return <button onClick={load} />`,
    `}`,
  ),

  // A catch-all proxy whose methods go through the refreshing helper.
  'src/app/api/[...path]/route.ts': lines(
    `import { request } from '@/lib/request'`,
    `export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {`,
    `  const { path } = await params`,
    `  return request(\`\${process.env.API_URL}/\${path.join('/')}\`)`,
    `}`,
    `export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {`,
    `  const { path } = await params`,
    `  return request(\`\${process.env.API_URL}/\${path.join('/')}\`, { method: 'POST', body: req.body })`,
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
const home = () => {
  const id = model.components.find((c) => c.name === 'Home')?.id
  return model.requests.filter((s) => s.componentId === id)
}
const byUrl = (sites: RequestSite[], u: string) => sites.filter((s) => url(s) === u)

beforeAll(() => {
  model = scanProject({ root: '/proj', fileSystem: memoryProject(FILES) })
})

describe('requests after an early exit in a helper', () => {
  it('validates against the model schema', () => {
    expect(() => AppModelSchema.parse(model)).not.toThrow()
  })

  it('marks a refresh after an early return, and keeps one main request', () => {
    const sites = home()
    expect(byUrl(sites, '/api/auth/refresh').map((s) => s.conditional)).toEqual([true])
    // The retry is the same request as the first call: one site, sent every time.
    expect(byUrl(sites, '/api/me').map((s) => s.conditional)).toEqual([undefined])
  })

  it('marks a request after a block that throws (arrow, .js)', () => {
    const sites = home()
    expect(byUrl(sites, '/api/audit').map((s) => s.conditional)).toEqual([true])
    expect(byUrl(sites, '/api/orders').map((s) => s.conditional)).toEqual([undefined])
  })

  it('marks a request after a block that returns, through a re-export', () => {
    const sites = home()
    expect(byUrl(sites, '/api/cache/warm').map((s) => s.conditional)).toEqual([true])
    expect(byUrl(sites, '/api/settings').map((s) => s.conditional)).toEqual([undefined])
  })

  it("doesn't count a return inside a callback, alternatives, or the component's own guard", () => {
    const sites = home()
    expect(byUrl(sites, '/api/plain/log').map((s) => s.conditional)).toEqual([undefined])
    expect(byUrl(sites, '/api/upload').map((s) => s.conditional)).toEqual([undefined])
    expect(byUrl(sites, '/api/send').map((s) => s.conditional)).toEqual([undefined])
    expect(byUrl(sites, '/api/own/first').map((s) => s.conditional)).toEqual([undefined])
    expect(sites.filter((s) => s.conditional).map(url)).toEqual([
      '/api/auth/refresh',
      '/api/audit',
      '/api/cache/warm',
    ])
  })

  it('lists the refresh as sometimes for each method of a catch-all proxy', () => {
    const route = model.routes.find((r) => r.path === '/api/[...path]' && r.kind === 'route-handler')
    for (const method of ['GET', 'POST']) {
      const sites = model.requests.filter((s) => s.routeId === route?.id && s.handlerMethod === method)
      expect(byUrl(sites, '/api/auth/refresh').map((s) => s.conditional)).toEqual([true])
      const main = sites.filter((s) => url(s) === '{API_URL}/:path*')
      expect(main.map((s) => s.conditional)).toEqual([undefined])
    }
  })
})
