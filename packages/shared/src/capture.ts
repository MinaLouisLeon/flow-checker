// Live capture data (M5, docs/PLAN.md 7): requests recorded by the runtime injected into the
// user's app, and the session timeline used later to record flows.
// The runtime only imports these as types, so zod never ends up in the user's bundle.
import { z } from 'zod'
import { type CaptureMatch, CaptureMatchSchema } from './match'
import { SourceLocSchema } from './model'
import { TypeCheckSchema, type TypeCheckStatus, typeCheckStatus } from './type-check'

/** A request or response body, cut to `maxBodyBytes`. */
export const CapturedBodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  /** Parsed JSON. */
  z.object({ kind: z.literal('json'), value: z.unknown(), size: z.number().optional() }),
  /** Text that is not JSON, or JSON that was cut short (`truncated`). */
  z.object({
    kind: z.literal('text'),
    value: z.string(),
    size: z.number().optional(),
    truncated: z.boolean().optional(),
  }),
  /** `FormData` or `application/x-www-form-urlencoded`. Files are described, not stored. */
  z.object({
    kind: z.literal('form'),
    value: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  }),
  /** Binary or streamed content: only its type and size are kept. */
  z.object({
    kind: z.literal('binary'),
    contentType: z.string().optional(),
    size: z.number().optional(),
  }),
])
export type CapturedBody = z.infer<typeof CapturedBodySchema>

/**
 * One message on an event stream (M18). SSE messages always come in. `body` is the `data`
 * (parsed as JSON when it is JSON), redacted like other bodies; it is left out when the message
 * is larger than `capture.maxMessageBytes`.
 */
export const CapturedMessageSchema = z.object({
  direction: z.enum(['in', 'out']),
  /** SSE `event:` field. Absent for unnamed events (`message`). */
  event: z.string().optional(),
  /** SSE `id:` field. */
  id: z.string().optional(),
  /** ISO time it arrived. */
  at: z.string(),
  /** Size of the data in bytes. */
  size: z.number().int().nonnegative(),
  body: CapturedBodySchema.optional(),
})
export type CapturedMessage = z.infer<typeof CapturedMessageSchema>

/** The state of an event stream connection (M18). */
export const CapturedStreamSchema = z.object({
  /** `open` while it is connected (the runtime sends updates), `closed` when it ended, `error` when it failed. */
  state: z.enum(['open', 'closed', 'error']),
  /** Messages received, including the ones not kept. */
  count: z.number().int().nonnegative(),
  /** Bytes of message data received. */
  bytes: z.number().int().nonnegative(),
  /** Messages were dropped (over `capture.maxMessages`) or kept without data (over `capture.maxMessageBytes`). */
  truncated: z.boolean().optional(),
  /** EventSource reconnects after the connection dropped. */
  reconnects: z.number().int().positive().optional(),
  /**
   * Runtime updates of an open stream only carry the new messages: `from` is the index of the
   * first one. The tool server appends them to what it has and removes the field.
   */
  from: z.number().int().nonnegative().optional(),
})
export type CapturedStream = z.infer<typeof CapturedStreamSchema>

export const CapturedRequestSchema = z.object({
  method: z.string(),
  /** Absolute URL. */
  url: z.string(),
  /** Lower-case header names. */
  headers: z.record(z.string(), z.string()),
  body: CapturedBodySchema,
})
export type CapturedRequest = z.infer<typeof CapturedRequestSchema>

export const CapturedResponseSchema = z.object({
  status: z.number().int(),
  statusText: z.string().optional(),
  headers: z.record(z.string(), z.string()),
  body: CapturedBodySchema,
})
export type CapturedResponse = z.infer<typeof CapturedResponseSchema>

/** The user interaction that most likely started a browser request. */
export const InteractionSchema = z.object({
  /** DOM event type: `click`, `submit`, `change`, `keydown`. */
  type: z.string(),
  /** Short description of the target element, e.g. `button "Delete user"`. */
  target: z.string(),
  /** React component names from the target element up, nearest first (from the React fiber). */
  componentChain: z.array(z.string()),
  /** ISO time of the interaction. */
  at: z.string(),
})
export type Interaction = z.infer<typeof InteractionSchema>

