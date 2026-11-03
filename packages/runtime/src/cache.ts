// Server cache events (M40): whether each cached `fetch`, `use cache` function and `unstable_cache`
// function was a hit, a miss or skipped. Hits send no request, so the capture wrappers never see
// them; this reads Next's own records instead:
//
// - fetch: Next's patched fetch is wrapped from the outside, and the result is read from the
//   metrics Next keeps per request in dev (`workStore.fetchMetrics`: hit / miss / skip / hmr and
//   a reason). Only calls that ask to be cached (`cache: 'force-cache'`, `next.revalidate`,
//   `next.tags`, like the scan's entries) are recorded; others pass straight through.
// - use cache: the cache handlers Next keeps on `globalThis` (an entry from `get` = hit).
// - unstable_cache: `IncrementalCache.get` with a `fetchUrl` of `unstable_cache …`.
//
// Everything here runs inside Next's renders, so it never throws into them and never reads the
// time with `Date` (see `clock.ts`).
import { AsyncLocalStorage } from 'node:async_hooks'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { CacheEvent } from '@flow-checker/shared'

type Fetch = typeof globalThis.fetch

/** What the server runtime fills in: id, session, time and the incoming request. */
export type CacheEventBase = Pick<CacheEvent, 'id' | 'sessionId' | 'at' | 'parent'>
export type CacheEventBody = Omit<CacheEvent, keyof CacheEventBase | 'sourceStack'>

export interface CacheObserverHooks {
  /** Taken when the call starts, so a result that arrives later keeps its request. */
  begin: () => CacheEventBase
  emit: (base: CacheEventBase, body: CacheEventBody) => void
  /** Stack frames at the call, innermost first, without the runtime's own. */
  stack: () => string[]
  /** False for URLs that aren't captured (the ingest endpoint, ignored globs). */
  shouldCapture: (url: URL) => boolean
  /** The incoming request asked for fresh data (`cache-control: no-cache`, a hard reload). */
  hardRefresh: (base: CacheEventBase) => boolean
}

interface FetchMetric {
  url?: string
  method?: string
  cacheStatus?: CacheEvent['status']
  cacheReason?: string
}

interface WorkStore {
  fetchMetrics?: FetchMetric[]
  incrementalCache?: object
}

interface Storage<T> {
  getStore: () => T | undefined
  run?: (store: T, ...rest: unknown[]) => unknown
}

interface CacheHandler {
  get: (key: string, ...rest: unknown[]) => unknown
  set: (key: string, entry: unknown, ...rest: unknown[]) => unknown
}

interface HandlerEntry {
  tags?: unknown
  revalidate?: number
  timestamp?: number
}

/** Set while a recorded fetch runs, so the capture wrapper below Next can say which request it sent. */
export const fetchSlot = new AsyncLocalStorage<{ captureId?: string }>()

const OBSERVED = Symbol.for('flow-checker.observed-fetch')
const WRAPPED_HANDLER = Symbol.for('flow-checker.cache-handler')
const WRAPPED_INCREMENTAL = Symbol.for('flow-checker.incremental-cache')
const WATCHED_STORAGE = Symbol.for('flow-checker.work-storage')
const HANDLERS_MAP = Symbol.for('@next/cache-handlers-map')
const PRIVATE_HANDLER = Symbol.for('@next/cache-handlers-private')
const DEV_TIERED_HANDLERS = Symbol.for('@next/cache-handlers-dev-tiered')
/** Waiting for a `use cache` miss to be stored (its tags come with it). */
const MISS_WAIT_MS = 10_000
/** Next's words for a lookup skipped because the browser asked for fresh data. */
const HARD_REFRESH = 'cache-control: no-cache (hard refresh)'

export interface CacheObserver {
  /** Next's patched fetch, wrapped to record cache results. */
  observeFetch: (nextFetch: Fetch) => Fetch
  isObserved: (fn: Fetch) => boolean
  /** Wraps cache handlers and the incremental cache that appeared since the last call. Cheap. */
  refresh: () => void
}

