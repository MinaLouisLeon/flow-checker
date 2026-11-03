// M40: the server runtime records whether each cached fetch and function was a hit, a miss or
// skipped, and the tool server compares that with the scan's cache map. Runs `flow-checker dev`
// on both caching fixtures (Next 16 with Cache Components, and Next 15), visits each page twice,
// then checks the served model and the Cache screen. Each fixture has a planted mismatch: a cached
// `fetch` the mock API answers with 404, which Next never keeps (in a route handler on Next 16).
import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import type { AppModel, CacheEntry } from '@flow-checker/shared'
import { expect, type Page, test } from '@playwright/test'

const repo = resolve(import.meta.dirname, '..')
const API = '{API_URL ?? http://localhost:4010}'

function devServer(fixture: string, ports: { dashboard: number; app: number }) {
  const app = `http://localhost:${ports.app}`
  const dashboard = `http://127.0.0.1:${ports.dashboard}`
  let dev: ChildProcess | undefined
  let log = ''

  const waitFor = async (url: string, timeoutMs: number) => {
    const end = Date.now() + timeoutMs
    while (Date.now() < end) {
      try {
        if ((await fetch(url)).status < 500) return
      } catch {}
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error(`Timed out waiting for ${url}\n${log}`)
  }

  return {
    app,
    dashboard,
    log: () => log,
    async start() {
      dev = spawn(
        process.execPath,
        [
          'packages/flow-checker/dist/cli.js',
          'dev',
          '--root',
          `fixtures/${fixture}`,
          '--no-open',
          '--port',
          String(ports.dashboard),
          '--app-port',
          String(ports.app),
        ],
        { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
      )
      const keep = (chunk: Buffer) => {
        log = (log + chunk.toString()).slice(-20_000)
      }
      dev.stdout?.on('data', keep)
      dev.stderr?.on('data', keep)
      await waitFor(`${dashboard}/api/health`, 60_000)
      await fetch(`${dashboard}/api/captures`, { method: 'DELETE' })
      await waitFor(app, 180_000)
    },
    stop() {
      if (!dev || dev.exitCode !== null) return
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'])
      else dev.kill('SIGTERM')
    },
    /** Cache entries as served: `kind name` -> the entry. */
    async entries(): Promise<Map<string, CacheEntry>> {
      const model = (await (await fetch(`${dashboard}/api/model`)).json()) as AppModel
      return new Map((model.cache?.entries ?? []).map((e) => [`${e.kind} ${e.name}`, e]))
    },
  }
}

/** Each page (or route handler) twice: the second time can be served from Next's cache. */
async function visitTwice(page: Page, app: string, paths: string[]) {
  for (const path of paths) {
    for (let i = 0; i < 2; i++) {
      if (path.startsWith('/api/')) {
        expect((await page.request.get(`${app}${path}`)).ok()).toBe(true)
        continue
      }
      await page.goto(`${app}${path}`)
      // A page Next failed to render (e.g. a prerender aborted by the runtime) has no heading.
      await expect(page.locator('h1').first()).toBeVisible()
    }
  }
}

/** Waits until every listed entry has the verdict, and returns them. */
async function untilVerdicts(server: ReturnType<typeof devServer>, wanted: Record<string, string>) {
  let entries = new Map<string, CacheEntry>()
  await expect
    .poll(
      async () => {
        entries = await server.entries()
        return Object.fromEntries(Object.keys(wanted).map((key) => [key, entries.get(key)?.runtime?.verdict]))
      },
      { timeout: 30_000 },
    )
    .toEqual(wanted)
  return entries
}

test.describe('Next 16 with Cache Components', () => {
  const server = devServer('caching', { dashboard: 4473, app: 3073 })

  test.beforeAll(async () => {
    test.setTimeout(240_000)
    await server.start()
  })
  test.afterAll(() => server.stop())

  test('captures hits and misses of fetch, use cache and unstable_cache, and flags the 404 fetch', async ({
    page,
  }) => {
    await visitTwice(page, server.app, ['/', '/products', '/settings', '/users', '/todos/1', '/api/featured'])

    const entries = await untilVerdicts(server, {
      'use-cache SiteHeader': 'cached',
      'use-cache listTodos': 'cached',
      'use-cache getSettings': 'cached',
      'use-cache getTodo': 'cached',
      'unstable-cache getUsers': 'cached',
      [`fetch ${API}/products`]: 'cached',
      [`fetch ${API}/products/featured`]: 'always-missed',
    })
    const featured = entries.get(`fetch ${API}/products/featured`)
    expect(featured?.runtime).toMatchObject({ hits: 0, reasons: ['answered 404'] })
    expect(featured?.flags.find((f) => f.kind === 'always-missed')?.message).toContain('answered 404')
    // Only the planted entry is flagged at runtime.
    const flagged = [...entries.values()].filter((e) =>
      e.flags.some((f) => f.kind === 'always-missed' || f.kind === 'never-cached'),
    )
    expect(flagged.map((e) => e.name)).toEqual([`${API}/products/featured`])
    expect(server.log()).not.toContain('unstable value')

    // The Cache screen lists it under To check, and shows the hits.
    await page.goto(`${server.dashboard}/#/cache`)
    const toCheck = page.locator('[data-section="to-check"]')
    await expect(toCheck.locator('[data-cache-flag="always-missed"]')).toContainText('answered 404')
    await expect(page.locator('[data-cache-runtime="cached"]').first()).toContainText('cached at runtime')
  })
})

test.describe('Next 15', () => {
  const server = devServer('caching-15', { dashboard: 4474, app: 3074 })

  test.beforeAll(async () => {
    test.setTimeout(240_000)
    await server.start()
  })
  test.afterAll(() => server.stop())

  test('captures hits and misses, flags the 404 fetch and a tagged fetch Next never caches', async ({
    page,
  }) => {
    await visitTwice(page, server.app, ['/', '/products', '/profile', '/todos/1'])

    const entries = await untilVerdicts(server, {
      'unstable-cache listProducts': 'cached',
      'unstable-cache getViewer': 'cached',
      [`fetch ${API}/todos`]: 'cached',
      [`fetch ${API}/products/featured`]: 'always-missed',
      // Tags without a `cache` option: Next 15 doesn't cache it on a page rendered per request.
      [`fetch ${API}/todos/:id`]: 'never-cached',
    })
    expect(entries.get(`fetch ${API}/todos/:id`)?.runtime?.reasons).toEqual(['auto no cache'])
  })
})
