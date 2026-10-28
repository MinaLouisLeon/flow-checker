/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// Browser capture runtime (docs/PLAN.md 7.2), loaded from the app's `instrumentation-client.ts`.
// It does nothing unless the app was started by flow-checker (which sets NEXT_PUBLIC_FLOW_CHECKER),
// never in production builds, and it never throws into the app.
import type { Capture, CapturedBody, Interaction, SessionEvent } from '@flow-checker/shared'
import { callerStack, headersToObject, readStream, requestBody, textBody } from './body'
import { createIgnoreMatcher, LINK_HEADER, parseRuntimeConfig, type RuntimeConfig, randomId } from './options'
import { compileRules, redactCapture } from './redact'

export type { RuntimeConfig } from './options'

const INSTALLED = Symbol.for('flow-checker.client')
const SESSION_KEY = 'flow-checker:session'
/** Interactions older than this are not linked to a request. */
const INTERACTION_WINDOW_MS = 5000
const FLUSH_MS = 400
const MAX_QUEUE = 200
const OWN_FRAMES = /flowChecker|flow-checker[\\/_]dist|runtime[-_]client/

type Global = typeof globalThis & { [INSTALLED]?: boolean }

/**
 * Starts capturing requests in the browser. Pass `process.env.NEXT_PUBLIC_FLOW_CHECKER`
 * (set by `flow-checker dev`). Without it, this is a no-op.
 */
export function installClientRuntime(config?: string | RuntimeConfig | null): void {
  try {
    if (process.env.NODE_ENV === 'production') return
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    const g = globalThis as Global
    if (g[INSTALLED]) return
    const parsed = parseRuntimeConfig(config)
    if (!parsed) return
    g[INSTALLED] = true
    start(parsed)
  } catch {
    // Capture must never break the app.
  }
}