export function createCacheObserver(hooks: CacheObserverHooks): CacheObserver {
  const claimed = new WeakSet<FetchMetric>()
  let workStorage: Storage<WorkStore> | undefined
  let triedRequire = false

  // Next 16 keeps its async storages on `globalThis`; Next 15 only in its own module, which the
  // app's `next` package resolves to the same instance Next's server uses.
  const workStore = (): WorkStore | undefined => {
    if (!workStorage) {
      const g = globalThis as Record<symbol, unknown>
      for (const symbol of Object.getOwnPropertySymbols(g)) {
        if (symbol.description?.startsWith('@next/work-async-storage@')) {
          workStorage = g[symbol] as Storage<WorkStore>
          break
        }
      }
      if (!workStorage && !triedRequire) {
        triedRequire = true
        workStorage = nextModule<{ workAsyncStorage?: Storage<WorkStore> }>(
          'next/dist/server/app-render/work-async-storage.external.js',
        )?.workAsyncStorage
      }
      if (workStorage) watchStores(workStorage)
    }
    try {
      return workStorage?.getStore()
    } catch {
      return undefined
    }
  }

  /**
   * Each render's work store carries the incremental cache `unstable_cache` reads: wrap its class
   * as soon as Next enters a store, even when the render makes no cached fetch.
   */
  const watchStores = (storage: Storage<WorkStore>) => {
    const marked = storage as Storage<WorkStore> & { [WATCHED_STORAGE]?: true }
    const run = marked.run
    if (typeof run !== 'function' || marked[WATCHED_STORAGE]) return
    marked[WATCHED_STORAGE] = true
    marked.run = function flowCheckerWorkRun(this: unknown, store: WorkStore, ...rest: unknown[]) {
      try {
        const cache = store?.incrementalCache
        if (cache) wrapIncremental(Object.getPrototypeOf(cache) as { get?: unknown })
      } catch {}
      return run.call(this, store, ...rest)
    }
  }

  /** A miss during a hard reload is Next bypassing its cache on purpose: a skip, like Next says for fetch. */
  const missOrSkip = (base: CacheEventBase): Pick<CacheEventBody, 'status' | 'reason'> =>
    hooks.hardRefresh(base) ? { status: 'skip', reason: HARD_REFRESH } : { status: 'miss' }

  // --- fetch ----------------------------------------------------------------------------------

  const observeFetch = (nextFetch: Fetch): Fetch => {
    const observed = async function flowCheckerCachedFetch(input: Parameters<Fetch>[0], init?: RequestInit) {
      let probe: FetchProbe | undefined
      try {
        probe = startFetch(input, init)
      } catch {
        probe = undefined
      }
      if (!probe) return nextFetch(input, init)
      const current = probe
      try {
        const response = await fetchSlot.run(current.slot, () => nextFetch(input, init))
        finishFetch(current, false)
        return response
      } catch (error) {
        finishFetch(current, true)
        throw error
      }
    } as Fetch & { [OBSERVED]?: Fetch }
    try {
      // Next reads markers such as `__nextPatched` from `globalThis.fetch`.
      Object.assign(observed, nextFetch)
    } catch {}
    observed[OBSERVED] = nextFetch
    return observed
  }

  interface FetchProbe {
    base: CacheEventBase
    store: WorkStore
    before: number
    method: string
    url: URL
    tags?: string[]
    stack: string[]
    slot: { captureId?: string }
  }

  const startFetch = (input: Parameters<Fetch>[0], init?: RequestInit): FetchProbe | undefined => {
    const next = (init as { next?: { revalidate?: unknown; tags?: unknown } } | undefined)?.next
    const tags = Array.isArray(next?.tags) ? next.tags.filter((t): t is string => typeof t === 'string') : []
    // The same options the scan reads as a cache entry.
    const asks = init?.cache === 'force-cache' || next?.revalidate !== undefined || tags.length > 0
    if (!asks) return undefined
    const store = workStore()
    if (!store) return undefined
    const request = input instanceof Request ? input : undefined
    const url = new URL(request ? request.url : String(input))
    if (!hooks.shouldCapture(url)) return undefined
    return {
      base: hooks.begin(),
      store,
      before: store.fetchMetrics?.length ?? 0,
      method: (init?.method ?? request?.method ?? 'GET').toUpperCase(),
      url,
      ...(tags.length > 0 ? { tags } : {}),
      stack: hooks.stack(),
      slot: {},
    }
  }

  const finishFetch = (probe: FetchProbe, failed: boolean) => {
    try {
      const metric = probe.store.fetchMetrics
        ?.slice(probe.before)
        .find((m) => !claimed.has(m) && sameUrl(m.url, probe.url) && (m.method ?? 'GET') === probe.method)
      let status = metric?.cacheStatus
      let reason = metric?.cacheReason
      if (metric) claimed.add(metric)
      // No metric (Next tracks none for this render): a request sent means the cache wasn't used.
      else if (probe.slot.captureId && !failed) status = 'miss'
      if (!status) return
      // In dev Next reports every empty lookup as a skip "(hard refresh)". It is one only when the
      // browser asked for fresh data; otherwise the data simply wasn't in the cache.
      if (status === 'skip' && /hard refresh/i.test(reason ?? '') && !hooks.hardRefresh(probe.base)) {
        status = 'miss'
        reason = undefined
      }
      const body: CacheEventBody = {
        kind: 'fetch',
        status,
        key: hashKey(`${probe.method} ${probe.url.href}`),
        method: probe.method,
        url: probe.url.href,
        stack: probe.stack,
      }
      if (reason) body.reason = reason
      if (probe.tags) body.tags = probe.tags
      if (status !== 'hit' && probe.slot.captureId) body.captureId = probe.slot.captureId
      hooks.emit(probe.base, body)
    } catch {}
  }

  // --- use cache ------------------------------------------------------------------------------

  const wrapHandler = (handler: CacheHandler | undefined, kind: string) => {
    if (!handler || typeof handler.get !== 'function') return
    const marked = handler as CacheHandler & { [WRAPPED_HANDLER]?: true }
    if (marked[WRAPPED_HANDLER]) return
    marked[WRAPPED_HANDLER] = true
    const pending = new Map<string, { base: CacheEventBase; body: CacheEventBody; timer: unknown }>()
    const send = (key: string) => {
      const item = pending.get(key)
      if (!item) return
      pending.delete(key)
      clearTimeout(item.timer as ReturnType<typeof setTimeout>)
      hooks.emit(item.base, item.body)
    }
    const get = handler.get
    handler.get = function flowCheckerCacheGet(this: unknown, key: string, ...rest: unknown[]) {
      const result = get.call(this, key, ...rest)
      try {
        const base = hooks.begin()
        void Promise.resolve(result).then(
          (entry) => {
            try {
              const found = entry as HandlerEntry | undefined
              const body: CacheEventBody = {
                kind: 'use-cache',
                ...(found ? { status: 'hit' as const } : missOrSkip(base)),
                key: hashKey(key),
                handler: kind,
                stack: [],
              }
              const id = functionId(key)
              if (id) body.functionId = id
              if (found) {
                const tags = stringTags(found.tags)
                if (tags) body.tags = tags
                if (isStale(found)) body.stale = true
                hooks.emit(base, body)
                return
              }
              // A miss runs the function and stores the result: wait for it to learn its tags.
              // An earlier miss of the same key that was never stored goes out first.
              send(key)
              const timer = setTimeout(() => send(key), MISS_WAIT_MS)
              ;(timer as { unref?: () => void }).unref?.()
              pending.set(key, { base, body, timer })
            } catch {}
          },
          () => {},
        )
      } catch {}
      return result
    }
    if (typeof handler.set === 'function') {
      const set = handler.set
      handler.set = function flowCheckerCacheSet(
        this: unknown,
        key: string,
        entry: unknown,
        ...rest: unknown[]
      ) {
        const result = set.call(this, key, entry, ...rest)
        try {
          if (pending.has(key)) {
            void Promise.resolve(entry).then(
              (stored) => {
                const item = pending.get(key)
                const tags = stringTags((stored as HandlerEntry | undefined)?.tags)
                if (item && tags) item.body.tags = tags
                send(key)
              },
              () => send(key),
            )
          }
        } catch {}
        return result
      }
    }
  }

  const wrapHandlers = () => {
    const g = globalThis as Record<symbol, unknown>
    // In dev, custom handlers are read through a tiered handler: wrap that one instead.
    const tiered = g[DEV_TIERED_HANDLERS] as Map<string, CacheHandler> | undefined
    const map = g[HANDLERS_MAP] as Map<string, CacheHandler> | undefined
    if (map instanceof Map) {
      for (const [kind, handler] of map) {
        if (!(tiered instanceof Map && tiered.has(kind))) wrapHandler(handler, kind)
      }
    }
    if (tiered instanceof Map) for (const [kind, handler] of tiered) wrapHandler(handler, kind)
    wrapHandler(g[PRIVATE_HANDLER] as CacheHandler | undefined, 'private')
  }

  // --- unstable_cache -------------------------------------------------------------------------

  const wrapIncremental = (proto: { get?: unknown } | undefined) => {
    if (!proto || typeof proto.get !== 'function') return
    const marked = proto as { [WRAPPED_INCREMENTAL]?: true; get: (...args: unknown[]) => unknown }
    if (marked[WRAPPED_INCREMENTAL]) return
    marked[WRAPPED_INCREMENTAL] = true
    const get = marked.get
    marked.get = function flowCheckerIncrementalGet(this: unknown, ...args: unknown[]) {
      const result = get.apply(this, args)
      try {
        const [key, ctx] = args as [
          unknown,
          { kind?: string; fetchUrl?: unknown; tags?: unknown } | undefined,
        ]
        const fetchUrl = ctx?.fetchUrl
        if (ctx?.kind === 'FETCH' && typeof fetchUrl === 'string' && fetchUrl.startsWith('unstable_cache ')) {
          const base = hooks.begin()
          void Promise.resolve(result).then(
            (entry) => {
              try {
                const found = entry as { value?: unknown; isStale?: unknown } | null | undefined
                const hit = Boolean(found?.value)
                const body: CacheEventBody = {
                  kind: 'unstable-cache',
                  ...(hit ? { status: 'hit' as const } : missOrSkip(base)),
                  key: hashKey(String(key)),
                  name: unstableCacheName(fetchUrl),
                  stack: [],
                }
                const tags = stringTags(ctx.tags)
                if (tags) body.tags = tags
                if (hit && found?.isStale === true) body.stale = true
                hooks.emit(base, body)
              } catch {}
            },
            () => {},
          )
        }
      } catch {}
      return result
    }
  }

  let incrementalLoaded = false
  const refresh = () => {
    try {
      wrapHandlers()
      if (!incrementalLoaded) {
        incrementalLoaded = true
        wrapIncremental(
          nextModule<{ IncrementalCache?: { prototype?: { get?: unknown } } }>(
            'next/dist/server/lib/incremental-cache/index.js',
          )?.IncrementalCache?.prototype,
        )
      }
      // The instance Next renders with, in case it isn't the class loaded above.
      const cache = workStore()?.incrementalCache
      if (cache) wrapIncremental(Object.getPrototypeOf(cache) as { get?: unknown })
    } catch {}
  }

  return {
    observeFetch,
    isObserved: (fn) => Boolean((fn as Fetch & { [OBSERVED]?: Fetch })[OBSERVED]),
    refresh,
  }
}

