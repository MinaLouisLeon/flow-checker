import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppModel } from '@flow-checker/shared'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'

export interface AppOptions {
  /** Absolute project root. Used for "open in editor" links. */
  root: string
  /** The scan result served at `/api/model`. */
  model: AppModel
  /** Re-runs the scan for `POST /api/scan`. Without it, re-scanning is disabled. */
  rescan?: () => AppModel | Promise<AppModel>
  /** Folder with the built dashboard (`index.html` + assets). */
  dashboardDir?: string
  /** Port the user's Next.js app runs on, for "open in app" links. */
  appPort?: number
  /** Shown in the dashboard header. */
  version?: string
}

/** What the dashboard needs besides the model. */
export interface ServerMeta {
  /** Absolute project root with forward slashes. */
  root: string
  appPort?: number
  version?: string
  /** ISO time of the last scan. */
  scannedAt: string
  canRescan: boolean
}

// The server only listens on loopback. Checking the Host header as well blocks DNS
// rebinding, where a remote page points its own domain at 127.0.0.1 to read the model.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function isLocalHost(host: string | undefined): boolean {
  if (!host) return false
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0]
  return LOCAL_HOSTS.has(name ?? '')
}

/** Builds the tool server's HTTP app: the JSON API and the static dashboard. */
export function createApp(options: AppOptions): Hono {
  let model = options.model
  let scannedAt = new Date().toISOString()
  let scanning: Promise<AppModel> | undefined

  const app = new Hono()

  app.use('*', async (c, next) => {
    if (!isLocalHost(c.req.header('host') ?? new URL(c.req.url).host)) return c.text('Forbidden host', 403)
    await next()
  })

  app.get('/api/health', (c) => c.json({ ok: true }))

  app.get('/api/model', (c) => c.json(model))

  app.get('/api/meta', (c) =>
    c.json({
      root: options.root.replaceAll('\\', '/'),
      appPort: options.appPort,
      version: options.version,
      scannedAt,
      canRescan: Boolean(options.rescan),
    } satisfies ServerMeta),
  )

  app.post('/api/scan', async (c) => {
    const rescan = options.rescan
    if (!rescan) return c.json({ error: 'Re-scanning is not available.' }, 501)
    // Requests that arrive during a scan share it instead of starting another.
    scanning ??= Promise.resolve()
      .then(rescan)
      .finally(() => {
        scanning = undefined
      })
    try {
      model = await scanning
      scannedAt = new Date().toISOString()
      return c.json(model)
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500)
    }
  })

  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404))

  const dir = options.dashboardDir
  if (dir && existsSync(join(dir, 'index.html'))) {
    app.use('*', serveStatic({ root: dir }))
    // The dashboard uses hash routing, so any other path just gets the app shell.
    // Read per request so a dashboard rebuild shows up without restarting.
    app.get('*', (c) => c.html(readFileSync(join(dir, 'index.html'), 'utf8')))
  } else {
    app.get('/', (c) =>
      c.text(
        'flow-checker server is running, but the dashboard build was not found.\n' +
          'The JSON API is still available at /api/model.\n',
      ),
    )
  }

  return app
}
