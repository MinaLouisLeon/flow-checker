// M44: the page view lists a page's server/client leaks, To check groups them, and the component panel
// shows them. Pages without leaks show no section.
import { readdirSync, readFileSync } from 'node:fs'
import { AppModelSchema, leaksOn, type ModelIndex } from '@flow-checker/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataContext } from '../src/context'
import { buildIndex } from '../src/model-index'
import { ComponentPanel } from '../src/screens/ComponentPanel'
import { Overview } from '../src/screens/Overview'
import { PageView } from '../src/screens/PageView'

const snapshots = new URL('../../scanner/test/__snapshots__/', import.meta.url)
const load = (fixture: string): ModelIndex =>
  buildIndex(
    AppModelSchema.parse(JSON.parse(readFileSync(new URL(`${fixture}.model.json`, snapshots), 'utf8'))),
  )
const FIXTURES = readdirSync(snapshots)
  .filter((f) => f.endsWith('.model.json'))
  .map((f) => f.replace('.model.json', ''))

function render(index: ModelIndex, view: ReturnType<typeof createElement>): string {
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } })
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(DataContext.Provider, { value: { index, meta: { canRescan: false } } }, view),
    ),
  )
}

const pageHtml = (index: ModelIndex, path: string) => {
  const route = index.model.routes.find((r) => r.kind === 'page' && r.path === path && !r.slot)
  if (!route) throw new Error(`no page ${path}`)
  return render(index, createElement(PageView, { routeId: route.id }))
}

describe('server/client leaks in the dashboard', () => {
  it.each(FIXTURES)('shows the section only on pages with leaks (%s)', (fixture) => {
    const index = load(fixture)
    for (const route of index.model.routes) {
      if (route.kind !== 'page') continue
      const html = render(index, createElement(PageView, { routeId: route.id }))
      const leaks = leaksOn(index.model, route.id)
      if (leaks.length === 0) expect(html).not.toContain('Server/client leaks')
      else expect(html.match(/data-leak=/g)?.length, `${fixture} ${route.path}`).toBe(leaks.length)
    }
  })

  it('says what a module leak imports, through which files, and why the page breaks', () => {
    const html = pageHtml(load('leaks'), '/files')
    expect(html).toContain('<h2>Server/client leaks</h2>')
    expect(html).toContain('data-term="leak:node"')
    expect(html).toContain(
      '<code>src/lib/disk.ts</code> imports <code>fs</code> (a Node.js module with no browser version)',
    )
    expect(html).toContain('<code>src/components/file-badge.tsx</code> → <code>src/lib/format-size.ts</code>')
    expect(html).toContain('the build fails')
  })

  it('says which prop a server component hands to which client component', () => {
    const index = load('leaks')
    expect(pageHtml(index, '/receipt')).toContain(
      '<code>ReceiptPage</code> hands <code>total</code> (a <code>Money</code> instance) to the client component <code>ReceiptTotal</code>',
    )
    expect(pageHtml(index, '/help')).toContain('<code>Link</code> from <code>next/link</code>')
    expect(pageHtml(index, '/filters')).toContain('<code>config.onChange</code> (a function)')
    expect(pageHtml(index, '/')).not.toContain('Server/client leaks')
  })

  it('groups the leaks under To check and in the component panel', () => {
    const index = load('leaks')
    const overview = render(index, createElement(Overview))
    expect(overview).toContain('props that can&#x27;t cross to the browser')
    expect(overview).toContain('<code>pg</code> (a database client)')
    const picker = index.model.components.find((c) => c.name === 'ProductsPage')
    const panel = render(index, createElement(ComponentPanel, { componentId: picker?.id as string }))
    expect(panel).toContain('hands <code>onSelect</code> (a function)')
  })
})
