// React Query tagging (M13, docs/PLAN.md 14): which query or mutation a browser request was
// sent for. Once the app's QueryClient is found (through the React fiber of its
// QueryClientProvider), every query and mutation function it runs is wrapped, so a request that
// starts while one runs carries that query's key. Works with React Query v4 and v5.
// Like the rest of the runtime, nothing here may throw into the app.

export interface ActiveQuery {
  kind: 'query' | 'mutation'
  /** The key as JSON-safe values. */
  key?: unknown[]
}

export interface QueryTracker {
  /** The query or mutation whose function is running right now, if any. */
  current(): ActiveQuery | undefined
  /** Wraps the functions a QueryClient runs. Returns false when it is not a QueryClient. */
  instrument(client: unknown): boolean
  /**
   * For a request sent right when the client was found: its query function started before it
   * could be wrapped. When exactly one query is fetching, the request is taken to be its.
   */
  guess(): ActiveQuery | undefined
  /** Whether a client was instrumented. */
  readonly ready: boolean
}

const WRAPPED = Symbol.for('flow-checker.query-fn')
const PATCHED = Symbol.for('flow-checker.query-proto')

type Fn = ((...args: unknown[]) => unknown) & { [WRAPPED]?: true }
type Proto = Record<string | symbol, unknown> & { [PATCHED]?: true }

interface QueryLike {
  queryKey?: unknown
  options?: { queryFn?: unknown }
  state?: { fetchStatus?: string }
}
interface MutationLike {
  options?: { mutationFn?: unknown; mutationKey?: unknown }
}
interface CacheLike {
  build?: (...args: unknown[]) => unknown
  getAll?: () => unknown[]
}
interface ClientLike {
  getQueryCache: () => CacheLike
  getMutationCache?: () => CacheLike
}

/**
 * The query or mutation function running now. Module-wide: React Query's prototypes are patched
 * once, and every tracker reads the same state.
 */
let active: ActiveQuery | undefined

export function createQueryTracker(): QueryTracker {
  let ready = false
  let instrumented: ClientLike | undefined

  /** Runs `fn` with `tag` as the active query while it runs synchronously. */
  const wrap = (fn: unknown, tag: (args: unknown[]) => ActiveQuery): unknown => {
    if (typeof fn !== 'function' || (fn as Fn)[WRAPPED]) return fn
    const original = fn as Fn
    const wrapped: Fn = function flowCheckerQueryFn(this: unknown, ...args: unknown[]) {
      const previous = active
      try {
        active = tag(args)
      } catch {
        active = undefined
      }
      try {
        return original.apply(this, args)
      } finally {
        active = previous
      }
    }
    wrapped[WRAPPED] = true
    return wrapped
  }

  const wrapQuery = (query: QueryLike) => {
    try {
      const options = query.options
      if (!options || typeof options.queryFn !== 'function') return
      // The function gets `{ queryKey }`; fall back to the query's own key.
      options.queryFn = wrap(options.queryFn, (args) => {
        const context = args[0] as { queryKey?: unknown } | undefined
        return { kind: 'query', ...keyField(context?.queryKey ?? query.queryKey) }
      })
    } catch {}
  }

  const wrapMutation = (mutation: MutationLike) => {
    try {
      const options = mutation.options
      if (!options || typeof options.mutationFn !== 'function') return
      options.mutationFn = wrap(options.mutationFn, () => ({
        kind: 'mutation',
        ...keyField(mutation.options?.mutationKey),
      }))
    } catch {}
  }

  /** Query (v4 + v5): options are set by `setOptions`, and `fetch` may be called without. */
  const patchQueryProto = (proto: Proto | null) => {
    if (!proto || proto[PATCHED]) return
    const setOptions = proto.setOptions
    const fetch = proto.fetch
    if (typeof fetch !== 'function') return
    proto[PATCHED] = true
    if (typeof setOptions === 'function') {
      proto.setOptions = function flowCheckerSetOptions(this: QueryLike, ...args: unknown[]) {
        const result = (setOptions as Fn).apply(this, args)
        wrapQuery(this)
        return result
      }
    }
    proto.fetch = function flowCheckerQueryFetch(this: QueryLike, ...args: unknown[]) {
      wrapQuery(this)
      return (fetch as Fn).apply(this, args)
    }
  }

  const patchMutationProto = (proto: Proto | null) => {
    if (!proto || proto[PATCHED]) return
    const execute = proto.execute
    if (typeof execute !== 'function') return
    proto[PATCHED] = true
    proto.execute = function flowCheckerMutationExecute(this: MutationLike, ...args: unknown[]) {
      wrapMutation(this)
      return (execute as Fn).apply(this, args)
    }
  }

  /** Patches the cache's `build`, so every query or mutation it creates is patched too. */
  const patchCache = (
    cache: CacheLike | undefined,
    patchItem: (proto: Proto | null) => void,
    wrapItem: (item: never) => void,
  ) => {
    if (!cache) return
    const proto = Object.getPrototypeOf(cache) as Proto | null
    if (proto && !proto[PATCHED] && typeof proto.build === 'function') {
      const build = proto.build as Fn
      proto[PATCHED] = true
      proto.build = function flowCheckerCacheBuild(this: unknown, ...args: unknown[]) {
        const item = build.apply(this, args)
        try {
          if (item && typeof item === 'object') patchItem(Object.getPrototypeOf(item))
        } catch {}
        return item
      }
    }
    for (const item of cache.getAll?.() ?? []) {
      if (!item || typeof item !== 'object') continue
      patchItem(Object.getPrototypeOf(item))
      wrapItem(item as never)
    }
  }

  return {
    current: () => active,
    get ready() {
      return ready
    },
    instrument(client) {
      try {
        if (!isQueryClient(client)) return false
        patchCache(client.getQueryCache(), patchQueryProto, wrapQuery)
        patchCache(client.getMutationCache?.(), patchMutationProto, wrapMutation)
        ready = true
        instrumented = client
        return true
      } catch {
        return false
      }
    },
    guess() {
      try {
        const fetching = (instrumented?.getQueryCache().getAll?.() ?? []).filter(
          (q) => (q as QueryLike).state?.fetchStatus === 'fetching',
        ) as QueryLike[]
        const only = fetching.length === 1 ? fetching[0] : undefined
        return only ? { kind: 'query', ...keyField(only.queryKey) } : undefined
      } catch {
        return undefined
      }
    },
  }
}