function start(config: RuntimeConfig) {
  const options = config.capture
  const rules = compileRules(options.redact)
  const ignored = createIgnoreMatcher(options.ignore)
  const ingest = new URL(config.ingest)
  const nativeFetch = window.fetch.bind(window)
  const sessionId = getSessionId()
  const now = () => new Date().toISOString()

  // --- Sending ------------------------------------------------------------------------------

  let captures: Capture[] = []
  let events: SessionEvent[] = []
  let timer: ReturnType<typeof setTimeout> | undefined

  const payload = () => {
    const body = JSON.stringify({ token: config.token, sessionId, captures, events })
    captures = []
    events = []
    return body
  }

  const flush = () => {
    timer = undefined
    if (captures.length === 0 && events.length === 0) return
    const body = payload()
    // `text/plain` and no-cors: a simple request, so no CORS preflight to the tool server.
    nativeFetch(ingest.href, {
      method: 'POST',
      body,
      mode: 'no-cors',
      keepalive: body.length < 60_000,
    }).catch(() => {})
  }

  const schedule = () => {
    if (captures.length + events.length >= MAX_QUEUE) flush()
    else if (!timer) timer = setTimeout(flush, FLUSH_MS)
  }

  const flushOnExit = () => {
    if (captures.length === 0 && events.length === 0) return
    const body = payload()
    try {
      if (navigator.sendBeacon?.(ingest.href, new Blob([body], { type: 'text/plain' }))) return
    } catch {}
    nativeFetch(ingest.href, { method: 'POST', body, mode: 'no-cors', keepalive: true }).catch(() => {})
  }
  window.addEventListener('pagehide', flushOnExit)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnExit()
  })

  const pushEvent = (event: SessionEvent) => {
    events.push(event)
    schedule()
  }

  const pushCapture = (capture: Capture) => {
    try {
      const out = redactCapture(capture, rules, options.storeRaw)
      captures.push(out)
      pushEvent({ kind: 'capture', at: capture.timestamp, captureId: capture.id })
    } catch {}
  }

  // --- Interactions and navigation ----------------------------------------------------------

  let lastInteraction: (Interaction & { time: number }) | undefined

  const onInteraction = (event: Event) => {
    try {
      if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Enter') return
      const target = event.target instanceof Element ? event.target : null
      if (!target) return
      const interaction = {
        type: event.type,
        target: describeElement(target),
        componentChain: componentChain(target),
        at: now(),
      }
      lastInteraction = { ...interaction, time: Date.now() }
      pushEvent({ kind: 'interaction', ...interaction, url: location.href })
    } catch {}
  }
  for (const type of ['click', 'submit', 'change', 'keydown']) {
    document.addEventListener(type, onInteraction, { capture: true, passive: true })
  }

  const currentInteraction = (): Interaction | undefined => {
    if (!lastInteraction || Date.now() - lastInteraction.time > INTERACTION_WINDOW_MS) return undefined
    const { time: _, ...interaction } = lastInteraction
    return interaction
  }

  let lastUrl = location.href
  const onNavigation = (how: 'push' | 'replace' | 'pop') => {
    try {
      if (location.href === lastUrl) return
      lastUrl = location.href
      pushEvent({ kind: 'navigation', at: now(), how, url: location.href })
    } catch {}
  }
  pushEvent({ kind: 'navigation', at: now(), how: 'load', url: location.href })
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method]
    history[method] = function flowCheckerHistory(this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args)
      onNavigation(method === 'pushState' ? 'push' : 'replace')
      return result
    }
  }
  window.addEventListener('popstate', () => onNavigation('pop'))

  // --- Request filtering --------------------------------------------------------------------

  const shouldCapture = (url: URL, headers: Record<string, string>): boolean => {
    if (url.origin === ingest.origin && url.pathname === ingest.pathname) return false
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    // Next's own RSC navigation and prefetch requests.
    if (headers.rsc === '1' || url.searchParams.has('_rsc')) return false
    return !ignored(url)
  }

  const linkHeader = (captureId: string) => `${sessionId}.${captureId}`

  const baseCapture = (id: string, method: string, url: URL, headers: Record<string, string>) => {
    const action = headers['next-action']
    const capture: Capture = {
      id,
      sessionId,
      origin: 'browser',
      transport: 'fetch',
      timestamp: now(),
      durationMs: 0,
      pageUrl: location.href,
      request: { method, url: url.href, headers, body: { kind: 'none' } },
      stack: callerStack(OWN_FRAMES),
      redacted: false,
      redactedPaths: [],
    }
    if (action) capture.serverAction = { id: action }
    const interaction = currentInteraction()
    if (interaction) capture.interaction = interaction
    return capture
  }

  // --- fetch --------------------------------------------------------------------------------

  window.fetch = async function flowCheckerFetch(input: RequestInfo | URL, init?: RequestInit) {
    let capture: Capture | undefined
    let bodyPromise: Promise<CapturedBody> | undefined
    let started = 0
    try {
      const request = input instanceof Request ? input : undefined
      const url = new URL(request ? request.url : String(input), location.href)
      const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
      const headers = { ...headersToObject(request?.headers), ...headersToObject(init?.headers) }
      if (shouldCapture(url, headers)) {
        const id = randomId('cap')
        capture = baseCapture(id, method, url, headers)
        const contentType = headers['content-type']
        if (init?.body !== undefined) {
          capture.request.body = requestBody(init.body, contentType, options.maxBodyBytes)
        } else if (request?.body) {
          bodyPromise = readStream(request.clone().body, contentType, options.maxBodyBytes)
        }
        // Same-origin calls (route handlers, server actions) carry a link so the server
        // runtime can tie its outgoing requests to this one.
        if (url.origin === location.origin && !request) {
          const merged = new Headers(init?.headers)
          merged.set(LINK_HEADER, linkHeader(id))
          init = { ...init, headers: merged }
        }
        started = performance.now()
      }
    } catch {
      capture = undefined
    }

    if (!capture) return nativeFetch(input, init)
    const current = capture
    try {
      const response = await nativeFetch(input, init)
      current.durationMs = Math.round(performance.now() - started)
      void finishFetch(current, response.clone(), bodyPromise)
      return response
    } catch (error) {
      current.durationMs = Math.round(performance.now() - started)
      current.error = errorText(error)
      void finishFetch(current, undefined, bodyPromise)
      throw error
    }
  }

  const finishFetch = async (capture: Capture, response?: Response, bodyPromise?: Promise<CapturedBody>) => {
    try {
      if (bodyPromise) capture.request.body = await bodyPromise.catch(() => ({ kind: 'binary' }) as const)
      if (response) {
        const headers = headersToObject(response.headers)
        const length = Number(headers['content-length'])
        capture.response = {
          status: response.status,
          statusText: response.statusText || undefined,
          headers,
          body: await readStream(
            response.body,
            headers['content-type'],
            options.maxBodyBytes,
            Number.isFinite(length) ? length : undefined,
          ).catch(() => ({ kind: 'binary' }) as const),
        }
        if (capture.response.statusText === undefined) delete capture.response.statusText
      }
    } catch {}
    pushCapture(capture)
  }

  // --- XMLHttpRequest (axios in the browser) ------------------------------------------------

  const xhrState = new WeakMap<
    XMLHttpRequest,
    { method: string; url: URL; headers: Record<string, string>; capture?: Capture; started?: number }
  >()
  const proto = XMLHttpRequest.prototype
  const { open, setRequestHeader, send } = proto

  proto.open = function flowCheckerXhrOpen(this: XMLHttpRequest, ...args: unknown[]) {
    try {
      const [method, url] = args as [string, string | URL]
      xhrState.set(this, {
        method: String(method).toUpperCase(),
        url: new URL(String(url), location.href),
        headers: {},
      })
    } catch {}
    return (open as (...a: unknown[]) => void).apply(this, args)
  } as typeof proto.open

  proto.setRequestHeader = function flowCheckerXhrHeader(this: XMLHttpRequest, name: string, value: string) {
    try {
      const state = xhrState.get(this)
      if (state) state.headers[name.toLowerCase()] = value
    } catch {}
    return setRequestHeader.call(this, name, value)
  }

  proto.send = function flowCheckerXhrSend(
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    try {
      const state = xhrState.get(this)
      if (state && shouldCapture(state.url, state.headers)) {
        const id = randomId('cap')
        const capture = baseCapture(id, state.method, state.url, { ...state.headers })
        capture.transport = 'xhr'
        capture.request.body = requestBody(body, state.headers['content-type'], options.maxBodyBytes)
        if (state.url.origin === location.origin) setRequestHeader.call(this, LINK_HEADER, linkHeader(id))
        state.capture = capture
        state.started = performance.now()
        this.addEventListener('loadend', () => finishXhr(this))
      }
    } catch {}
    return send.call(this, body)
  }

  const finishXhr = (xhr: XMLHttpRequest) => {
    try {
      const state = xhrState.get(xhr)
      const capture = state?.capture
      if (!state || !capture) return
      capture.durationMs = Math.round(performance.now() - (state.started ?? performance.now()))
      if (xhr.status === 0) {
        capture.error = 'Network error or request aborted'
      } else {
        const headers = parseXhrHeaders(xhr.getAllResponseHeaders())
        capture.response = {
          status: xhr.status,
          headers,
          body: xhrBody(xhr, headers['content-type'], options.maxBodyBytes),
        }
        if (xhr.statusText) capture.response.statusText = xhr.statusText
      }
      pushCapture(capture)
    } catch {}
  }

  console.info(`[flow-checker] capturing requests → ${ingest.origin}`)
}

