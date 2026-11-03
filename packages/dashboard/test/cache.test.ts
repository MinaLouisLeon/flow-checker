// M39: the Cache screen lists tags, cached data and revalidation calls with their flags, and the
// page view shows what the page renders with from the cache and what refreshes it. M40: with live
// capture, what Next's cache did with each entry, and the runtime flags under To check.
import { readFileSync } from 'node:fs'
import { AppModelSchema, applyVerification, type CacheRuntime } from '@flow-checker/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataContext } from '../src/context'
import { buildIndex } from '../src/model-index'
import { href, parseHash } from '../src/router'
import { CacheScreen } from '../src/screens/CacheScreen'
import { PageView } from '../src/screens/PageView'

const indexOf = (fixture: string) =>
  buildIndex(
    AppModelSchema.parse(
      JSON.parse(
        readFileSync(
          new URL(`../../scanner/test/__snapshots__/${fixture}.model.json`, import.meta.url),
          'utf8',
        ),
      ),
    ),
  )
const caching = indexOf('caching')

function html(index: ReturnType<typeof buildIndex>, view: ReactElement): string {
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } })
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(DataContext.Provider, { value: { index, meta: { canRescan: false } } }, view),
    ),
  )
}

const pageId = (path: string) =>
  caching.model.routes.find((r) => r.kind === 'page' && r.path === path)?.id ?? ''
const count = (text: string, part: string) => text.split(part).length - 1

describe('cache screen', () => {
  const screen = html(caching, createElement(CacheScreen))

  it('lists every tag with what sets and revalidates it', () => {
    for (const tag of ['nav', 'products', 'settings', 'stats', 'todo-{id}', 'todos', 'user', 'users']) {
      expect(screen).toContain(`data-tag="${tag}"`)
    }
    // `user` is revalidated but nothing sets it.
    expect(screen).toMatch(/data-tag="user"><td><code>user<\/code><\/td><td><span class="warn">nothing/)
  })

  it('lists each flag on its case under To check', () => {
    const toCheck = screen.slice(screen.indexOf('data-section="to-check"'), screen.indexOf('<h2>Tags</h2>'))
    expect(toCheck).toContain('revalidateTag(&#x27;user&#x27;, &#x27;max&#x27;)')
    expect(count(toCheck, 'data-cache-flag="tag-never-set"')).toBe(1)
    expect(count(toCheck, 'data-cache-flag="tag-never-revalidated"')).toBe(2)
    expect(count(toCheck, 'data-cache-flag="path-no-route"')).toBe(1)
    expect(count(toCheck, 'data-cache-flag="update-tag-outside-action"')).toBe(1)
  })

  it('says when there is nothing', () => {
    expect(html(indexOf('basic'), createElement(CacheScreen))).toContain('found no cached data')
  })
})

describe('page view', () => {
  it('shows the cached data and what refreshes the page', () => {
    const page = html(caching, createElement(PageView, { routeId: pageId('/users') }))
    expect(page).toContain('<h2>Server cache</h2>')
    expect(page).toContain('data-cache-entry="unstable-cache"')
    expect(page).toContain('<code>getUsers</code>')
    // The cached header comes from the root layout.
    expect(page).toContain('<code>SiteHeader</code>')
    expect(page).toContain('revalidateTag(&#x27;users&#x27;, &#x27;max&#x27;)')
  })

  it('has no cache section on a page without cached data', () => {
    const basic = indexOf('basic')
    const about = basic.model.routes.find((r) => r.path === '/about')?.id ?? ''
    expect(html(basic, createElement(PageView, { routeId: about }))).not.toContain('Server cache')
  })
})

describe('with live capture (M40)', () => {
  // Results as the tool server serves them for the recorded run (see server/test/cache-check.test.ts).
  const byName = (name: string) => caching.model.cache?.entries.find((e) => e.name === name)?.id ?? ''
  const result = (verdict: CacheRuntime['verdict'], hits: number, misses: number): CacheRuntime => ({
    hits,
    misses,
    skips: 0,
    keys: 1,
    lastAt: '2026-11-03T10:00:00.000Z',
    verdict,
    ...(verdict === 'always-missed' ? { reasons: ['answered 404'] } : {}),
  })
  const live = buildIndex(
    applyVerification(caching.model, {
      sites: {},
      cache: {
        [byName('SiteHeader')]: result('cached', 2, 0),
        [byName('{API_URL ?? http://localhost:4010}/products/featured')]: result('always-missed', 0, 2),
      },
    }),
  )
  const screen = html(live, createElement(CacheScreen))

  it('shows what Next did with each entry it saw', () => {
    expect(screen).toContain('data-cache-runtime="cached"')
    expect(screen).toMatch(
      /data-cache-runtime="cached">at runtime: <span class="badge badge-ok"[^>]*>cached at runtime<\/span> 2 hits/,
    )
    // Flagged entries get the counts; the flag says the rest.
    expect(screen).toMatch(/data-cache-runtime="always-missed">at runtime: {2}2 misses/)
  })

  it('lists the runtime flag under To check, with the status the request got', () => {
    const toCheck = screen.slice(screen.indexOf('data-section="to-check"'), screen.indexOf('<h2>Tags</h2>'))
    expect(count(toCheck, 'data-cache-flag="always-missed"')).toBe(1)
    expect(toCheck).toContain('The request answered 404')
  })

  it('shows nothing about runtime for entries live capture never saw', () => {
    expect(count(screen, 'data-cache-runtime=')).toBe(2)
    expect(html(caching, createElement(CacheScreen))).not.toContain('data-cache-runtime')
  })
})

describe('route', () => {
  it('round-trips through the hash', () => {
    expect(href({ name: 'cache' })).toBe('#/cache')
    expect(parseHash('#/cache')).toEqual({ name: 'cache' })
  })
})
