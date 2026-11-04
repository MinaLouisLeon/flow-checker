// M43: the page view shows where each page's browser part starts, on every fixture, with what each
// boundary brings and the planted boundary that could move lower.
import { readdirSync, readFileSync } from 'node:fs'
import { type AppModel, AppModelSchema, type ModelIndex } from '@flow-checker/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { DataContext } from '../src/context'
import { setShowDetails } from '../src/details'
import { CAP } from '../src/lists'
import { buildIndex } from '../src/model-index'
import { ComponentPanel } from '../src/screens/ComponentPanel'
import { PageView } from '../src/screens/PageView'

const snapshots = new URL('../../scanner/test/__snapshots__/', import.meta.url)
const load = (fixture: string): ModelIndex =>
  buildIndex(
    AppModelSchema.parse(JSON.parse(readFileSync(new URL(`${fixture}.model.json`, snapshots), 'utf8'))),
  )
const FIXTURES = readdirSync(snapshots)
  .filter((f) => f.endsWith('.model.json'))
  .map((f) => f.replace('.model.json', ''))

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

const pageHtml = (index: ModelIndex, path: string, details = false) => {
  const route = index.model.routes.find((r) => r.kind === 'page' && r.path === path && !r.slot)
  if (!route) throw new Error(`no page ${path}`)
  return render(index, createElement(PageView, { routeId: route.id }), details)
}

afterEach(() => setShowDetails(false))

describe('client boundaries in the page view', () => {
  it.each(FIXTURES)('shows every boundary of every page (%s)', (fixture) => {
    const index = load(fixture)
    const model: AppModel = index.model
    for (const route of model.routes) {
      if (route.kind !== 'page') continue
      const html = render(index, createElement(PageView, { routeId: route.id }), false)
      expect(html).toContain('<h2>Client boundaries</h2>')
      const client = route.client
      expect(client).toBeDefined()
      if (!client || client.boundaries.length === 0) {
        expect(html).toContain('every component renders on the server')
        continue
      }
      // Long lists show the first few and a "more" row (M23).
      for (const edge of client.boundaries.slice(0, CAP)) {
        const name = index.components.get(edge.componentId)?.name
        expect(html, `${fixture} ${route.path} ${name}`).toContain(`data-client="${name}"`)
      }
      if (client.boundaries.length > CAP) expect(html).toContain('more-row')
    }
  })

  it('says where each boundary starts, through a barrel, and what it brings', () => {
    const index = load('client-boundaries')
    const html = pageHtml(index, '/')
    expect(html).toContain('6 <code>&#x27;use client&#x27;</code> boundaries bring 9 components')
    expect(html).toContain('data-client="LikeButton"')
    expect(html).toContain('through <code>src/components/index.ts</code>')
    expect(html).toContain('rendered by <code>RootLayout</code> (layout)')
    expect(html).toContain('data-term="client:boundary"')
    // The page and layout themselves.
    expect(pageHtml(index, '/settings')).toContain('the page itself')
    expect(pageHtml(index, '/cart')).toContain('packages: <span><code>zod</code>')
  })

  it('flags only the planted boundary as one that could move lower, with where to', () => {
    const html = pageHtml(load('client-boundaries'), '/')
    expect(html.match(/data-term="client:lower"/g)?.length).toBe(1)
    expect(html).toContain('could move down to <code>Menu</code>')
  })

  it('marks the tree where the browser part starts, not client components below it', () => {
    const html = pageHtml(load('client-boundaries'), '/')
    const tree = html.slice(html.indexOf('component-tree'))
    // Counter, LikeButton, Shell, Toolbar, Chart: not Tabs (inside Toolbar) or Menu.
    expect(tree.match(/client boundary</g)?.length).toBe(5)
  })

  it('lists what it brings and why only with details on', () => {
    const index = load('client-boundaries')
    expect(pageHtml(index, '/cart')).not.toContain('What it brings and why')
    const html = pageHtml(index, '/cart', true)
    expect(html).toContain('What it brings and why')
    expect(html).toContain('data-client-use="hook"')
    expect(html).toContain('src/lib/cart-item.ts')
    expect(html).toContain('(also on the server)')
  })

  it('explains in the component panel what needs the browser', () => {
    const index = load('client-boundaries')
    const tabs = index.model.components.find((c) => c.name === 'Tabs')
    const html = render(index, createElement(ComponentPanel, { componentId: tabs?.id as string }), false)
    expect(html).toContain('Needs the browser for')
    expect(html).toContain('<code>useState</code> (hook)')
    expect(html).toContain('<code>onClick</code> (event handler)')
  })

  it('asks for a new scan on older models', () => {
    const index = load('client-boundaries')
    const model = structuredClone(index.model)
    for (const route of model.routes) delete route.client
    const html = pageHtml(buildIndex(model), '/')
    expect(html).toContain('scan again to see where this page')
  })
})
