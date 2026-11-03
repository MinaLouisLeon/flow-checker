// M40: the server runtime records hits, misses and skips of Next's server cache. Next is played by
// small fakes of what the runtime reads: its patched fetch (with the per-request `fetchMetrics`
// it keeps in dev), the `use cache` handlers on `globalThis`, and `IncrementalCache.get` for
// `unstable_cache`. The real thing is covered by `e2e/cache.spec.ts` on Next 16 and 15.
import { AsyncLocalStorage } from 'node:async_hooks'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { CacheEvent, Capture, IngestBatch } from '@flow-checker/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { functionId, hashKey, unstableCacheName } from '../src/cache'
import { resolveCaptureOptions } from '../src/options'
import { registerServerRuntime, type ServerRuntime } from '../src/server'

interface Metric {
  url: string
  method: string
  cacheStatus: CacheEvent['status']
  cacheReason?: string
}
interface FakeWorkStore {
  fetchMetrics: Metric[]
  incrementalCache?: FakeIncrementalCache
}

const servers: Server[] = []
const captures: Capture[] = []
const events: CacheEvent[] = []
let backend = ''
let app = ''
let runtime: ServerRuntime | undefined
/** Plays Next's work store, kept on `globalThis` like Next 16 does. */
const work = new AsyncLocalStorage<FakeWorkStore>()
/** While set, `Date.now()` and `Math.random()` throw, like Next aborting a prerender that reads them. */
let prerendering = false

function listen(server: Server): Promise<string> {
  servers.push(server)
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
    ),
  )
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

/** Next's patched fetch, reduced: a cache of 200 responses and a metric per call. */
function fakeNextFetch(origin: typeof fetch): typeof fetch {
  const cache = new Map<string, string>()
  const patched = async (
    input: RequestInfo | URL,
    init?: RequestInit & { next?: { revalidate?: number } },
  ) => {
    const store = work.getStore()
    const url = String(input)
    const method = init?.method ?? 'GET'
    const cacheable = init?.cache === 'force-cache' || init?.next?.revalidate !== undefined
    const cached = cacheable ? cache.get(url) : undefined
    if (cached !== undefined) {
      store?.fetchMetrics.push({ url, method, cacheStatus: 'hit', cacheReason: 'revalidate: 60' })
      return new Response(cached, { status: 200 })
    }
    const res = await origin(input, { ...init, next: { ...init?.next, fetchType: 'origin' } } as RequestInit)
    const body = await res.clone().text()
    if (cacheable && res.status === 200) cache.set(url, body)
    store?.fetchMetrics.push(
      cacheable
        ? // In dev Next calls an empty lookup a hard refresh.
          { url, method, cacheStatus: 'skip', cacheReason: 'cache-control: no-cache (hard refresh)' }
        : { url, method, cacheStatus: 'skip', cacheReason: 'auto no cache' },
    )
    return res
  }
  return Object.assign(patched, { __nextPatched: true }) as unknown as typeof fetch
}

/** A `use cache` handler like Next's default one: entries in memory, with their tags. */
function fakeHandler() {
  const entries = new Map<string, { tags: string[]; revalidate: number; timestamp: number }>()
  return {
    get: async (key: string) => entries.get(key),
    set: async (key: string, pending: Promise<{ tags: string[]; revalidate: number; timestamp: number }>) => {
      entries.set(key, await pending)
    },
  }
}

class FakeIncrementalCache {
  private readonly entries = new Map<string, unknown>()
  async get(key: string, _ctx: { kind: string; fetchUrl: string; tags: string[] }) {
    return this.entries.has(key) ? { value: this.entries.get(key), isStale: false } : null
  }
  async set(key: string, value: unknown) {
    this.entries.set(key, value)
  }
}

/** What each app route does: the page renders inside the fake work store. */
const routes: Record<string, (store: FakeWorkStore) => Promise<void>> = {}

