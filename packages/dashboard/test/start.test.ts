// M32: every Start here item opens a screen that shows it, from the hash alone.
import { readFileSync } from 'node:fs'
import { AppModelSchema, buildSummary, type SummaryLink } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { areasOf, endpointsOf, filterRequests } from '../src/lists'
import { buildIndex } from '../src/model-index'
import { href, parseHash, summaryScreen } from '../src/router'

const FIXTURES = [
  'basic',
  'react-query',
  'server-actions',
  'bff',
  'next-intl',
  'middleware',
  'postman',
  'trpc',
  'graphql-apollo',
  'sse',
  'websocket',
]

const model = (name: string) =>
  AppModelSchema.parse(
    JSON.parse(
      readFileSync(new URL(`../../scanner/test/__snapshots__/${name}.model.json`, import.meta.url), 'utf8'),
    ),
  )

describe.each(FIXTURES)('Start here links of %s', (fixture) => {
  const index = buildIndex(model(fixture))
  const summary = buildSummary(index, { endpoints: endpointsOf(index), areas: areasOf(index) })
  const links: SummaryLink[] = summary.sections.flatMap((s) => [s.link, ...s.items.map((i) => i.link)])

  it('round-trips every link through the hash to a known screen', () => {
    for (const link of links) {
      const screen = summaryScreen(link)
      const parsed = parseHash(href(screen))
      expect(parsed.name, JSON.stringify(link)).not.toBe('not-found')
      expect(parsed, JSON.stringify(link)).toMatchObject(
        Object.fromEntries(Object.entries(screen).filter(([, v]) => v !== undefined && v !== '')),
      )
    }
  })

  it('opens request lists that are not empty', () => {
    for (const link of links) {
      if (link.to !== 'requests' || link.siteId) continue
      const screen = summaryScreen(link)
      if (screen.name !== 'requests') throw new Error('not a request list')
      expect(filterRequests(index, screen).length, JSON.stringify(link)).toBeGreaterThan(0)
    }
  })

  it('opens areas, endpoints hosts, flows, pages, components and types that exist', () => {
    for (const link of links) {
      if (link.to === 'area') expect(areasOf(index).byId.has(link.areaId)).toBe(true)
      if (link.to === 'endpoints' && link.host)
        expect(endpointsOf(index).hosts.some((h) => h.key === link.host)).toBe(true)
      if (link.to === 'flow') expect(index.flows.has(link.flowId)).toBe(true)
      if (link.to === 'page') expect(index.routes.has(link.routeId)).toBe(true)
      if (link.to === 'component') expect(index.components.has(link.componentId)).toBe(true)
      if (link.to === 'type') expect(index.types.has(link.typeId)).toBe(true)
    }
  })
})
