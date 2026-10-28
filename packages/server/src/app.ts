import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RuntimeCaptureOptions } from '@flow-checker/runtime/options'
import { compileRules, redactCapture } from '@flow-checker/runtime/redact'
import { type AppModel, IngestBatchSchema, summarizeCapture } from '@flow-checker/shared'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { FlowTracker } from './flows'
import { OverridesFile } from './overrides'
import type { CaptureStore } from './store'
import { Verifier } from './verify'

/** Largest ingest batch accepted, in bytes. */
const MAX_INGEST_BYTES = 20_000_000
const SSE_PING_MS = 20_000
/** Batch verification updates sent over the live feed. */
const VERIFICATION_EVENT_MS = 150

export interface CaptureOptions {
  store: CaptureStore
  /** Per-run secret the runtime sends with every batch. */
  token: string
  /** Resolved capture settings. Captures are redacted again on arrival unless `storeRaw`. */
  options: RuntimeCaptureOptions
}

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
  /** Live capture: the ingest endpoint and capture API. Without it, both are off. */
  capture?: CaptureOptions
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
  /** Present when live capture is on. */
  capture?: { storeRaw: boolean }
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
  const overrides = options.capture ? new OverridesFile(options.root) : undefined
  const verifier =
    options.capture && overrides
      ? new Verifier({ root: options.root, model, store: options.capture.store, overrides })
      : undefined
  const flows =
    options.capture && overrides
      ? new FlowTracker({ model, store: options.capture.store, overrides })
      : undefined
  // With capture on, sites matched by a capture are served as `verified`, and flows carry the
  // names you gave them.
  const served = () => {
    const current = verifier?.servedModel() ?? model
    return flows ? flows.withNames(current) : current
  }

  const app = new Hono()

  app.use('*', async (c, next) => {
    if (!isLocalHost(c.req.header('host') ?? new URL(c.req.url).host)) return c.text('Forbidden host', 403)
    await next()
  })

  app.get('/api/health', (c) => c.json({ ok: true }))

  app.get('/api/model', (c) => c.json(served()))

  app.get('/api/meta', (c) =>
    c.json({
      root: options.root.replaceAll('\\', '/'),
      appPort: options.appPort,
      version: options.version,
      scannedAt,
      canRescan: Boolean(options.rescan),
      capture: options.capture ? { storeRaw: options.capture.options.storeRaw } : undefined,
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
      verifier?.setModel(model)
      flows?.setModel(model)
      return c.json(served())
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500)
    }
  })

  if (options.capture && verifier && flows) mountCapture(app, options.capture, verifier, flows)

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

