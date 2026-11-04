// M46: the page view lists the server actions a page uses with their auth and input labels, the Actions
// screen lists every action with the open ones first, and To check groups the flags.
import { readdirSync, readFileSync } from 'node:fs'
import { AppModelSchema, actionsOn, type ModelIndex } from '@flow-checker/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { DataContext } from '../src/context'
import { setShowDetails } from '../src/details'
import { buildIndex } from '../src/model-index'
import { href, parseHash } from '../src/router'
import { ActionsScreen } from '../src/screens/ActionsScreen'
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

describe('server actions in the dashboard', () => {
  it('routes #/actions', () => {
    expect(href({ name: 'actions' })).toBe('#/actions')
    expect(parseHash('#/actions')).toEqual({ name: 'actions' })
  })

  it.each(FIXTURES)('shows the section only on pages that use an action (%s)', (fixture) => {
    const index = load(fixture)
    for (const route of index.model.routes) {
      if (route.kind !== 'page') continue
      const html = render(index, createElement(PageView, { routeId: route.id }))
      const actions = actionsOn(index.model, route.id)
      if (actions.length === 0) expect(html).not.toContain('<h2>Server actions</h2>')
      else expect(html.match(/data-action=/g)?.length, `${fixture} ${route.path}`).toBe(actions.length)
    }
  })

  it('labels each action and explains the flag on its page', () => {
    const index = load('action-safety')
    const post = pageHtml(index, '/posts/[id]')
    expect(post).toContain('data-term="action:unprotected"')
    expect(post).toContain('data-term="action:auth-checked"')
    expect(post).toContain('data-term="action:input-checked"')
    expect(post).toContain('a server action is a public <code>POST</code> endpoint')
    // Only one of the three actions there is open.
    expect(post.match(/data-term="action:unprotected"/g)).toHaveLength(1)
    expect(pageHtml(index, '/')).toContain('inline in <a href="#/component/')
  })

  it('shows how each label was found only with details on', () => {
    const index = load('action-safety')
    expect(pageHtml(index, '/admin')).not.toContain('Auth checked by its wrapper')
    setShowDetails(true)
    const admin = pageHtml(index, '/admin')
    expect(admin).toContain('Auth checked by its wrapper <code>withAdmin</code>.')
    expect(admin).toContain('data-term="action:change-database"')
    expect(admin).toContain('wrapped in withAdmin')
  })

  it('lists the open actions first on the Actions screen, then the others', () => {
    const html = render(load('action-safety'), createElement(ActionsScreen))
    const toCheck = html.slice(html.indexOf('data-section="to-check"'), html.indexOf('Other actions'))
    expect(toCheck.match(/data-action=/g)).toHaveLength(3)
    expect(html).toContain('10 actions')
    // Seven others: five shown, the rest behind "+2 more" (M23).
    expect(html).toContain('+2 more')
  })

  it('says so on an app with no server actions', () => {
    expect(render(load('basic'), createElement(ActionsScreen))).toContain('The scan found no server actions.')
  })

  it('groups the flags under To check', () => {
    const overview = render(load('action-safety'), createElement(Overview))
    expect(overview).toContain('Server actions that change data with no auth check and no input check')
    expect(overview).toContain('Server action <code>deletePost</code> changes data')
  })
})