/** For server captures: the incoming request the outgoing call was made for. */
export const CaptureParentSchema = z.object({
  method: z.string(),
  /** Path and query of the incoming request. */
  url: z.string(),
  /** The browser capture that sent the incoming request, when it could be linked. */
  captureId: z.string().optional(),
  /** Set when the incoming request called a server action. */
  serverActionId: z.string().optional(),
})
export type CaptureParent = z.infer<typeof CaptureParentSchema>

export const CaptureSchema = z.object({
  id: z.string(),
  /** Browser tab session. Server captures inherit it from the browser request they serve. */
  sessionId: z.string(),
  /** Where the request was sent from. */
  origin: z.enum(['browser', 'server']),
  /** `http` is Node's http/https module (axios on the server). `eventsource`: `new EventSource()` (M18). */
  transport: z.enum(['fetch', 'xhr', 'http', 'eventsource']),
  /** ISO time the request started. */
  timestamp: z.string(),
  durationMs: z.number(),
  /** Browser: the page URL. Server: absent (see `parent`). */
  pageUrl: z.string().optional(),
  request: CapturedRequestSchema,
  /** Absent when the request failed before a response arrived (see `error`). */
  response: CapturedResponseSchema.optional(),
  error: z.string().optional(),
  /** Server action called by this request (from the `Next-Action` header). */
  serverAction: z.object({ id: z.string() }).optional(),
  interaction: InteractionSchema.optional(),
  /**
   * React Query run the request was sent from (M13): the query or mutation whose function was
   * running, and its key as JSON (redacted like bodies). Browser only.
   */
  query: z
    .object({
      kind: z.enum(['query', 'mutation']),
      key: z.array(z.unknown()).optional(),
    })
    .optional(),
  /**
   * tRPC call (M16). A batched request (`/api/trpc/a.b,c.d?batch=1`) is split into one capture
   * per procedure: each has its own input as the request body, its own result (or error) as the
   * response, and `batch` says where it came from. The URL is the single-procedure form.
   */
  procedure: z
    .object({
      path: z.string(),
      type: z.enum(['query', 'mutation', 'subscription']),
      batch: z
        .object({
          /** Id the runtime gave the whole request. Server hops still point to it as `parent.captureId`. */
          id: z.string(),
          index: z.number().int().nonnegative(),
          size: z.number().int().positive(),
        })
        .optional(),
    })
    .optional(),
  /**
   * GraphQL operation (M17), read from the body (or the GET query). A batched request (an array
   * of operations) is split into one capture per operation: each has its own operation as the
   * request body and its own result as the response, and `batch` says where it came from.
   */
  operation: z
    .object({
      /** `operationName`, else the name in the query text. Absent when only a hash was sent. */
      name: z.string().optional(),
      type: z.enum(['query', 'mutation', 'subscription']).optional(),
      /** Persisted query hash or document id (`extensions.persistedQuery.sha256Hash`, `doc_id`, `documentId`). */
      hash: z.string().optional(),
      /** Only the hash was sent, no query text. */
      persisted: z.boolean().optional(),
      batch: z
        .object({
          /** Id the runtime gave the whole request. */
          id: z.string(),
          index: z.number().int().nonnegative(),
          size: z.number().int().positive(),
        })
        .optional(),
    })
    .optional(),
  /**
   * Event stream (M18): an `EventSource`, or a fetch answered with `text/event-stream`. The
   * messages are here, not in `response.body`.
   */
  stream: CapturedStreamSchema.optional(),
  messages: z.array(CapturedMessageSchema).optional(),
  parent: CaptureParentSchema.optional(),
  /** Stack frames where the request was sent, innermost first. */
  stack: z.array(z.string()),
  /** Sensitive values were masked (see `redactedPaths`). False only with `capture.storeRaw`. */
  redacted: z.boolean(),
  /** What was masked, e.g. `request.headers.authorization`, `request.body.password`. */
  redactedPaths: z.array(z.string()),
  /**
   * Project frames of `stack`, resolved through the dev build's source maps by the tool server
   * when the capture arrives (chunks change on rebuild, so this is done once). Innermost first.
   */
  sourceStack: z.array(SourceLocSchema.extend({ fn: z.string().optional() })).optional(),
  /** Which request site this is, set by the tool server (M6). Absent until matched. */
  match: CaptureMatchSchema.optional(),
  /** The bodies compared with the matched site's declared types, set by the tool server (M8). */
  typeCheck: TypeCheckSchema.optional(),
})
export type Capture = z.infer<typeof CaptureSchema>