function xhrBody(xhr: XMLHttpRequest, contentType: string | undefined, maxBytes: number): CapturedBody {
  try {
    if (xhr.responseType === '' || xhr.responseType === 'text') {
      return textBody(xhr.responseText, contentType, maxBytes)
    }
    if (xhr.responseType === 'json') {
      return xhr.response === null ? { kind: 'none' } : { kind: 'json', value: xhr.response }
    }
    const size = xhr.response?.byteLength ?? xhr.response?.size
    return { kind: 'binary', contentType, size: typeof size === 'number' ? size : undefined }
  } catch {
    return { kind: 'binary', contentType }
  }
}

function parseXhrHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const index = line.indexOf(':')
    if (index > 0) out[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim()
  }
  return out
}

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const id = randomId('ses')
    sessionStorage.setItem(SESSION_KEY, id)
    return id
  } catch {
    return randomId('ses')
  }
}

/** `button "Delete user"`, `input[name=email]`, `form#login`. */
function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase()
  let text = tag
  if (el.id) text += `#${el.id}`
  const name = el.getAttribute('name')
  if (name) text += `[name=${name}]`
  const type = el.getAttribute('type')
  if (type && tag === 'input') text += `[type=${type}]`
  const label =
    el.getAttribute('aria-label') ??
    (tag === 'input' || tag === 'textarea' || tag === 'select' ? null : el.textContent)
  const clean = label?.replace(/\s+/g, ' ').trim()
  if (clean) text += ` "${clean.length > 40 ? `${clean.slice(0, 40)}…` : clean}"`
  return text
}

/** React component names from the element's fiber up to the root, nearest first. */
function componentChain(el: Element): string[] {
  let node: Element | null = el
  let fiber: Fiber | undefined
  while (node && !fiber) {
    const key = Object.keys(node).find((k) => k.startsWith('__reactFiber$'))
    if (key) fiber = (node as unknown as Record<string, Fiber>)[key]
    node = node.parentElement
  }
  const names: string[] = []
  for (let f = fiber, steps = 0; f && names.length < 30 && steps < 500; f = f.return, steps++) {
    const name = fiberName(f.type)
    if (name && names[names.length - 1] !== name) names.push(name)
  }
  return names
}

interface Fiber {
  type: unknown
  return?: Fiber
}

function fiberName(type: unknown, depth = 0): string | undefined {
  if (depth > 3 || !type) return undefined
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string }
    return fn.displayName || fn.name || undefined
  }
  if (typeof type === 'object') {
    const t = type as { displayName?: string; render?: unknown; type?: unknown }
    if (t.displayName) return t.displayName
    if (t.render) return fiberName(t.render, depth + 1) // forwardRef
    if (t.type) return fiberName(t.type, depth + 1) // memo
  }
  return undefined
}
