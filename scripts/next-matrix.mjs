// Next.js version matrix (docs/PLAN.md M11). For each version it creates a small App Router app,
// installs that Next.js version with the packed @integr8-media/flow-checker, sets it up the way the
// docs say (`flow-checker init`, plus withFlowChecker() before 15.3), and checks:
//
//   init    → the app's existing register() (non-async, with a production-only `if`) gets the
//             flow-checker blocks as its first statements and becomes async (M22)
//
//   doctor  → no failed check
//   scan    → the page, route handler and its three requests are found, plus the middleware
//             (`middleware.ts` before 16, `proxy.ts` from 16): its matcher, redirect and fetch;
//             and the v0.2.0 sites: a React Query query with its key, two tRPC procedures, a
//             urql GraphQL operation, an EventSource, a native WebSocket, and the Postman
//             collection matched to the code
//   dev     → a page-load server fetch, a click-triggered browser fetch and the route handler's
//             upstream fetch are captured, matched to their sites and linked (two-hop chain); the
//             middleware's fetch is captured and matched (edge runtime before 16, Node.js on 16);
//             the query is matched by key, the tRPC batch is split per procedure, the GraphQL
//             capture is matched and type-checked, and the event stream's and socket's messages
//             are captured and matched
//
// Run after `pnpm build` (needs network for npm and Playwright's Chromium):
//   node scripts/next-matrix.mjs                 # every version below
//   node scripts/next-matrix.mjs 14.2 15.5       # only these
//   node scripts/next-matrix.mjs --keep          # keep the temporary apps for debugging
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const repo = resolve(import.meta.dirname, '..')
const pkgDir = join(repo, 'packages', 'flow-checker')
const isWin = process.platform === 'win32'

/** Oldest supported, each major's last line, and the version split points (15.0, 15.3). */
export const VERSIONS = {
  13.4: { next: '13.4.19', react: '18.3.1' },
  14.2: { next: '14.2.35', react: '18.3.1' },
  15.2: { next: '15.2.9', react: '19.1.1' },
  15.5: { next: '15.5.28', react: '19.1.1' },
  16: { next: '16.4.3', react: '19.3.1' },
}

const args = process.argv.slice(2)
const keep = args.includes('--keep')
const wanted = args.filter((a) => !a.startsWith('--'))
const versions = wanted.length ? wanted : Object.keys(VERSIONS)
for (const v of versions) {
  if (!VERSIONS[v]) {
    console.error(`Unknown version "${v}". Known: ${Object.keys(VERSIONS).join(', ')}`)
    process.exit(1)
  }
}

const work = mkdtempSync(join(tmpdir(), 'flow-checker-matrix-'))
const results = []

try {
  run('pnpm', ['pack', '--pack-destination', work], pkgDir)
  const tarball = join(
    work,
    readdirSync(work).find((f) => f.endsWith('.tgz')),
  )
  const upstream = await startUpstream()
  const browser = await chromium.launch()
  try {
    for (const v of versions) {
      const started = Date.now()
      const log = []
      try {
        await checkVersion(v, VERSIONS[v], { tarball, upstream: upstream.url, browser, log })
        results.push({ v, ok: true, seconds: (Date.now() - started) / 1000 })
      } catch (error) {
        results.push({ v, ok: false, seconds: (Date.now() - started) / 1000, error, log })
      }
    }
  } finally {
    await browser.close()
    upstream.close()
  }
} finally {
  if (!keep) removeDir(work)
  else console.log(`Kept ${work}`)
}

