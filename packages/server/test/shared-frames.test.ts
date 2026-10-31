// Stack frames in a request helper every site uses say little about which site sent a request.
import type { AppModel, Capture, RequestSite } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { Matcher } from '../src/matcher'

const WRAPPER = [
  { file: 'src/services/request.ts', line: 18, column: 10, callee: 'run' },
  { file: 'src/services/client.ts', line: 2, column: 10, callee: 'fetch' },
]

function site(id: string, file: string, url: RequestSite['url']): RequestSite {
  return {
    id,
    origin: 'component',
    transport: 'fetch',
    method: 'GET',
    url,
    trigger: { kind: 'page-load' },
    callStack: [{ file, line: 5, column: 3, callee: 'request' }, ...WRAPPER],
    status: 'inferred',
    flags: [],
  }
}

const faq = site('req_faq', 'src/faq.ts', { text: 'url', confidence: 'unknown' })
const jobs = site('req_jobs', 'src/jobs.ts', { text: "'/api/jobs'", confidence: 'exact', path: '/api/jobs' })
const model = { requests: [faq, jobs], components: [], routes: [], navigations: [] } as unknown as AppModel

function capture(url: string, frames: { file: string; line: number; column: number }[]) {
  const c = {
    id: 'cap_1',
    sessionId: 'ses_1',
    origin: 'browser',
    transport: 'fetch',
    timestamp: '2026-10-31T10:00:00.000Z',
    durationMs: 10,
    pageUrl: 'http://localhost:3000/',
    request: { method: 'GET', url, headers: {}, body: { kind: 'none' } },
    stack: [],
    redacted: true,
  } as unknown as Capture
  return { c, context: { frames, resolveAction: () => undefined } }
}

describe('shared wrapper frames', () => {
  it('do not match a site with an unknown URL on their own', () => {
    // Sent from code the scan doesn't know, through the shared helper.
    const { c, context } = capture('http://localhost:3000/api/latest-feeds', [
      { file: 'src/feeds.ts', line: 9, column: 3 },
      ...WRAPPER,
    ])
    const match = new Matcher(model).match(c, context)
    expect(match.status).toBe('unmatched')
  })

  it('still match through the frames only one site has', () => {
    const { c, context } = capture('http://localhost:3000/api/whatever', [
      { file: 'src/faq.ts', line: 5, column: 3 },
      ...WRAPPER,
    ])
    expect(new Matcher(model).match(c, context)).toMatchObject({ status: 'matched', siteId: 'req_faq' })
  })
})
