import { describe, expect, it } from 'vitest'
import {
  type AppModel,
  diffCounts,
  diffModels,
  MODEL_VERSION,
  pairRenamedSites,
  type RequestSite,
} from '../src'

const site = (id: string, hash: string | undefined, over: Partial<RequestSite> = {}): RequestSite => ({
  id,
  origin: 'component',
  componentId: 'cmp_a',
  transport: 'fetch',
  method: 'GET',
  trigger: { kind: 'effect' },
  callStack: [],
  ...(hash ? { hash } : {}),
  status: 'inferred',
  flags: [],
  ...over,
})

const model = (requests: RequestSite[]): AppModel => ({
  version: MODEL_VERSION,
  project: { appDir: 'app' },
  routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'app', files: {}, children: [] },
  routes: [],
  components: [],
  types: [],
  requests,
  navigations: [],
  flows: [],
})

describe('pairRenamedSites', () => {
  it('pairs a site that moved by its code hash', () => {
    expect(
      pairRenamedSites(
        [site('req_a', 'h1'), site('req_b', 'h2')],
        [site('req_a2', 'h1'), site('req_b', 'h2')],
      ),
    ).toEqual({
      req_a: 'req_a2',
    })
  })

  it('pairs a site that moved and changed by its call path', () => {
    const frame = (line: number) => [{ file: 'lib/api.ts', line, column: 3, callee: 'fetch' }]
    expect(
      pairRenamedSites(
        [site('req_a', 'h1', { callStack: frame(5) })],
        [site('req_a2', 'h2', { callStack: frame(9) })],
      ),
    ).toEqual({ req_a: 'req_a2' })
    const before = model([site('req_a', 'h1', { callStack: frame(5) })])
    const after = model([site('req_a2', 'h2', { callStack: frame(9) })])
    expect(diffModels(before, after).changedCode).toEqual(['req_a2'])
  })

  it('does not guess when several sites fit', () => {
    expect(pairRenamedSites([site('req_a', 'h1'), site('req_b', 'h1')], [site('req_c', 'h1')])).toEqual({})
    expect(pairRenamedSites([site('req_a', 'h1'), site('req_b', 'h2')], [site('req_c', 'h3')])).toEqual({})
  })

  it('pairs sites from models without hashes by call path', () => {
    expect(pairRenamedSites([site('req_a', undefined)], [site('req_c', undefined)])).toEqual({
      req_a: 'req_c',
    })
  })
})

describe('diffModels', () => {
  it('lists added, removed and changed entities, and sites whose code changed', () => {
    const before = model([site('req_a', 'h1'), site('req_b', 'h2'), site('req_c', 'h3')])
    const after = model([
      // Verification status and flags are not code changes.
      site('req_a', 'h1', { status: 'verified', flags: [{ kind: 'stale', message: '' }] }),
      site('req_b', 'h2b'),
      site('req_c2', 'h3'),
      site('req_d', 'h4'),
    ])
    const diff = diffModels(before, after)
    expect(diff.entities).toEqual({
      requests: { added: ['req_c2', 'req_d'], removed: ['req_c'], changed: ['req_b'] },
    })
    expect(diff.renamedSites).toEqual({ req_c: 'req_c2' })
    expect(diff.changedCode).toEqual(['req_b'])
    expect(diffCounts(diff)).toEqual({ requests: { added: 2, removed: 1, changed: 1 } })
  })

  it('is empty for the same model', () => {
    const same = model([site('req_a', 'h1')])
    expect(diffModels(same, same)).toEqual({ entities: {}, renamedSites: {}, changedCode: [] })
  })
})
