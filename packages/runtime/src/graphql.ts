// GraphQL requests (M17): which operation a request sends, read from the body (or the GET query).
//
//   POST /api/graphql  {"operationName":"Todos","query":"query Todos { ... }","variables":{}}
//   POST /api/graphql  [{...}, {...}]                      (batched: Apollo's BatchHttpLink)
//   GET  /api/graphql?query=...&variables=...              (urql, Apollo with useGETForQueries)
//   POST /api/graphql  {"extensions":{"persistedQuery":{"sha256Hash":"..."}}}   (persisted)
//
// `splitGraphqlCapture()` tags a capture with its operation and splits a batch into one capture
// per operation (each with its own body and result), before redaction. A GET request's payload
// becomes the request body, so its variables are redacted and type-checked like a POST's.
// Plain web APIs only, no GraphQL parser: this runs in the browser and in Node.
import type { Capture, CapturedBody, CapturedResponse } from '@flow-checker/shared'

type OperationType = 'query' | 'mutation' | 'subscription'

export interface GraphqlOperationInfo {
  name?: string
  type?: OperationType
  hash?: string
  persisted?: boolean
}

/** Keys a persisted document id is sent under, besides APQ's `extensions.persistedQuery.sha256Hash`. */
const ID_KEYS = ['doc_id', 'documentId', 'queryId']
/** A request body with only these keys and a string `id` is a persisted document (Relay). */
const PAYLOAD_KEYS = new Set(['id', 'variables', 'operationName', 'extensions'])

/** The operation a GraphQL request payload sends, or undefined when it isn't one. */
export function readGraphqlPayload(value: unknown): GraphqlOperationInfo | undefined {
  if (!isObject(value)) return undefined
  const query = typeof value.query === 'string' ? value.query : undefined
  const operationName =
    typeof value.operationName === 'string' && value.operationName ? value.operationName : undefined
  let hash: string | undefined
  const extensions = isObject(value.extensions) ? value.extensions : undefined
  const apq = extensions && isObject(extensions.persistedQuery) ? extensions.persistedQuery : undefined
  if (apq && typeof apq.sha256Hash === 'string') hash = apq.sha256Hash
  for (const key of ID_KEYS) if (!hash && typeof value[key] === 'string') hash = value[key] as string
  if (!hash && !query && typeof value.id === 'string' && Object.keys(value).every((k) => PAYLOAD_KEYS.has(k)))
    hash = value.id
  if (query !== undefined) {
    const found = operationIn(query, operationName)
    if (!found) return undefined
    return {
      ...(found.name ? { name: found.name } : {}),
      type: found.type,
      ...(hash ? { hash } : {}),
    }
  }
  if (!hash) return undefined
  return { ...(operationName ? { name: operationName } : {}), hash, persisted: true }
}

/**
 * The named operation (or the first one) in a query text: `query Todos(...) { ... }`. Undefined
 * when the text doesn't look like a GraphQL document.
 */
export function operationIn(text: string, name?: string): { name?: string; type: OperationType } | undefined {
  // Comments and strings can hold anything; drop them before looking for keywords.
  const code = text.replace(/"""[\s\S]*?"""|"(?:[^"\\\n]|\\.)*"/g, '""').replace(/#[^\n]*/g, '')
  const trimmed = code.trimStart()
  if (!/^(query|mutation|subscription|fragment|\{)/.test(trimmed)) return undefined
  const ops = [...code.matchAll(/(?:^|[\s}])(query|mutation|subscription)\b\s*([_A-Za-z][_0-9A-Za-z]*)?/g)]
  const named = name ? ops.find((m) => m[2] === name) : undefined
  const first = named ?? ops[0]
  if (!first) return trimmed.startsWith('{') ? { type: 'query' } : undefined
  const opName = first[2]
  return { ...(opName ? { name: opName } : name ? { name } : {}), type: first[1] as OperationType }
}

/** Tags a GraphQL capture with its operation and splits batches. Anything else comes back as it is. */
export function splitGraphqlCapture(capture: Capture): Capture[] {
  try {
    if (capture.operation || capture.procedure || capture.serverAction) return [capture]
    const method = capture.request.method.toUpperCase()
    if (method === 'GET') return fromGet(capture)
    if (method !== 'POST') return [capture]
    const payload = bodyValue(capture.request.body, capture.request.headers['content-type'])
    if (Array.isArray(payload)) return fromBatch(capture, payload)
    const info = readGraphqlPayload(payload)
    return info ? [{ ...capture, operation: info }] : [capture]
  } catch {
    return [capture]
  }
}

function fromGet(capture: Capture): Capture[] {
  const url = new URL(capture.request.url, 'http://relative.invalid')
  const params = url.searchParams
  if (!params.has('query') && !params.has('extensions') && !ID_KEYS.some((k) => params.has(k)))
    return [capture]
  const payload: Record<string, unknown> = {}
  for (const [key, raw] of params) {
    payload[key] = key === 'variables' || key === 'extensions' ? (parseJson(raw) ?? raw) : raw
  }
  const info = readGraphqlPayload(payload)
  if (!info) return [capture]
  // The payload moves to the body (redacted and checked there); the URL keeps its path.
  const absolute = /^[a-z][a-z\d+.-]*:/i.test(capture.request.url)
  return [
    {
      ...capture,
      request: {
        ...capture.request,
        url: absolute ? `${url.origin}${url.pathname}` : url.pathname,
        body: { kind: 'json', value: payload },
      },
      operation: info,
    },
  ]
}

function fromBatch(capture: Capture, payloads: unknown[]): Capture[] {
  const infos = payloads.map(readGraphqlPayload)
  if (payloads.length === 0 || infos.some((i) => !i)) return [capture]
  const results = capture.response ? jsonOf(capture.response.body) : undefined
  const size = payloads.length
  return payloads.map((payload, index): Capture => {
    const info = infos[index] as GraphqlOperationInfo
    const piece: Capture = {
      ...capture,
      id: size > 1 ? `${capture.id}-${index}` : capture.id,
      request: { ...capture.request, body: { kind: 'json', value: payload } },
      operation: { ...info, ...(size > 1 ? { batch: { id: capture.id, index, size } } : {}) },
    }
    if (capture.response) piece.response = pieceResponse(capture.response, results, index, size)
    return piece
  })
}

function pieceResponse(
  response: CapturedResponse,
  results: unknown,
  index: number,
  size: number,
): CapturedResponse {
  const { statusText: _, ...rest } = response
  const result = Array.isArray(results) ? results[index] : undefined
  if (result === undefined) return size > 1 ? { ...rest, body: { kind: 'none' } } : response
  return { ...rest, body: { kind: 'json', value: result } }
}

function bodyValue(body: CapturedBody, contentType: string | undefined): unknown {
  // `application/graphql`: the body is the query text itself.
  if (body.kind === 'text' && contentType?.includes('application/graphql')) return { query: body.value }
  return jsonOf(body)
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
