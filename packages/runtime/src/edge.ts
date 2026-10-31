// Edge capture runtime (M14), loaded from the app's `instrumentation.ts` when Next registers it
// for the edge runtime. Middleware runs there by default before Next.js 16 (`middleware.ts`).
// Best effort: `fetch` only, with no Node.js APIs, so it has no incoming-request context and no
// http/https capture. It does nothing unless FLOW_CHECKER=1, and it never throws into the app.
import type { Capture, CapturedBody } from '@flow-checker/shared'
import { callerStack, headersToObject, readStream, requestBody } from './body'
import { createIgnoreMatcher, parseRuntimeConfig, type RuntimeConfig, randomId } from './options'
import { compileRules, redactCapture } from './redact'

const INSTALLED = Symbol.for('flow-checker.edge')
const WRAPPED = Symbol.for('flow-checker.wrapped-fetch')
const OWN_FRAMES = /flowChecker|flow-checker[\\/_]dist|runtime[-_]edge/

type Fetch = typeof globalThis.fetch
type Global = typeof globalThis & { [INSTALLED]?: EdgeRuntime }

export interface EdgeRuntime {
  /** Resolves when the captures sent so far have been delivered. */
  flush: () => Promise<void>
}

/**
 * Starts capturing `fetch` calls in the edge runtime. Pass `process.env.FLOW_CHECKER_RUNTIME`
 * written out in `instrumentation.ts`, so Next's edge bundler keeps the variable.
 */
export function registerEdgeRuntime(config?: string | RuntimeConfig): EdgeRuntime | undefined {
  try {
    // Written out (not `process.env[name]`): Next only provides variables it sees in edge code.
    if (process.env.FLOW_CHECKER !== '1') return undefined
    const g = globalThis as Global
    if (g[INSTALLED]) return g[INSTALLED]
    const parsed = parseRuntimeConfig(config ?? process.env.FLOW_CHECKER_RUNTIME)
    if (!parsed) return undefined
    const runtime = start(parsed)
    g[INSTALLED] = runtime
    return runtime
  } catch {
    return undefined
  }
}

function start(config: RuntimeConfig): EdgeRuntime {
  const options = config.capture
  const rules = compileRules(options.redact)
  const ignored = createIgnoreMatcher(options.ignore)
  const ingest = new URL(config.ingest)
  const original = globalThis.fetch
  const nativeFetch: Fetch = (original as Fetch & { [WRAPPED]?: Fetch })[WRAPPED] ?? original
  let depth = 0
  // Sent one at a time as they finish: an edge function's timers may not outlive its request.
  let sending: Promise<void> = Promise.resolve()

  const send = (capture: Capture) => {
    try {
      const body = JSON.stringify({
        token: config.token,
        captures: [redactCapture(capture, rules, options.storeRaw)],
        events: [],
      })
      sending = sending
        .then(() =>
          nativeFetch(ingest.href, { method: 'POST', body, headers: { 'content-type': 'text/plain' } }).then(
            (res) => void res.body?.cancel().catch(() => {}),
          ),
        )
        .catch(() => {})
    } catch {}
  }

  const shouldCapture = (url: URL) => {
    if (url.origin === ingest.origin && url.pathname === ingest.pathname) return false
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return !ignored(url)
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
    send(capture)
  }

  const wrapped = async function flowCheckerEdgeFetch(input: Parameters<Fetch>[0], init?: RequestInit) {
    if (depth > 0) return original(input, init)
    let capture: Capture | undefined
    let bodyPromise: Promise<CapturedBody> | undefined
    try {
      const request = input instanceof Request ? input : undefined
      const url = new URL(request ? request.url : String(input))
      const headers = shouldCapture(url)
        ? { ...headersToObject(request?.headers), ...headersToObject(init?.headers) }
        : undefined
      if (headers && headers.rsc !== '1') {
        capture = {
          id: randomId('cap'),
          sessionId: 'server',
          origin: 'server',
          transport: 'fetch',
          timestamp: new Date().toISOString(),
          durationMs: 0,
          request: {
            method: (init?.method ?? request?.method ?? 'GET').toUpperCase(),
            url: url.href,
            headers,
            body: { kind: 'none' },
          },
          stack: callerStack(OWN_FRAMES),
          redacted: false,
          redactedPaths: [],
        }
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
    if (!capture) return original(input, init)

    const current = capture
    const started = Date.now()
    let pending: Promise<Response>
    depth++
    try {
      pending = original(input, init)
    } finally {
      depth--
    }
    try {
      const response = await pending
      current.durationMs = Date.now() - started
      void finish(current, response.clone(), bodyPromise)
      return response
    } catch (error) {
      current.durationMs = Date.now() - started
      current.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      void finish(current, undefined, bodyPromise)
      throw error
    }
  } as Fetch & { [WRAPPED]?: Fetch }
  try {
    Object.assign(wrapped, original)
  } catch {}
  wrapped[WRAPPED] = original
  globalThis.fetch = wrapped

  return { flush: () => sending }
}