/** `/ingest` for the runtime, and the capture API for the dashboard. */
function mountCapture(app: Hono, capture: CaptureOptions, verifier: Verifier, flows: FlowTracker) {
  const { store, token } = capture
  const rules = compileRules(capture.options.redact)

  // The runtime posts text/plain (a CORS "simple" request, so browsers send it without a
  // preflight). Nothing is returned to read, so no CORS headers are needed.
  app.post('/ingest', async (c) => {
    const length = Number(c.req.header('content-length'))
    if (length > MAX_INGEST_BYTES) return c.json({ error: 'Batch too large' }, 413)
    let json: unknown
    try {
      const text = await c.req.text()
      if (text.length > MAX_INGEST_BYTES) return c.json({ error: 'Batch too large' }, 413)
      json = JSON.parse(text)
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    const parsed = IngestBatchSchema.safeParse(json)
    if (!parsed.success)
      return c.json({ error: 'Invalid batch', issues: parsed.error.issues.slice(0, 5) }, 400)
    const batch = parsed.data
    if (batch.token !== token) return c.json({ error: 'Invalid token' }, 403)

    // Safety net: the runtime already redacted, unless it was misconfigured.
    verifier.ingest(batch.captures.map((item) => redactCapture(item, rules, capture.options.storeRaw)))
    if (batch.sessionId) store.addEvents(batch.sessionId, batch.events)
    return c.body(null, 204)
  })

  app.get('/api/captures', (c) => {
    const limit = Number(c.req.query('limit') ?? 500)
    return c.json(
      store.list({
        limit: Number.isFinite(limit) && limit > 0 ? limit : 500,
        sessionId: c.req.query('session') || undefined,
      }),
    )
  })

  app.delete('/api/captures', (c) => {
    verifier.clear()
    flows.changed()
    return c.body(null, 204)
  })

  app.get('/api/captures/:id', (c) => {
    const found = store.get(c.req.param('id'))
    if (!found) return c.json({ error: 'Capture not found' }, 404)
    return c.json({ capture: found, children: store.children(found.id).map(summarizeCapture) })
  })

  // Manual assignment: `{ "siteId": "req_..." }`, or `null` for "no site". Remembered for
  // captures like this one in overrides.json.
  app.put('/api/captures/:id/match', async (c) => {
    const body = (await c.req.json().catch(() => undefined)) as { siteId?: unknown } | undefined
    const siteId = body?.siteId
    if (!(typeof siteId === 'string' || siteId === null)) {
      return c.json({ error: 'Expected { "siteId": string | null }' }, 400)
    }
    try {
      const updated = verifier.assign(c.req.param('id'), siteId)
      if (!updated) return c.json({ error: 'Capture not found' }, 404)
      return c.json(summarizeCapture(updated))
    } catch (error) {
      return c.json({ error: (error as Error).message }, 400)
    }
  })

  // Back to automatic matching.
  app.delete('/api/captures/:id/match', (c) => {
    const updated = verifier.assign(c.req.param('id'), undefined)
    if (!updated) return c.json({ error: 'Capture not found' }, 404)
    return c.json(summarizeCapture(updated))
  })

  app.get('/api/verification', (c) => c.json(verifier.summary()))

  // Flows (M7): which inferred flows were walked, recorded variants and named recordings.
  app.get('/api/flows', (c) => c.json(flows.summary()))

  app.put('/api/flows/:id/name', async (c) => {
    const body = (await c.req.json().catch(() => undefined)) as { name?: unknown } | undefined
    if (typeof body?.name !== 'string') return c.json({ error: 'Expected { "name": string }' }, 400)
    if (!flows.rename(c.req.param('id'), body.name)) return c.json({ error: 'Flow not found' }, 404)
    return c.body(null, 204)
  })

  // Named recording: start, then stop to save everything that happened in between.
  app.post('/api/recordings', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { name?: unknown }
    return c.json(flows.start(typeof body.name === 'string' ? body.name : ''), 201)
  })

  app.post('/api/recordings/stop', (c) => {
    const saved = flows.stop()
    return saved ? c.json(saved) : c.json({ error: 'Nothing is being recorded' }, 409)
  })

  app.delete('/api/recordings/:id', (c) =>
    flows.deleteRecording(c.req.param('id'))
      ? c.body(null, 204)
      : c.json({ error: 'Recording not found' }, 404),
  )

  app.get('/api/sites/:id/captures', (c) => {
    const id = c.req.param('id')
    const list = store
      .all()
      .filter((item) => item.match?.status === 'matched' && item.match.siteId === id)
      .map(summarizeCapture)
      .reverse()
    return c.json(list)
  })

  app.get('/api/sessions/:id', (c) => {
    const session = store.session(c.req.param('id'))
    return session ? c.json(session) : c.json({ error: 'Session not found' }, 404)
  })

  // Live feed for the dashboard: a `capture` event per new or re-matched capture, a
  // `verification` event when site statuses may have changed, and `flows` for flow results.
  app.get('/api/live', (c) =>
    streamSSE(c, async (stream) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const stopCaptures = store.subscribe((item) => {
        void stream.writeSSE({ event: 'capture', data: JSON.stringify(summarizeCapture(item)) })
      })
      const stopVerification = verifier.subscribe(() => {
        timer ??= setTimeout(() => {
          timer = undefined
          if (!stream.aborted) {
            void stream.writeSSE({ event: 'verification', data: JSON.stringify(verifier.summary()) })
          }
        }, VERIFICATION_EVENT_MS)
      })
      let flowsTimer: ReturnType<typeof setTimeout> | undefined
      const stopFlows = flows.subscribe(() => {
        flowsTimer ??= setTimeout(() => {
          flowsTimer = undefined
          if (!stream.aborted) void stream.writeSSE({ event: 'flows', data: JSON.stringify(flows.summary()) })
        }, VERIFICATION_EVENT_MS)
      })
      const unsubscribe = () => {
        stopCaptures()
        stopVerification()
        stopFlows()
        if (timer) clearTimeout(timer)
        if (flowsTimer) clearTimeout(flowsTimer)
      }
      stream.onAbort(unsubscribe)
      await stream.writeSSE({ event: 'ready', data: '{}' })
      while (!stream.aborted && !stream.closed) {
        await stream.sleep(SSE_PING_MS)
        if (!stream.aborted) await stream.writeSSE({ event: 'ping', data: '{}' })
      }
      unsubscribe()
    }),
  )
}
