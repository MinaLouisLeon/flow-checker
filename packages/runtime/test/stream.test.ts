import type { Capture } from '@flow-checker/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveCaptureOptions } from '../src/options'
import { compileRules, REDACTED_STRING, redactCapture } from '../src/redact'
import {
  createSseParser,
  messageBody,
  readEventStream,
  recordStream,
  type SseEvent,
  STREAM_UPDATE_MS,
} from '../src/stream'

function parse(chunks: string[]): SseEvent[] {
  const events: SseEvent[] = []
  const parser = createSseParser((e) => events.push(e))
  for (const chunk of chunks) parser.push(chunk)
  return events
}

function capture(): Capture {
  return {
    id: 'cap_1',
    sessionId: 'ses_1',
    origin: 'browser',
    transport: 'eventsource',
    timestamp: '2026-10-30T10:00:00.000Z',
    durationMs: 0,
    request: { method: 'GET', url: 'http://localhost:3000/api/clock', headers: {}, body: { kind: 'none' } },
    stack: [],
    redacted: false,
    redactedPaths: [],
  }
}

function streamOf(chunks: string[], error?: Error): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      if (error) controller.error(error)
      else controller.close()
    },
  })
}

describe('createSseParser', () => {
  it('reads named, unnamed and multi-line events, skipping comments', () => {
    expect(
      parse([': hello\n\n', 'event: tick\ndata: {"n":1}\nid: 7\n\n', 'data: a\ndata: b\n\n', 'data:x\n\n']),
    ).toEqual([{ event: 'tick', id: '7', data: '{"n":1}' }, { data: 'a\nb' }, { data: 'x' }])
  })

  it('handles events split across chunks, CRLF split between chunks, and a BOM', () => {
    expect(parse(['﻿event: ti', 'ck\r', '\ndata: 1\r\n', '\r\n'])).toEqual([{ event: 'tick', data: '1' }])
  })

  it('drops events without data and an event cut off at the end', () => {
    expect(parse(['event: ping\n\n', 'data: never finished\n'])).toEqual([])
  })
})

describe('messageBody', () => {
  it('parses JSON data and keeps other text', () => {
    expect(messageBody('{"a":1}')).toEqual({ kind: 'json', value: { a: 1 }, size: 7 })
    expect(messageBody('42')).toEqual({ kind: 'json', value: 42, size: 2 })
    expect(messageBody('hello')).toEqual({ kind: 'text', value: 'hello', size: 5 })
    expect(messageBody('{not json')).toEqual({ kind: 'text', value: '{not json', size: 9 })
    expect(messageBody('')).toEqual({ kind: 'none' })
  })
})

