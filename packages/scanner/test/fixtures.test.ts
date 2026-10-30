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

  it('matches the model snapshot', async () => {
    // The installed Next version changes with upgrades; it is not part of the contract.
    const model = scan(fixture)
    const stable = { ...model, project: { ...model.project, nextVersion: '<next-version>' } }
    await expect(`${JSON.stringify(stable, null, 2)}\n`).toMatchFileSnapshot(
      `__snapshots__/${fixture}.model.json`,
    )
  })
})
