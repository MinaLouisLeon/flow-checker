import type { Capture } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { textBody } from '../src/body'
import { createIgnoreMatcher, parseRuntimeConfig, resolveCaptureOptions } from '../src/options'
import { compileRules, REDACTED_STRING, redactCapture } from '../src/redact'

const rules = compileRules(resolveCaptureOptions().redact)

function capture(overrides: Partial<Capture> = {}): Capture {
  return {
    id: 'cap_1',
    sessionId: 'ses_1',
    origin: 'browser',
    transport: 'fetch',
    timestamp: '2026-10-27T10:00:00.000Z',
    durationMs: 12,
    pageUrl: 'http://localhost:3000/login',
    request: {
      method: 'POST',
      url: 'http://localhost:4010/auth/login',
      headers: { 'content-type': 'application/json', authorization: 'Bearer abc.def' },
      body: { kind: 'json', value: { email: 'ada@example.com', password: 'hunter2', remember: true } },
    },
    response: {
      status: 200,
      headers: { 'set-cookie': 'sid=1' },
      body: {
        kind: 'json',
        value: { user: { id: 1, access_token: 'xyz', tags: ['a'] }, otp: { digits: 6, sent: true } },
      },
    },
    stack: [],
    redacted: false,
    redactedPaths: [],
    ...overrides,
  }
}

describe('redactCapture', () => {
  it('masks headers, nested keys and keeps the shape', () => {
    const out = redactCapture(capture(), rules)
    expect(out.redacted).toBe(true)
    expect(out.request.headers).toEqual({
      'content-type': 'application/json',
      authorization: REDACTED_STRING,
    })
    expect(out.request.body).toEqual({
      kind: 'json',
      value: { email: 'ada@example.com', password: REDACTED_STRING, remember: true },
    })
    expect(out.response?.headers['set-cookie']).toBe(REDACTED_STRING)
    expect(out.response?.body).toEqual({
      kind: 'json',
      value: { user: { id: 1, access_token: REDACTED_STRING, tags: ['a'] }, otp: { digits: 0, sent: false } },
    })
    expect(out.redactedPaths.sort()).toEqual(
      [
        'request.headers.authorization',
        'request.body.password',
        'response.headers.set-cookie',
        'response.body.user.access_token',
        'response.body.otp',
      ].sort(),
    )
  })

  it('masks JWTs, bearer tokens and card numbers inside strings', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    const out = redactCapture(
      capture({
        request: {
          method: 'POST',
          url: 'http://api.test/pay?session=abc',
          headers: { 'x-trace': `Bearer abcdef123` },
          body: { kind: 'text', value: `card 4111 1111 1111 1111, ref 1234567890123, jwt ${jwt}` },
        },
      }),
      rules,
    )
    expect(out.request.headers['x-trace']).toBe('[REDACTED]')
    expect(out.request.body).toEqual({
      kind: 'text',
      value: 'card [REDACTED], ref 1234567890123, jwt [REDACTED]',
    })
  })

  it('masks sensitive query parameters, also on relative URLs', () => {
    const out = redactCapture(
      capture({
        request: {
          method: 'GET',
          url: 'http://api.test/verify?code=123456&lang=en',
          headers: {},
          body: { kind: 'none' },
        },
        parent: { method: 'GET', url: '/cb?token=abc&x=1' },
      }),
      rules,
    )
    expect(out.request.url).toBe(`http://api.test/verify?code=${REDACTED_STRING}&lang=en`)
    expect(out.parent?.url).toBe(`/cb?token=${REDACTED_STRING}&x=1`)
    expect(out.redactedPaths).toContain('request.url?code')
  })

  it('is idempotent, so the server can apply it again', () => {
    const once = redactCapture(capture(), rules)
    const twice = redactCapture(once, rules)
    expect(twice).toEqual(once)
  })

  it('keeps everything with storeRaw', () => {
    const raw = capture()
    const out = redactCapture(raw, rules, true)
    expect(out.request.body).toEqual(raw.request.body)
    expect(out.redacted).toBe(false)
  })

  it('extends the defaults with user rules', () => {
    const custom = compileRules(
      resolveCaptureOptions({ redact: { keys: ['email'], headers: ['x-tenant'], patterns: [/ada/] } }).redact,
    )
    const out = redactCapture(
      capture({
        request: {
          method: 'POST',
          url: 'http://x.test/',
          headers: { 'x-tenant': 't1' },
          body: { kind: 'json', value: { email: 'e', password: 'p', name: 'ada lovelace' } },
        },
      }),
      custom,
    )
    expect(out.request.headers['x-tenant']).toBe(REDACTED_STRING)
    expect(out.request.body).toEqual({
      kind: 'json',
      value: { email: REDACTED_STRING, password: REDACTED_STRING, name: '[REDACTED] lovelace' },
    })
  })
})

describe('options', () => {
  it('matches ignore globs against the path and the full URL', () => {
    const ignored = createIgnoreMatcher(resolveCaptureOptions({ ignore: ['*/health'] }).ignore)
    expect(ignored(new URL('http://localhost:3000/_next/static/chunk.js'))).toBe(true)
    expect(ignored(new URL('http://localhost:3000/logo.PNG'))).toBe(true)
    expect(ignored(new URL('https://telemetry.nextjs.org/api/v1/record'))).toBe(true)
    expect(ignored(new URL('http://api.test/health'))).toBe(true)
    expect(ignored(new URL('http://api.test/users'))).toBe(false)
    // Next 13.4 dev server IPC to its render workers.
    expect(ignored(new URL('http://[::1]:55669/?key=abc&method=ensurePage&args=%5B%5D'))).toBe(true)
    expect(ignored(new URL('http://api.test/search?key=abc'))).toBe(false)
  })

  it('parses the runtime config from env JSON', () => {
    expect(parseRuntimeConfig(undefined)).toBeUndefined()
    expect(parseRuntimeConfig('not json')).toBeUndefined()
    expect(parseRuntimeConfig('{"ingest":"http://127.0.0.1:4400/ingest"}')).toBeUndefined()
    const config = parseRuntimeConfig('{"ingest":"http://127.0.0.1:4400/ingest","token":"t"}')
    expect(config?.capture.maxBodyBytes).toBe(256_000)
  })
})

describe('textBody', () => {
  it('parses JSON, forms and truncates long text', () => {
    expect(textBody('{"a":1}', 'application/json', 100)).toEqual({ kind: 'json', value: { a: 1 }, size: 7 })
    expect(textBody('a=1&a=2&b=x', 'application/x-www-form-urlencoded', 100)).toEqual({
      kind: 'form',
      value: { a: ['1', '2'], b: 'x' },
    })
    expect(textBody('x'.repeat(20), 'application/json', 10)).toEqual({
      kind: 'text',
      value: 'x'.repeat(10),
      size: 20,
      truncated: true,
    })
    expect(textBody('', 'text/plain', 10)).toEqual({ kind: 'none' })
  })
})
