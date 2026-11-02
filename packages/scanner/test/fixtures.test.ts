import { resolve } from 'node:path'
import {
  type AppModel,
  AppModelSchema,
  formatFlows,
  formatModel,
  formatRequests,
  formatTypes,
} from '@flow-checker/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import { scanProject } from '../src'

const FIXTURES = [
  'basic',
  'react-query',
  'react-query-v4',
  'server-actions',
  'bff',
  'next-intl',
  'mismatch',
  'middleware',
  'postman',
  'trpc-v10',
  'trpc',
  'graphql-apollo',
  'graphql-apollo-v3',
  'graphql-urql',
  'graphql-relay',
  'sse',
  'websocket',
] as const
const fixturesDir = resolve(import.meta.dirname, '../../../fixtures')

const models = new Map<string, AppModel>()
function scan(fixture: string): AppModel {
  let model = models.get(fixture)
  if (!model) {
    model = scanProject({ root: resolve(fixturesDir, fixture) })
    models.set(fixture, model)
  }
  return model
}

describe.each(FIXTURES)('fixture %s', (fixture) => {
  // A cold scan takes a few seconds, more while every test file runs in parallel.
  beforeAll(() => {
    scan(fixture)
  }, 60_000)

  it('produces a valid model', () => {
    expect(() => AppModelSchema.parse(scan(fixture))).not.toThrow()
  })

  it('matches the route and component tree snapshot', async () => {
    await expect(formatModel(scan(fixture))).toMatchFileSnapshot(`__snapshots__/${fixture}.tree.txt`)
  })

  it('matches the resolved types snapshot', async () => {
    await expect(formatTypes(scan(fixture))).toMatchFileSnapshot(`__snapshots__/${fixture}.types.txt`)
  })

  it('matches the request sites snapshot', async () => {
    await expect(formatRequests(scan(fixture))).toMatchFileSnapshot(`__snapshots__/${fixture}.requests.txt`)
  })

  it('matches the navigation and flows snapshot', async () => {
    await expect(formatFlows(scan(fixture))).toMatchFileSnapshot(`__snapshots__/${fixture}.flows.txt`)
  })

  it('labels every page, and shows a condition for every guarded one (M31)', () => {
    for (const route of scan(fixture).routes) {
      if (route.kind !== 'page') {
        expect(route.access).toBeUndefined()
        continue
      }
      expect(route.access, route.path).toBeDefined()
      if (route.access?.status !== 'guarded') continue
      const shown = route.access.guards.filter((g) => !g.unclear && (g.condition || g.always))
      expect(shown.length, route.path).toBeGreaterThan(0)
    }
  })

  it('has no duplicate sites', () => {
    // A twin is the same network call from the same origin, reached once through a path and
    // once through the tail of it (a local function walked in place and through its hook).
    const loc = (f: { file: string; line: number; column: number }) => `${f.file}:${f.line}:${f.column}`
    const origin = (s: AppModel['requests'][number]) =>
      `${s.origin} ${s.componentId ?? ''} ${s.routeId ?? ''} ${s.handlerMethod ?? ''} ${s.serverAction?.name ?? ''}`
    const twins: string[] = []
    const sites = scan(fixture).requests
    for (const a of sites) {
      for (const b of sites) {
        if (a === b || a.callStack.length >= b.callStack.length || origin(a) !== origin(b)) continue
        const tail = b.callStack.slice(b.callStack.length - a.callStack.length).map(loc)
        if (tail.join() === a.callStack.map(loc).join()) twins.push(`${a.id} / ${b.id}`)
      }
    }
    expect(twins).toEqual([])
  })

  it('matches the model snapshot', async () => {
    // The installed Next version changes with upgrades; it is not part of the contract.
    const model = scan(fixture)
    const stable = { ...model, project: { ...model.project, nextVersion: '<next-version>' } }
    await expect(`${JSON.stringify(stable, null, 2)}\n`).toMatchFileSnapshot(
      `__snapshots__/${fixture}.model.json`,
    )
  })
})
