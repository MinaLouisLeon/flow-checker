// Components that mount the same React Query query share its one request (M24): the capture is
// matched to all of them instead of being ambiguous.
import type { AppModel, Capture, QueryKeyPart, RequestSite } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { Matcher, sameQuery } from '../src/matcher'

// The query function's call path, below the hook: the same code for every component.
const QUERY_FN = [
  { file: 'src/hooks/useSettings.ts', line: 4, column: 10, callee: 'useQuery' },
  { file: 'src/services/api.ts', line: 12, column: 3, callee: 'http' },
  { file: 'src/services/api.ts', line: 3, column: 15, callee: 'fetch' },
]
const KEY: QueryKeyPart[] = [{ kind: 'static', value: 'settings' }]

function site(id: string, file: string, overrides: Partial<RequestSite> = {}): RequestSite {
  return {
    id,
    origin: 'component',
    componentId: `cmp_${id}`,
    transport: 'fetch',
    method: 'GET',
    url: { text: 'settingsUrl', confidence: 'pattern', base: '{API_URL}', path: '/settings' },
    hook: { name: 'useQuery', module: '@tanstack/react-query', key: 'key' },
    queryKey: KEY,
    trigger: { kind: 'page-load' },
    callStack: [{ file, line: 6, column: 3, callee: 'useSettings' }, ...QUERY_FN],
    status: 'inferred',
    flags: [],
    ...overrides,
  }
}

const model = (requests: RequestSite[]) =>
  ({ requests, components: [], routes: [], navigations: [] }) as unknown as AppModel

function capture(key: unknown[] = ['settings']) {
  const c = {
    id: 'cap_1',
    sessionId: 'ses_1',
    origin: 'browser',
    transport: 'fetch',
    timestamp: '2026-11-01T10:00:00.000Z',
    durationMs: 10,
    pageUrl: 'http://localhost:3000/settings',
    request: { method: 'GET', url: 'http://localhost:4010/settings', headers: {}, body: { kind: 'none' } },
    query: { kind: 'query', key },
    stack: [],
    redacted: true,
  } as unknown as Capture
  // Only the shared frames are on the stack: React Query runs the function once, from its cache.
  return { c, context: { frames: QUERY_FN.slice(1), resolveAction: () => undefined } }
}

describe('a query mounted by several components', () => {
  const panel = site('req_panel', 'src/components/SettingsPanel.tsx')
  const badge = site('req_badge', 'src/components/SettingsBadge.tsx')

  it('is one shared match that verifies every site', () => {
    const { c, context } = capture()
    const match = new Matcher(model([panel, badge])).match(c, context)
    expect(match.status).toBe('matched')
    expect([match.siteId, ...(match.sharedWith ?? [])].sort()).toEqual(['req_badge', 'req_panel'])
  })

  it('stays ambiguous when the sites send another query function', () => {
    const other = site('req_other', 'src/components/Other.tsx', {
      callStack: [
        { file: 'src/components/Other.tsx', line: 6, column: 3, callee: 'useQuery' },
        { file: 'src/components/Other.tsx', line: 6, column: 40, callee: 'http' },
        ...QUERY_FN.slice(2),
      ],
    })
    // Without source maps nothing tells the two apart, and they are not one query.
    const { c, context } = capture()
    const match = new Matcher(model([panel, other])).match(c, { ...context, frames: [] })
    expect(match.status).toBe('ambiguous')
  })

  it('stays ambiguous for different keys or a mutation', () => {
    const keyed = site('req_keyed', 'src/components/Keyed.tsx', {
      queryKey: [...KEY, { kind: 'param', name: 'tab' }],
    })
    expect(sameQuery(panel, keyed)).toBe(false)
    const mutation = site('req_mut', 'src/components/Save.tsx', {
      hook: { name: 'useMutation', module: '@tanstack/react-query' },
    })
    expect(sameQuery(panel, mutation)).toBe(false)
    expect(sameQuery(panel, site('req_plain', 'src/a.tsx', { hook: undefined }))).toBe(false)
    expect(sameQuery(panel, badge)).toBe(true)
  })
})
