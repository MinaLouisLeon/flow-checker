// dev safety net for the server hook (docs/PLAN.md M22). When browser requests reach a project
// route handler that sends requests of its own, server captures should follow. If none has
// arrived some seconds after the first such request, the hook most likely never ran.
import {
  type AppModel,
  type Capture,
  type Route,
  routePathRegex,
  type ServerCaptureStatus,
  servedPaths,
} from '@flow-checker/shared'
import type { CaptureStore } from './store'

/** How long to wait for a server capture after the first browser request to a route handler. */
export const SERVER_CAPTURE_WAIT_MS = 10_000

export interface ServerCaptureWatchOptions {
  model: AppModel
  store: CaptureStore
  waitMs?: number
  /** Called once when the state becomes `missing`. */
  onMissing?: (status: ServerCaptureStatus) => void
}

export class ServerCaptureWatch {
  #status: ServerCaptureStatus = { state: 'waiting' }
  #handlers: { route: Route; regex: RegExp }[] = []
  #model: AppModel
  #timer: ReturnType<typeof setTimeout> | undefined
  #listeners = new Set<(status: ServerCaptureStatus) => void>()
  #stop: () => void
  #warned = false
  /** Captures from earlier runs (re-matched after a re-scan) don't count. */
  readonly #since = Date.now()

  constructor(private readonly options: ServerCaptureWatchOptions) {
    this.#model = options.model
    this.setModel(options.model)
    this.#stop = options.store.subscribe((capture) => this.#see(capture))
  }

  setModel(model: AppModel): void {
    this.#model = model
    // Only handlers that send requests themselves: a handler that just answers makes no capture.
    const sending = new Set(
      model.requests.filter((s) => s.origin === 'route-handler' && s.routeId).map((s) => s.routeId),
    )
    this.#handlers = model.routes
      .filter((r) => r.kind === 'route-handler' && sending.has(r.id))
      .map((route) => ({ route, regex: routePathRegex(route.path) }))
  }

  status(): ServerCaptureStatus {
    return this.#status
  }

  subscribe(listener: (status: ServerCaptureStatus) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  close(): void {
    clearTimeout(this.#timer)
    this.#stop()
  }

  #see(capture: Capture) {
    if (this.#status.state === 'running') return
    const at = Date.parse(capture.timestamp)
    if (Number.isFinite(at) && at < this.#since) return
    if (capture.origin === 'server') {
      clearTimeout(this.#timer)
      this.#timer = undefined
      this.#set({ state: 'running' })
      return
    }
    if (this.#timer || this.#status.state === 'missing') return
    const request = this.#handlerRequest(capture)
    if (!request) return
    this.#timer = setTimeout(() => {
      this.#timer = undefined
      if (this.#status.state !== 'waiting') return
      const status: ServerCaptureStatus = { state: 'missing', request }
      this.#set(status)
      if (!this.#warned) {
        this.#warned = true
        this.options.onMissing?.(status)
      }
    }, this.options.waitMs ?? SERVER_CAPTURE_WAIT_MS)
    this.#timer.unref?.()
  }

  /** `GET /api/x` when the browser capture went to one of the app's own route handlers. */
  #handlerRequest(capture: Capture): string | undefined {
    if (!capture.pageUrl || this.#handlers.length === 0) return undefined
    let url: URL
    let page: URL
    try {
      url = new URL(capture.request.url)
      page = new URL(capture.pageUrl)
    } catch {
      return undefined
    }
    if (url.origin !== page.origin) return undefined
    const paths = servedPaths(this.#model.middleware, url.pathname)
    const hit = this.#handlers.some(({ route, regex }) => {
      if (!paths.some((p) => regex.test(p))) return false
      return !route.methods?.length || route.methods.includes(capture.request.method.toUpperCase() as never)
    })
    return hit ? `${capture.request.method.toUpperCase()} ${url.pathname}` : undefined
  }

  #set(status: ServerCaptureStatus) {
    this.#status = status
    for (const listener of this.#listeners) {
      try {
        listener(status)
      } catch {}
    }
  }
}