describe('recordStream', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends the capture on open, then only the new messages, then the end state', () => {
    vi.useFakeTimers()
    const sent: { capture: Capture; first: boolean }[] = []
    const recorder = recordStream(
      capture(),
      { maxMessages: 10, maxMessageBytes: 1000 },
      (c, first) => sent.push({ capture: structuredClone(c), first }),
      () => 1234,
    )
    recorder.open()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      first: true,
      capture: { stream: { state: 'open', count: 0 }, messages: [] },
    })

    recorder.message({ event: 'tick', data: '{"n":1}' })
    recorder.message({ data: '{"state":"done"}' })
    expect(sent).toHaveLength(1)
    vi.advanceTimersByTime(STREAM_UPDATE_MS)
    expect(sent).toHaveLength(2)
    expect(sent[1]?.first).toBe(false)
    expect(sent[1]?.capture.stream).toMatchObject({ from: 0, count: 2, state: 'open' })
    expect(sent[1]?.capture.messages?.map((m) => m.event)).toEqual(['tick', undefined])

    recorder.message({ event: 'done', data: '{}' })
    recorder.end('closed')
    expect(sent).toHaveLength(3)
    expect(sent[2]?.capture.stream).toMatchObject({ from: 2, count: 3, state: 'closed' })
    expect(sent[2]?.capture.messages?.map((m) => m.event)).toEqual(['done'])
    expect(sent[2]?.capture.durationMs).toBe(1234)
    expect(recorder.ended).toBe(true)
    // Nothing after the end.
    recorder.message({ data: 'late' })
    vi.advanceTimersByTime(STREAM_UPDATE_MS)
    expect(sent).toHaveLength(3)
  })

  it('keeps big messages without data and only counts messages over the limit', () => {
    const sent: Capture[] = []
    const recorder = recordStream(
      capture(),
      { maxMessages: 2, maxMessageBytes: 5 },
      (c) => sent.push(structuredClone(c)),
      () => 0,
    )
    recorder.message({ data: '"small"' })
    recorder.message({ data: '1' })
    recorder.message({ data: 'dropped' })
    recorder.end('closed')
    const last = sent[0]
    expect(last?.stream).toEqual({ state: 'closed', count: 3, bytes: 15, truncated: true })
    expect(last?.messages?.map((m) => [m.size, m.body?.kind])).toEqual([
      [7, undefined],
      [1, 'json'],
    ])
  })

  it('counts EventSource reconnects', () => {
    const sent: Capture[] = []
    const recorder = recordStream(
      capture(),
      resolveCaptureOptions(),
      (c) => sent.push(c),
      () => 0,
    )
    recorder.open()
    recorder.reconnect()
    recorder.end('error', 'gone')
    expect(sent.at(-1)?.stream).toMatchObject({ state: 'error', reconnects: 1 })
    expect(sent.at(-1)?.error).toBe('gone')
  })
})

describe('readEventStream', () => {
  it('reads a response body into the recorder until it ends', async () => {
    const sent: Capture[] = []
    const recorder = recordStream(
      capture(),
      resolveCaptureOptions(),
      (c) => sent.push(c),
      () => 0,
    )
    recorder.open()
    await readEventStream(streamOf(['event: a\ndata: 1\n\nda', 'ta: 2\n\n']), recorder)
    const messages = sent.flatMap((c) => c.messages ?? [])
    expect(messages.map((m) => [m.event, m.body])).toEqual([
      ['a', { kind: 'json', value: 1, size: 1 }],
      [undefined, { kind: 'json', value: 2, size: 1 }],
    ])
    expect(sent.at(-1)?.stream?.state).toBe('closed')
  })

  it('treats an aborted read as closed and another failure as an error', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const sentA: Capture[] = []
    const a = recordStream(
      capture(),
      resolveCaptureOptions(),
      (c) => sentA.push(c),
      () => 0,
    )
    await readEventStream(streamOf(['data: 1\n\n'], abort), a)
    expect(sentA.at(-1)?.stream?.state).toBe('closed')

    const sentB: Capture[] = []
    const b = recordStream(
      capture(),
      resolveCaptureOptions(),
      (c) => sentB.push(c),
      () => 0,
    )
    await readEventStream(streamOf([], new TypeError('network')), b)
    expect(sentB.at(-1)).toMatchObject({ stream: { state: 'error' }, error: 'TypeError: network' })
  })
})

describe('redacting messages', () => {
  it('masks message data, with paths that count from `stream.from`', () => {
    const rules = compileRules(resolveCaptureOptions().redact)
    const update: Capture = {
      ...capture(),
      stream: { state: 'open', count: 5, bytes: 10, from: 3 },
      messages: [
        { direction: 'in', at: 'now', size: 9, body: { kind: 'json', value: { token: 'abc', n: 1 } } },
        { direction: 'in', at: 'now', size: 9 },
      ],
    }
    const out = redactCapture(update, rules)
    expect(out.messages?.[0]?.body).toEqual({ kind: 'json', value: { token: REDACTED_STRING, n: 1 } })
    expect(out.messages?.[1]?.body).toBeUndefined()
    expect(out.redactedPaths).toEqual(['messages[3].body.token'])
  })
})
