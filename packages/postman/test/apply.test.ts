// M15 "done when": on the postman fixture, sites are matched to collection requests, example-based
// types fill `unknown-response`, `{{baseUrl}}` URLs are resolved, and missing / unused endpoints
// are flagged. Plus in-memory edge cases of the matching.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import {
  type AppModel,
  AppModelSchema,
  type Capture,
  checkCapture,
  MODEL_VERSION,
  type RequestSite,
  type TypeShape,
  typeCheckStatus,
  typeTable,
} from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import {
  applyPostman,
  type ImportedRequest,
  importLocalPostman,
  type PostmanImport,
  resolveUrl,
  shapeOfValues,
  words,
} from '../src'

const root = resolve(import.meta.dirname, '../../../fixtures/postman')
const NOW = new Date('2026-10-30T12:00:00.000Z')

describe('postman fixture', () => {
  const scanned = scanProject({ root })
  const imported = importLocalPostman({
    root,
    config: { collection: 'postman/collections/Fixture API', environment: 'postman/environments/local.yaml' },
    now: NOW,
  })
  const model = applyPostman(scanned, imported, { appOrigins: ['http://localhost:3000'] })
  const site = (callee: string, method = 'GET') =>
    model.requests.find(
      (s) => s.method === method && s.callStack.some((f) => f.callee === callee),
    ) as RequestSite
  const entry = (name: string) => model.postman?.requests.find((r) => r.name === name)

  it('matches sites to collection requests by method and URL', () => {
    expect(site('getUsers').contract).toMatchObject({ name: 'List users', by: 'url' })
    expect(site('getUser').contract).toMatchObject({ name: 'Get user', by: 'url' })
    expect(site('createTodo', 'POST').contract).toMatchObject({ name: 'Create todo', by: 'url' })
    expect(entry('List users')?.siteIds).toEqual([site('getUsers').id])
  })

  it('resolves {{baseUrl}} from the environment', () => {
    expect(entry('Get user')?.url).toEqual({
      text: '{{baseUrl}}/users/:id',
      confidence: 'pattern',
      base: 'http://localhost:4010',
      path: '/users/:id',
    })
  })

  it('fills a URL the scan could not resolve from the request its name and method point to', () => {
    const todos = site('listTodos')
    expect(scanned.requests.find((s) => s.id === todos.id)?.url?.confidence).toBe('unknown')
    expect(todos.url).toEqual({
      text: 'todosUrl()',
      confidence: 'postman',
      base: 'http://localhost:4010',
      path: '/todos',
    })
    expect(todos.contract).toMatchObject({ name: 'List todos', by: 'code' })
    expect(todos.flags.map((f) => f.kind)).not.toContain('dynamic-url')
  })

  it('fills a missing response type from the saved 2xx examples', () => {
    const getUser = site('getUser')
    expect(scanned.requests.find((s) => s.id === getUser.id)?.flags.map((f) => f.kind)).toContain(
      'unknown-response',
    )
    expect(getUser.responseType).toMatchObject({
      text: '{ id: number; name: string; email: string; role: string }',
      source: 'postman',
    })
    expect(getUser.flags.map((f) => f.kind)).not.toContain('unknown-response')
  })

  it('flags a code type that does not fit the example', () => {
    expect(site('getProducts').flags).toContainEqual({
      kind: 'contract-mismatch',
      message:
        'The response type Product[] doesn\'t match the Postman example "200 OK": [].price is number 49.9 (expected string).',
    })
    expect(site('getUsers').flags).toEqual([])
    expect(site('createTodo', 'POST').flags).toEqual([])
  })

  it('flags sites not in the collection and collection requests nothing calls', () => {
    expect(site('deleteUser', 'DELETE').flags).toContainEqual({
      kind: 'not-in-collection',
      message: 'The Postman collection "Fixture API" has no DELETE /users/:id request.',
    })
    const unused = model.postman?.requests.filter((r) => r.flags.some((f) => f.kind === 'unused-endpoint'))
    expect(unused?.map((r) => r.name)).toEqual(['Delete product', 'Get todo'])
  })

  it('type-checks captured data against types from examples, like declared ones', () => {
    const recording = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../server/test/recordings/postman.json'), 'utf8'),
    ) as { captures: Capture[] }
    const types = typeTable(model.types)
    const status = (path: string, s: RequestSite) => {
      const capture = recording.captures.find((c) => new URL(c.request.url).pathname === path)
      const check = capture && checkCapture(capture, s, types)
      return check && typeCheckStatus(check)
    }
    expect(status('/users/2', site('getUser'))).toBe('ok')
    expect(status('/products', site('getProducts'))).toBe('mismatch')
  })

  it('writes a model that loads, and leaves the scan as it was', () => {
    const parsed = AppModelSchema.parse(JSON.parse(JSON.stringify(model)))
    expect(parsed.version).toBe(MODEL_VERSION)
    expect(parsed.postman?.requests).toHaveLength(7)
    expect(scanned.postman).toBeUndefined()
    expect(scanned.requests.some((s) => s.contract)).toBe(false)
  })
})

