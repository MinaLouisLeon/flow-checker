// Next.js version matrix (docs/PLAN.md M11). For each version it creates a small App Router app,
// installs that Next.js version with the packed @integr8-media/flow-checker, sets it up the way the
// docs say (`flow-checker init`, plus withFlowChecker() before 15.3), and checks:
//
//   doctor  → no failed check
//   scan    → the page, route handler and its three requests are found, plus the middleware
//             (`middleware.ts` before 16, `proxy.ts` from 16): its matcher, redirect and fetch
//   dev     → a page-load server fetch, a click-triggered browser fetch and the route handler's
//             upstream fetch are captured, matched to their sites and linked (two-hop chain); the
//             middleware's fetch is captured and matched (edge runtime before 16, Node.js on 16)
//
// Run after `pnpm build` (needs network for npm and Playwright's Chromium):
//   node scripts/next-matrix.mjs                 # every version below
//   node scripts/next-matrix.mjs 14.2 15.5       # only these
//   node scripts/next-matrix.mjs --keep          # keep the temporary apps for debugging
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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
  if (legacy) {
    writeFileSync(
      join(app, 'next.config.js'),
      "const { withFlowChecker } = require('@integr8-media/flow-checker/next')\n\nmodule.exports = withFlowChecker({})\n",
    )
  }

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
  ]
  for (const expected of expectations) {
    if (!scan.includes(expected)) throw new Error(`scan is missing "${expected}":\n${scan}`)
  }
  console.log('  scan ok')

  // dev: dashboard + the app with capture on.
  const env = { ...process.env, UPSTREAM_URL: upstream, NEXT_TELEMETRY_DISABLED: '1' }
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
      await page.getByRole('button', { name: 'Say hello' }).click()
      await page.getByText('Hello from upstream').waitFor({ timeout: 60_000 })
      const captures = await waitForCaptures(dashboard, ingests)
      // The middleware redirects /old to the home page.
      await page.goto(`${appUrl}/old`)
      await page.waitForURL(`${appUrl}/`)
      const flags = await waitForMiddleware(dashboard)
      console.log(`  dev ok (${captures.length} captures matched, chain linked, ${flags} middleware fetches)`)
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
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
        exclude: ['node_modules'],
      },
      null,
      2,
    ),
    'app/layout.tsx': `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
    'app/page.tsx': `import { Hello } from '@/components/Hello'

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
    server.listen(0, '127.0.0.1', () =>
      done({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }),
    )
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
