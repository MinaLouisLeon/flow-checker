// tRPC requests (M16): one HTTP request can carry several procedure calls.
//
//   GET  /api/trpc/todo.list,user.byId?batch=1&input={"0":{},"1":{"id":1}}
//   POST /api/trpc/todo.add?batch=1          body {"0":{"title":"x"}}
//
// The response is an array of results (`[{ result: { data } }, { error }]`), an object keyed by
// index (v10 stream link), or JSON Lines (v11 `httpBatchStreamLink`). `splitTrpcCapture()` turns
// such a capture into one capture per procedure, before redaction, so each is matched and
// type-checked on its own. Plain web APIs only: this runs in the browser and in Node.
import type { Capture, CapturedBody, CapturedResponse } from '@flow-checker/shared'

/** `todo.list` or `a.b,c.d`: the last URL segment of a tRPC call. */
const PATH = /^[A-Za-z_$][\w$-]*(?:\.[A-Za-z_$][\w$-]*)*$/

export interface TrpcRequest {
  /** Path the procedures are served under, e.g. `/api/trpc`. */
  endpoint: string
  paths: string[]
  /** `?batch=1`: inputs and results are keyed by index. */
  batch: boolean
}

/**
 * Reads a tRPC call from a URL (absolute, or a path with a query). It counts as tRPC when its
 * endpoint is one of `endpoints`, has a `trpc` segment, or the request has a tRPC header.
 */
export function parseTrpcUrl(
  url: string,
  options: { endpoints?: readonly string[]; headers?: Record<string, string> } = {},
): TrpcRequest | undefined {
  let parsed: URL
  try {
    parsed = new URL(url, 'http://relative.invalid')
  } catch {
    return undefined
  }
  const segments = parsed.pathname.split('/')
  let last: string
  try {
    last = decodeURIComponent(segments.pop() ?? '')
  } catch {
    return undefined
  }
  const paths = last.split(',')
  if (paths.length === 0 || !paths.every((p) => PATH.test(p))) return undefined
  const endpoint = segments.join('/') || '/'
  const headers = options.headers ?? {}
  const known =
    (options.endpoints ?? []).includes(endpoint) ||
    /(^|\/)trpc(\/|$)/i.test(endpoint) ||
    'trpc-accept' in headers ||
    'x-trpc-source' in headers
  if (!known) return undefined
  return { endpoint, paths, batch: parsed.searchParams.get('batch') === '1' }
}

/** Splits a tRPC capture into one per procedure. Anything else comes back as it is. */
export function splitTrpcCapture(capture: Capture, endpoints: readonly string[] = []): Capture[] {
  try {
    if (capture.procedure || capture.serverAction) return [capture]
    const call = parseTrpcUrl(capture.request.url, { endpoints, headers: capture.request.headers })
    if (!call) return [capture]
    return split(capture, call)
  } catch {
    return [capture]
  }
}

function split(capture: Capture, call: TrpcRequest): Capture[] {
  const method = capture.request.method.toUpperCase()
  const size = call.paths.length
  const inputs = readInputs(capture, call)
  const results = capture.response ? readResults(capture.response.body, call) : undefined
  const streamed = capture.response?.headers['content-type']?.includes('event-stream')
  const type = method === 'POST' ? 'mutation' : streamed ? 'subscription' : 'query'
  const url = new URL(capture.request.url, 'http://relative.invalid')
  const keyPath = queryKeyPath(capture.query?.key)

  return call.paths.map((path, index): Capture => {
    const input = inputs[index]
    const single = new URL(`${call.endpoint.replace(/\/$/, '')}/${path}`, url)
    const piece: Capture = {
      ...capture,
      id: size > 1 ? `${capture.id}-${index}` : capture.id,
      request: {
        ...capture.request,
        url: /^[a-z][a-z\d+.-]*:/i.test(capture.request.url) ? single.href : single.pathname,
        body: input === undefined ? { kind: 'none' } : { kind: 'json', value: input },
      },
      procedure: {
        path,
        type,
        ...(size > 1 ? { batch: { id: capture.id, index, size } } : {}),
      },
    }
    if (capture.response) piece.response = pieceResponse(capture.response, results, index, size)
    // A React Query key belongs to one procedure of the batch: `[['todo', 'list'], { input, type }]`.
    if (capture.query && size > 1 && keyPath !== path) delete piece.query
    return piece
  })
}