beforeAll(async () => {
  const ingest = await listen(
    createServer(async (req, res) => {
      const batch = JSON.parse(await readBody(req)) as IngestBatch
      captures.push(...batch.captures)
      events.push(...(batch.cache ?? []))
      res.writeHead(204).end()
    }),
  )
  backend = await listen(
    createServer(async (req, res) => {
      await readBody(req)
      if (req.url?.startsWith('/missing')) {
        res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"not found"}')
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end('[{"id":1}]')
    }),
  )
  app = await listen(
    createServer(async (req, res) => {
      const store: FakeWorkStore = { fetchMetrics: [], incrementalCache }
      await work.run(store, () => routes[req.url ?? '']?.(store))
      res.writeHead(200).end('ok')
    }),
  )

  ;(globalThis as Record<symbol, unknown>)[Symbol.for('@next/work-async-storage@test')] = work
  ;(globalThis as Record<symbol, unknown>)[Symbol.for('@next/cache-handlers-map')] = new Map([
    ['default', handler],
  ])
  process.env.FLOW_CHECKER = '1'
  runtime = registerServerRuntime({
    ingest: `${ingest}/ingest`,
    token: 'secret',
    capture: resolveCaptureOptions(),
  })
  // Next patches fetch after `register()` ran.
  globalThis.fetch = fakeNextFetch(globalThis.fetch)

  // Only calls from the runtime count: Node's own HTTP code may read the time too.
  const fromRuntime = () => /runtime[\\/]src[\\/]/.test(new Error().stack ?? '')
  const now = Date.now
  const random = Math.random
  Date.now = () => {
    if (prerendering && fromRuntime()) throw new Error('Date.now() during a prerender')
    return now()
  }
  Math.random = () => {
    if (prerendering && fromRuntime()) throw new Error('Math.random() during a prerender')
    return random()
  }
})

const handler = fakeHandler()
const incrementalCache = new FakeIncrementalCache()

afterAll(() => {
  delete process.env.FLOW_CHECKER
  for (const server of servers) server.close()
})

beforeEach(() => {
  captures.length = 0
  events.length = 0
})

