// Next.js version matrix (docs/PLAN.md M11). For each version it creates a small App Router app,
// installs that Next.js version with the packed @integr8-media/flow-checker, sets it up the way the
// docs say (`flow-checker init`, plus withFlowChecker() before 15.3), and checks:
//
//   explore → before any setup, the dashboard serves the scan (with the guarded page) and no
//             project file is created or changed (M28)
//   init    →the app's existing register() (non-async, with a production-only `if`) gets the
//             flow-checker blocks as its first statements and becomes async (M22)
//
//   doctor  → no failed check
//   scan    → the page, route handler and its three requests are found, plus the middleware
//             (`middleware.ts` before 16, `proxy.ts` from 16): its matcher, redirect and fetch;
//             and the v0.2.0 sites: a React Query query with its key, two tRPC procedures, a
//             urql GraphQL operation, an EventSource, a native WebSocket, and the Postman
//             collection matched to the code; and v0.3.0: the account page is `guarded`;
//             and v0.4.0: each page's render mode, the cached fetch with its tag and the route
//             handler that revalidates it, a missing loading state and a templated title;
//             and v0.5.0: client boundaries and no server/client leak, a private env name read in
//             client code (its `.env` value never written out), an open server action next to a
//             checked one, and a server waterfall
//   build   → `next build` prints the same render mode for every page as the scan (M38), and its
//             client reference manifests list the scanned client boundaries (M43, from 14.2)
//   summary → Start here names the Next.js version, the middleware and the start page (M32)
//   impact  → the route handler file affects the page that calls it (M36)
//   dev     →a page-load server fetch, a click-triggered browser fetch and the route handler's
//             upstream fetch are captured, matched to their sites and linked (two-hop chain); the
//             middleware's fetch is captured and matched (edge runtime before 16, Node.js on 16);
//             the query is matched by key, the tRPC batch is split per procedure, the GraphQL
//             capture is matched and type-checked, and the event stream's and socket's messages
//             are captured and matched; the cached fetch is a hit on the second visit (M40,
//             Next 15 and later); the waterfall is confirmed by capture timings (M47)
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
import {
  compareClientBoundaries,
  compareRenderModes,
  readBuildTable,
  readClientReferences,
} from './next-build-table.mjs'

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

