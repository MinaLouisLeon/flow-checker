// Server capture runtime (docs/PLAN.md 7.3), loaded from the app's `instrumentation.ts`.
// It does nothing unless FLOW_CHECKER=1, and it never throws into the app.
//
// - fetch: `globalThis.fetch` is wrapped through an accessor, because Next's dev server puts the
//   native fetch back on hot reload (`resetFetch`), which would silently drop a plain wrapper.
// - http/https (axios on Node): Node's `http.client.*` diagnostics channels.
// - Incoming requests: `http.server.request.start` puts the request into an AsyncLocalStorage,
//   so each outgoing call knows which page render, route handler or server action it belongs to.
import { AsyncLocalStorage } from 'node:async_hooks'
import diagnostics from 'node:diagnostics_channel'
import { ClientRequest, type IncomingMessage } from 'node:http'
import type { Capture, CapturedBody, CaptureParent } from '@flow-checker/shared'
import { bytesBody, callerStack, headersToObject, readStream, requestBody } from './body'
import {
  createIgnoreMatcher,
  ENV,
  LINK_HEADER,
  parseRuntimeConfig,
  type RuntimeConfig,
  randomId,
} from './options'
import { compileRules, redactCapture } from './redact'
import { splitTrpcCapture } from './trpc'

export type { RuntimeConfig } from './options'

const INSTALLED = Symbol.for('flow-checker.server')
const WRAPPED = Symbol.for('flow-checker.wrapped-fetch')
const FLUSH_MS = 300
const OWN_FRAMES = /flowChecker|flow-checker[\\/_]dist|runtime[-_]server|node:internal|node:diagnostics/

type Fetch = typeof globalThis.fetch
type Global = typeof globalThis & { [INSTALLED]?: ServerRuntime }

interface IncomingContext {
  parent: CaptureParent
  sessionId: string
}

export interface ServerRuntime {
  /** Sends queued captures now. */
  flush: () => Promise<void>
}

/**
 * Starts capturing outgoing server requests. Call it from `register()` in `instrumentation.ts`
 * (Node.js runtime only). Reads its settings from the env set by `flow-checker dev`.
 */
export function registerServerRuntime(config?: string | RuntimeConfig): ServerRuntime | undefined {
  try {
    if (process.env[ENV.enabled] !== '1') return undefined
    const g = globalThis as Global
    if (g[INSTALLED]) return g[INSTALLED]
    const parsed = parseRuntimeConfig(config ?? process.env[ENV.server])
    if (!parsed) return undefined
    const runtime = start(parsed)
    g[INSTALLED] = runtime
    return runtime
  } catch {
    return undefined
  }
}

