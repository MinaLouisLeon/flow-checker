// M23: bounded lists, folded rows and scroll decisions. Pure helpers, tested without rendering.
import { readFileSync } from 'node:fs'
import { AppModelSchema } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { CAP, callerGroups, capped, groupNavigations, hitsEveryQuery, typeRows } from '../src/lists'
import { buildIndex } from '../src/model-index'
import { href, parseHash, type Screen } from '../src/router'
import { screenIdentity, scrollTarget } from '../src/scroll'
import { SYNTHETIC, syntheticModel } from './synthetic'

const base = AppModelSchema.parse(
  JSON.parse(
    readFileSync(new URL('../../scanner/test/__snapshots__/next-intl.model.json', import.meta.url), 'utf8'),
  ),
)
// Parsing checks that the synthetic model is a valid model.
const model = AppModelSchema.parse(syntheticModel(base, { pagePath: '/[locale]/dashboard' }))
const index = buildIndex(model)

describe('capped lists', () => {
  it('shows the first entries and counts the rest', () => {
    const items = Array.from({ length: 12 }, (_, i) => i)
    expect(capped(items, false)).toEqual({ shown: [0, 1, 2, 3, 4], hidden: 7 })
    expect(capped(items, true)).toEqual({ shown: items, hidden: 0 })
    expect(capped(items.slice(0, CAP), false).hidden).toBe(0)
    expect(capped(items, false, 10).hidden).toBe(2)
  })

  it('says "every query" only for cache calls with no key, procedure or operation', () => {
    expect(hitsEveryQuery({})).toBe(true)
    expect(hitsEveryQuery({ key: [] })).toBe(false)
    expect(hitsEveryQuery({ procedure: '' })).toBe(false)
    expect(hitsEveryQuery({ operation: 'Todos' })).toBe(false)
    const links = model.queryLinks.filter((l) => l.id.startsWith('ql_syn_'))
    expect(links.filter(hitsEveryQuery)).toHaveLength(1)
  })
})

describe('repeated navigations', () => {
  it('folds a navigation found in every component that uses a hook', () => {
    const navs = model.navigations.filter((n) => n.loc.file === SYNTHETIC.hookFile)
    expect(navs).toHaveLength(12)
    const groups = groupNavigations(model.navigations)
    const hook = groups.find((g) => g[0]?.loc.file === SYNTHETIC.hookFile)
    expect(hook).toHaveLength(12)
    expect(groups).toHaveLength(base.navigations.length + 1)
  })

  it('keeps navigations apart when the kind, target, trigger or line differ', () => {
    const nav = model.navigations.find((n) => n.loc.file === SYNTHETIC.hookFile)
    if (!nav) throw new Error('no hook navigation')
    const variants = [
      { ...nav, id: 'a', kind: 'replace' as const },
      { ...nav, id: 'b', href: { ...nav.href, text: "'/other'" } },
      { ...nav, id: 'c', trigger: { kind: 'effect' as const } },
      { ...nav, id: 'd', loc: { ...nav.loc, line: nav.loc.line + 1 } },
    ]
    expect(groupNavigations([nav, ...variants])).toHaveLength(5)
  })
})

describe('route handler callers', () => {
  const handler = model.routes.find((r) => r.path === SYNTHETIC.handlerPath)
  const callers = index.handlerCallers.get(handler?.id ?? '') ?? []

  it('groups callers by the URL they send, sorted, and folds callers at the same line', () => {
    const groups = callerGroups(callers, index)
    expect(groups.map((g) => g.label)).toEqual(['POST /api/auth/login', 'POST /api/reviews'])
    const [login, reviews] = groups
    expect(login?.count).toBe(12)
    expect(login?.rows).toHaveLength(1)
    expect(login?.rows[0]).toHaveLength(12)
    // Two lines: two rows.
    expect(reviews?.rows.map((r) => r.length)).toEqual([1, 1])
  })

  it('searches by URL, component and file', () => {
    expect(callerGroups(callers, index, 'reviews').map((g) => g.label)).toEqual(['POST /api/reviews'])
    expect(callerGroups(callers, index, 'HookUser3').map((g) => g.count)).toEqual([1])
    expect(callerGroups(callers, index, 'send.ts')).toHaveLength(2)
    expect(callerGroups(callers, index, 'nothing-like-this')).toEqual([])
  })

  it('lists the handler’s own requests apart from its callers', () => {
    expect(index.handlerRequests.get(handler?.id ?? '')?.map((s) => s.id)).toEqual(['req_syn_upstream'])
  })
})

