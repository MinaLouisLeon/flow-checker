// M39: the Cache screen lists tags, cached data and revalidation calls with their flags, and the
// page view shows what the page renders with from the cache and what refreshes it.
import { readFileSync } from 'node:fs'
import { AppModelSchema } from '@flow-checker/shared'
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

describe('route', () => {
  it('round-trips through the hash', () => {
    expect(href({ name: 'cache' })).toBe('#/cache')
    expect(parseHash('#/cache')).toEqual({ name: 'cache' })
  })
})
