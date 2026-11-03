// M39: tag and path matching, and the cache wording.
import { describe, expect, it } from 'vitest'
import {
  type CacheEntry,
  type CacheKey,
  cacheLifeText,
  invalidationText,
  pathMatchesRoute,
  type Route,
  tagsMatch,
} from '../src'

const exact = (value: string): CacheKey => ({ text: `'${value}'`, value, confidence: 'exact' })
const pattern = (value: string): CacheKey => ({ text: value, value, confidence: 'pattern' })
const unknown: CacheKey = { text: 'tag', confidence: 'unknown' }

const route = (path: string, kind: Route['kind'] = 'page'): Route => ({
  id: path,
  path,
  kind,
  file: `app${path}/page.tsx`,
  segments: [],
  layoutChain: [],
})

describe('tagsMatch', () => {
  it('matches exact tags by value', () => {
    expect(tagsMatch(exact('posts'), exact('posts'))).toBe(true)
    expect(tagsMatch(exact('posts'), exact('post'))).toBe(false)
  })

  it('matches patterns against values and other patterns', () => {
    expect(tagsMatch(pattern('post-{id}'), exact('post-1'))).toBe(true)
    expect(tagsMatch(exact('post-1'), pattern('post-{id}'))).toBe(true)
    expect(tagsMatch(pattern('post-{id}'), pattern('post-{slug}'))).toBe(true)
    expect(tagsMatch(pattern('post-{id}'), exact('posts'))).toBe(false)
    expect(tagsMatch(pattern('user:{id}:posts'), pattern('user:{id}'))).toBe(true)
    // Regex characters in a tag are literal.
    expect(tagsMatch(pattern('a.b-{id}'), exact('aXb-1'))).toBe(false)
  })

  it("matches nothing when a tag can't be read", () => {
    expect(tagsMatch(unknown, exact('posts'))).toBe(false)
    expect(tagsMatch(unknown, unknown)).toBe(false)
  })
})

describe('pathMatchesRoute', () => {
  it('matches a literal path or a route pattern to the page', () => {
    expect(pathMatchesRoute('/blog', undefined, route('/blog'))).toBe(true)
    expect(pathMatchesRoute('/blog/', undefined, route('/blog'))).toBe(true)
    expect(pathMatchesRoute('/blog/1', undefined, route('/blog/[slug]'))).toBe(true)
    expect(pathMatchesRoute('/blog/[slug]', 'page', route('/blog/[slug]'))).toBe(true)
    expect(pathMatchesRoute('/blog/{id}', undefined, route('/blog/[slug]'))).toBe(true)
    expect(pathMatchesRoute('/blog', undefined, route('/blog/[slug]'))).toBe(false)
    expect(pathMatchesRoute('/blog/1', undefined, route('/blog'))).toBe(false)
  })

  it('matches every route below a layout path', () => {
    expect(pathMatchesRoute('/', 'layout', route('/a/b'))).toBe(true)
    expect(pathMatchesRoute('/blog', 'layout', route('/blog/[slug]'))).toBe(true)
    expect(pathMatchesRoute('/blog', 'layout', route('/about'))).toBe(false)
    expect(pathMatchesRoute('/', undefined, route('/a'))).toBe(false)
  })

  it('handles catch-all segments and route groups', () => {
    expect(pathMatchesRoute('/docs/a/b', undefined, route('/docs/[...slug]'))).toBe(true)
    expect(pathMatchesRoute('/docs', undefined, route('/docs/[...slug]'))).toBe(false)
    expect(pathMatchesRoute('/docs', undefined, route('/docs/[[...slug]]'))).toBe(true)
    expect(pathMatchesRoute('/docs/[...slug]', 'page', route('/docs/[...slug]'))).toBe(true)
    expect(pathMatchesRoute('/(shop)/cart', undefined, route('/cart'))).toBe(true)
    expect(pathMatchesRoute('/api/data', undefined, route('/api/data', 'route-handler'))).toBe(true)
  })
})

describe('wording', () => {
  const entry = (patch: Partial<CacheEntry>): CacheEntry => ({
    id: 'ce_1',
    kind: 'use-cache',
    name: 'f',
    tags: [],
    siteIds: [],
    pageIds: [],
    handlerIds: [],
    flags: [],
    loc: { file: 'a.ts', line: 1, column: 1 },
    ...patch,
  })

  it('says how long an entry is kept', () => {
    expect(cacheLifeText(entry({ revalidate: 900 }))).toBe('15m (default)')
    expect(cacheLifeText(entry({ revalidate: 3600, life: "cacheLife('hours')" }))).toBe('1h')
    expect(cacheLifeText(entry({ kind: 'fetch', revalidate: 60 }))).toBe('1m')
    expect(cacheLifeText(entry({ kind: 'fetch' }))).toBe('until revalidated')
    expect(cacheLifeText(entry({ kind: 'unstable-cache', revalidate: false }))).toBe('until revalidated')
  })

  it('writes the call as it is in the code', () => {
    const base = {
      id: 'ci_1',
      origin: 'server-action' as const,
      entryIds: [],
      pageIds: [],
      handlerIds: [],
      flags: [],
      callStack: [],
      loc: { file: 'a.ts', line: 1, column: 1 },
    }
    expect(invalidationText({ ...base, api: 'revalidateTag', tag: exact('posts'), profile: "'max'" })).toBe(
      "revalidateTag('posts', 'max')",
    )
    expect(
      invalidationText({ ...base, api: 'revalidatePath', path: { ...exact('/blog'), type: 'layout' } }),
    ).toBe("revalidatePath('/blog', 'layout')")
  })
})
