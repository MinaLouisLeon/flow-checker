// M41: the page view shows what covers a page while it loads, on an error and on `notFound()`, the
// gaps and the title; the Map links slot pages and intercepting pages to the pages they belong to.
import { readFileSync } from 'node:fs'
import { AppModelSchema } from '@flow-checker/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { DataContext } from '../src/context'
import { setShowDetails } from '../src/details'
import { layoutRoutes } from '../src/graph-layout'
import { buildIndex } from '../src/model-index'
import { PageView } from '../src/screens/PageView'

const index = buildIndex(
  AppModelSchema.parse(
    JSON.parse(
      readFileSync(
        new URL('../../scanner/test/__snapshots__/boundaries.model.json', import.meta.url),
        'utf8',
      ),
    ),
  ),
)

function pageHtml(path: string, details = false): string {
  const route = index.model.routes.find((r) => r.kind === 'page' && r.path === path && !r.slot)
  if (!route) throw new Error(`no page ${path}`)
  setShowDetails(details)
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } })
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        DataContext.Provider,
        { value: { index, meta: { canRescan: false } } },
        createElement(PageView, { routeId: route.id }),
      ),
    ),
  )
}

afterEach(() => setShowDetails(false))

describe('boundaries in the page view', () => {
  it('names the files Next shows while loading, on an error and on notFound()', () => {
    const html = pageHtml('/dashboard')
    expect(html).toContain('<h2>Boundaries</h2>')
    expect(html).toContain('src/app/dashboard/loading.tsx')
    expect(html).toContain('src/app/dashboard/error.tsx')
    expect(html).toContain('src/app/not-found.tsx')
    expect(html).not.toContain('data-gap=')
  })

  it('shows a gap with its glossary term and source', () => {
    const html = pageHtml('/photos/[id]')
    expect(html).toContain('data-gap="no-fallback"')
    expect(html).toContain('data-term="boundary:no-fallback"')
    expect(html).toContain('nothing: navigation waits for the page')
    expect(html).toContain('src/lib/api.ts:17')
  })

  it('lists every boundary only with details on', () => {
    expect(pageHtml('/reports')).not.toContain('data-boundary=')
    const html = pageHtml('/reports', true)
    expect(html).toContain('data-boundary="suspense"')
    expect(html).toContain('data-boundary="error-boundary"')
    expect(html).toContain('<code>SettingsPanel</code>')
  })

  it('shows the title Next renders and where metadata comes from', () => {
    const html = pageHtml('/blog/[slug]')
    expect(html).toContain('<h2>Metadata</h2>')
    expect(html).toContain('<code>Post {slug} | Boundaries</code>')
    expect(html).toContain('<code>generateMetadata</code>')
    expect(html).toContain('template <code>%s | Boundaries</code>')
  })
})

describe('slots and intercepting routes on the Map', () => {
  const graph = layoutRoutes(index.model.routes)
  const path = (id: string) => {
    const r = index.routes.get(id)
    return r ? `${r.path}${r.slot ? ` @${r.slot}` : ''}${r.intercepting ? ' (intercepting)' : ''}` : id
  }
  const edges = graph.edges.map((e) => `${e.kind}: ${path(e.source)} -> ${path(e.target)}`)

  it('hangs slot pages off the page at their URL', () => {
    expect(edges).toContain('slot: /dashboard -> /dashboard @stats')
    expect(edges).toContain('slot: /dashboard -> /dashboard @team')
  })

  it('puts an intercepting page under the page it opens from, pointing at the page it stands in for', () => {
    expect(edges).toContain('intercept: /photos -> /photos/[id] @modal (intercepting)')
    expect(edges).toContain('intercepts: /photos/[id] @modal (intercepting) -> /photos/[id]')
  })

  it('keeps one node per route', () => {
    expect(graph.nodes).toHaveLength(index.model.routes.length)
  })
})
