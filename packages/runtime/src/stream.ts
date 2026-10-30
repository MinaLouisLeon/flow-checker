// Event streams (M18): a `text/event-stream` parser, and a recorder that keeps a capture's
// messages within `capture.maxMessages` / `capture.maxMessageBytes` and sends updates while the
// stream is open. Web platform APIs only: used by the browser and the server runtime.
import type { Capture, CapturedBody, CapturedMessage } from '@flow-checker/shared'
import { byteLength } from './body'

/** One event as the SSE spec dispatches it. */
export interface SseEvent {
  /** `event:` field; absent for unnamed events (`message`). */
  event?: string
  /** `id:` field, when this event set one. */
  id?: string
  data: string
}

export interface SseParser {
  push(text: string): void
}

/**
 * Incremental SSE parser (WHATWG rules): `data:` lines are joined with newlines, a blank line
 * dispatches the event, `:` lines are comments, and an event without data is dropped.
 */
export function createSseParser(onEvent: (event: SseEvent) => void): SseParser {
  let buffer = ''
  let data: string[] | undefined
  let event: string | undefined
  let id: string | undefined
  let first = true

  const line = (text: string) => {
    if (text === '') {
      if (data)
        onEvent({ ...(event ? { event } : {}), ...(id !== undefined ? { id } : {}), data: data.join('\n') })
      data = undefined
      event = undefined
      id = undefined
      return
    }
    if (text.startsWith(':')) return
    const colon = text.indexOf(':')
    const field = colon < 0 ? text : text.slice(0, colon)
    let value = colon < 0 ? '' : text.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'data') {
      data ??= []
      data.push(value)
    } else if (field === 'event') event = value
    else if (field === 'id' && !value.includes('\u0000')) id = value
  }

  return {
    push(text) {
      buffer += text
      if (first && buffer.length > 0) {
        first = false
        if (buffer.charCodeAt(0) === 0xfeff) buffer = buffer.slice(1)
      }
      for (;;) {
        const match = /\r\n|\r|\n/.exec(buffer)
        if (!match) return
        // A `\r` at the end may be the first half of `\r\n`: wait for the next chunk.
        if (match[0] === '\r' && match.index === buffer.length - 1) return
        line(buffer.slice(0, match.index))
        buffer = buffer.slice(match.index + match[0].length)
      }
    },
  }
}

/** The message data as a body: JSON when it parses, else text. */
export function messageBody(data: string): CapturedBody {
  if (data === '') return { kind: 'none' }
  const size = byteLength(data)
  const trimmed = data.trim()
  if (/^[[{"\d-]|^(true|false|null)$/.test(trimmed)) {
    try {
      return { kind: 'json', value: JSON.parse(data), size }
    } catch {}
  }
  return { kind: 'text', value: data, size }
}

export interface StreamLimits {
  maxMessages: number
  maxMessageBytes: number
}

export interface StreamRecorder {
  /** The connection is open (EventSource `open`, fetch response headers). Sends the capture. */
  open(): void
  message(event: SseEvent): void
  /** EventSource reconnected after the connection dropped. */
  reconnect(): void
  /** The stream ended. Sends the last update. */
  end(state: 'closed' | 'error', error?: string): void
  readonly ended: boolean
}

/** How often an open stream sends its new messages. */
export const STREAM_UPDATE_MS = 1000

/**
 * Records messages on `capture` and calls `send` with the whole capture first, then with
 * updates that only carry the messages since the last one (`stream.from`, merged by the tool
 * server). `elapsed()` gives the time since the request started, in ms.
 */
export function recordStream(
  capture: Capture,
  limits: StreamLimits,
  send: (capture: Capture, first: boolean) => void,
  elapsed: () => number,
): StreamRecorder {
  const messages: CapturedMessage[] = []
  capture.stream = { state: 'open', count: 0, bytes: 0 }
  let sent = 0
  let opened = false
  let ended = false
  let announced = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
    const stream = capture.stream
    if (!stream) return
    capture.durationMs = Math.round(elapsed())
    const first = !announced
    const update: Capture = {
      ...capture,
      stream: first ? { ...stream } : { ...stream, from: sent },
      messages: messages.slice(first ? 0 : sent),
    }
    announced = true
    sent = messages.length
    send(update, first)
  }

  const schedule = () => {
    if (ended || timer) return
    timer = setTimeout(() => {
      try {
        flush()
      } catch {}
    }, STREAM_UPDATE_MS)
    ;(timer as { unref?: () => void }).unref?.()
  }

  return {
    get ended() {
      return ended
    },
    open() {
      if (ended) return
      if (!opened) {
        opened = true
        flush()
      }
    },
    message(event) {
      if (ended || !capture.stream) return
      const stream = capture.stream
      const size = byteLength(event.data)
      stream.count++
      stream.bytes += size
      if (messages.length >= limits.maxMessages) {
        stream.truncated = true
        schedule()
        return
      }
      const message: CapturedMessage = {
        direction: 'in',
        ...(event.event && event.event !== 'message' ? { event: event.event } : {}),
        ...(event.id ? { id: event.id } : {}),
        at: new Date().toISOString(),
        size,
      }
      if (size > limits.maxMessageBytes) stream.truncated = true
      else message.body = messageBody(event.data)
      messages.push(message)
      schedule()
    },
    reconnect() {
      if (ended || !capture.stream) return
      capture.stream.reconnects = (capture.stream.reconnects ?? 0) + 1
      schedule()
    },
    end(state, error) {
      if (ended || !capture.stream) return
      ended = true
      capture.stream.state = state
      if (error) capture.error = error
      flush()
    },
  }
}

/** Reads a (cloned) event stream response body into the recorder until it ends. */
export async function readEventStream(
  body: ReadableStream<Uint8Array> | null,
  recorder: StreamRecorder,
): Promise<void> {
  if (!body) {
    recorder.end('closed')
    return
  }
  const decoder = new TextDecoder()
  const parser = createSseParser((event) => recorder.message(event))
  const reader = body.getReader()
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      parser.push(decoder.decode(next.value, { stream: true }))
    }
    parser.push(decoder.decode())
    recorder.end('closed')
  } catch (error) {
    // The app aborting the request (or leaving the page) closes the stream; anything else failed it.
    const name = error instanceof Error ? error.name : ''
    if (name === 'AbortError') recorder.end('closed')
    else recorder.end('error', error instanceof Error ? `${error.name}: ${error.message}` : String(error))
  } finally {
    reader.releaseLock?.()
  }
}

export function isEventStream(contentType: string | undefined): boolean {
  return !!contentType && contentType.toLowerCase().includes('text/event-stream')
}