console.log('\nNext.js matrix:')
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} Next ${VERSIONS[r.v].next} (${Math.round(r.seconds)} s)`)
  if (!r.ok) {
    console.log(
      `      ${String(r.error?.message ?? r.error)
        .split('\n')
        .join('\n      ')}`,
    )
    const tail = r.log.slice(-40)
    if (tail.length) console.log(`      --- last output ---\n      ${tail.join('\n      ')}`)
  }
}
if (results.some((r) => !r.ok)) process.exitCode = 1

// --- One version ------------------------------------------------------------------------------

async function checkVersion(key, { next, react }, { tarball, upstream, browser, log }) {
  console.log(`\n▶ Next ${next}`)
  const app = join(work, `next-${key}`)
  writeApp(app, atLeast(next, 16, 0))
  const legacy = !atLeast(next, 15, 3)
  const reactTypes = react.startsWith('18') ? '18' : '19'
  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--loglevel=error',
      tarball,
      `next@${next}`,
      `react@${react}`,
      `react-dom@${react}`,
      'typescript@5',
      `@types/react@${reactTypes}`,
      `@types/react-dom@${reactTypes}`,
      '@types/node@22',
      // v0.2.0 libraries, at the versions the fixtures use.
      '@tanstack/react-query@5.105.0',
      '@trpc/server@11.22.1',
      '@trpc/client@11.22.1',
      'zod@4.6.7',
      'urql@5.0.4',
      '@urql/core@6.0.3',
      'graphql@16.14.2',
    ],
    app,
  )

  const cli = join(app, 'node_modules', '@integr8-media', 'flow-checker', 'dist', 'cli.js')
  const fc = (...a) => run(process.execPath, [cli, ...a], app)

  // Set up as a user would: init, then (before 15.3) the next.config wrapper init asks for.
  const init = fc('init', '--yes')
  if (legacy !== init.includes('withFlowChecker')) {
    throw new Error(`init ${legacy ? 'did not ask' : 'asked'} for withFlowChecker():\n${init}`)
  }
  // M22: the existing register() is edited in place, keeping the app's own code.
  const hook = readFileSync(join(app, 'instrumentation.ts'), 'utf8')
  if (
    !init.includes('update  instrumentation.ts (adds the flow-checker blocks at the start of register()') ||
    !/^export async function register\(\): Promise<void> \{\n {2}\/\/ flow-checker:/.test(hook) ||
    !hook.includes("console.log('tracing on')")
  ) {
    throw new Error(`init did not edit the existing register():\n${init}\n${hook}`)
  }
  if (legacy) {
    writeFileSync(
      join(app, 'next.config.js'),
      "const { withFlowChecker } = require('@integr8-media/flow-checker/next')\n\nmodule.exports = withFlowChecker({})\n",
    )
  }
  // The Postman contract (M15), added to the config init wrote.
  writeFileSync(
    join(app, 'flow-checker.config.ts'),
    "import { defineConfig } from '@integr8-media/flow-checker/config'\n\nexport default defineConfig({ postman: { collection: 'api.postman_collection.json' } })\n",
  )

  const [port, appPort] = [await freePort(), await freePort()]
  const ports = ['--port', String(port), '--app-port', String(appPort)]
  const doctor = spawnSync(process.execPath, [cli, 'doctor', ...ports], { cwd: app, encoding: 'utf8' })
  if (doctor.status !== 0) throw new Error(`doctor failed:\n${doctor.stdout}${doctor.stderr}`)
  console.log('  doctor ok')

  const scan = fc('scan', '--requests', '--tree', '--flows')
  const middlewareFile = atLeast(next, 16, 0) ? 'proxy.ts' : 'middleware.ts'
  const expectations = [
    '/api/hello',
    '/greeting',
    '/page',
    // Middleware (M14): the file, the routes its matcher selects, its redirect and its fetch.
    `${middlewareFile}  ${atLeast(next, 16, 0) ? 'proxy' : 'middleware'}`,
    'matcher: /, /old',
    'redirect / -> /  middleware',
    '/flags  fetch  middleware',
    // v0.2.0: React Query key, tRPC procedures, GraphQL operation, SSE events, socket messages.
    "fetch useQuery(['todos', 'list'])",
    'procedure: greet (query)',
    'procedure: count (query)',
    'operation: Notes (query)',
    'schema: file schema.graphql, 2 types',
    'event tick: Tick',
    'sends message: Ping',
    'receives message: Echo',
    // Postman: /api/todos is in the collection, /api/archive is called by nothing.
    'Postman "Matrix API": 1 of 2 collection requests called',
  ]
  for (const expected of expectations) {
    if (!scan.includes(expected)) throw new Error(`scan is missing "${expected}":\n${scan}`)
  }
  console.log('  scan ok')

  // dev: dashboard + the app with capture on.
  const env = {
    ...process.env,
    UPSTREAM_URL: upstream,
    NEXT_PUBLIC_WS_URL: `${upstream.replace('http', 'ws')}/echo`,
    NEXT_TELEMETRY_DISABLED: '1',
  }
  delete env.FLOW_CHECKER
  const dev = spawn(process.execPath, [cli, 'dev', '--no-open', '--no-watch', ...ports], {
    cwd: app,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !isWin,
  })
  for (const stream of [dev.stdout, dev.stderr]) {
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => log.push(...chunk.split(/\r?\n/).filter(Boolean)))
  }
  const dashboard = `http://127.0.0.1:${port}`
  const appUrl = `http://localhost:${appPort}`
  try {
    await waitFor(async () => (await fetch(`${dashboard}/api/health`)).ok, 'the dashboard', 30_000)
    // The first request compiles the page; old versions take a while.
    await waitFor(async () => (await fetch(appUrl)).ok, 'the app', 180_000)

    // The page stays open until the captures arrive: the runtime sends them in batches.
    const page = await browser.newPage()
    const ingests = []
    page.on('response', (res) => {
      if (res.url().endsWith('/ingest')) ingests.push(res.status())
    })
    page.on('pageerror', (error) => log.push(`[browser] ${error.message}`))
    page.on('console', (msg) => log.push(`[browser ${msg.type()}] ${msg.text()}`))
    try {
      await page.goto(appUrl)
      await clickUntil(page.getByRole('button', { name: 'Say hello' }), page.getByText('Hello from upstream'))
      const captures = await waitForCaptures(dashboard, ingests)
      // v0.2.0 transports: the page loads the query, GraphQL, the event stream and the socket.
      await page.getByText('Matrix todo').waitFor({ timeout: 60_000 })
      await page.getByText('1 notes').waitFor({ timeout: 60_000 })
      await page.getByText('Ticks: 3').waitFor({ timeout: 60_000 })
      await page.getByText('Echo: echo: ping').waitFor({ timeout: 60_000 })
      await page.getByRole('button', { name: 'Call tRPC' }).click()
      await page.getByText('Hi matrix (3)').waitFor({ timeout: 60_000 })
      const transports = await waitForTransports(dashboard)
      // The middleware redirects /old to the home page.
      await page.goto(`${appUrl}/old`)
      await page.waitForURL(`${appUrl}/`)
      const flags = await waitForMiddleware(dashboard)
      console.log(
        `  dev ok (${captures.length} captures matched, chain linked, ${flags} middleware fetches, ${transports})`,
      )
    } finally {
      await page.close()
    }
  } finally {
    await stop(dev)
  }
}

