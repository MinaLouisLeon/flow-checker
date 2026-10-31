// React Query tagging (M13) against the real query-core, v5 and v4.
import type { Capture } from '@flow-checker/shared'
import * as v5 from '@tanstack/query-core'
import * as v4 from 'query-core-v4'
import { describe, expect, it } from 'vitest'
import { resolveCaptureOptions } from '../src/options'
import { createQueryTracker, findQueryClient, toJsonKey } from '../src/query'
import { compileRules, redactCapture } from '../src/redact'

type Core = typeof v5

const versions: [string, Core][] = [
  ['v5', v5],
  ['v4', v4 as unknown as Core],
]

describe.each(versions)('React Query %s', (_name, core) => {
  /** A client, a tracker on it, and a fake `fetch` that records which query was active. */
  function setup() {
    const client = new core.QueryClient()
    const tracker = createQueryTracker()
    const seen: unknown[] = []
    const send = async <T>(value: T) => {
      seen.push(tracker.current())
      return value
    }
    return { client, tracker, seen, send }
  }

  // First: React Query's prototypes stay patched for the rest of the run.
  it('covers queries that existed before the client was found', async () => {
    const { client, tracker, seen, send } = setup()
    const before = new core.QueryObserver(client, { queryKey: ['early'], queryFn: () => send(1) })
    const unsubscribe = before.subscribe(() => {})
    await waitFor(() => before.getCurrentResult().status === 'success')
    expect(seen).toEqual([undefined])
    tracker.instrument(client)
    await before.refetch()
    unsubscribe()
    expect(seen).toEqual([undefined, { kind: 'query', key: ['early'] }])
  })

  it('guesses the query for a request sent while the client is found', async () => {
    const { client, tracker } = setup()
    let guessed: unknown
    // Like the browser runtime: the first request finds the client, mid-query.
    const first = client.fetchQuery({
      queryKey: ['first', 1],
      queryFn: async () => {
        tracker.instrument(client)
        guessed = tracker.guess()
        return 1
      },
    })
    await first
    expect(guessed).toEqual({ kind: 'query', key: ['first', 1] })
    // Nothing fetching: no guess.
    expect(tracker.guess()).toBeUndefined()
  })

  it('recognizes a QueryClient and nothing else', () => {
    const { client, tracker } = setup()
    expect(tracker.instrument({})).toBe(false)
    expect(tracker.ready).toBe(false)
    expect(tracker.instrument(client)).toBe(true)
    expect(tracker.ready).toBe(true)
  })

  it('tags requests sent while a query function runs, and only then', async () => {
    const { client, tracker, seen, send } = setup()
    tracker.instrument(client)
    await client.fetchQuery({ queryKey: ['todos', { page: 1, q: undefined }], queryFn: () => send([1]) })
    expect(seen).toEqual([{ kind: 'query', key: ['todos', { page: 1 }] }])
    expect(tracker.current()).toBeUndefined()
  })

  it('tags observer fetches, refetches after invalidation and infinite queries', async () => {
    const { client, tracker, seen, send } = setup()
    tracker.instrument(client)
    const observer = new core.QueryObserver(client, { queryKey: ['users', 7], queryFn: () => send('ada') })
    const unsubscribe = observer.subscribe(() => {})
    await waitFor(() => observer.getCurrentResult().status === 'success')
    await client.invalidateQueries({ queryKey: ['users'] })
    unsubscribe()
    await client.fetchInfiniteQuery({
      queryKey: ['feed'],
      queryFn: () => send(['post']),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    } as Parameters<typeof client.fetchInfiniteQuery>[0])
    expect(seen).toEqual([
      { kind: 'query', key: ['users', 7] },
      { kind: 'query', key: ['users', 7] },
      { kind: 'query', key: ['feed'] },
    ])
  })

  it('tags mutations with their key', async () => {
    const { client, tracker, seen, send } = setup()
    tracker.instrument(client)
    const observer = new core.MutationObserver(client, {
      mutationKey: ['save'],
      mutationFn: (value: number) => send(value),
    })
    await observer.mutate(1)
    const keyless = new core.MutationObserver(client, { mutationFn: (value: number) => send(value) })
    await keyless.mutate(2)
    expect(seen).toEqual([{ kind: 'mutation', key: ['save'] }, { kind: 'mutation' }])
  })

  it('does not change what the app gets back or throws', async () => {
    const { client, tracker } = setup()
    tracker.instrument(client)
    tracker.instrument(client)
    await expect(client.fetchQuery({ queryKey: ['ok'], queryFn: async () => 42 })).resolves.toBe(42)
    await expect(
      client.fetchQuery({
        queryKey: ['fails'],
        queryFn: async () => {
          throw new Error('boom')
        },
        retry: false,
      }),
    ).rejects.toThrow('boom')
    expect(tracker.current()).toBeUndefined()
  })
})