// --- In-memory cases ------------------------------------------------------------------------

function siteOf(partial: Partial<RequestSite> & Pick<RequestSite, 'id'>): RequestSite {
  return {
    origin: 'component',
    componentId: 'cmp_x',
    transport: 'fetch',
    trigger: { kind: 'page-load' },
    callStack: [{ file: 'lib/api.ts', line: 1, column: 1, callee: 'fetch' }],
    status: 'inferred',
    flags: [],
    ...partial,
  }
}

function modelOf(requests: RequestSite[]): AppModel {
  return {
    version: MODEL_VERSION,
    project: { appDir: 'app' },
    routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'app', files: {}, children: [] },
    routes: [],
    components: [],
    types: [],
    requests,
    navigations: [],
    flows: [],
    queryLinks: [],
  }
}

function importOf(requests: Partial<ImportedRequest>[], extra: Partial<PostmanImport> = {}): PostmanImport {
  return {
    version: 1,
    importedAt: NOW.toISOString(),
    collection: { name: 'API', source: { kind: 'file', path: 'api.json' } },
    variables: [],
    environmentValues: [],
    requests: requests.map((r, i) => ({
      name: `R${i}`,
      folder: [],
      method: 'GET',
      url: '',
      examples: [],
      ...r,
    })),
    ...extra,
  }
}

const api = (path: string, extra: Partial<RequestSite['url']> = {}) => ({
  text: `\`\${API}${path}\``,
  confidence: path.includes(':') ? ('pattern' as const) : ('exact' as const),
  base: 'https://api.test',
  path,
  ...extra,
})