function waitForCaptures(dashboard, ingests) {
  return waitFor(
    async () => {
      const list = await (await fetch(`${dashboard}/api/captures`)).json()
      const browserHello = list.find((c) => c.origin === 'browser' && c.url.endsWith('/api/hello'))
      const hop = list.find(
        (c) => c.origin === 'server' && c.url.endsWith('/greeting') && c.parentCaptureId === browserHello?.id,
      )
      const render = list.find((c) => c.origin === 'server' && c.url.endsWith('/page'))
      const all = [browserHello, hop, render]
      return all.every((c) => c?.match?.status === 'matched') ? all : undefined
    },
    'browser, route handler and page-load captures, matched',
    30_000,
  ).catch(async (error) => {
    const list = await (await fetch(`${dashboard}/api/captures`)).json().catch(() => [])
    error.message += `\nBrowser /ingest responses: ${ingests.join(', ') || 'none'}`
    error.message += `\nCaptured:\n${list.map((c) => `  ${c.origin} ${c.method} ${c.url.slice(0, 120)} parent=${c.parentCaptureId ?? '-'} match=${c.match?.status ?? '-'}`).join('\n') || '  nothing'}`
    throw error
  })
}

/**
 * v0.2.0 captures, each matched: the React Query request (by its key), both procedures of the
 * tRPC batch (split), the GraphQL operation, the event stream's messages and the socket's.
 */
