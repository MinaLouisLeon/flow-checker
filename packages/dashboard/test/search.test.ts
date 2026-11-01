// M33: every global search result opens a screen that shows it.
import { readFileSync } from 'node:fs'
import { AppModelSchema, type SearchItem, search } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { areasOf, endpointsOf, searchOf } from '../src/lists'
import { buildIndex, type ModelIndex } from '../src/model-index'
import { href, parseHash, searchScreen } from '../src/router'

const model = (name: string) =>
  AppModelSchema.parse(
    JSON.parse(
      readFileSync(new URL(`../../scanner/test/__snapshots__/${name}.model.json`, import.meta.url), 'utf8'),
    ),
  )

/** Whether the screen a result opens has the item in it. */
function shows(item: SearchItem, index: ModelIndex): boolean {
  const screen = parseHash(href(searchScreen(item)))
  switch (screen.name) {
    case 'page':
      return index.routes.has(screen.routeId) && screen.routeId === item.id
    case 'component':
      return index.components.has(screen.componentId)
    case 'requests':
      return !!screen.siteId && index.requests.has(screen.siteId)
    case 'endpoints':
      return endpointsOf(index).endpoints.some((e) => e.key === screen.endpointId)
    case 'types':
      return !!screen.typeId && index.types.has(screen.typeId)
    case 'flows':
      return !!screen.flowId && index.flows.has(screen.flowId)
    case 'areas':
      return !!screen.areaId && areasOf(index).byId.has(screen.areaId)
    default:
      return false
  }
}

describe.each(['next-intl', 'react-query', 'trpc', 'middleware'])('search links on %s', (name) => {
  const index = buildIndex(model(name))

  it('opens a screen with the item for every result', () => {
    const si = searchOf(index)
    expect(si.entries.length).toBeGreaterThan(0)
    const broken = si.entries
      .filter((e) => !shows(e.item, index))
      .map((e) => `${e.item.kind}:${e.item.label}`)
    expect(broken).toEqual([])
  })

  it('builds the index once per model index', () => {
    expect(searchOf(index)).toBe(searchOf(index))
    expect(searchOf(buildIndex(index.model))).not.toBe(searchOf(index))
  })
})

describe('search on the dashboard data', () => {
  it('has every kind on next-intl', () => {
    const si = searchOf(buildIndex(model('next-intl')))
    const kinds = new Set(si.entries.map((e) => e.item.kind))
    expect(kinds).toEqual(new Set(['page', 'area', 'component', 'flow', 'endpoint', 'request', 'type']))
    expect(search(si, 'verify').items[0]).toMatchObject({ kind: 'area', label: 'verify' })
  })
})
