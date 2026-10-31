// Requests a third-party script sends (a Google sign-in SDK) are not scanner misses.
import type { AppModel, Capture } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { isThirdParty, Matcher } from '../src/matcher'

const model = { requests: [], components: [], routes: [], navigations: [] } as unknown as AppModel

function capture(url: string, stack: string[]): Capture {
  return {
    id: 'cap_1',
    sessionId: 'ses_1',
    origin: 'browser',
    transport: 'xhr',
    timestamp: '2026-10-31T10:00:00.000Z',
    durationMs: 10,
    pageUrl: 'http://localhost:3000/en',
    request: { method: 'GET', url, headers: {}, body: { kind: 'none' } },
    stack,
    redacted: true,
  } as unknown as Capture
}

const RUNTIME = 'at baseCapture (http://localhost:3000/_next/static/chunks/node_modules_x._.js:1735:221)'
const context = { frames: [], resolveAction: () => undefined }

describe('third-party requests', () => {
  it('flags a request a script from another origin sends there', () => {
    const gsi = capture('https://accounts.google.com/gsi/status?client_id=1', [
      RUNTIME,
      'at _.m.send (https://accounts.google.com/gsi/client?hl=en:195:191)',
      'at useGoogleOneTapLogin.useEffect (http://localhost:3000/_next/static/chunks/node_modules_y._.js:363:228)',
    ])
    expect(isThirdParty(gsi, context)).toBe(true)
    expect(new Matcher(model).match(gsi, context)).toMatchObject({
      status: 'unmatched',
      thirdParty: true,
      candidates: [],
    })
  })

  it('keeps project requests to other origins as scanner misses', () => {
    const own = capture('https://api.example.com/users', [
      RUNTIME,
      'at loadUsers (http://localhost:3000/_next/static/chunks/src_app_page_x._.js:12:5)',
    ])
    expect(isThirdParty(own, context)).toBe(false)
    // Project frames from the source map: the app sent it.
    const mapped = capture('https://accounts.google.com/gsi/status', [
      'at x (https://accounts.google.com/gsi/client:1:1)',
    ])
    expect(isThirdParty(mapped, { ...context, frames: [{ file: 'src/a.ts', line: 1, column: 1 }] })).toBe(
      false,
    )
    expect(new Matcher(model).match(own, context).thirdParty).toBeUndefined()
  })

  it('never flags same-origin requests', () => {
    const same = capture('http://localhost:3000/api/x', ['at y (https://cdn.example.com/sdk.js:1:1)'])
    expect(isThirdParty(same, context)).toBe(false)
  })
})
