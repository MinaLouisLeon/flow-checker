// M38: the page view says how a page renders and why, and the Map filters by render mode.
import { readFileSync } from 'node:fs'
import { AppModelSchema } from '@flow-checker/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataContext } from '../src/context'
import { buildIndex } from '../src/model-index'
import { href, parseHash } from '../src/router'
import { PageView } from '../src/screens/PageView'

const index = buildIndex(
  AppModelSchema.parse(
    JSON.parse(
      readFileSync(new URL('../../scanner/test/__snapshots__/basic.model.json', import.meta.url), 'utf8'),
    ),
  ),
)

function pageHtml(path: string): string {
  const route = index.model.routes.find((r) => r.kind === 'page' && r.path === path)
  if (!route) throw new Error(`no page ${path}`)
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

describe('render mode in the page view', () => {
  it('shows the mode and each reason with its source', () => {
    const html = pageHtml('/users/[id]')
    expect(html).toContain('<h2>Rendering</h2>')
    expect(html).toContain('data-term="render:dynamic"')
    expect(html).toContain('data-render="dynamic-params"')
    expect(html).toContain('<code>[id]</code> and no <code>generateStaticParams</code>')
  })

  it('says a static page is prerendered', () => {
    const html = pageHtml('/about')
    expect(html).toContain('data-term="render:static"')
    expect(html).toContain('Prerendered once at build time')
  })
})

describe('map render filter', () => {
  it('round-trips through the hash', () => {
    const screen = { name: 'map', view: 'graph', q: '', render: 'dynamic' } as const
    expect(href(screen)).toBe('#/map?render=dynamic')
    expect(parseHash('#/map?render=dynamic')).toEqual(screen)
    expect(parseHash('#/map?render=fast')).toMatchObject({ render: undefined })
    expect(href({ name: 'map', view: 'graph', q: '', access: 'open', render: 'isr' })).toBe(
      '#/map?access=open&render=isr',
    )
  })
})
