import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type AppModel, MODEL_VERSION } from '@flow-checker/shared'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp, type ServerMeta, startServer } from '../src'

const model = (appDir = 'app'): AppModel => ({
  version: MODEL_VERSION,
  project: { appDir },
  routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: appDir, files: {}, children: [] },
  routes: [],
  components: [],
  types: [],
})

const get = (app: ReturnType<typeof createApp>, path: string, init?: RequestInit) =>
  app.request(`http://localhost:4400${path}`, init)

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

function dashboardDir() {
  const dir = mkdtempSync(join(tmpdir(), 'flow-checker-dash-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), '<!doctype html><div id="root"></div>')
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)')
  return dir
}

describe('createApp', () => {
  it('serves the model and meta', async () => {
    const app = createApp({ root: 'C:\\work\\app', model: model(), appPort: 3000, version: '1.2.3' })
    const res = await get(app, '/api/model')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(model())

    const meta = (await (await get(app, '/api/meta')).json()) as ServerMeta
    expect(meta).toMatchObject({ root: 'C:/work/app', appPort: 3000, version: '1.2.3', canRescan: false })
    expect(Date.parse(meta.scannedAt)).not.toBeNaN()
  })

  it('re-scans on POST /api/scan and serves the new model', async () => {
    let calls = 0
    const app = createApp({
      root: '/p',
      model: model(),
      rescan: () => {
        calls++
        return model('src/app')
      },
    })
    const [a, b] = await Promise.all([
      get(app, '/api/scan', { method: 'POST' }),
      get(app, '/api/scan', { method: 'POST' }),
    ])
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(calls).toBe(1)
    expect(((await (await get(app, '/api/model')).json()) as AppModel).project.appDir).toBe('src/app')
  })

  it('reports scan errors and missing re-scan support', async () => {
    const failing = createApp({
      root: '/p',
      model: model(),
      rescan: () => {
        throw new Error('no app dir')
      },
    })
    const res = await get(failing, '/api/scan', { method: 'POST' })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'no app dir' })

    const readOnly = createApp({ root: '/p', model: model() })
    expect((await get(readOnly, '/api/scan', { method: 'POST' })).status).toBe(501)
    expect((await get(readOnly, '/api/nope')).status).toBe(404)
  })

  it('rejects requests for non-local hosts', async () => {
    const app = createApp({ root: '/p', model: model() })
    const res = await app.request('http://evil.example/api/model', { headers: { host: 'evil.example' } })
    expect(res.status).toBe(403)
    for (const host of ['127.0.0.1:4400', '[::1]:4400', 'localhost']) {
      const ok = await app.request('http://x/api/health', { headers: { host } })
      expect(ok.status).toBe(200)
    }
  })

  it('serves the dashboard and falls back to index.html', async () => {
    const app = createApp({ root: '/p', model: model(), dashboardDir: dashboardDir() })
    expect(await (await get(app, '/')).text()).toContain('id="root"')
    expect(await (await get(app, '/assets/app.js')).text()).toBe('console.log(1)')
    expect(await (await get(app, '/some/page')).text()).toContain('id="root"')
  })

  it('explains a missing dashboard build', async () => {
    const app = createApp({ root: '/p', model: model(), dashboardDir: join(tmpdir(), 'does-not-exist') })
    expect(await (await get(app, '/')).text()).toContain('dashboard build was not found')
  })
})

describe('startServer', () => {
  it('listens on loopback and moves to the next port when taken', async () => {
    const blocker = createServer()
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve))
    const taken = (blocker.address() as AddressInfo).port

    const server = await startServer({ root: '/p', model: model(), port: taken })
    try {
      expect(server.port).toBe(taken + 1)
      const res = await fetch(`${server.url}/api/health`)
      expect(await res.json()).toEqual({ ok: true })
    } finally {
      await server.close()
      blocker.close()
    }
  })
})
