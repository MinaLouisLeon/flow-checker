// WebSockets (M19): socket.io frame decoding and two-way message recording.
import type { Capture } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { resolveCaptureOptions } from '../src/options'
import { compileRules, REDACTED_STRING, redactCapture } from '../src/redact'
import { isSocketIoUrl, parseSocketIoFrame } from '../src/socket'
import { recordStream } from '../src/stream'

describe('parseSocketIoFrame', () => {
  it('reads events with one argument, several, a namespace and an ack id', () => {
    expect(parseSocketIoFrame('42["chat",{"text":"hi"}]')).toEqual({ name: 'chat', value: { text: 'hi' } })
    expect(parseSocketIoFrame('42["move",1,2]')).toEqual({ name: 'move', value: [1, 2] })
    expect(parseSocketIoFrame('42["ping"]')).toEqual({ name: 'ping', value: [] })
    expect(parseSocketIoFrame('42/admin,7["kick","ada"]')).toEqual({
      name: 'kick',
      value: 'ada',
      namespace: '/admin',
    })
    expect(parseSocketIoFrame('4213["chat","x"]')).toEqual({ name: 'chat', value: 'x' })
  })

  it('reads binary events and how many attachments follow', () => {
    expect(parseSocketIoFrame('451-["file",{"_placeholder":true,"num":0}]')).toEqual({
      name: 'file',
      value: { _placeholder: true, num: 0 },
      attachments: 1,
    })
  })

  it('skips protocol traffic and frames that do not parse', () => {
    for (const frame of ['0{"sid":"a"}', '2', '3', '2probe', '5', '40', '40{"sid":"b"}', '41', '431["ok"]'])
      expect(parseSocketIoFrame(frame)).toBeUndefined()
    expect(parseSocketIoFrame('42not json')).toBeUndefined()
    expect(parseSocketIoFrame('42[1,2]')).toBeUndefined()
    expect(parseSocketIoFrame('42/admin')).toBeUndefined()
  })

  it('tells socket.io URLs by their engine.io version', () => {
    expect(isSocketIoUrl(new URL('ws://localhost:4011/socket.io/?EIO=4&transport=websocket'))).toBe(true)
    expect(isSocketIoUrl(new URL('ws://localhost:4011/ws'))).toBe(false)
  })
})

function capture(): Capture {
  return {
    id: 'cap_ws',
    sessionId: 'ses_1',
    origin: 'browser',
    transport: 'websocket',
    timestamp: '2026-10-30T10:00:00.000Z',
    durationMs: 0,
    request: { method: 'GET', url: 'ws://localhost:4011/ws', headers: {}, body: { kind: 'none' } },
    stack: [],
    redacted: false,
    redactedPaths: [],
  }
}

describe('recording WebSocket messages', () => {
  it('keeps both directions, parsed values and binary sizes, and the close code', () => {
    const sent: Capture[] = []
    const c = capture()
    const recorder = recordStream(
      c,
      { maxMessages: 10, maxMessageBytes: 1000 },
      (u) => sent.push(u),
      () => 5,
    )
    recorder.open()
    recorder.message({ direction: 'out', data: '{"text":"hi"}' })
    recorder.message({ direction: 'in', event: 'chat', value: { text: 'yo' }, size: 24 })
    recorder.message({ direction: 'in', binary: true, size: 3 })
    if (c.stream) c.stream.closeCode = 1000
    recorder.end('closed')
    const last = sent[sent.length - 1]
    expect(last?.stream).toEqual({ state: 'closed', count: 3, bytes: 13 + 24 + 3, from: 0, closeCode: 1000 })
    expect(last?.messages?.map(({ at: _, ...m }) => m)).toEqual([
      { direction: 'out', size: 13, body: { kind: 'json', value: { text: 'hi' }, size: 13 } },
      { direction: 'in', event: 'chat', size: 24, body: { kind: 'json', value: { text: 'yo' }, size: 24 } },
      { direction: 'in', size: 3, body: { kind: 'binary', size: 3 } },
    ])
  })

  it('masks sent and received data alike', () => {
    const sent: Capture[] = []
    const c = capture()
    const recorder = recordStream(
      c,
      { maxMessages: 10, maxMessageBytes: 1000 },
      (u) => sent.push(u),
      () => 1,
    )
    recorder.open()
    recorder.message({
      direction: 'out',
      event: 'login',
      value: { user: 'ada', password: 'hunter2' },
      size: 40,
    })
    recorder.end('closed')
    const rules = compileRules(resolveCaptureOptions().redact)
    const out = redactCapture(sent[sent.length - 1] as Capture, rules)
    expect(out.messages?.[0]?.body).toEqual({
      kind: 'json',
      value: { user: 'ada', password: REDACTED_STRING },
      size: 40,
    })
    expect(out.redactedPaths).toEqual(['messages[0].body.password'])
  })
})