function isQueryClient(value: unknown): value is ClientLike {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as ClientLike).getQueryCache === 'function' &&
    typeof (value as { invalidateQueries?: unknown }).invalidateQueries === 'function'
  )
}

/** The key as JSON values: strings and lists cut short, functions and class instances named. */
export function toJsonKey(key: unknown): unknown[] | undefined {
  if (!Array.isArray(key)) return undefined
  return key.slice(0, MAX_ITEMS).map((v) => jsonValue(v, 0))
}

const MAX_ITEMS = 20
const MAX_STRING = 200

function jsonValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return null
  switch (typeof value) {
    case 'string':
      return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value
    case 'number':
      return Number.isFinite(value) ? value : null
    case 'boolean':
      return value
    case 'bigint':
      return value.toString()
    case 'function':
    case 'symbol':
      return `[${typeof value}]`
  }
  if (depth >= 4) return '[…]'
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((v) => jsonValue(v, depth + 1))
  if (value instanceof Date) return value.toISOString()
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return `[${proto?.constructor?.name ?? 'object'}]`
  const out: Record<string, unknown> = {}
  // React Query hashes object keys sorted, and drops `undefined` values.
  for (const k of Object.keys(value as object)
    .sort()
    .slice(0, MAX_ITEMS)) {
    const v = (value as Record<string, unknown>)[k]
    if (v !== undefined) out[k] = jsonValue(v, depth + 1)
  }
  return out
}

function keyField(key: unknown): { key?: unknown[] } {
  const json = toJsonKey(key)
  return json ? { key: json } : {}
}

// --- Finding the client ----------------------------------------------------------------------

interface Fiber {
  child?: Fiber | null
  sibling?: Fiber | null
  return?: Fiber | null
  memoizedProps?: Record<string, unknown> | null
}

/** Fibers looked at before giving up: enough for big trees, cheap enough to retry. */
const MAX_FIBERS = 20_000

/**
 * The QueryClient from a `QueryClientProvider` (its `client` prop) or the context provider it
 * renders (`value`), searched from React's root fiber, which React keeps on the root container
 * (`__reactContainer$…`) or reaches from any element (`__reactFiber$…`).
 */
export function findQueryClient(roots: readonly unknown[]): unknown {
  for (const root of roots) {
    const fiber = rootFiber(root)
    if (!fiber) continue
    const found = searchFibers(fiber)
    if (found) return found
  }
  return undefined
}

function rootFiber(node: unknown): Fiber | undefined {
  if (!node || typeof node !== 'object') return undefined
  const record = node as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (key.startsWith('__reactContainer$')) return record[key] as Fiber
  }
  for (const key of Object.keys(record)) {
    if (!key.startsWith('__reactFiber$')) continue
    let fiber = record[key] as Fiber | undefined
    for (let i = 0; fiber?.return && i < 10_000; i++) fiber = fiber.return
    return fiber
  }
  return undefined
}

function searchFibers(start: Fiber): unknown {
  const stack: Fiber[] = [start]
  for (let seen = 0; stack.length > 0 && seen < MAX_FIBERS; seen++) {
    const fiber = stack.pop() as Fiber
    const props = fiber.memoizedProps
    if (props && typeof props === 'object') {
      if (isQueryClient(props.client)) return props.client
      if (isQueryClient(props.value)) return props.value
    }
    if (fiber.sibling) stack.push(fiber.sibling)
    if (fiber.child) stack.push(fiber.child)
  }
  return undefined
}