/** A fake value for the `.env` name the client reads; it must never appear in the scan's output. */
const SECRET = 'matrix-secret-value'

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
  writeApp(app, next)
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

  // M28: explore on the app as cloned (no config, no hooks), leaving every project file as it was.
  await checkExplore(cli, app, log)

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
      `const { withFlowChecker } = require('@integr8-media/flow-checker/next')\n\nmodule.exports = withFlowChecker(${nextConfig(next)})\n`,
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
    // v0.3.0 (M31): the account page redirects when there is no session cookie.
    'access: guarded',
    'redirects to `/` when `!session` (page)',
    // v0.4.0: render modes (M38), the server cache map (M39), boundaries and titles (M41).
    /## \/ {2}app\/page\.tsx\n[^#]*render: dynamic\n {2}dynamic: /,
    /## \/account {2}[^#]*render: dynamic\n {2}dynamic: /,
    /## \/cached {2}[^#]*render: ISR 1m\n/,
    /## \/cached {2}[^#]*title: Cached \| Matrix/,
    /## \/ {2}app\/page\.tsx\n[^#]*! no loading state:/,
    /fetch {2}\{UPSTREAM_URL\}\/quote {2}\[quote\] {2}1m {2}app\/cached\/page\.tsx:\d+\n {2}used by: \/cached\n/,
    /revalidateTag\('quote'[^)]*\) {2}in route handler `POST \/api\/refresh`[^\n]*\n {2}refreshes: fetch \{UPSTREAM_URL\}\/quote\n {2}pages: \/cached\n/,
    // v0.5.0: client boundaries (M43), env names (M45), server actions (M46), a waterfall (M47).
    /## \/ {2}app\/page\.tsx\n[^#]*client: 7 boundaries/,
    /^MATRIX_SECRET: \.env \[private-in-client\]$/m,
    /^UPSTREAM_URL: not defined \[not-defined\]$/m,
    /deleteNote \(no auth check, input not checked\) \[unprotected\]/,
    /renameNote \(auth checked, input checked\)/,
    /waterfall \(server\) in Slow app\/slow\/page\.tsx:\d+\n {2}1\. await getUser\(\) [^\n]*\n {2}2\. await getStats\(\) /,
  ]
  for (const expected of expectations) {
    const found = typeof expected === 'string' ? scan.includes(expected) : expected.test(scan)
    if (!found) throw new Error(`scan is missing ${expected}:\n${scan}`)
  }
  const modelText = readFileSync(join(app, '.flow-checker', 'model.json'), 'utf8')
  const model = JSON.parse(modelText)
  // M44: nothing in the app crosses the server/client line wrongly (it builds and runs).
  if (model.leaks?.length)
    throw new Error(`scan found leaks in an app that runs:\n${JSON.stringify(model.leaks)}`)
  // M45: names only, never the value from `.env`.
  if (scan.includes(SECRET) || modelText.includes(SECRET)) throw new Error('the scan wrote a value from .env')
  console.log('  scan ok')

  // v0.3.0: Start here in the terminal (M32) and the impact of a route handler file (M36).
  const summary = fc('summary')
  for (const expected of [
    new RegExp(`Next\\.js +${next.replaceAll('.', '\\.')}`),
    atLeast(next, 16, 0) ? /Proxy +proxy\.ts/ : /Middleware +middleware\.ts/,
    /^ *Start page +\/ /m,
  ]) {
    if (!expected.test(summary)) throw new Error(`summary is missing ${expected}:\n${summary}`)
  }
  const impact = fc('impact', join('app', 'api', 'hello', 'route.ts'))
  if (!/page +\/ +sends GET \/api\/hello/.test(impact) || !impact.includes('route handler  /api/hello')) {
    throw new Error(`impact of app/api/hello/route.ts is missing the page or the handler:\n${impact}`)
  }
  console.log('  summary and impact ok')

  // M38: `next build` prints the render mode the scan gives each page.
  // Not spawnSync: the build fetches from the upstream server, which runs in this process.
  const build = await runAsync(
    process.execPath,
    [join(app, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'],
    app,
    { ...process.env, UPSTREAM_URL: upstream, NEXT_TELEMETRY_DISABLED: '1', FLOW_CHECKER: '' },
  )
  const buildOut = build.output
  if (build.status !== 0) throw new Error(`next build failed:\n${buildOut}`)
  const built = readBuildTable(buildOut)
  const modes = compareRenderModes(model, built)
  if (built.size < 3 || modes.length > 0) {
    throw new Error(
      `next build and the scan disagree (${built.size} routes read):\n${modes.join('\n')}\n${buildOut}`,
    )
  }
  // M43: the build's client references are the scanned boundaries.
  const references = readClientReferences(app)
  const refProblems = references
    ? compareClientBoundaries(model, references)
    : ['no client reference manifest']
  if (refProblems.length) {
    throw new Error(`next build and the scanned client boundaries differ:\n${refProblems.join('\n')}`)
  }
  const clientRefs = `${references.size} client references`
  // dev must not start from the production build.
  removeDir(join(app, '.next'))
  console.log(`  build ok (${built.size} routes, same render modes, ${clientRefs})`)

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
      // M40: the cached fetch misses on the first visit and is a hit on the second.
      let cache = 'cache check skipped before Next 15'
      if (atLeast(next, 15, 0)) {
        for (let i = 0; i < 2; i++) {
          await page.goto(`${appUrl}/cached`)
          await page.getByText('Quote: Matrix quote').waitFor({ timeout: 60_000 })
        }
        cache = `cached fetch ${await waitForCacheHit(dashboard)}`
      }
      // M47: the two independent awaits run one after the other at runtime.
      await page.goto(`${appUrl}/slow`)
      await page.getByText('Slow: Matrix user, 3 stats').waitFor({ timeout: 60_000 })
      const waterfall = await waitForWaterfall(dashboard)
      console.log(
        `  dev ok (${captures.length} captures matched, chain linked, ${flags} middleware fetches, ${transports}, ${cache}, ${waterfall})`,
      )
    } finally {
      await page.close()
    }
  } finally {
    await stop(dev)
  }
}

/**
 * `explore` before any setup (M28): the dashboard serves the scan (pages, the route handler and the
 * guarded page's access) and no file in the project is created, changed or removed.
 */
