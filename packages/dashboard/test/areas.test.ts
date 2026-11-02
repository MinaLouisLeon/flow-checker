// M30: the Areas screen's search, links and the cost on a big app.
import { readFileSync } from 'node:fs'
import { type AppModel, AppModelSchema, type Component, type Route } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { areaRows, areasOf, filterAreas } from '../src/lists'
import { buildIndex } from '../src/model-index'
import { href, parseHash, type Screen } from '../src/router'

const model = (name: string) =>
  AppModelSchema.parse(
    JSON.parse(
      readFileSync(new URL(`../../scanner/test/__snapshots__/${name}.model.json`, import.meta.url), 'utf8'),
    ),
  )

describe('area search', () => {
  const index = buildIndex(model('react-query'))
  const rows = areaRows(index)
  const keys = (q: string) => filterAreas(rows, q).map((a) => a.key)

  it('finds areas by name, page path and component', () => {
    expect(keys('')).toEqual(['home', 'settings', 'todos', 'users'])
    expect(keys('/todos/[id]')).toEqual(['todos'])
    expect(keys('userlist')).toEqual(['users'])
    expect(keys('settings panel')).toEqual(['settings'])
    expect(keys('nothing-like-this')).toEqual([])
  })

  it('builds the areas once per index', () => {
    expect(areasOf(index)).toBe(areasOf(index))
  })
})

describe('area links', () => {
  it('round-trips the screens through the hash', () => {
    const screens: Screen[] = [
      { name: 'areas', q: '' },
      { name: 'areas', areaId: 'ar_abc', q: 'billing' },
      { name: 'map', view: 'graph', q: '', areas: true },
      { name: 'map', view: 'tree', q: 'x' },
    ]
    for (const screen of screens) expect(parseHash(href(screen))).toEqual(screen)
  })
})

/** The perf app's shape: a list and a detail page per feature, each with its own components. */
function featureApp(features: number): AppModel {
  const base = model('basic')
  const loc = { file: 'src/app/layout.tsx', line: 1, column: 1 }
  const components: Component[] = [{ ...comp('cmp_layout', 'src/app/layout.tsx'), children: [] }]
  const routes: Route[] = []
  const layoutChain = [{ kind: 'layout' as const, file: 'src/app/layout.tsx', componentId: 'cmp_layout' }]
  for (let i = 0; i < features; i++) {
    const form = comp(`cmp_f${i}_form`, `src/features/f${i}/F${i}Form.tsx`)
    components.push(
      { ...comp(`cmp_f${i}_list`, `src/app/f${i}/page.tsx`), children: [ref(form.id, loc)] },
      comp(`cmp_f${i}_detail`, `src/app/f${i}/[id]/page.tsx`),
      form,
    )
    routes.push(
      route(`rt_f${i}`, `/f${i}`, `cmp_f${i}_list`, layoutChain),
      route(`rt_f${i}_id`, `/f${i}/[id]`, `cmp_f${i}_detail`, layoutChain),
    )
  }
  return { ...base, components, routes, requests: [], navigations: [], flows: [], queryLinks: [] }
}

function comp(id: string, file: string): Component {
  return {
    id,
    name: id,
    file,
    loc: { file, line: 1, column: 1 },
    kind: 'server',
    clientBoundary: false,
    children: [],
    usedTypes: [],
  }
}

function ref(componentId: string, loc: Component['loc']): Component['children'][number] {
  return { name: componentId, componentId, resolution: 'project', loc }
}

function route(id: string, path: string, componentId: string, layoutChain: Route['layoutChain']): Route {
  return { id, path, kind: 'page', file: `src/app${path}/page.tsx`, segments: [], layoutChain, componentId }
}

describe('areas on a big app', () => {
  it('gives one area per feature and searches in under 50 ms per keystroke', () => {
    const start = performance.now()
    const index = buildIndex(featureApp(200))
    const list = areasOf(index)
    const built = performance.now() - start
    expect(list.areas).toHaveLength(200)
    expect(list.areas.every((a) => a.routeIds.length === 2)).toBe(true)
    expect(list.sharedComponentIds).toEqual(['cmp_layout'])
    expect(built).toBeLessThan(1000)
    const rows = areaRows(index, list)
    let slowest = 0
    for (const q of ['f', 'f1', 'f12', 'f12 form', 'x']) {
      const t = performance.now()
      filterAreas(rows, q)
      slowest = Math.max(slowest, performance.now() - t)
    }
    expect(slowest).toBeLessThan(50)
  })
})
