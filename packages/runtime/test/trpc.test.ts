// tRPC batch splitting (M16) on responses from the real tRPC servers, v11 and v10.
import type { Capture } from '@flow-checker/shared'
import { TRPCError as ErrorV11, initTRPC as initV11 } from '@trpc/server'
import { fetchRequestHandler as handleV11 } from '@trpc/server/adapters/fetch'
import { TRPCError as ErrorV10, initTRPC as initV10 } from 'trpc-server-v10'
import { fetchRequestHandler as handleV10 } from 'trpc-server-v10/adapters/fetch'
import { describe, expect, it } from 'vitest'
import { headersToObject, readStream, textBody } from '../src/body'
import { decodeJsonLines, parseTrpcUrl, splitTrpcCapture } from '../src/trpc'

const ORIGIN = 'http://localhost:3000'
const todos = [
  { id: 1, title: 'Write', done: true },
  { id: 2, title: 'Read', done: false },
]

/** Input parsers without zod: they only need to return the value. */
const idInput = (raw: unknown) => raw as { id: number }
const titleInput = (raw: unknown) => raw as { title: string }

const t11 = initV11.create()
const routerV11 = t11.router({
  todo: {
    list: t11.procedure.query(() => todos),
    byId: t11.procedure.input(idInput).query(({ input }) => {
      const todo = todos.find((x) => x.id === input.id)
      if (!todo) throw new ErrorV11({ code: 'NOT_FOUND', message: 'No such todo' })
      return todo
    }),
    add: t11.procedure
      .input(titleInput)
      .mutation(({ input }) => ({ id: 3, title: input.title, done: false })),
  },
})

const t10 = initV10.create()
const routerV10 = t10.router({
  todo: t10.router({
    list: t10.procedure.query(() => todos),
    byId: t10.procedure.input(idInput).query(({ input }) => {
      const todo = todos.find((x) => x.id === input.id)
      if (!todo) throw new ErrorV10({ code: 'NOT_FOUND', message: 'No such todo' })
      return todo
    }),
    add: t10.procedure
      .input(titleInput)
      .mutation(({ input }) => ({ id: 3, title: input.title, done: false })),
  }),
})

type Handler = (req: Request) => Promise<Response>
const servers: [string, Handler][] = [
  ['v11', (req) => handleV11({ endpoint: '/api/trpc', req, router: routerV11, createContext: () => ({}) })],
  ['v10', (req) => handleV10({ endpoint: '/api/trpc', req, router: routerV10, createContext: () => ({}) })],
]