async function checkExplore(cli, app, log) {
  const before = projectFiles(app)
  const port = await freePort()
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }
  delete env.FLOW_CHECKER
  const explore = spawn(
    process.execPath,
    [cli, 'explore', '--no-open', '--no-watch', '--port', String(port)],
    {
      cwd: app,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: !isWin,
    },
  )
  const output = []
  for (const stream of [explore.stdout, explore.stderr]) {
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => output.push(...chunk.split(/\r?\n/).filter(Boolean)))
  }
  try {
    const dashboard = `http://127.0.0.1:${port}`
    const model = await waitFor(
      async () => {
        const res = await fetch(`${dashboard}/api/model`)
        const body = res.ok ? await res.json() : undefined
        return body?.routes?.length ? body : undefined
      },
      'the explore dashboard to serve a scan',
      120_000,
    ).catch((error) => {
      error.message += `\nexplore output:\n${output.join('\n')}`
      throw error
    })
    const route = (path) => model.routes.find((r) => r.path === path)
    if (route('/')?.kind !== 'page' || route('/api/hello')?.kind !== 'route-handler') {
      throw new Error(
        `explore's model is missing / or /api/hello: ${model.routes.map((r) => r.path).join(', ')}`,
      )
    }
    if (route('/account')?.access?.status !== 'guarded') {
      throw new Error(`explore's /account is not guarded: ${JSON.stringify(route('/account')?.access)}`)
    }
    if (!output.some((line) => line.includes('Start here gives a short tour'))) {
      throw new Error(`explore did not point to Start here:\n${output.join('\n')}`)
    }
  } finally {
    log.push(...output)
    await stop(explore)
    // The scan explore kept in the OS temp folder.
    const kept = output.join('\n').match(/the scan is kept in (.+), outside the project/)?.[1]
    if (kept && !keep) removeDir(kept)
  }
  const after = projectFiles(app)
  if (after !== before) throw new Error(`explore changed the project:\nbefore:\n${before}\nafter:\n${after}`)
  console.log('  explore ok (project untouched)')
}

/** Every file in the app with its content hash, apart from installed packages. */
function projectFiles(dir, prefix = '') {
  const out = []
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (path === 'node_modules') continue
    if (entry.isDirectory()) out.push(`${path}/`, projectFiles(dir, path))
    else {
      const hash = createHash('sha256')
        .update(readFileSync(join(dir, path)))
        .digest('hex')
        .slice(0, 12)
      out.push(`${path} ${hash}`)
    }
  }
  return out.filter(Boolean).join('\n')
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

/** The cached fetch's runtime result on the served model: Next reused it. */
function waitForCacheHit(dashboard) {
  const entry = async () => {
    const model = await (await fetch(`${dashboard}/api/model`)).json()
    return model.cache?.entries?.find((e) => e.kind === 'fetch' && e.name.endsWith('/quote'))
  }
  return waitFor(
    async () => {
      const runtime = (await entry())?.runtime
      return runtime?.verdict === 'cached' ? `${runtime.hits} hit, ${runtime.misses} miss` : undefined
    },
    'the cached fetch to be a hit at runtime',
    30_000,
  ).catch(async (error) => {
    error.message += `\nEntry: ${JSON.stringify(await entry().catch(() => null))}`
    throw error
  })
}

/** The waterfall finding's runtime result: a load where the second request waited for the first. */
function waitForWaterfall(dashboard) {
  const finding = async () =>
    (await (await fetch(`${dashboard}/api/model`)).json()).perf?.findings?.find(
      (f) => f.kind === 'waterfall' && f.fn === 'Slow',
    )
  return waitFor(
    async () => {
      const id = (await finding())?.id
      const runtime = id && (await (await fetch(`${dashboard}/api/perf`)).json()).findings?.[id]
      return runtime?.status === 'confirmed'
        ? `waterfall confirmed, ${runtime.savedMs} ms to save`
        : undefined
    },
    'the waterfall to be confirmed at runtime',
    30_000,
  ).catch(async (error) => {
    const f = await finding().catch(() => undefined)
    const perf = await (await fetch(`${dashboard}/api/perf`)).json().catch(() => ({}))
    const list = await (await fetch(`${dashboard}/api/captures`)).json().catch(() => [])
    error.message += `\nFinding: ${JSON.stringify(f ?? null)}\nRuntime: ${JSON.stringify(f ? perf.findings?.[f.id] : perf)}`
    error.message += `\nCaptured:\n${list
      .filter((c) => c.url.includes('/slow/'))
      .map((c) => `  ${c.origin} ${c.url} match=${c.match?.status ?? '-'} at=${c.timestamp ?? '-'}`)
      .join('\n')}`
    throw error
  })
}

// --- The app ----------------------------------------------------------------------------------

/** next.config: Next 13 needs server actions turned on. */
function nextConfig(next) {
  return atLeast(next, 14, 0) ? '{}' : '{ experimental: { serverActions: true } }'
}

