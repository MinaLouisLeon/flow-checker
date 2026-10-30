// Records real captures from every fixture app, for the matcher (M6) and type comparison (M8) tests.
// For each fixture: starts the mock API and `flow-checker dev` (built CLI), drives the app in
// Chromium, then saves the captures the tool server stored to
// packages/server/test/recordings/<fixture>.json. Local paths are replaced with `<repo>`.
//
// Run after `pnpm build`:  node scripts/record-captures.mjs [fixture...]
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const repo = resolve(import.meta.dirname, '..')
const outDir = join(repo, 'packages', 'server', 'test', 'recordings')
const PORTS = { mockApi: 4010, dashboard: 4477, app: 3077 }
const app = `http://localhost:${PORTS.app}`
const dashboard = `http://127.0.0.1:${PORTS.dashboard}`

const settle = (page, ms = 1500) =>
  page
    .waitForLoadState('networkidle')
    .catch(() => {})
    .then(() => page.waitForTimeout(ms))

/** What to do in each fixture app. Every request site should fire at least once. */
const scripts = {
  basic: async (page) => {
    await page.goto(`${app}/`)
    await settle(page)
    await page.goto(`${app}/about`)
    await settle(page)
    await page.goto(`${app}/users/2`)
    await settle(page)
    await page.click('button')
    await page.waitForURL(`${app}/`)
    await settle(page)
  },
  'react-query': async (page) => {
    await page.goto(`${app}/`)
    await settle(page)
    await page.click('input[type=checkbox] >> nth=1')
    await settle(page)
    await page.fill('input[placeholder="New todo"]', 'Record captures')
    await page.click('button[type=submit]')
    await page.waitForURL(/\/todos\/\d+/)
    await settle(page)
    // Server prefetch + HydrationBoundary, useQueries, then queryClient methods.
    await page.goto(`${app}/users`)
    await settle(page)
    await page.hover('li button >> nth=0')
    await settle(page)
    // A click without hovering first, so ensureQueryData has nothing cached for this user.
    await page.dispatchEvent('li >> nth=1 >> button >> nth=0', 'click')
    await settle(page)
    await page.click('button:has-text("Refresh")')
    await settle(page)
  },
  'react-query-v4': async (page) => {
    await page.goto(`${app}/`)
    await settle(page)
    await page.click('input[type=checkbox] >> nth=1')
    await settle(page)
    await page.fill('input[placeholder="New todo"]', 'Record captures')
    await page.click('button[type=submit]')
    await page.waitForURL(/\/todos\/\d+/)
    await settle(page)
    await page.goto(`${app}/users`)
    await settle(page)
    await page.click('button:has-text("Delete") >> nth=1')
    await settle(page)
  },
  'server-actions': async (page) => {
    await page.goto(`${app}/products`)
    await settle(page)
    await page.goto(`${app}/products/new`)
    await settle(page)
    await page.fill('input[name=name]', 'Cable')
    await page.fill('input[name=price]', '9.5')
    await page.click('button[type=submit]')
    await page.waitForURL(/\/products\/\d+$/)
    await settle(page)
    await page.goto(`${app}/products`)
    await settle(page)
    await page.click('li button >> nth=0')
    await settle(page, 2500)
  },
  bff: async (page) => {
    await page.goto(`${app}/`)
    await settle(page)
    await page.fill('input[name=name]', 'Cable')
    await page.fill('input[name=price]', '9.5')
    await page.fill('input[name=stock]', '3')
    await page.click('button[type=submit]')
    await page.waitForURL(/\/products\/\d+$/)
    await settle(page)
  },
  'next-intl': async (page) => {
    await page.goto(`${app}/en/login`)
    await settle(page)
    await page.fill('input[name=email]', 'ada@example.com')
    await page.fill('input[name=password]', 'password')
    await page.click('button[type=submit]')
    await page.waitForURL(/\/verify\?challenge=/)
    await settle(page)
    await page.fill('input[name=code]', '123456')
    await page.click('button[type=submit]')
    await page.waitForURL(/\/dashboard/)
    await settle(page, 2500)
  },
  middleware: async (page) => {
    // Signed out: the proxy sends the dashboard to the login page.
    await page.goto(`${app}/dashboard`)
    await page.waitForURL(`${app}/login`)
    await settle(page)
    // A rewrite (the products page answers /shop) and a permanent redirect.
    await page.goto(`${app}/shop`)
    await settle(page)
    await page.goto(`${app}/old-home`)
    await page.waitForURL(`${app}/`)
    await settle(page)
    // A session the API doesn't know: the proxy's session check fails.
    await page.context().addCookies([{ name: 'session', value: 'expired', url: app }])
    await page.goto(`${app}/dashboard`)
    await page.waitForURL(/\/login\?expired=1/)
    await settle(page)
    // Signed in: the dashboard loads, and the login page sends you back to it.
    await page.context().addCookies([{ name: 'session', value: await signIn(), url: app }])
    await page.goto(`${app}/dashboard`)
    await settle(page)
    await page.click('a:has-text("Settings")')
    await page.waitForURL(`${app}/dashboard/settings`)
    await settle(page)
    await page.goto(`${app}/login`)
    await page.waitForURL(`${app}/dashboard`)
    await settle(page)
  },
  mismatch: async (page) => {
    await page.goto(`${app}/`)
    await settle(page)
    await page.fill('input[name=title]', 'Check types')
    await page.click('button[type=submit]')
    await page.waitForSelector('li:has-text("Check types")')
    await settle(page)
  },
}

