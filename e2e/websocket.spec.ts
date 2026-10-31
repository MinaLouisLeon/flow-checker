// M19: WebSockets are captured live, message by message in both directions, matched to their
// `new WebSocket()` and socket.io sites, and type-checked per message. Runs the fixture's socket
// server and `flow-checker dev` on the websocket fixture (its own ports), uses the app, then
// checks the dashboard.
import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import type { Capture, CaptureSummary } from '@flow-checker/shared'
import { expect, test } from '@playwright/test'

const repo = resolve(import.meta.dirname, '..')
const PORTS = { dashboard: 4469, app: 3069, sockets: 4011 }
const app = `http://localhost:${PORTS.app}`
const dashboard = `http://127.0.0.1:${PORTS.dashboard}`

const children: ChildProcess[] = []
let log = ''

async function waitFor(url: string, timeoutMs: number) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).status < 500) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Timed out waiting for ${url}\n${log}`)
}

async function captures(): Promise<CaptureSummary[]> {
  return (await fetch(`${dashboard}/api/captures?limit=100`)).json() as Promise<CaptureSummary[]>
}

async function captureOf(summary: CaptureSummary | undefined): Promise<Capture> {
  const res = await fetch(`${dashboard}/api/captures/${summary?.id}`)
  return ((await res.json()) as { capture: Capture }).capture
}

function run(args: string[]) {
  const child = spawn(process.execPath, args, {
    cwd: repo,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const keep = (chunk: Buffer) => {
    log = (log + chunk.toString()).slice(-10_000)
  }
  child.stdout?.on('data', keep)
  child.stderr?.on('data', keep)
  children.push(child)
}

test.beforeAll(async () => {
  test.setTimeout(240_000)
  run(['fixtures/websocket/socket-server.mjs'])
  run([
    'packages/flow-checker/dist/cli.js',
    'dev',
    '--root',
    'fixtures/websocket',
    '--no-open',
    '--port',
    String(PORTS.dashboard),
    '--app-port',
    String(PORTS.app),
  ])
  await waitFor(`http://127.0.0.1:${PORTS.sockets}/health`, 20_000)
  await waitFor(`${dashboard}/api/health`, 60_000)
  await fetch(`${dashboard}/api/captures`, { method: 'DELETE' })
  await waitFor(app, 180_000)
})

test.afterAll(() => {
  for (const child of children) {
    if (child.exitCode !== null) continue
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'])
    else child.kill('SIGTERM')
  }
})

test('a native WebSocket is captured both ways and checked per message', async ({ page }) => {
  await page.goto(`${app}/`)
  await expect(page.getByText('Ticker closed after 3 quotes')).toBeVisible()

  let summary: CaptureSummary | undefined
  await expect
    .poll(async () => {
      summary = (await captures()).find((c) => c.url.endsWith('/live') && (c.stream?.count ?? 0) > 0)
      return summary?.stream
    })
    .toEqual({ state: 'closed', count: 4 })
  expect(summary).toMatchObject({
    transport: 'websocket',
    match: { status: 'matched' },
    typeCheck: 'mismatch',
  })

  const capture = await captureOf(summary)
  expect(capture.messages?.map((m) => m.direction)).toEqual(['out', 'in', 'in', 'in'])
  expect(capture.stream).toMatchObject({
    protocol: 'ticker.v1',
    closeCode: 1000,
    closeReason: 'enough quotes',
  })

  // The dashboard shows the timeline, sent and received, and the message that doesn't fit Quote.
  await page.goto(`${dashboard}/#/live/${encodeURIComponent(capture.id)}`)
  const messages = page.locator('section', {
    has: page.getByRole('heading', { name: 'Messages', exact: true }),
  })
  await expect(messages).toContainText('4 messages (1 sent)')
  await expect(messages).toContainText('↑ sends')
  await expect(messages).toContainText('{"type":"quote","symbol":"BETA","price":"9.10"}')
  const check = page.locator('section', {
    has: page.getByRole('heading', { name: 'Type check', exact: true }),
  })
  await expect(check).toContainText('string "9.10"')
})

test('socket.io events are decoded from the frames, matched by name and redacted', async ({ page }) => {
  await page.goto(`${app}/chat`)
  await expect(page.getByText('Joined as ada')).toBeVisible()
  await page.getByPlaceholder('Say something').fill('hi sockets')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('ada: hi sockets')).toBeVisible()
  await page.getByRole('button', { name: 'Leave' }).click()

  let summary: CaptureSummary | undefined
  await expect
    .poll(async () => {
      summary = (await captures()).find((c) => c.url.includes('/socket.io/') && (c.stream?.count ?? 0) > 0)
      return summary?.stream?.state
    })
    .toBe('closed')
  expect(summary).toMatchObject({ transport: 'websocket', match: { status: 'matched' }, typeCheck: 'ok' })

  const capture = await captureOf(summary)
  expect(capture.messages?.map((m) => `${m.direction} ${m.event}`)).toEqual([
    'in joined',
    'out chat',
    'in chat',
  ])
  expect(capture.redactedPaths).toContain('messages[0].body.token')

  await page.goto(`${dashboard}/#/live/${encodeURIComponent(capture.id)}`)
  const messages = page.locator('section', {
    has: page.getByRole('heading', { name: 'Messages', exact: true }),
  })
  await expect(messages).toContainText('socket.io')
  await expect(messages).toContainText('[REDACTED:string]')
  await expect(messages).toContainText('"text":"hi sockets"')
})