function waitForTransports(dashboard) {
  const get = async (path) => (await fetch(`${dashboard}${path}`)).json()
  const matched = (c) => c?.match?.status === 'matched'
  /** The full capture's winning evidence, e.g. `query-key`. */
  const signals = async (c) =>
    (await get(`/api/captures/${c.id}`)).capture?.match?.candidates?.[0]?.evidence?.map((e) => e.signal) ?? []
  const checks = {
    'react-query': async (list) => {
      const c = list.find((x) => x.origin === 'browser' && x.url.endsWith('/api/todos'))
      return c && (await signals(c)).includes('query-key') ? c : undefined
    },
    'trpc greet': async (list) => list.find((c) => c.procedure === 'greet'),
    'trpc count': async (list) => list.find((c) => c.procedure === 'count'),
    graphql: async (list) => list.find((c) => c.operation === 'Notes' && c.typeCheck === 'ok'),
    sse: async (list) => list.find((c) => c.transport === 'eventsource' && c.stream?.count >= 3),
    websocket: async (list) => list.find((c) => c.transport === 'websocket' && c.stream?.count >= 2),
  }
  const missing = async (list) => {
    const out = []
    for (const [name, check] of Object.entries(checks)) if (!matched(await check(list))) out.push(name)
    return out
  }
  return waitFor(
    async () =>
      (await missing(await get('/api/captures'))).length ? undefined : Object.keys(checks).join(', '),
    'React Query, tRPC, GraphQL, SSE and WebSocket captures, matched',
    30_000,
  ).catch(async (error) => {
    const list = await get('/api/captures').catch(() => [])
    error.message += `\nMissing: ${(await missing(list).catch(() => [])).join(', ')}`
    // Tells a key the browser never sent apart from one the matcher did not use.
    for (const c of list.filter((x) => x.origin === 'browser' && x.url.endsWith('/api/todos'))) {
      const full = (await get(`/api/captures/${c.id}`).catch(() => ({}))).capture
      const top = full?.match?.candidates?.[0]
      error.message += `\nReact Query capture ${c.id}: query=${JSON.stringify(full?.query ?? null)} at ${full?.timestamp ?? '-'}`
      error.message += `\n  top candidate ${top?.siteId ?? '-'}: ${top?.evidence?.map((e) => `${e.signal}${e.points >= 0 ? '+' : ''}${e.points}`).join(' ') ?? '-'}`
    }
    error.message += `\nCaptured:\n${list.map((c) => `  ${c.origin} ${c.transport} ${c.method} ${c.url.slice(0, 100)} ${c.procedure ?? c.operation ?? ''} stream=${c.stream?.count ?? '-'} match=${c.match?.status ?? '-'} types=${c.typeCheck ?? '-'}`).join('\n') || '  nothing'}`
    throw error
  })
}

/** The middleware's upstream fetch, captured and matched to the middleware's site. */
function waitForMiddleware(dashboard) {
  return waitFor(
    async () => {
      const list = await (await fetch(`${dashboard}/api/captures`)).json()
      const flags = list.filter((c) => c.origin === 'server' && c.url.endsWith('/flags'))
      return flags.length > 0 && flags.every((c) => c.match?.status === 'matched') ? flags.length : undefined
    },
    'the middleware fetch, matched',
    30_000,
  ).catch(async (error) => {
    const list = await (await fetch(`${dashboard}/api/captures`)).json().catch(() => [])
    error.message += `\nCaptured:\n${list.map((c) => `  ${c.origin} ${c.method} ${c.url.slice(0, 120)} match=${c.match?.status ?? '-'}`).join('\n') || '  nothing'}`
    throw error
  })
}

// --- The app ----------------------------------------------------------------------------------