describe('matching', () => {
  it('treats example ids in collection URLs as parameters and prefers the closer request', () => {
    const model = modelOf([siteOf({ id: 's1', method: 'GET', url: api('/users/:id') })])
    const out = applyPostman(
      model,
      importOf([
        { name: 'Me', url: 'https://api.test/users/me' },
        { name: 'By id', url: 'https://api.test/users/42' },
      ]),
    )
    expect(out.requests[0]?.contract?.name).toBe('By id')
  })

  it('needs the same method and origin', () => {
    const model = modelOf([
      siteOf({ id: 's1', method: 'POST', url: api('/users') }),
      siteOf({ id: 's2', method: 'GET', url: api('/users', { base: 'https://other.test' }) }),
    ])
    const out = applyPostman(model, importOf([{ url: 'https://api.test/users' }]))
    expect(out.requests[0]?.contract).toBeUndefined()
    expect(out.requests[0]?.flags.map((f) => f.kind)).toEqual(['not-in-collection'])
    // Another API: not this collection's business.
    expect(out.requests[1]?.contract).toBeUndefined()
    expect(out.requests[1]?.flags).toEqual([])
  })

  it('lines up an unknown base on either side by the end of the path', () => {
    const model = modelOf([
      siteOf({ id: 's1', method: 'GET', url: api('/items/:id', { base: '{API_URL}', baseEnv: 'API_URL' }) }),
    ])
    // `{{baseUrl}}` has no value: the collection's base is unknown too.
    const out = applyPostman(model, importOf([{ url: '{{baseUrl}}/v2/items/:itemId' }]))
    expect(out.requests[0]?.contract?.name).toBe('R0')
    expect(out.postman?.requests[0]?.url).toEqual({
      text: '{{baseUrl}}/v2/items/:itemId',
      confidence: 'pattern',
      base: '{{baseUrl}}',
      path: '/v2/items/:itemId',
    })
    expect(out.postman?.requests[0]?.unresolved).toEqual(['baseUrl'])
  })

  it("matches same-origin calls to collection URLs on the app's own origin", () => {
    const model = modelOf([
      siteOf({
        id: 's1',
        method: 'GET',
        url: { text: "'/api/health'", confidence: 'exact', path: '/api/health' },
      }),
    ])
    const imported = importOf([{ url: '{{app}}/api/health' }], {
      variables: [{ key: 'app', value: 'http://127.0.0.1:3000' }],
    })
    expect(applyPostman(model, imported).requests[0]?.contract).toBeUndefined()
    expect(
      applyPostman(model, imported, { appOrigins: ['http://localhost:3000'] }).requests[0]?.contract,
    ).toBeDefined()
  })

  it('leaves an unknown URL alone when the code points to more than one request', () => {
    const model = modelOf([
      siteOf({
        id: 's1',
        method: 'GET',
        url: { text: 'url', confidence: 'unknown' },
        callStack: [{ file: 'a.ts', line: 1, column: 1, callee: 'loadItems' }],
        flags: [{ kind: 'dynamic-url', message: 'x' }],
      }),
    ])
    const out = applyPostman(
      model,
      importOf([
        { name: 'Items', url: 'https://api.test/items' },
        { name: 'Item list', url: 'https://api.test/v2/items' },
      ]),
    )
    expect(out.requests[0]?.contract).toBeUndefined()
    expect(out.requests[0]?.flags.map((f) => f.kind)).toEqual(['dynamic-url'])
  })

  it('fills a missing body type and checks a declared one', () => {
    const body = { value: { title: 'x', userId: 1 }, redactedPaths: [] }
    const typed: TypeShape = {
      kind: 'object',
      properties: [
        { name: 'title', type: { kind: 'primitive', name: 'string' } },
        { name: 'userId', type: { kind: 'primitive', name: 'string' } },
      ],
    }
    const model = modelOf([
      siteOf({ id: 's1', method: 'POST', url: api('/todos') }),
      siteOf({ id: 's2', method: 'PUT', url: api('/todos'), bodyType: { text: 'NewTodo', shape: typed } }),
    ])
    const out = applyPostman(
      model,
      importOf([
        { method: 'POST', url: 'https://api.test/todos', body },
        { method: 'PUT', url: 'https://api.test/todos', body },
      ]),
    )
    expect(out.requests[0]?.bodyType).toEqual({
      text: '{ title: string; userId: number }',
      shape: shapeOfValues([body.value]),
      source: 'postman',
    })
    expect(out.requests[1]?.flags).toEqual([
      {
        kind: 'contract-mismatch',
        message:
          "The request body type NewTodo doesn't match the Postman request body: userId is number 1 (expected string).",
      },
    ])
  })

  it('skips server actions', () => {
    const model = modelOf([siteOf({ id: 's1', transport: 'server-action', method: 'POST' })])
    expect(applyPostman(model, importOf([{ url: 'https://api.test/x' }])).requests[0]).toBe(model.requests[0])
  })
})

describe('helpers', () => {
  it('resolves variables, nested ones too, and splits off the origin', () => {
    const vars = new Map([
      ['base', '{{host}}/v1'],
      ['host', 'https://API.test:443'],
      ['id', '7'],
    ])
    const out = resolveUrl('{{base}}/users/{{id}}/posts/{{postId}}?x=1#top', vars, new Set())
    expect(out.origin).toBe('https://api.test')
    expect(out.segments).toEqual([
      { kind: 'static', value: 'v1' },
      { kind: 'static', value: 'users' },
      { kind: 'param', name: 'id' },
      { kind: 'static', value: 'posts' },
      { kind: 'param', name: 'postId' },
    ])
    expect(out.unresolved).toEqual(['postId'])
    expect(resolveUrl('localhost:4010/users', new Map(), new Set()).origin).toBe('http://localhost:4010')
  })

  it('splits names into words', () => {
    expect(words('getUserTodos')).toEqual(['user', 'todo'])
    expect(words('List categories')).toEqual(['list', 'category'])
    expect(words('fetchJSONData')).toEqual([])
  })

  it('merges examples: missing properties are optional, mixed values a union', () => {
    expect(
      shapeOfValues([
        { id: 1, tags: [], note: null },
        { id: 2, tags: ['a'], note: 'x', extra: true },
      ]),
    ).toEqual({
      kind: 'object',
      properties: [
        { name: 'id', type: { kind: 'primitive', name: 'number' } },
        { name: 'tags', type: { kind: 'array', element: { kind: 'primitive', name: 'string' } } },
        {
          name: 'note',
          type: {
            kind: 'union',
            types: [
              { kind: 'primitive', name: 'string' },
              { kind: 'primitive', name: 'null' },
            ],
          },
        },
        { name: 'extra', type: { kind: 'primitive', name: 'boolean' }, optional: true },
      ],
    })
  })
})
