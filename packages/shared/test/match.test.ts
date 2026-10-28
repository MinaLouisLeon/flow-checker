import { describe, expect, it } from 'vitest'
import { generalizePath, matchRequestUrl, pathPatternRegex, routePathRegex } from '../src'

describe('pathPatternRegex', () => {
  it('matches :params as one segment and ignores a trailing slash', () => {
    const re = pathPatternRegex('/users/:id/todos')
    expect(re.test('/users/42/todos')).toBe(true)
    expect(re.test('/users/42/todos/')).toBe(true)
    expect(re.test('/users/42/x/todos')).toBe(false)
    expect(re.test('/users//todos')).toBe(false)
    expect(pathPatternRegex('/').test('/')).toBe(true)
    expect(pathPatternRegex('/a.b').test('/aXb')).toBe(false)
  })
})

describe('routePathRegex', () => {
  it('handles dynamic, catch-all and optional catch-all segments', () => {
    expect(routePathRegex('/').test('/')).toBe(true)
    expect(routePathRegex('/[locale]/users/[id]').test('/en/users/7')).toBe(true)
    expect(routePathRegex('/[locale]/users/[id]').test('/en/users')).toBe(false)
    expect(routePathRegex('/docs/[...slug]').test('/docs/a/b')).toBe(true)
    expect(routePathRegex('/docs/[...slug]').test('/docs')).toBe(false)
    expect(routePathRegex('/docs/[[...slug]]').test('/docs')).toBe(true)
    expect(routePathRegex('/docs/[[...slug]]').test('/docs/a/b')).toBe(true)
  })
})

describe('matchRequestUrl', () => {
  const url = (u: string) => new URL(u)

  it('enforces a fixed base but not one taken from an env variable', () => {
    const fixed = { text: '', confidence: 'exact' as const, base: 'http://api.test', path: '/users' }
    expect(matchRequestUrl(fixed, url('http://api.test/users'))).toEqual({
      kind: 'exact',
      sameBase: true,
      queryKeys: 0,
    })
    expect(matchRequestUrl(fixed, url('http://other.test/users'))).toBeUndefined()

    const fromEnv = { ...fixed, baseEnv: 'API_URL' }
    expect(matchRequestUrl(fromEnv, url('http://other.test/users'))).toMatchObject({ sameBase: false })
  })

  it('puts the base path in front and counts query keys', () => {
    const site = {
      text: '',
      confidence: 'pattern' as const,
      base: 'http://api.test/v1',
      path: '/todos',
      query: 'userId=:userId&done=:done',
    }
    expect(matchRequestUrl(site, url('http://api.test/v1/todos?userId=1'))).toEqual({
      kind: 'pattern',
      sameBase: true,
      queryKeys: 1,
    })
    expect(matchRequestUrl(site, url('http://api.test/todos'))).toBeUndefined()
  })

  it('never matches an unknown URL', () => {
    expect(matchRequestUrl({ text: 'url', confidence: 'unknown' }, url('http://x/y'))).toBeUndefined()
  })
})

describe('generalizePath', () => {
  it('replaces id-like segments', () => {
    expect(generalizePath('/users/42/todos/9f1c2b3a-1111-4222-8333-444455556666')).toBe('/users/:x/todos/:x')
    expect(generalizePath('/products/new')).toBe('/products/new')
  })
})
