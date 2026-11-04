// M45: the page view lists the environment variables a page's code reads, the Env screen lists every
// name with its reads, flags and files, and To check groups the flags. Names only, never values.
import { readdirSync, readFileSync } from 'node:fs'
import { AppModelSchema, envOn, type ModelIndex } from '@flow-checker/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { DataContext } from '../src/context'
import { setShowDetails } from '../src/details'
import { buildIndex } from '../src/model-index'
import { href, parseHash } from '../src/router'
import { EnvScreen } from '../src/screens/EnvScreen'
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

afterEach(() => setShowDetails(false))

describe('environment variables in the dashboard', () => {
  it('routes #/env', () => {
    expect(href({ name: 'env' })).toBe('#/env')
    expect(parseHash('#/env')).toEqual({ name: 'env' })
  })

  it.each(FIXTURES)('shows the section only on pages whose code reads a name (%s)', (fixture) => {
    const index = load(fixture)
    for (const route of index.model.routes) {
      if (route.kind !== 'page') continue
      const html = render(index, createElement(PageView, { routeId: route.id }))
      const vars = envOn(index.model, route.id)
      if (vars.length === 0) expect(html).not.toContain('<h2>Environment variables</h2>')
      else expect(html.match(/data-env=/g)?.length, `${fixture} ${route.path}`).toBe(vars.length)
    }
  })

  it('shows each flag on the page it is about, with its sentence', () => {
    const index = load('env')
    const checkout = pageHtml(index, '/checkout')
    expect(checkout).toContain('data-term="env:private-in-client"')
    expect(checkout).toContain(
      '<code>STRIPE_SECRET_KEY</code> has no <code>NEXT_PUBLIC_</code> prefix but is read in client code',
    )
    expect(pageHtml(index, '/about')).toContain(
      'is destructured from <code>process.env</code> in client code',
    )
    expect(pageHtml(index, '/status')).toContain('only listed in <code>.env.example</code>')
    // The layout's analytics id is fine on every page.
    const home = pageHtml(index, '/')
    expect(home).toContain('data-env="NEXT_PUBLIC_ANALYTICS_ID"')
    expect(home).not.toContain('data-term="env:private-in-client"')
  })

  it('shows sides only with details on', () => {
    const index = load('env')
    expect(pageHtml(index, '/checkout')).not.toContain('data-term="env:client"')
    setShowDetails(true)
    expect(pageHtml(index, '/checkout')).toContain('data-term="env:client"')
  })

  it('lists every name, the flags, the reads it can’t name and the files on the Env screen', () => {
    const html = render(load('env'), createElement(EnvScreen))
    expect(html.match(/data-env-flag=/g)).toHaveLength(4)
    expect(html).toContain('data-env="DATABASE_URL"')
    expect(html).toContain('+13 more')
    expect(html).toContain('Names built at run time')
    expect(html).toContain('process.env[`FEATURE_${name.toUpperCase()}`]')
    expect(html).toMatch(/data-section="unread">.*<code>UNUSED_TOKEN<\/code>/)
    expect(html).toContain('data-env-file=".env.example"')
    expect(html).toContain('never (Next doesn&#x27;t load it)')
    expect(html).not.toContain('fixture-value-')
  })

  it('says so on an app with no environment variables', () => {
    const index = load('basic')
    const model = { ...index.model, env: undefined }
    expect(render(buildIndex(model), createElement(EnvScreen))).toContain(
      'The scan found no environment variables.',
    )
  })

  it('groups the flags under To check', () => {
    const overview = render(load('env'), createElement(Overview))
    expect(overview).toContain('Environment variables read where they have no value')
    expect(overview).toContain('<code>DATABASE_URL</code> is read without a fallback')
  })
})
