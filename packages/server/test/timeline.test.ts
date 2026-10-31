// A page load is logged after the page's first requests; recorded flows show it first.
import type { Capture } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { loadsFirst, recordingName, type TimelineEvent } from '../src/flows'

const page = 'http://localhost:3000/en'
const request = (at: number, pageUrl = page): TimelineEvent => ({
  at,
  iso: new Date(at).toISOString(),
  kind: 'capture',
  capture: { id: `cap_${at}`, origin: 'browser', pageUrl } as unknown as Capture,
})
const load = (at: number, url = page): TimelineEvent => ({
  at,
  iso: new Date(at).toISOString(),
  kind: 'navigation',
  how: 'load',
  url,
})
const order = (events: TimelineEvent[]) => events.map((e) => (e.kind === 'navigation' ? 'load' : e.at))

describe('recordingName', () => {
  const nav = (path: string) => ({ kind: 'navigate' as const, at: '', how: 'push' as const, path })
  it('names a recording after the pages it went through', () => {
    expect(recordingName([nav('/en'), nav('/en'), nav('/en/jobs')], '2026-10-31T10:00:00Z')).toBe(
      '/en → /en/jobs',
    )
    expect(recordingName([nav('/a'), nav('/b'), nav('/c'), nav('/d')], '2026-10-31T10:00:00Z')).toBe(
      '/a → … → /d',
    )
  })
  it('falls back to the start time', () => {
    expect(recordingName([], '2026-10-31T10:00:00Z')).toMatch(/^Recorded flow \d\d:\d\d$/)
  })
})

describe('loadsFirst', () => {
  it('moves a load before the requests its page made', () => {
    expect(order(loadsFirst([request(1), request(2), load(3), request(4)]))).toEqual(['load', 1, 2, 4])
  })

  it('stops at requests from another page', () => {
    expect(order(loadsFirst([request(1, 'http://localhost:3000/a'), request(2), load(3)]))).toEqual([
      1,
      'load',
      2,
    ])
  })
})
