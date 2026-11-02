// M34: lists and the page view show only the main badge unless "Details" is on, and every badge
// that stands for a glossary word links to an entry that exists.
import { readFileSync } from 'node:fs'
import { AppModelSchema, explain, type GlossaryGroupId } from '@flow-checker/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { DataContext } from '../src/context'
import { setShowDetails } from '../src/details'
import { buildIndex, type ModelIndex } from '../src/model-index'
import { PageView } from '../src/screens/PageView'
import { RequestsScreen } from '../src/screens/RequestsScreen'

const FIXTURES = [
  'basic',
  'react-query',
  'server-actions',
  'bff',
  'middleware',
  'trpc',
  'graphql-apollo',
  'sse',
]

const model = (name: string) =>
  AppModelSchema.parse(
    JSON.parse(
      readFileSync(new URL(`../../scanner/test/__snapshots__/${name}.model.json`, import.meta.url), 'utf8'),
    ),
  )

function render(index: ModelIndex, view: ReturnType<typeof createElement>, details: boolean): string {
  setShowDetails(details)
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } })
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(DataContext.Provider, { value: { index, meta: { canRescan: false } } }, view),
    ),
  )
}

const badges = (html: string) => html.match(/class="badge /g)?.length ?? 0
const terms = (html: string) => [...html.matchAll(/data-term="([^":]+):([^"]+)"/g)].map((m) => [m[1], m[2]])

afterEach(() => setShowDetails(false))

describe.each(FIXTURES)('badges in %s', (fixture) => {
  const index = buildIndex(model(fixture))
  const pages = index.model.routes.filter((r) => r.kind === 'page')

  it('page views show fewer badges without details', () => {
    let fewer = 0
    let plainTotal = 0
    let fullTotal = 0
    for (const page of pages) {
      const view = createElement(PageView, { routeId: page.id })
      const plain = badges(render(index, view, false))
      const full = badges(render(index, view, true))
      expect(plain, page.path).toBeLessThanOrEqual(full)
      if (plain < full) fewer++
      plainTotal += plain
      fullTotal += full
    }
    // Every fixture page names itself `page` at least, so each one has something to hide.
    expect(fewer).toBe(pages.length)
    // "Details" on is the 0.2.2 page view; off hides at least a third of its badges.
    expect(plainTotal * 3).toBeLessThanOrEqual(fullTotal * 2)
  })

  it('the request list shows at most one badge per request without details', () => {
    const view = createElement(RequestsScreen, { name: 'requests', q: '' })
    const html = render(index, view, false)
    // One main badge per row, plus `×N` on a row that folds the same request from several places.
    const rows = html.match(/class="request-summary"/g)?.length ?? 0
    expect(badges(html)).toBeLessThanOrEqual(rows * 2)
    expect(badges(html)).toBeLessThan(badges(render(index, view, true)))
  })

  it('links every badge word to a glossary entry', () => {
    for (const page of pages) {
      const html = render(index, createElement(PageView, { routeId: page.id }), true)
      for (const [group, key] of terms(html)) {
        expect(explain(group as GlossaryGroupId, key as string), `${group}:${key}`).toBeDefined()
      }
    }
  })
})
