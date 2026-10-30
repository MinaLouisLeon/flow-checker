import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  importLocalPostman,
  importPostman,
  loadPostman,
  PostmanError,
  type PostmanImport,
  readCache,
} from '../src'

const fixture = resolve(import.meta.dirname, '../../../fixtures/postman')
const NOW = new Date('2026-10-30T12:00:00.000Z')

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'fc-postman-'))
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), text)
  }
  return root
}

/** Without where it came from: the same collection in two formats. */
function content(imported: PostmanImport) {
  const { collection, environment, importedAt: _, ...rest } = imported
  return { name: collection.name, environment: environment?.name, ...rest }
}

describe('local collections', () => {
  const v3 = importLocalPostman({
    root: fixture,
    config: { collection: 'postman/collections/Fixture API', environment: 'postman/environments/local.yaml' },
    now: NOW,
  })
  const v21 = importLocalPostman({
    root: fixture,
    config: {
      collection: 'postman/fixture-api.postman_collection.json',
      environment: 'postman/local.postman_environment.json',
    },
    now: NOW,
  })

  it('reads a v3 YAML folder: folders, order, examples and environment', () => {
    expect(v3.collection).toEqual({
      name: 'Fixture API',
      source: { kind: 'folder', path: 'postman/collections/Fixture API' },
    })
    expect(v3.environment).toEqual({
      name: 'Local',
      source: { kind: 'file', path: 'postman/environments/local.yaml' },
    })
    expect(v3.requests.map((r) => `${r.folder.join('/')}: ${r.method} ${r.url} (${r.name})`)).toEqual([
      'Users: GET {{baseUrl}}/users (List users)',
      'Users: GET {{baseUrl}}/users/:id (Get user)',
      'Products: GET {{baseUrl}}/products (List products)',
      'Products: DELETE {{baseUrl}}/products/:id (Delete product)',
      'Todos: GET {{baseUrl}}/todos (List todos)',
      'Todos: GET {{baseUrl}}/todos/:id (Get todo)',
      'Todos: POST {{baseUrl}}/todos (Create todo)',
    ])
    const getUser = v3.requests[1]
    expect(getUser?.examples.map((e) => [e.name, e.status])).toEqual([
      ['200 OK', 200],
      ['404 Not Found', 404],
    ])
    expect(v3.requests[6]?.body?.value).toEqual({ title: 'Buy milk', userId: 1 })
  })

  it('reads the same collection from a v2.1 JSON export', () => {
    expect(v21.collection.source).toEqual({
      kind: 'file',
      path: 'postman/fixture-api.postman_collection.json',
    })
    expect(content(v21)).toEqual(content(v3))
  })

  it('keeps only the variables URLs use, never secrets, headers or auth', () => {
    expect(v3.environmentValues).toEqual([{ key: 'baseUrl', value: 'http://localhost:4010' }])
    const text = JSON.stringify(v3)
    expect(text).not.toContain('not-a-real-token')
    expect(text).not.toContain('Authorization')
  })

  it('reports a missing or invalid source', () => {
    expect(() => importLocalPostman({ root: fixture, config: { collection: 'nope.json' } })).toThrow(
      /Postman collection not found: nope\.json/,
    )
    const root = project({ 'c.json': '{"hello": 1}', 'v1.json': '{"info":{"schema":"v1"},"item":[]}' })
    expect(() => importLocalPostman({ root, config: { collection: 'c.json' } })).toThrow(PostmanError)
    expect(() => importLocalPostman({ root, config: { collection: 'v1.json' } })).toThrow(/unsupported/)
    const empty = project({ 'col/.resources/definition.yaml': '$kind: collection\n' })
    expect(() => importLocalPostman({ root: empty, config: { collection: 'col' } })).toThrow(
      /No HTTP requests/,
    )
  })

  it('redacts example bodies with the capture rules and keeps their JSON types', () => {
    const root = project({
      'c.json': JSON.stringify({
        info: {
          name: 'Auth',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        variable: [
          { key: 'host', value: 'api.example.com' },
          { key: 'apiKey', value: 'k-123' },
          { key: 'off', value: 'x', disabled: true },
        ],
        item: [
          {
            name: 'Login',
            request: {
              method: 'post',
              url: { protocol: 'https', host: ['{{host}}'], path: ['auth', 'login'] },
              body: { mode: 'raw', raw: '{"email":"a@b.c","password":"hunter2"}' },
            },
            response: [{ name: 'OK', code: 200, body: '{"token":"eyJ.abc.def","user":{"id":1}}' }],
          },
          { name: 'Not HTTP', request: { method: 'CONNECT', url: '{{host}}/x' } },
        ],
      }),
    })
    const imported = importLocalPostman({ root, config: { collection: 'c.json' }, now: NOW })
    expect(imported.variables).toEqual([{ key: 'host', value: 'api.example.com' }])
    const [login] = imported.requests
    expect(imported.requests).toHaveLength(1)
    expect(login?.method).toBe('POST')
    expect(login?.url).toBe('https://{{host}}/auth/login')
    expect(login?.body).toEqual({
      value: { email: 'a@b.c', password: '[REDACTED:string]' },
      redactedPaths: ['request.body.password'],
    })
    expect(login?.examples[0]?.body).toEqual({
      value: { token: '[REDACTED:string]', user: { id: 1 } },
      redactedPaths: ['response.body.token'],
    })
  })

  it('takes variables from v3 folder definitions', () => {
    const root = project({
      'col/.resources/definition.yaml':
        "$kind: collection\nname: API\nvariables:\n  - key: base\n    value: 'http://a.test'\n",
      'col/v2/.resources/definition.yaml':
        "$kind: collection\nvariables:\n  - key: version\n    value: 'v2'\n",
      'col/v2/List.request.yaml': "$kind: http-request\nmethod: GET\nurl: '{{base}}/{{version}}/items'\n",
      'col/Other.request.yaml': "$kind: graphql-request\nurl: '{{base}}/graphql'\n",
    })
    const imported = importLocalPostman({ root, config: { collection: 'col' }, now: NOW })
    expect(imported.collection.name).toBe('API')
    expect(imported.requests).toEqual([
      {
        name: 'List',
        folder: ['v2'],
        method: 'GET',
        url: '{{base}}/{{version}}/items',
        variables: [{ key: 'version', value: 'v2' }],
        examples: [],
      },
    ])
  })
})

describe('cloud collections', () => {
  const collection = {
    collection: {
      info: {
        name: 'Cloud API',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [{ name: 'Ping', request: { method: 'GET', url: '{{baseUrl}}/ping' } }],
    },
  }
  const environment = {
    environment: { name: 'Prod', values: [{ key: 'baseUrl', value: 'https://api.test', enabled: true }] },
  }
  const fakeFetch = (calls: { url: string; key: string | null }[], status = 200) =>
    (async (url: string, init?: RequestInit) => {
      const key = new Headers(init?.headers).get('x-api-key')
      calls.push({ url, key })
      const body = url.includes('/environments/') ? environment : collection
      return new Response(JSON.stringify(body), { status })
    }) as typeof fetch

  it('fetches the collection and environment with the API key from the env variable', async () => {
    const calls: { url: string; key: string | null }[] = []
    const imported = await importPostman({
      root: fixture,
      config: {
        collection: { id: 'c-1', apiKeyEnv: 'MY_KEY' },
        environment: { id: 'e-1', apiKeyEnv: 'MY_KEY' },
      },
      env: { MY_KEY: 'PMAK-secret' },
      fetch: fakeFetch(calls),
      apiBase: 'https://postman.test',
      now: NOW,
    })
    expect(calls).toEqual([
      { url: 'https://postman.test/collections/c-1', key: 'PMAK-secret' },
      { url: 'https://postman.test/environments/e-1', key: 'PMAK-secret' },
    ])
    expect(imported.collection).toEqual({ name: 'Cloud API', source: { kind: 'cloud', id: 'c-1' } })
    expect(imported.environmentValues).toEqual([{ key: 'baseUrl', value: 'https://api.test' }])
    expect(JSON.stringify(imported)).not.toContain('PMAK')
  })

  it('explains a missing key, a refused key and an unknown id', async () => {
    const base = { root: fixture, apiBase: 'https://postman.test' }
    await expect(importPostman({ ...base, config: { collection: { id: 'c-1' } }, env: {} })).rejects.toThrow(
      /POSTMAN_API_KEY/,
    )
    const env = { POSTMAN_API_KEY: 'k' }
    await expect(
      importPostman({ ...base, config: { collection: { id: 'c-1' } }, env, fetch: fakeFetch([], 401) }),
    ).rejects.toThrow(/refused the key in POSTMAN_API_KEY \(401\)/)
    await expect(
      importPostman({ ...base, config: { collection: { id: 'c-1' } }, env, fetch: fakeFetch([], 404) }),
    ).rejects.toThrow(/c-1 was not found/)
    expect(() => importLocalPostman({ ...base, config: { collection: { id: 'c-1' } } })).toThrow(
      /postman import/,
    )
  })

  it('uses the cache when the cloud is not refreshed or not reachable', async () => {
    const root = project({})
    const calls: { url: string; key: string | null }[] = []
    const config = { collection: { id: 'c-1' } }
    const env = { POSTMAN_API_KEY: 'k' }
    const first = await loadPostman({ root, config, env, fetch: fakeFetch(calls), apiBase: 'https://p.test' })
    expect(first.from).toBe('import')
    expect(readCache(root)?.collection.name).toBe('Cloud API')
    // Not refreshed: from the cache, no request.
    const second = await loadPostman({
      root,
      config,
      env,
      fetch: fakeFetch(calls),
      apiBase: 'https://p.test',
    })
    expect(second.from).toBe('cache')
    expect(calls).toHaveLength(1)
    // Refreshed but the API fails: the cache, with a warning.
    const third = await loadPostman({
      root,
      config,
      env,
      refresh: true,
      fetch: fakeFetch(calls, 500),
      apiBase: 'https://p.test',
    })
    expect(third.from).toBe('cache')
    expect(third.warning).toMatch(/answered 500.*Using the last import/)
    // No config: the last import.
    expect((await loadPostman({ root, config: undefined })).imported?.collection.name).toBe('Cloud API')
  })
})