/** Sends a request to the handler and records it the way the runtime does. */
async function capture(
  handler: Handler,
  path: string,
  init: { method?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<Capture> {
  const url = `${ORIGIN}${path}`
  const method = init.method ?? 'GET'
  const headers = { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers }
  const res = await handler(new Request(url, { method, headers, body: init.body }))
  const responseHeaders = headersToObject(res.headers)
  return {
    id: 'cap_test',
    sessionId: 'ses_test',
    origin: 'browser',
    transport: 'fetch',
    timestamp: '2026-10-30T12:00:00.000Z',
    durationMs: 5,
    pageUrl: `${ORIGIN}/`,
    request: {
      method,
      url,
      headers,
      body: init.body ? textBody(init.body, 'application/json', 100_000) : { kind: 'none' },
    },
    response: {
      status: res.status,
      headers: responseHeaders,
      body: textBody(await res.text(), responseHeaders['content-type'], 100_000),
    },
    stack: [],
    redacted: false,
    redactedPaths: [],
  }
}

const batchInput = (inputs: unknown[]) =>
  encodeURIComponent(JSON.stringify(Object.fromEntries(inputs.map((v, i) => [i, v]))))

describe.each(servers)('tRPC %s', (version, handler) => {
  it('splits a GET batch into one capture per procedure, errors included', async () => {
    const whole = await capture(
      handler,
      `/api/trpc/todo.list,todo.byId,todo.byId?batch=1&input=${batchInput([undefined, { id: 2 }, { id: 9 }])}`,
    )
    const pieces = splitTrpcCapture(whole)
    expect(pieces.map((p) => p.id)).toEqual(['cap_test-0', 'cap_test-1', 'cap_test-2'])
    expect(pieces.map((p) => p.request.url)).toEqual([
      `${ORIGIN}/api/trpc/todo.list`,
      `${ORIGIN}/api/trpc/todo.byId`,
      `${ORIGIN}/api/trpc/todo.byId`,
    ])
    expect(pieces.map((p) => p.procedure)).toEqual([
      { path: 'todo.list', type: 'query', batch: { id: 'cap_test', index: 0, size: 3 } },
      { path: 'todo.byId', type: 'query', batch: { id: 'cap_test', index: 1, size: 3 } },
      { path: 'todo.byId', type: 'query', batch: { id: 'cap_test', index: 2, size: 3 } },
    ])
    expect(pieces.map((p) => p.request.body)).toEqual([
      { kind: 'none' },
      { kind: 'json', value: { id: 2 } },
      { kind: 'json', value: { id: 9 } },
    ])
    expect(pieces.map((p) => p.response?.status)).toEqual([200, 200, 404])
    expect(pieces[0]?.response?.body).toEqual({ kind: 'json', value: todos })
    expect(pieces[1]?.response?.body).toEqual({ kind: 'json', value: todos[1] })
    expect(pieces[2]?.response?.body).toMatchObject({
      kind: 'json',
      value: { message: 'No such todo', data: { code: 'NOT_FOUND', httpStatus: 404 } },
    })
  })

  it('splits a POST batch of mutations', async () => {
    const whole = await capture(handler, '/api/trpc/todo.add?batch=1', {
      method: 'POST',
      body: JSON.stringify({ 0: { title: 'Ship' } }),
    })
    const [piece, ...rest] = splitTrpcCapture(whole)
    expect(rest).toEqual([])
    // A single call keeps the capture's id: there is nothing to tell apart.
    expect(piece?.id).toBe('cap_test')
    expect(piece?.procedure).toEqual({ path: 'todo.add', type: 'mutation' })
    expect(piece?.request.body).toEqual({ kind: 'json', value: { title: 'Ship' } })
    expect(piece?.response?.body).toEqual({ kind: 'json', value: { id: 3, title: 'Ship', done: false } })
  })

  it('reads a call without batching (httpLink)', async () => {
    const whole = await capture(handler, `/api/trpc/todo.byId?input=${encodeURIComponent('{"id":1}')}`)
    const [piece] = splitTrpcCapture(whole)
    expect(piece?.request.body).toEqual({ kind: 'json', value: { id: 1 } })
    expect(piece?.response).toMatchObject({ status: 200, body: { kind: 'json', value: todos[0] } })
  })

  it('reads streamed batches', async () => {
    const headers: Record<string, string> =
      version === 'v11' ? { 'trpc-accept': 'application/jsonl' } : { 'trpc-batch-mode': 'stream' }
    const whole = await capture(
      handler,
      `/api/trpc/todo.list,todo.byId?batch=1&input=${batchInput([undefined, { id: 9 }])}`,
      { headers },
    )
    // v11 sends JSON Lines (not one JSON value); v10 an object keyed by index.
    expect(whole.response?.body.kind).toBe(version === 'v11' ? 'text' : 'json')
    const pieces = splitTrpcCapture(whole)
    expect(pieces.map((p) => p.response?.status)).toEqual([200, 404])
    expect(pieces[0]?.response?.body).toEqual({ kind: 'json', value: todos })
    expect(pieces[1]?.response?.body).toMatchObject({ kind: 'json', value: { message: 'No such todo' } })
  })
})

describe('splitTrpcCapture', () => {
  const [, handler] = servers[0] as [string, Handler]

  it('leaves other requests alone', async () => {
    const plain = await capture(handler, '/api/users/1')
    expect(splitTrpcCapture(plain)).toEqual([plain])
    // Already split: nothing to do.
    const [piece] = splitTrpcCapture(await capture(handler, '/api/trpc/todo.list'))
    expect(piece && splitTrpcCapture(piece)).toEqual([piece])
  })

  it('finds endpoints without a trpc segment when they are known or the request says so', () => {
    expect(parseTrpcUrl('/rpc/todo.list?batch=1')).toBeUndefined()
    expect(parseTrpcUrl('/rpc/todo.list?batch=1', { endpoints: ['/rpc'] })).toEqual({
      endpoint: '/rpc',
      paths: ['todo.list'],
      batch: true,
    })
    expect(
      parseTrpcUrl('/rpc/todo.list', { headers: { 'trpc-accept': 'application/jsonl' } })?.endpoint,
    ).toBe('/rpc')
    expect(parseTrpcUrl('/api/trpc/not a path')).toBeUndefined()
  })

  it('unwraps superjson values and keeps the React Query key on its own procedure', async () => {
    const whole = await capture(handler, '/api/trpc/todo.list')
    const batch: Capture = {
      ...whole,
      request: {
        ...whole.request,
        url: `${ORIGIN}/api/trpc/todo.list,todo.byId?batch=1&input=${batchInput([{ json: null }, { json: { id: 1 }, meta: {} }])}`,
      },
      response: {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: {
          kind: 'json',
          value: [{ result: { data: { json: todos } } }, { result: { data: { json: todos[0] } } }],
        },
      },
      query: { kind: 'query', key: [['todo', 'byId'], { input: { id: 1 }, type: 'query' }] },
    }
    const pieces = splitTrpcCapture(batch)
    expect(pieces.map((p) => p.request.body)).toEqual([
      { kind: 'json', value: null },
      { kind: 'json', value: { id: 1 } },
    ])
    expect(pieces.map((p) => p.response?.body)).toEqual([
      { kind: 'json', value: todos },
      { kind: 'json', value: todos[0] },
    ])
    expect(pieces.map((p) => p.query?.key?.[0])).toEqual([undefined, ['todo', 'byId']])
  })

  it('keeps metadata when the body could not be read', async () => {
    const whole = await capture(
      handler,
      `/api/trpc/todo.list,todo.byId?batch=1&input=${batchInput([undefined, { id: 1 }])}`,
    )
    const cut: Capture = {
      ...whole,
      response: {
        ...(whole.response as NonNullable<Capture['response']>),
        body: { kind: 'text', value: '[{', truncated: true },
      },
    }
    const pieces = splitTrpcCapture(cut)
    expect(pieces.map((p) => p.response?.body)).toEqual([{ kind: 'none' }, { kind: 'none' }])
    expect(pieces.map((p) => p.procedure?.path)).toEqual(['todo.list', 'todo.byId'])
  })

  it('keeps a streamed body the app aborted after reading it', async () => {
    // tRPC's stream link aborts the request once every result is in, which errors our copy.
    const whole = await capture(
      handler,
      `/api/trpc/todo.list,todo.byId?batch=1&input=${batchInput([undefined, { id: 1 }])}`,
      { headers: { 'trpc-accept': 'application/jsonl' } },
    )
    const text = whole.response?.body.kind === 'text' ? whole.response.body.value : ''
    const bytes = new TextEncoder().encode(text)
    const aborted = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        // Error after the data was read, like an abort signal firing.
        setTimeout(() => controller.error(new DOMException('aborted', 'AbortError')), 5)
      },
    })
    const body = await readStream(aborted, 'application/json', 100_000)
    expect(body).toMatchObject({ kind: 'text', value: text, truncated: true })
    const pieces = splitTrpcCapture({
      ...whole,
      response: { ...(whole.response as NonNullable<Capture['response']>), body },
    })
    expect(pieces.map((p) => p.response?.body)).toEqual([
      { kind: 'json', value: todos },
      { kind: 'json', value: todos[0] },
    ])
    // Nothing read at all: still an error.
    const empty = new ReadableStream<Uint8Array>({ start: (c) => c.error(new Error('aborted')) })
    await expect(readStream(empty, 'application/json', 100_000)).rejects.toThrow('aborted')
  })

  it('decodes the complete lines of cut-short JSON Lines', () => {
    const lines = [
      JSON.stringify({ 0: [[0], [null, 0, 0]], 1: [[0], [null, 0, 1]] }),
      JSON.stringify([0, 0, [[{ result: { data: 1 } }]]]),
      '[1, 0, [[{ "result":',
    ]
    expect(decodeJsonLines(lines.join('\n'))).toEqual({ 0: { result: { data: 1 } }, 1: undefined })
  })

  it('decodes nested promise chunks in JSON Lines', () => {
    const text = [
      JSON.stringify({ 0: [[0], [null, 0, 0]] }),
      JSON.stringify([0, 0, [[{ result: 0 }], ['result', 0, 1]]]),
      JSON.stringify([1, 0, [[{ data: 0 }], ['data', 0, 2]]]),
      JSON.stringify([2, 0, [[{ ok: true }]]]),
      '',
    ].join('\n')
    expect(decodeJsonLines(text)).toEqual({ 0: { result: { data: { ok: true } } } })
  })
})