function start(config: RuntimeConfig): ServerRuntime {
  const options = config.capture
  const rules = compileRules(options.redact)
  const ignored = createIgnoreMatcher(options.ignore)
  const ingest = new URL(config.ingest)
  const incoming = new AsyncLocalStorage<IncomingContext>()
  // Depth of our own fetch wrappers on the current synchronous call, so a fetch wrapped twice
  // (another library re-wrapping ours) is recorded once.
  let depth = 0

  // --- Sending ------------------------------------------------------------------------------

  const nativeFetch: Fetch = unwrap(globalThis.fetch)
  let queue: Capture[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let sending: Promise<void> = Promise.resolve()

  const flush = (): Promise<void> => {
    if (timer) clearTimeout(timer)
    timer = undefined
    if (queue.length === 0) return sending
    const captures = queue
    queue = []
    const body = JSON.stringify({ token: config.token, captures, events: [] })
    sending = sending
      .then(() =>
        nativeFetch(ingest.href, { method: 'POST', body, headers: { 'content-type': 'text/plain' } }).then(
          (res) => void res.body?.cancel().catch(() => {}),
        ),
      )
      .catch(() => {})
    return sending
  }

  const push = (capture: Capture) => {
    try {
      for (const piece of splitTrpcCapture(capture)) queue.push(redactCapture(piece, rules, options.storeRaw))
      if (!timer) {
        timer = setTimeout(() => void flush(), FLUSH_MS)
        timer.unref?.()
      }
    } catch {}
  }

  const shouldCapture = (url: URL) => {
    if (url.origin === ingest.origin && url.pathname === ingest.pathname) return false
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return !ignored(url)
  }

  // Next's own RSC requests, e.g. the page it fetches from itself after a server action redirects.
  const isNextInternal = (headers: Record<string, string>) => headers.rsc === '1'

  const baseCapture = (
    transport: Capture['transport'],
    method: string,
    url: URL,
    headers: Record<string, string>,
  ): Capture => {
    const context = incoming.getStore()
    const capture: Capture = {
      id: randomId('cap'),
      sessionId: context?.sessionId ?? 'server',
      origin: 'server',
      transport,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      request: { method, url: url.href, headers, body: { kind: 'none' } },
      stack: callerStack(OWN_FRAMES),
      redacted: false,
      redactedPaths: [],
    }
    if (context) capture.parent = context.parent
    return capture
  }

  // --- Incoming requests --------------------------------------------------------------------

  diagnostics.subscribe('http.server.request.start', (message) => {
    try {
      const request = (message as { request: IncomingMessage }).request
      const url = request.url ?? '/'
      if (url.startsWith('/_next/') || url.startsWith('/__nextjs')) return
      const headers = request.headers
      const parent: CaptureParent = { method: request.method ?? 'GET', url }
      const link = header(headers[LINK_HEADER])
      let sessionId = 'server'
      if (link) {
        const dot = link.indexOf('.')
        if (dot > 0) {
          sessionId = link.slice(0, dot)
          parent.captureId = link.slice(dot + 1)
        }
      }
      const action = header(headers['next-action'])
      if (action) parent.serverActionId = action
      // Everything the request handler runs from here on (sync and async) sees this context.
      incoming.enterWith({ parent, sessionId })
    } catch {}
  })

  // --- fetch --------------------------------------------------------------------------------

  const wrap = (target: Fetch): Fetch => {
    const wrapped = async function flowCheckerServerFetch(input: Parameters<Fetch>[0], init?: RequestInit) {
      if (depth > 0) return target(input, init)
      let capture: Capture | undefined
      let bodyPromise: Promise<CapturedBody> | undefined
      try {
        const request = input instanceof Request ? input : undefined
        const url = new URL(request ? request.url : String(input))
        const headers = shouldCapture(url)
          ? { ...headersToObject(request?.headers), ...headersToObject(init?.headers) }
          : undefined
        if (headers && !isNextInternal(headers)) {
          capture = baseCapture(
            'fetch',
            (init?.method ?? request?.method ?? 'GET').toUpperCase(),
            url,
            headers,
          )
          const contentType = headers['content-type']
          if (init?.body !== undefined && init.body !== null) {
            capture.request.body = requestBody(init.body, contentType, options.maxBodyBytes)
          } else if (request?.body) {
            bodyPromise = readStream(request.clone().body, contentType, options.maxBodyBytes)
          }
        }
      } catch {
        capture = undefined
      }

      if (!capture) return target(input, init)
      const current = capture
      const started = performance.now()
      let pending: Promise<Response>
      depth++
      try {
        pending = target(input, init)
      } finally {
        depth--
      }
      try {
        const response = await pending
        current.durationMs = Math.round(performance.now() - started)
        void finish(current, response.clone(), bodyPromise)
        return response
      } catch (error) {
        current.durationMs = Math.round(performance.now() - started)
        current.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        void finish(current, undefined, bodyPromise)
        throw error
      }
    } as Fetch & { [WRAPPED]?: Fetch }
    // Keep markers such as Next's `__nextPatched` visible on the outer function.
    try {
      Object.assign(wrapped, target)
    } catch {}
    wrapped[WRAPPED] = target
    return wrapped
  }

  const finish = async (capture: Capture, response?: Response, bodyPromise?: Promise<CapturedBody>) => {
    try {
      if (bodyPromise) capture.request.body = await bodyPromise.catch(() => ({ kind: 'binary' }) as const)
      if (response) {
        const headers = headersToObject(response.headers)
        const length = Number(headers['content-length'])
        capture.response = {
          status: response.status,
          headers,
          body: await readStream(
            response.body,
            headers['content-type'],
            options.maxBodyBytes,
            Number.isFinite(length) ? length : undefined,
          ).catch(() => ({ kind: 'binary' }) as const),
        }
        if (response.statusText) capture.response.statusText = response.statusText
      }
    } catch {}
    push(capture)
  }

  // Next patches fetch on top of ours (its patched fetch calls ours for real network requests:
  // stored as is). Anything else assigned, such as the native fetch put back by `resetFetch`, is
  // wrapped again.
  let current = wrap(globalThis.fetch)
  try {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      enumerable: true,
      get: () => current,
      set: (value: Fetch) => {
        current = typeof value !== 'function' || isOurs(value) || isNextPatched(value) ? value : wrap(value)
      },
    })
  } catch {
    globalThis.fetch = current
  }

  // --- http / https (axios) -----------------------------------------------------------------

  const clientRequests = new WeakMap<ClientRequest, { capture: Capture; started: number }>()

  diagnostics.subscribe('http.client.request.start', (message) => {
    try {
      const request = (message as { request: ClientRequest }).request
      // The Host header has the port; `request.host` does not.
      const host = String(request.getHeader('host') ?? request.host)
      const protocol = request.protocol ?? 'http:'
      const url = new URL(`${protocol}//${host}${request.path}`)
      if (!shouldCapture(url)) return
      const headers = headersToObject(request.getHeaders())
      if (isNextInternal(headers)) return
      const capture = baseCapture('http', request.method, url, headers)
      const state = { capture, started: performance.now() }
      clientRequests.set(request, state)
      request.once('error', (error) => {
        capture.durationMs = Math.round(performance.now() - state.started)
        capture.error = `${error.name}: ${error.message}`
        capture.request.body = collected(request, headers['content-type'])
        push(capture)
      })
    } catch {}
  })

  diagnostics.subscribe('http.client.response.finish', (message) => {
    try {
      const { request, response } = message as { request: ClientRequest; response: IncomingMessage }
      const state = clientRequests.get(request)
      if (!state) return
      clientRequests.delete(request)
      const { capture } = state
      capture.request.body = collected(request, capture.request.headers['content-type'])
      const headers = headersToObject(response.headers)
      const chunks: Uint8Array[] = []
      let total = 0
      // Tap 'data' through emit: adding a listener would switch the stream to flowing mode.
      const emit = response.emit
      response.emit = function flowCheckerEmit(
        this: IncomingMessage,
        event: string | symbol,
        ...args: unknown[]
      ) {
        try {
          if (event === 'data' && total <= options.maxBodyBytes) {
            const chunk = args[0]
            const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Uint8Array)
            chunks.push(bytes)
            total += bytes.byteLength
          } else if (event === 'end' || event === 'close' || event === 'error') {
            response.emit = emit
            capture.durationMs = Math.round(performance.now() - state.started)
            capture.response = {
              status: response.statusCode ?? 0,
              headers,
              body: bytesBody(chunks, total, headers['content-type'], options.maxBodyBytes),
            }
            if (response.statusMessage) capture.response.statusText = response.statusMessage
            push(capture)
          }
        } catch {}
        return emit.call(this, event, ...args)
      } as typeof response.emit
    } catch {}
  })

  // Bodies are tapped on the prototype: the start channel can fire after the body was written.
  const requestChunks = new WeakMap<ClientRequest, { chunks: Uint8Array[]; total: number }>()
  const tap = (request: ClientRequest, chunk: unknown) => {
    try {
      if (chunk === undefined || chunk === null || typeof chunk === 'function') return
      let entry = requestChunks.get(request)
      if (!entry) {
        entry = { chunks: [], total: 0 }
        requestChunks.set(request, entry)
      }
      if (entry.total > options.maxBodyBytes) return
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Uint8Array)
      entry.chunks.push(bytes)
      entry.total += bytes.byteLength
    } catch {}
  }
  const proto = ClientRequest.prototype
  const { write, end } = proto
  proto.write = function flowCheckerWrite(this: ClientRequest, chunk: unknown, ...rest: unknown[]) {
    tap(this, chunk)
    return (write as (...a: unknown[]) => boolean).call(this, chunk, ...rest)
  } as typeof proto.write
  proto.end = function flowCheckerEnd(this: ClientRequest, chunk?: unknown, ...rest: unknown[]) {
    tap(this, chunk)
    return (end as (...a: unknown[]) => ClientRequest).call(this, chunk, ...rest)
  } as typeof proto.end

  const collected = (request: ClientRequest, contentType: string | undefined): CapturedBody => {
    const entry = requestChunks.get(request)
    if (!entry || entry.total === 0) return { kind: 'none' }
    return bytesBody(entry.chunks, entry.total, contentType, options.maxBodyBytes)
  }

  return { flush }
}

function header(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function isOurs(fn: Fetch): boolean {
  return Boolean((fn as Fetch & { [WRAPPED]?: Fetch })[WRAPPED])
}

/** Next's patched fetch wraps whatever fetch was current when it patched, which is ours. */
function isNextPatched(fn: Fetch): boolean {
  return Boolean((fn as Fetch & { __nextPatched?: boolean }).__nextPatched)
}

/** The fetch below our wrappers, used to send captures without capturing them. */
function unwrap(fn: Fetch): Fetch {
  let current = fn
  for (let i = 0; i < 10 && isOurs(current); i++) {
    current = (current as Fetch & { [WRAPPED]: Fetch })[WRAPPED]
  }
  return current
}