function writeApp(dir, proxy) {
  const files = {
    'package.json': JSON.stringify(
      { name: 'matrix-app', private: true, scripts: { dev: 'next dev' } },
      null,
      2,
    ),
    '.gitignore': 'node_modules\n.next\n',
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2017',
          lib: ['dom', 'dom.iterable', 'esnext'],
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          skipLibCheck: true,
          allowJs: true,
          plugins: [{ name: 'next' }],
          paths: { '@/*': ['./*'] },
        },
        // Old Next versions add `.next/types` on first start; that rewrite rebuilds the page and can
        // swallow the first click, so it is already here.
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
      },
      null,
      2,
    ),
    // The app's own register() from before flow-checker (M22): init must put its blocks first,
    // outside this condition, and make register async.
    'instrumentation.ts': `export function register(): void {
  if (process.env.NODE_ENV === 'production') {
    console.log('tracing on')
  }
}
`,
    'app/layout.tsx': `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
    'app/page.tsx': `import { EchoSocket } from '@/components/Echo'
import { Hello } from '@/components/Hello'
import { Notes } from '@/components/Notes'
import { Ticks } from '@/components/Ticks'
import { Todos } from '@/components/Todos'
import { Trpc } from '@/components/Trpc'

interface PageData {
  title: string
}