/** A session token from the mock API (login + OTP), for fixtures that read it from a cookie. */
async function signIn() {
  const post = (path, body) =>
    fetch(`http://127.0.0.1:${PORTS.mockApi}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then((res) => res.json())
  const { challengeId } = await post('/auth/login', { email: 'ada@example.com', password: 'password' })
  const { token } = await post('/auth/verify-otp', { challengeId, code: '123456' })
  return token
}

function start(command, args, label) {
  const child = spawn(command, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let log = ''
  const keep = (chunk) => {
    log = (log + chunk.toString()).slice(-20_000)
  }
  child.stdout.on('data', keep)
  child.stderr.on('data', keep)
  return {
    log: () => log,
    stop: () => {
      if (child.exitCode !== null) return
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'])
      else child.kill('SIGTERM')
    },
    label,
  }
}

async function waitFor(url, timeoutMs) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      const res = await fetch(url)
      if (res.status < 500) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

/** Waits until `read()` returns the same value for `quietMs` (at most `maxMs`). */
async function untilStable(read, quietMs = 4000, maxMs = 30_000) {
  const end = Date.now() + maxMs
  let last = await read()
  let since = Date.now()
  while (Date.now() < end && Date.now() - since < quietMs) {
    await new Promise((r) => setTimeout(r, 500))
    const next = await read()
    if (next !== last) {
      last = next
      since = Date.now()
    }
  }
}

function serverActions(fixture, captures) {
  const ids = new Set(captures.flatMap((c) => [c.serverAction?.id, c.parent?.serverActionId]).filter(Boolean))
  const out = {}
  for (const dir of ['.next/dev/server', '.next/server']) {
    let manifest
    try {
      manifest = JSON.parse(
        readFileSync(join(repo, 'fixtures', fixture, dir, 'server-reference-manifest.json'), 'utf8'),
      )
    } catch {
      continue
    }
    for (const [id, entry] of Object.entries(manifest.node ?? {})) {
      if (ids.has(id) && !out[id] && entry.filename && entry.exportedName) {
        out[id] = { filename: entry.filename, exportedName: entry.exportedName }
      }
    }
  }
  return out
}

function scrub(value) {
  const text = JSON.stringify(value)
  const variants = [repo, repo.replaceAll('\\', '/'), repo.replaceAll('\\', '\\\\')]
  let out = text
  for (const v of variants) out = out.split(v).join('<repo>')
  return JSON.parse(out)
}

async function record(fixture, browser) {
  const mock = start(process.execPath, ['fixtures/mock-api/server.js'], 'mock-api')
  const dev = start(
    process.execPath,
    [
      'packages/flow-checker/dist/cli.js',
      'dev',
      '--root',
      `fixtures/${fixture}`,
      '--no-open',
      '--port',
      String(PORTS.dashboard),
      '--app-port',
      String(PORTS.app),
    ],
    'dev',
  )
  try {
    await waitFor(`http://127.0.0.1:${PORTS.mockApi}/users`, 20_000)
    await waitFor(`${dashboard}/api/health`, 60_000)
    await fetch(`${dashboard}/api/captures`, { method: 'DELETE' })
    await waitFor(app, 180_000)
    const page = await (await browser.newContext()).newPage()
    await scripts[fixture](page)
    // A route compiled on first use can answer seconds later, and the browser only sends a
    // capture once the response is read. Keep the page open until nothing new arrives.
    await untilStable(async () => (await (await fetch(`${dashboard}/api/captures?limit=1000`)).json()).length)
    await page.context().close()

    const list = await (await fetch(`${dashboard}/api/captures?limit=1000`)).json()
    const captures = []
    for (const summary of list.reverse()) {
      const { capture } = await (await fetch(`${dashboard}/api/captures/${summary.id}`)).json()
      captures.push(capture)
    }
    const counts = { matched: 0, ambiguous: 0, unmatched: 0 }
    for (const c of captures) counts[c.match?.status ?? 'unmatched']++
    console.log(`${fixture}: ${captures.length} captures`, counts)
    const saved = {
      fixture,
      // Server action ids from Next's manifest, so tests can resolve them without a build.
      actions: serverActions(fixture, captures),
      captures: captures.map(({ match: _, ...rest }) => ({ ...rest, stack: rest.stack.slice(0, 12) })),
    }
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, `${fixture}.json`), `${JSON.stringify(scrub(saved), null, 2)}\n`)
  } catch (error) {
    console.error(`${fixture} failed: ${error.message}\n--- dev log ---\n${dev.log()}`)
    process.exitCode = 1
  } finally {
    dev.stop()
    mock.stop()
    await new Promise((r) => setTimeout(r, 1500))
  }
}

const wanted = process.argv.slice(2)
const fixtures = wanted.length > 0 ? wanted : Object.keys(scripts)
const browser = await chromium.launch()
try {
  for (const fixture of fixtures) await record(fixture, browser)
} finally {
  await browser.close()
}