describe('types list', () => {
  it('folds instantiations of a generic and hides unused types', () => {
    const { rows, unused } = typeRows(index, { q: '' })
    const page = rows.find((r) => r.name === `${SYNTHETIC.generic}<…>`)
    expect(page?.types.map((t) => t.name)).toEqual(['Page<User>', 'Page<Post>'])
    expect(page?.uses).toEqual([1, 1])
    expect(page?.total).toBe(2)
    expect(rows.some((r) => r.name === 'NeverUsed')).toBe(false)
    expect(unused).toBeGreaterThanOrEqual(2)
  })

  it('shows unused types on request, and always the selected one', () => {
    const all = typeRows(index, { q: '', unused: true })
    expect(all.unused).toBe(0)
    expect(all.rows.find((r) => r.name === 'Page<…>')?.types).toHaveLength(3)
    expect(all.rows.reduce((n, r) => n + r.types.length, 0)).toBe(model.types.length)
    const kept = typeRows(index, { q: '', keep: 'typ_syn_unused' })
    expect(kept.rows.some((r) => r.name === 'NeverUsed')).toBe(true)
  })

  it('searches instantiations by name', () => {
    const { rows } = typeRows(index, { q: 'post', unused: true })
    expect(rows.find((r) => r.name === 'Page<…>')?.types.map((t) => t.name)).toEqual(['Page<Post>'])
  })
})

describe('scroll between screens', () => {
  it('opens a new screen at the top', () => {
    expect(scrollTarget('components', 'types', true, 500)).toBe(0)
    expect(scrollTarget(undefined, 'overview', true, undefined)).toBe(0)
  })

  it('keeps the position when a list screen only changes its selection', () => {
    expect(scrollTarget('components', 'components', true, undefined)).toBeUndefined()
  })

  it('returns to the saved position on back/forward and replaceScreen()', () => {
    expect(scrollTarget('types', 'components', false, 840)).toBe(840)
    expect(scrollTarget('components', 'components', false, undefined)).toBeUndefined()
  })

  it('treats another page or component as another screen, a selection on a page as the same', () => {
    const id = (hash: string) => screenIdentity(parseHash(hash))
    expect(id('#/page/rt_1')).not.toBe(id('#/page/rt_2'))
    expect(id('#/page/rt_1?c=cmp_1')).toBe(id('#/page/rt_1?c=cmp_2'))
    expect(id('#/component/cmp_1')).not.toBe(id('#/component/cmp_2'))
    expect(id('#/components/cmp_1')).toBe(id('#/components/cmp_2?q=x'))
  })
})

describe('routes', () => {
  const roundTrip = (screen: Screen) => parseHash(href(screen))

  it('round-trips the route handler list and the unused types toggle', () => {
    const handlers: Screen = { name: 'map', view: 'handlers', q: 'api' }
    expect(href(handlers)).toBe('#/map?view=handlers&q=api')
    expect(roundTrip(handlers)).toEqual(handlers)
    expect(href({ name: 'map', view: 'graph', q: '' })).toBe('#/map')
    expect(parseHash('#/map?view=sideways')).toMatchObject({ view: 'graph' })
    const types: Screen = { name: 'types', typeId: 'typ_1', q: '', unused: true }
    expect(href(types)).toBe('#/types/typ_1?all=1')
    expect(roundTrip(types)).toEqual(types)
  })
})