async function getPage(): Promise<PageData> {
  const res = await fetch(\`\${process.env.UPSTREAM_URL}/page\`, { cache: 'no-store' })
  return res.json()
}

export const dynamic = 'force-dynamic'

export default async function Home() {
  const data = await getPage()
  return (
    <main>
      <h1>{data.title}</h1>
      <Hello />
      <Todos />
      <Trpc />
      <Notes />
      <Ticks />
      <EchoSocket />
    </main>
  )
}
`,
    'components/Hello.tsx': `'use client'
import { useState } from 'react'

interface Greeting {
  message: string
}

export function Hello() {
  const [message, setMessage] = useState('')
  async function onClick() {
    const res = await fetch('/api/hello')
    const data: Greeting = await res.json()
    setMessage(data.message)
  }
  return (
    <div>
      <button type="button" onClick={onClick}>
        Say hello
      </button>
      <p>{message}</p>
    </div>
  )
}
`,
    'app/api/hello/route.ts': `export const dynamic = 'force-dynamic'

export async function GET() {
  const res = await fetch(\`\${process.env.UPSTREAM_URL}/greeting\`, { cache: 'no-store' })
  return Response.json(await res.json())
}
`,
    'next.config.js': 'module.exports = {}\n',
    // --- v0.2.0 transports (M13, M15–M19), all rendered on the home page ---
    // React Query (M13): a query whose key is captured with its request.
    'components/Todos.tsx': `'use client'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

interface Todo {
  id: number
  title: string
}

function TodoList() {
  const { data } = useQuery({
    queryKey: ['todos', 'list'],
    queryFn: async (): Promise<Todo[]> => (await fetch('/api/todos')).json(),
  })
  return <ul>{data?.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
}

export function Todos() {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <TodoList />
    </QueryClientProvider>
  )
}
`,
    'app/api/todos/route.ts': `export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json([{ id: 1, title: 'Matrix todo' }])
}
`,
    // tRPC (M16): two procedures called together, sent as one batched request.
    'server/trpc.ts': `import { initTRPC } from '@trpc/server'
import { z } from 'zod'

const t = initTRPC.create()

export const appRouter = t.router({
  greet: t.procedure.input(z.object({ name: z.string() })).query(({ input }) => ({ text: \`Hi \${input.name}\` })),
  count: t.procedure.query(() => ({ total: 3 })),
})

export type AppRouter = typeof appRouter
`,
    'app/api/trpc/[trpc]/route.ts': `import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/trpc'

const handler = (req: Request) =>
  fetchRequestHandler({ endpoint: '/api/trpc', req, router: appRouter, createContext: () => ({}) })

export { handler as GET, handler as POST }
`,
    'components/Trpc.tsx': `'use client'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { useState } from 'react'
import type { AppRouter } from '@/server/trpc'

const trpc = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: '/api/trpc' })] })

export function Trpc() {
  const [text, setText] = useState('')
  async function onClick() {
    const [greet, count] = await Promise.all([trpc.greet.query({ name: 'matrix' }), trpc.count.query()])
    setText(\`\${greet.text} (\${count.total})\`)
  }
  return (
    <div>
      <button type="button" onClick={onClick}>
        Call tRPC
      </button>
      <p>{text}</p>
    </div>
  )
}
`,
    // GraphQL (M17): an untyped urql query, typed from schema.graphql.
    'schema.graphql': 'type Query {\n  notes: [Note!]!\n}\n\ntype Note {\n  id: ID!\n  text: String!\n}\n',
    'app/api/graphql/route.ts': `export const dynamic = 'force-dynamic'

const notes = [{ id: '1', text: 'Matrix note' }]

export async function GET() {
  return Response.json({ data: { notes } })
}

export async function POST() {
  return Response.json({ data: { notes } })
}
`,
    'components/Notes.tsx': `'use client'
import { useEffect, useState } from 'react'
import { cacheExchange, createClient, fetchExchange, gql, Provider, useQuery } from 'urql'

const client = createClient({ url: '/api/graphql', exchanges: [cacheExchange, fetchExchange] })

const NotesQuery = gql\`
  query Notes {
    notes {
      id
      text
    }
  }
\`

function NoteList() {
  const [{ data }] = useQuery({ query: NotesQuery })
  return <p>{data ? \`\${data.notes.length} notes\` : ''}</p>
}

// Client only: the relative URL can't be fetched during server rendering.
export function Notes() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? (
    <Provider value={client}>
      <NoteList />
    </Provider>
  ) : null
}
`,
    // Server-sent events (M18): a route handler that writes three named events.
    'app/api/events/route.ts': `export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (let n = 1; n <= 3; n++) {
        controller.enqueue(encoder.encode(\`event: tick\\ndata: \${JSON.stringify({ n })}\\n\\n\`))
        await new Promise((r) => setTimeout(r, 200))
      }
      controller.close()
    },
  })
  return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } })
}
`,
    'components/Ticks.tsx': `'use client'
import { useEffect, useState } from 'react'

interface Tick {
  n: number
}

export function Ticks() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const source = new EventSource('/api/events')
    source.addEventListener('tick', (e) => {
      const tick = JSON.parse((e as MessageEvent).data) as Tick
      setN(tick.n)
      if (tick.n === 3) source.close()
    })
    return () => source.close()
  }, [])
  return <p>Ticks: {n}</p>
}
`,
    // WebSockets (M19): a native socket to the script's echo server.
    'components/Echo.tsx': `'use client'
import { useEffect, useState } from 'react'

interface Ping {
  text: string
}

interface Echo {
  text: string
}

export function EchoSocket() {
  const [text, setText] = useState('')
  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL ?? '')
    const ping: Ping = { text: 'ping' }
    ws.onopen = () => ws.send(JSON.stringify(ping))
    ws.onmessage = (e) => {
      const echo = JSON.parse(e.data) as Echo
      setText(echo.text)
    }
    return () => ws.close()
  }, [])
  return <p>Echo: {text}</p>
}
`,
    // Postman (M15): the contract. /api/todos is called, /api/archive isn't.
    'api.postman_collection.json': JSON.stringify(
      {
        info: {
          name: 'Matrix API',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'List todos',
            request: { method: 'GET', url: { raw: '/api/todos', path: ['api', 'todos'] } },
          },
          {
            name: 'Archive',
            request: { method: 'GET', url: { raw: '/api/archive', path: ['api', 'archive'] } },
          },
        ],
      },
      null,
      2,
    ),
    // Middleware: Next 16 calls it proxy.ts (Node.js runtime); before that middleware.ts (edge).
    [proxy ? 'proxy.ts' : 'middleware.ts']: `import { NextResponse, type NextRequest } from 'next/server'

export async function ${proxy ? 'proxy' : 'middleware'}(request: NextRequest) {
  await fetch(\`\${process.env.UPSTREAM_URL}/flags\`, { cache: 'no-store' })
  if (request.nextUrl.pathname === '/old') return NextResponse.redirect(new URL('/', request.url))
  return NextResponse.next()
}

export const config = { matcher: ['/', '/old'] }
`,
  }
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  // Stops lockfile and .gitignore lookups at the app.
  mkdirSync(join(dir, '.git'), { recursive: true })
  writeFileSync(join(dir, 'package-lock.json'), '{}')
}

// --- Helpers ----------------------------------------------------------------------------------