function readInputs(capture: Capture, call: TrpcRequest): unknown[] {
  let value: unknown
  if (capture.request.method.toUpperCase() === 'GET') {
    const raw = new URL(capture.request.url, 'http://relative.invalid').searchParams.get('input')
    value = raw === null ? undefined : parseJson(raw)
  } else {
    value = jsonOf(capture.request.body)
  }
  if (!call.batch) return [unwrap(value)]
  const byIndex = isObject(value) ? value : {}
  return call.paths.map((_, i) => unwrap(byIndex[String(i)]))
}

/** Each procedure's result envelope (`{ result }` / `{ error }`), when the body could be read. */
function readResults(body: CapturedBody, call: TrpcRequest): unknown[] | undefined {
  let value = jsonOf(body)
  // JSON Lines: complete lines still decode when the body was cut short or the read interrupted.
  if (value === undefined && body.kind === 'text') value = decodeJsonLines(body.value)
  if (value === undefined) return undefined
  if (!call.batch) return [value]
  if (Array.isArray(value)) return value
  if (isObject(value)) return call.paths.map((_, i) => value[String(i)])
  return undefined
}

function pieceResponse(
  response: CapturedResponse,
  results: unknown[] | undefined,
  index: number,
  size: number,
): CapturedResponse {
  const { statusText: _, ...rest } = response
  const envelope = results?.[index]
  if (!isObject(envelope)) {
    // Not readable (binary, cut short): keep the body only when nothing was split.
    return size > 1 ? { ...rest, body: { kind: 'none' } } : response
  }
  if ('error' in envelope) {
    const error = unwrap(envelope.error)
    const data = isObject(error) && isObject(error.data) ? error.data : undefined
    const status = typeof data?.httpStatus === 'number' ? data.httpStatus : response.status
    return { ...rest, status, body: { kind: 'json', value: error } }
  }
  const result = isObject(envelope.result) ? envelope.result : undefined
  const data = result ? unwrap(result.data) : undefined
  // A batch with mixed results answers 207; each successful call is a 200.
  const status = response.status === 207 ? 200 : response.status
  return { ...rest, status, body: data === undefined ? { kind: 'none' } : { kind: 'json', value: data } }
}

/**
 * v11 `httpBatchStreamLink` sends JSON Lines: a head `{ "0": <encoded>, ... }`, then one line
 * per promise `[chunkId, status, <encoded>]`. An encoded value is `[[value], ...asyncProps]`
 * where each async prop `[key, type, chunkId]` points at a later line (`key` null: the whole
 * value). Rebuilds the plain `{ "0": { result: { data } } }` object.
 */
export function decodeJsonLines(text: string): Record<string, unknown> | undefined {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return undefined
  const head = parseJson(lines[0] as string)
  if (!isObject(head)) return undefined
  const chunks = new Map<number, unknown[][]>()
  for (const line of lines.slice(1)) {
    // A cut-short last line does not parse and is left out.
    const chunk = parseJson(line)
    if (!Array.isArray(chunk) || typeof chunk[0] !== 'number') continue
    const list = chunks.get(chunk[0]) ?? []
    list.push(chunk)
    chunks.set(chunk[0], list)
  }
  const decode = (encoded: unknown, depth: number): unknown => {
    if (!Array.isArray(encoded) || depth > 20) return undefined
    const [first, ...asyncProps] = encoded as unknown[]
    let data: unknown = Array.isArray(first) ? first[0] : undefined
    for (const prop of asyncProps) {
      if (!Array.isArray(prop)) continue
      const [key, kind, chunkId] = prop as [string | null, number, number]
      const lines = chunks.get(chunkId) ?? []
      // Promises have one line; async iterables (subscriptions) yield several.
      const values = lines.map(([, status, value]) =>
        kind === 0 && status === 1 ? { error: value } : decode(value, depth + 1),
      )
      const value = kind === 0 ? values[0] : values
      if (key === null) return value
      if (isObject(data)) data = { ...data, [key]: value }
    }
    return data
  }
  const out: Record<string, unknown> = {}
  for (const [key, encoded] of Object.entries(head)) out[key] = decode(encoded, 0)
  return out
}

/** superjson (a common tRPC transformer) wraps values as `{ json, meta? }`. */
function unwrap(value: unknown): unknown {
  if (!isObject(value) || !('json' in value)) return value
  return Object.keys(value).every((k) => k === 'json' || k === 'meta') ? value.json : value
}

function queryKeyPath(key: unknown[] | undefined): string | undefined {
  const first = key?.[0]
  return Array.isArray(first) && first.every((p) => typeof p === 'string') ? first.join('.') : undefined
}

function jsonOf(body: CapturedBody): unknown {
  if (body.kind === 'json') return body.value
  if (body.kind === 'text' && !body.truncated) return parseJson(body.value)
  return undefined
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