function writeApp(dir, next) {
  const proxy = atLeast(next, 16, 0)
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
    // v0.4.0 (M41): the title template the cached page's title goes through.
    'app/layout.tsx': `export const metadata = { title: { default: 'Matrix', template: '%s | Matrix' } }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
    // v0.3.0 (M31): a page that redirects without a session, so it is labeled `guarded`. Not
    // visited: only the scan reads it.
    'app/account/page.tsx': `import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Account() {
  const session = (await cookies()).get('session')
  if (!session) redirect('/')
  return <p>Account</p>
}
`,
    'app/page.tsx': `import { Admin } from '@/components/Admin'
import { EchoSocket } from '@/components/Echo'
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
      <Admin />
    </main>
  )
}
`,
    // v0.4.0 (M38–M40): an ISR page through a tagged, timed fetch, and a route handler that
    // revalidates it. Next 16 wants a cache profile with revalidateTag().
    'app/cached/page.tsx': `export const metadata = { title: 'Cached' }

interface Quote {
  text: string
}

async function getQuote(): Promise<Quote> {
  const res = await fetch(\`\${process.env.UPSTREAM_URL}/quote\`, { next: { revalidate: 60, tags: ['quote'] } })
  return res.json()
}

export default async function Cached() {
  const quote = await getQuote()
  return <p>Quote: {quote.text}</p>
}
`,
    'app/api/refresh/route.ts': `import { revalidatePath, revalidateTag } from 'next/cache'

export async function POST() {
  revalidateTag('quote'${proxy ? ", 'max'" : ''})
  revalidatePath('/cached')
  return Response.json({ ok: true })
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
    'next.config.js': `module.exports = ${nextConfig(next)}\n`,
    // --- v0.5.0 (M43–M47) ---
    // M45: a name without NEXT_PUBLIC_, defined in .env and read in client code (undefined there).
    '.env': `MATRIX_SECRET=${SECRET}\n`,
    // M46: an action anyone can call that deletes, next to one that checks the session and its input.
    'app/actions.ts': `'use server'
import { cookies } from 'next/headers'

export async function deleteNote(id: string) {
  await fetch(\`\${process.env.UPSTREAM_URL}/notes/\${id}\`, { method: 'DELETE' })
}

export async function renameNote(id: string, text: string) {
  const session = (await cookies()).get('session')
  if (!session) throw new Error('Not signed in')
  if (typeof id !== 'string' || typeof text !== 'string' || text.length > 100) throw new Error('Bad input')
  await fetch(\`\${process.env.UPSTREAM_URL}/notes/\${id}\`, { method: 'PUT', body: JSON.stringify({ text }) })
}
`,
    // M43: one more client boundary on the home page; it calls both actions and reads the env name.
    'components/Admin.tsx': `'use client'
import { useState } from 'react'
import { deleteNote, renameNote } from '@/app/actions'

export function Admin() {
  const [done, setDone] = useState('')
  async function onDelete() {
    await deleteNote('1')
    setDone(process.env.MATRIX_SECRET ? 'Deleted with a key' : 'Deleted')
  }
  async function onRename() {
    await renameNote('1', 'Renamed')
    setDone('Renamed')
  }
  return (
    <div>
      <button type="button" onClick={onDelete}>
        Delete note
      </button>
      <button type="button" onClick={onRename}>
        Rename note
      </button>
      <p>{done}</p>
    </div>
  )
}
`,
    // M47: two requests that don't depend on each other, awaited one after the other.
    'app/slow/page.tsx': `export const dynamic = 'force-dynamic'

interface User {
  name: string
}

interface Stats {
  count: number
}

async function getUser(): Promise<User> {
  const res = await fetch(\`\${process.env.UPSTREAM_URL}/slow/user\`, { cache: 'no-store' })
  return res.json()
}

async function getStats(): Promise<Stats> {
  const res = await fetch(\`\${process.env.UPSTREAM_URL}/slow/stats\`, { cache: 'no-store' })
  return res.json()
}

export default async function Slow() {
  const user = await getUser()
  const stats = await getStats()
  return (
    <p>
      Slow: {user.name}, {stats.count} stats
    </p>
  )
}
`,
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
      else if (req.url === '/quote') res.end(JSON.stringify({ text: 'Matrix quote' }))
      // Slow enough that the waterfall shows in the capture timings (M47).
      else if (req.url === '/slow/user')
        setTimeout(() => res.end(JSON.stringify({ name: 'Matrix user' })), 150)
      else if (req.url === '/slow/stats') setTimeout(() => res.end(JSON.stringify({ count: 3 })), 150)
      else if (req.url.startsWith('/notes/')) res.end('{}')
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

/** Runs a command without blocking this process's servers. Resolves with its exit code and output. */
function runAsync(cmd, args, cwd, env) {
  return new Promise((done) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8')
      stream.on('data', (chunk) => {
        output += chunk
      })
    }
    child.on('close', (status) => done({ status, output }))
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