/** The external API the app calls. */
function startUpstream() {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      res.setHeader('content-type', 'application/json')
      if (req.url === '/greeting') res.end(JSON.stringify({ message: 'Hello from upstream' }))
      else if (req.url === '/flags') res.end(JSON.stringify({ beta: true }))
      else if (req.url === '/page') res.end(JSON.stringify({ title: 'Matrix app' }))
      else {
        res.statusCode = 404
        res.end('{}')
      }
    })
    server.on('upgrade', echoSocket)
    server.listen(0, '127.0.0.1', () =>
      done({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }),
    )
  })
}

/**
 * A WebSocket echo server, just enough for the app's socket: answers each text message
 * `{ text }` with `{ text: 'echo: <text>' }` and replies to a close. Short frames only.
 */
function echoSocket(req, socket) {
  const accept = createHash('sha1')
    .update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64')
  socket.on('error', () => {})
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
  )
  const frame = (opcode, payload) => Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload])
  let buffer = Buffer.alloc(0)
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    while (buffer.length >= 2) {
      const opcode = buffer[0] & 0x0f
      let length = buffer[1] & 0x7f
      let offset = 2
      if (length === 126) {
        if (buffer.length < 4) return
        length = buffer.readUInt16BE(2)
        offset = 4
      }
      // Browsers always mask what they send.
      const mask = buffer.subarray(offset, offset + 4)
      offset += 4
      if (buffer.length < offset + length) return
      const payload = Buffer.from(buffer.subarray(offset, offset + length)).map((b, i) => b ^ mask[i % 4])
      buffer = buffer.subarray(offset + length)
      if (opcode === 8) {
        socket.end(frame(8, payload))
        return
      }
      if (opcode === 1) {
        const { text } = JSON.parse(payload.toString('utf8'))
        socket.write(frame(1, Buffer.from(JSON.stringify({ text: `echo: ${text}` }))))
      }
    }
  })
}

function run(cmd, args, cwd) {
  // npm/pnpm are .cmd shims on Windows and need a shell, which splits on spaces.
  const viaShell = isWin && cmd !== process.execPath
  const argv = viaShell ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args
  try {
    return execFileSync(cmd, argv, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: viaShell,
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    throw new Error(`${cmd} ${args.join(' ')} failed:\n${error.stdout ?? ''}${error.stderr ?? error.message}`)
  }
}

/**
 * Stops `flow-checker dev` and waits for it to exit. On SIGTERM it stops the app's process tree
 * first, so nothing writes into the temporary folder afterwards. Force-kills after 15 s.
 */
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise((done) => child.once('exit', done))
  const signal = (sig) => {
    try {
      if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      else process.kill(-child.pid, sig)
    } catch {}
  }
  signal('SIGTERM')
  const timedOut = await Promise.race([
    exited.then(() => false),
    new Promise((r) => setTimeout(() => r(true), 15_000)),
  ])
  if (timedOut) {
    signal('SIGKILL')
    await exited
  }
}

/** Removes a temporary folder. A file still held open by a stopped process only warns. */
function removeDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  } catch (error) {
    console.warn(`Could not remove ${dir}: ${error.message}`)
  }
}

/**
 * Clicks until `shown` appears. A click that lands before hydration, or during a Fast Refresh rebuild in
 * a freshly started dev server, does nothing, so one lost click must not fail the run.
 */
async function clickUntil(button, shown, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs
  for (;;) {
    await button.click()
    try {
      await shown.waitFor({ timeout: Math.min(10_000, Math.max(1, until - Date.now())) })
      return
    } catch (error) {
      if (Date.now() >= until) throw error
    }
  }
}

async function waitFor(check, what, timeoutMs) {
  const until = Date.now() + timeoutMs
  let last
  while (Date.now() < until) {
    try {
      const value = await check()
      if (value) return value
    } catch (error) {
      last = error
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Timed out waiting for ${what}${last ? ` (${last.message})` : ''}`)
}

function freePort() {
  return new Promise((done) => {
    const server = createNetServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => done(port))
    })
  })
}

function atLeast(version, major, minor) {
  const [a, b] = version.split('.').map(Number)
  return a > major || (a === major && b >= minor)
}