/** A module of the app's own `next` package, or `undefined`. */
function nextModule<T>(path: string): T | undefined {
  try {
    return createRequire(join(process.cwd(), 'package.json'))(path) as T
  } catch {
    return undefined
  }
}

function sameUrl(written: string | undefined, url: URL): boolean {
  if (!written) return false
  if (written === url.href) return true
  try {
    return new URL(written).href === url.href
  } catch {
    return false
  }
}

/** The function id at the start of a `use cache` key: `["<id>",[args],…]`. */
export function functionId(key: string): string | undefined {
  return /^\["([0-9a-f]{20,})"/i.exec(key)?.[1]
}

/** `unstable_cache <path>  <name>`: the wrapped function's name; empty for an anonymous one. */
export function unstableCacheName(fetchUrl: string): string {
  const parts = fetchUrl.split(/\s{2,}/)
  return parts.length > 1 ? (parts[parts.length - 1]?.trim() ?? '') : ''
}

function stringTags(tags: unknown): string[] | undefined {
  if (!Array.isArray(tags)) return undefined
  const out = tags.filter((t): t is string => typeof t === 'string' && !t.startsWith('_N_T_'))
  return out.length > 0 ? out : undefined
}

function isStale(entry: HandlerEntry): boolean {
  if (typeof entry.timestamp !== 'number' || typeof entry.revalidate !== 'number') return false
  return performance.timeOrigin + performance.now() > entry.timestamp + entry.revalidate * 1000
}

/** FNV-1a, twice with different seeds: a short stable hash, so keys never carry the values. */
export function hashKey(text: string): string {
  let a = 0x811c9dc5
  let b = 0x01000193 ^ 0x5bd1e995
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193)
    b = Math.imul(b ^ c, 0x5bd1e995)
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36)
}