export const SessionEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('navigation'),
    at: z.string(),
    /** `load` is the first page of the tab, or a full reload. */
    how: z.enum(['load', 'push', 'replace', 'pop']),
    url: z.string(),
  }),
  z.object({
    kind: z.literal('interaction'),
    at: z.string(),
    type: z.string(),
    target: z.string(),
    componentChain: z.array(z.string()),
    url: z.string(),
  }),
  z.object({ kind: z.literal('capture'), at: z.string(), captureId: z.string() }),
])
export type SessionEvent = z.infer<typeof SessionEventSchema>

export const SessionSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  startedAt: z.string(),
  updatedAt: z.string(),
  events: z.array(SessionEventSchema),
})
export type Session = z.infer<typeof SessionSchema>

/** What the runtime posts to the tool server's `/ingest` endpoint. */
export const IngestBatchSchema = z.object({
  /** Per-run secret, so other local pages can't write captures. */
  token: z.string(),
  sessionId: z.string().optional(),
  captures: z.array(CaptureSchema).default([]),
  events: z.array(SessionEventSchema).default([]),
})
export type IngestBatch = z.infer<typeof IngestBatchSchema>

/** A capture without its bodies and headers: what lists show. */
export interface CaptureSummary {
  id: string
  sessionId: string
  origin: Capture['origin']
  transport: Capture['transport']
  timestamp: string
  durationMs: number
  method: string
  url: string
  status?: number
  error?: string
  pageUrl?: string
  serverActionId?: string
  parentCaptureId?: string
  /** tRPC procedure path (M16). */
  procedure?: string
  /** GraphQL operation name (M17), or its hash when only that was sent. */
  operation?: string
  /** Event streams (M18): messages received and the connection state. */
  stream?: { state: NonNullable<Capture['stream']>['state']; count: number }
  /** Nearest component from the interaction, if any. */
  component?: string
  redacted: boolean
  match?: Pick<CaptureMatch, 'status' | 'by' | 'siteId' | 'score'>
  /** Result of comparing the bodies with the matched site's types. */
  typeCheck?: TypeCheckStatus
  /** Taken before the matched site's code last changed (M9). Set by the tool server. */
  stale?: boolean
}

export function summarizeCapture(c: Capture): CaptureSummary {
  return {
    id: c.id,
    sessionId: c.sessionId,
    origin: c.origin,
    transport: c.transport,
    timestamp: c.timestamp,
    durationMs: c.durationMs,
    method: c.request.method,
    url: c.request.url,
    status: c.response?.status,
    error: c.error,
    pageUrl: c.pageUrl,
    serverActionId: c.serverAction?.id,
    parentCaptureId: c.parent?.captureId,
    ...(c.procedure ? { procedure: c.procedure.path } : {}),
    ...(c.operation && (c.operation.name || c.operation.hash)
      ? { operation: c.operation.name || `#${c.operation.hash?.slice(0, 12)}` }
      : {}),
    ...(c.stream ? { stream: { state: c.stream.state, count: c.stream.count } } : {}),
    component: c.interaction?.componentChain[0],
    redacted: c.redacted,
    match: c.match && {
      status: c.match.status,
      by: c.match.by,
      siteId: c.match.siteId,
      score: c.match.score,
    },
    typeCheck: c.typeCheck && typeCheckStatus(c.typeCheck),
  }
}
