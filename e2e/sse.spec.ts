// M18: event streams are captured live, message by message, matched to their EventSource and
// fetch sites, and type-checked per event. Runs `flow-checker dev` on the sse fixture (its own
// ports, no mock API), uses the app, then checks the dashboard.
import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import type { Capture, CaptureSummary } from '@flow-checker/shared'
import { expect, test } from '@playwright/test'

const repo = resolve(import.meta.dirname, '..')
const PORTS = { dashboard: 4468, app: 3068 }
const app = `http://localhost:${PORTS.app}`
const dashboard = `http://127.0.0.1:${PORTS.dashboard}`

let dev: ChildProcess | undefined
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

test.beforeAll(async () => {
  test.setTimeout(240_000)
  dev = spawn(
    process.execPath,
    [
      'packages/flow-checker/dist/cli.js',
      'dev',
      '--root',
      'fixtures/sse',
      '--no-open',
      '--port',
      String(PORTS.dashboard),
      '--app-port',
      String(PORTS.app),
    ],
    { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  )
  const keep = (chunk: Buffer) => {
    log = (log + chunk.toString()).slice(-10_000)
  }
  dev.stdout?.on('data', keep)
  dev.stderr?.on('data', keep)
  await waitFor(`${dashboard}/api/health`, 60_000)
  await fetch(`${dashboard}/api/captures`, { method: 'DELETE' })
  await waitFor(app, 180_000)
})

test.afterAll(() => {
  if (!dev || dev.exitCode !== null) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'])
  else dev.kill('SIGTERM')
})

test('an EventSource stream is captured message by message and checked per event', async ({ page }) => {
  await page.goto(`${app}/jobs/7`)
  await page.getByRole('button', { name: 'Start job' }).click()
  await expect(page.getByText('Job finished')).toBeVisible()

  // The stream is sent while it is open, then closed with its last messages.
  let summary: CaptureSummary | undefined
  await expect
    .poll(async () => {
      summary = (await captures()).find((c) => c.url.endsWith('/api/jobs/7/progress'))
      return summary?.stream
    })
    .toEqual({ state: 'closed', count: 5 })
  expect(summary).toMatchObject({
    transport: 'eventsource',
    match: { status: 'matched' },
    typeCheck: 'mismatch',
  })

  const { capture } = (await (await fetch(`${dashboard}/api/captures/${summary?.id}`)).json()) as {
    capture: Capture
  }
  expect(capture.messages?.map((m) => m.event)).toEqual([
    'progress',
    'progress',
    'progress',
    'progress',
    'done',
  ])
  expect(capture.redactedPaths).toContain('messages[4].body.token')

  // The dashboard shows the message timeline and the event that doesn't fit its type.
  await page.goto(`${dashboard}/#/live/${encodeURIComponent(capture.id)}`)
  const messages = page.locator('section', {
    has: page.getByRole('heading', { name: 'Messages', exact: true }),
  })
  await expect(messages).toContainText('5 received')
  await expect(messages).toContainText('{"percent":"25%","step":"queued"}')
  await expect(messages).toContainText('[REDACTED:string]')
  const check = page.locator('section', {
    has: page.getByRole('heading', { name: 'Type check', exact: true }),
  })
  await expect(check).toContainText('progress')
  await expect(check).toContainText('string "25%"')
})

test('a streamed fetch is matched to its site, with event types from the route handler', async ({ page }) => {
  await page.goto(`${app}/chat`)
  await page.getByPlaceholder('Say something').fill('hi there')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('4 tokens')).toBeVisible()

  await expect
    .poll(async () => (await captures()).find((c) => c.url.endsWith('/api/chat'))?.stream?.state)
    .toBe('closed')
  const chat = (await captures()).find((c) => c.url.endsWith('/api/chat'))
  expect(chat).toMatchObject({ transport: 'fetch', match: { status: 'matched' }, typeCheck: 'ok' })

  // The dashboard shows the chunks as they arrived.
  await page.goto(`${dashboard}/#/live/${encodeURIComponent(chat?.id ?? '')}`)
  await expect(
    page.locator('section', { has: page.getByRole('heading', { name: 'Messages', exact: true }) }),
  ).toContainText('"delta":"You "')
})