async function visit(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${app}${path}`, { headers })
  expect(await res.text()).toBe('ok')
  await runtime?.flush()
}

describe('server cache events (M40)', () => {
  it('records a cached fetch: a miss that sent a request, then a hit that sent none', async () => {
    routes['/products'] = async () => {
      await (
        await fetch(`${backend}/products`, { next: { revalidate: 60, tags: ['products'] } } as RequestInit)
      ).json()
    }
    await visit('/products')
    await visit('/products')

    expect(events.map((e) => e.status)).toEqual(['miss', 'hit'])
    const [miss, hit] = events
    expect(miss).toMatchObject({
      kind: 'fetch',
      method: 'GET',
      url: `${backend}/products`,
      tags: ['products'],
      parent: { method: 'GET', url: '/products' },
    })
    // Next's "(hard refresh)" for an empty lookup is a plain miss when the browser didn't ask for it.
    expect(miss?.reason).toBeUndefined()
    expect(miss?.captureId).toBe(captures.find((c) => c.request.url === `${backend}/products`)?.id)
    expect(hit).toMatchObject({ status: 'hit', reason: 'revalidate: 60' })
    expect(hit?.captureId).toBeUndefined()
    expect(hit?.key).toBe(miss?.key)
    expect(captures.filter((c) => c.request.url === `${backend}/products`)).toHaveLength(1)
    // Where it was called, for matching it to the scan's entry.
    expect(hit?.stack.some((line) => line.includes('cache.test.ts'))).toBe(true)
  })

  it("keeps Next's hard refresh skip when the browser asked for fresh data", async () => {
    routes['/fresh'] = async () => {
      await (await fetch(`${backend}/fresh`, { cache: 'force-cache' })).text()
    }
    await visit('/fresh', { 'cache-control': 'no-cache' })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ status: 'skip', reason: 'cache-control: no-cache (hard refresh)' })
  })

  it('records every call of a cached fetch that answers 404 as a miss', async () => {
    routes['/featured'] = async () => {
      await (await fetch(`${backend}/missing/featured`, { cache: 'force-cache' })).text()
    }
    await visit('/featured')
    await visit('/featured')
    expect(events.map((e) => e.status)).toEqual(['miss', 'miss'])
    expect(events.every((e) => e.captureId)).toBe(true)
  })

  it('leaves fetches that do not ask to be cached alone', async () => {
    routes['/plain'] = async () => {
      await (await fetch(`${backend}/plain`)).text()
      await (await fetch(`${backend}/plain`, { cache: 'no-store' })).text()
    }
    await visit('/plain')
    expect(events).toEqual([])
    expect(captures.filter((c) => c.request.url === `${backend}/plain`)).toHaveLength(2)
  })

  it('sends a result once per incoming request, though dev renders a page twice', async () => {
    let calls = 0
    routes['/twice'] = async () => {
      for (let i = 0; i < 2; i++) {
        calls++
        await (await fetch(`${backend}/twice`, { next: { revalidate: 60 } } as RequestInit)).text()
      }
    }
    await visit('/twice')
    expect(calls).toBe(2)
    expect(events.map((e) => e.status)).toEqual(['miss', 'hit'])
    await visit('/twice')
    expect(events.map((e) => e.status)).toEqual(['miss', 'hit', 'hit'])
  })

  it('records use cache lookups from the cache handlers, with the tags the miss stored', async () => {
    const key = '["80bdcfbf6ed0e0523efba08d7ced296a51b04262e1",["1"],["development","x"]]'
    // What Next's cache wrapper does: look up, and on a miss run the function and store it.
    routes['/todo'] = async () => {
      const found = await handler.get(key)
      if (!found) await handler.set(key, Promise.resolve({ tags: ['todo-1'], revalidate: 900, timestamp: 0 }))
    }
    await visit('/todo')
    await visit('/todo')
    // The miss waits for its entry to be stored, to learn its tags.
    await new Promise((r) => setTimeout(r, 20))
    await runtime?.flush()
    expect(events).toHaveLength(2)
    const miss = events.find((e) => e.status === 'miss')
    const hit = events.find((e) => e.status === 'hit')
    expect(miss).toMatchObject({
      kind: 'use-cache',
      functionId: '80bdcfbf6ed0e0523efba08d7ced296a51b04262e1',
      handler: 'default',
      tags: ['todo-1'],
      parent: { url: '/todo' },
    })
    expect(hit).toMatchObject({ kind: 'use-cache', tags: ['todo-1'] })
    // Hit long after its 900 s: served stale, refreshed in the background.
    expect(hit?.stale).toBe(true)
    // The key is a hash: the arguments never leave the app.
    expect(JSON.stringify(events)).not.toContain('["1"]')
  })

  it('records unstable_cache lookups from the incremental cache, with the wrapped function name', async () => {
    routes['/users'] = async (store) => {
      const ctx = { kind: 'FETCH', fetchUrl: 'unstable_cache /users  loadUsers', tags: ['users'] }
      const found = await store.incrementalCache?.get('k-users', ctx)
      if (!found) await store.incrementalCache?.set('k-users', '[]')
    }
    await visit('/users')
    await visit('/users')
    expect(events.map((e) => [e.kind, e.status, e.name, e.tags])).toEqual([
      ['unstable-cache', 'miss', 'loadUsers', ['users']],
      ['unstable-cache', 'hit', 'loadUsers', ['users']],
    ])
  })

  it('never reads Date.now() or Math.random() while a page renders', async () => {
    routes['/prerender'] = async () => {
      prerendering = true
      try {
        await (await fetch(`${backend}/prerender`, { next: { revalidate: 60 } } as RequestInit)).text()
        await (await fetch(`${backend}/prerender`, { next: { revalidate: 60 } } as RequestInit)).text()
        await (await fetch(`${backend}/prerender-plain`)).text()
      } finally {
        prerendering = false
      }
    }
    await visit('/prerender')
    expect(events.map((e) => e.status)).toEqual(['miss', 'hit'])
    const sent = captures.filter((c) => c.request.url.startsWith(backend)).map((c) => c.request.url)
    expect(sent).toEqual([`${backend}/prerender`, `${backend}/prerender-plain`])
    expect(captures.every((c) => !Number.isNaN(Date.parse(c.timestamp)))).toBe(true)
  })
})

describe('cache helpers', () => {
  it('reads the function id from a use cache key', () => {
    expect(functionId('["803ac0075887d790c2640b745e2103560d8979243e",[],["development","1"]]')).toBe(
      '803ac0075887d790c2640b745e2103560d8979243e',
    )
    // Root params are appended after the JSON.
    expect(functionId('["c01ba700bc54924ce9ab8edec5f3eac70174a33bce",["1"]]|locale=en')).toBe(
      'c01ba700bc54924ce9ab8edec5f3eac70174a33bce',
    )
    expect(functionId('not a key')).toBeUndefined()
  })

  it("reads unstable_cache's function name, empty for an anonymous function", () => {
    expect(unstableCacheName('unstable_cache /users  loadUsers')).toBe('loadUsers')
    expect(unstableCacheName('unstable_cache    loadUsers')).toBe('loadUsers')
    expect(unstableCacheName('unstable_cache /products 9f86d081884c7d659a2feaa0c55ad015')).toBe('')
  })

  it('hashes keys the same way every time', () => {
    expect(hashKey('GET http://x/a')).toBe(hashKey('GET http://x/a'))
    expect(hashKey('GET http://x/a')).not.toBe(hashKey('GET http://x/b'))
  })
})
