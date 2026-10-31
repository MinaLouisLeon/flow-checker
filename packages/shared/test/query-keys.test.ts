// Query key matching for cache links (M13), with unreadable segments never acting as wildcards (M24).
import { describe, expect, it } from 'vitest'
import type { QueryKeyPart } from '../src/model'
import { formatQueryKey, isUnknownKey, queryKeyHits, queryKeyMatchesValue } from '../src/query-keys'

const s = (value: string | number): QueryKeyPart => ({ kind: 'static', value })
const p = (name: string): QueryKeyPart => ({ kind: 'param', name })
const u = (name: string): QueryKeyPart => ({ kind: 'param', name, unknown: true })
const rest = (text: string): QueryKeyPart => ({ kind: 'rest', text })

describe('queryKeyHits', () => {
  it('matches by prefix, and runtime params as any value after the first segment', () => {
    expect(queryKeyHits([s('todos')], [s('todos'), s('list')])).toBe(true)
    expect(queryKeyHits([s('todos'), p('id')], [s('todos'), s(1)], true)).toBe(true)
    expect(queryKeyHits([s('todos'), s(2)], [s('todos'), p('id')], true)).toBe(true)
    expect(queryKeyHits([s('todos'), s('list')], [s('todos')])).toBe(false)
  })

  it('links nothing when the first segment is not known', () => {
    expect(queryKeyHits([u('libKey')], [s('todos')])).toBe(false)
    expect(queryKeyHits([rest('makeKey()')], [s('todos')])).toBe(false)
    expect(queryKeyHits([p('scope')], [s('todos')])).toBe(false)
    expect(queryKeyHits([s('todos')], [p('scope'), s('todos')])).toBe(false)
  })

  it('links by the known prefix when a later filter segment is unreadable', () => {
    expect(queryKeyHits([s('todos'), u('x'), s('a')], [s('todos'), s('list')], true)).toBe(true)
    expect(queryKeyHits([s('todos'), rest('extra')], [s('todos')])).toBe(true)
    expect(queryKeyHits([s('users'), u('x')], [s('todos')])).toBe(false)
  })

  it('never hits an unreadable segment of a query key', () => {
    expect(queryKeyHits([s('feed')], [s('feed'), u('lib')])).toBe(true)
    expect(queryKeyHits([s('feed'), s('a')], [s('feed'), u('lib')])).toBe(false)
    expect(queryKeyHits([s('feed'), p('id')], [s('feed'), u('lib')])).toBe(false)
    const obj = (value: QueryKeyPart): QueryKeyPart => ({ kind: 'object', entries: [{ key: 'k', value }] })
    expect(queryKeyHits([s('a'), obj(s(1))], [s('a'), obj(u('lib'))])).toBe(false)
  })
})

describe('unknown key segments', () => {
  it('are told apart from runtime params in text', () => {
    expect(formatQueryKey([u('libKey'), p('id')])).toBe('[?libKey, :id]')
  })

  it('make a key "not known" only at its start', () => {
    expect(isUnknownKey([u('libKey')])).toBe(true)
    expect(isUnknownKey([rest('k')])).toBe(true)
    expect(isUnknownKey([s('feed'), u('lib')])).toBe(false)
    expect(isUnknownKey(undefined)).toBe(false)
  })

  it('still fit any captured value', () => {
    expect(queryKeyMatchesValue([u('libKey'), s('lib')], ['v1', 'lib'])).toBe(true)
  })
})