describe('findQueryClient', () => {
  const client = new v5.QueryClient()

  it('finds the provider below the root container', () => {
    const provider = { memoizedProps: { client, children: null } }
    const root = { child: { child: { sibling: provider }, memoizedProps: { className: 'x' } } }
    expect(findQueryClient([{ __reactContainer$abc: root }])).toBe(client)
  })

  it('climbs from an element fiber and accepts the context value', () => {
    const context = { memoizedProps: { value: client } }
    const root: Record<string, unknown> = { child: context }
    const leaf = { return: { return: root } }
    expect(findQueryClient([null, { __reactFiber$xyz: leaf }])).toBe(client)
  })

  it('searches the tree on screen, not the copy React saved on the container', () => {
    // After React's first commit: the saved root fiber is the empty copy, and its FiberRoot
    // points at the committed tree that holds the provider.
    const provider = { memoizedProps: { client } }
    const current: Record<string, unknown> = { child: provider }
    const saved: Record<string, unknown> = { child: null, stateNode: { current } }
    current.stateNode = saved.stateNode
    expect(findQueryClient([{ __reactContainer$abc: saved }])).toBe(client)
    const leaf = { return: saved }
    expect(findQueryClient([{ __reactFiber$xyz: leaf }])).toBe(client)
  })

  it('returns nothing without React or without a client', () => {
    expect(findQueryClient([{}, { __reactContainer$a: { child: { memoizedProps: { value: 1 } } } }])).toBe(
      undefined,
    )
  })
})

describe('query keys in captures', () => {
  it('keeps keys JSON-safe and short', () => {
    class Filter {}
    const key = toJsonKey([
      'a',
      1n,
      () => 1,
      new Date(0),
      new Filter(),
      { b: undefined, a: 'x' },
      'y'.repeat(300),
    ])
    expect(key?.slice(0, 6)).toEqual([
      'a',
      '1',
      '[function]',
      '1970-01-01T00:00:00.000Z',
      '[Filter]',
      { a: 'x' },
    ])
    expect(String(key?.[6]).length).toBe(201)
    expect(toJsonKey('todos')).toBeUndefined()
  })

  it('masks sensitive values in keys like bodies', () => {
    const rules = compileRules(resolveCaptureOptions().redact)
    const capture: Capture = {
      id: 'cap_1',
      sessionId: 'ses_1',
      origin: 'browser',
      transport: 'fetch',
      timestamp: new Date(0).toISOString(),
      durationMs: 1,
      request: { method: 'GET', url: 'https://x.test/me', headers: {}, body: { kind: 'none' } },
      query: { kind: 'query', key: ['session', { token: 'abc', page: 2 }] },
      stack: [],
      redacted: false,
      redactedPaths: [],
    }
    const out = redactCapture(capture, rules)
    expect(out.query?.key).toEqual(['session', { token: '[REDACTED:string]', page: 2 }])
    expect(out.redactedPaths).toContain('query.key[1].token')
  })
})

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 5))
  expect(check()).toBe(true)
}
