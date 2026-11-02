// M31: the Map's access filter lives in the URL like its other options.
import { describe, expect, it } from 'vitest'
import { href, parseHash } from '../src/router'

describe('map access filter', () => {
  it('round-trips through the hash', () => {
    const screen = { name: 'map', view: 'graph', q: '', access: 'guarded' } as const
    expect(href(screen)).toBe('#/map?access=guarded')
    expect(parseHash('#/map?access=guarded')).toEqual(screen)
    expect(parseHash('#/map?access=locked')).toMatchObject({ access: undefined })
    expect(href({ name: 'map', view: 'graph', q: '' })).toBe('#/map')
  })
})
