// GraphQL bodies in collections (M17): requests are told apart by operation, since they all
// share one URL. Checked against the scanned graphql-urql fixture.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import { describe, expect, it } from 'vitest'
import { applyPostman, importLocalPostman } from '../src'

const fixture = resolve(import.meta.dirname, '../../../fixtures/graphql-urql')

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'fc-postman-gql-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}

const V21 = JSON.stringify({
  info: {
    name: 'GraphQL API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [{ key: 'base', value: 'http://localhost:3000' }],
  item: [
    {
      name: 'Todos',
      request: {
        method: 'POST',
        url: '{{base}}/api/graphql',
        body: {
          mode: 'graphql',
          graphql: {
            query: 'query Todos($status: TodoStatus) { todos(status: $status) { id title } }',
            variables: '{"status":"OPEN"}',
          },
        },
      },
      response: [{ name: 'OK', code: 200, body: '{"data":{"todos":[{"id":"1","title":"x"}]}}' }],
    },
    {
      name: 'Add todo',
      request: {
        method: 'POST',
        url: '{{base}}/api/graphql',
        body: {
          mode: 'raw',
          raw: '{"query":"mutation AddTodo($input: AddTodoInput!) { addTodo(input: $input) { id } }","variables":{"input":{"title":"x"}}}',
        },
      },
    },
    {
      name: 'Unused',
      request: {
        method: 'POST',
        url: '{{base}}/api/graphql',
        body: { mode: 'graphql', graphql: { query: 'query Stats { stats }' } },
      },
    },
  ],
})

describe('GraphQL requests in a collection', () => {
  it('reads the operation and keeps the variables as the body', () => {
    const root = project({
      'c.json': V21,
      'col/Viewer.request.yaml':
        "$kind: graphql-request\nurl: '{{base}}/api/graphql'\nquery: 'query Viewer { viewer { id } }'\nvariables: '{}'\n",
    })
    const v21 = importLocalPostman({ root, config: { collection: 'c.json' } })
    expect(v21.requests.map((r) => [r.name, r.operation, r.body?.value])).toEqual([
      ['Todos', { name: 'Todos', type: 'query' }, { status: 'OPEN' }],
      ['Add todo', { name: 'AddTodo', type: 'mutation' }, { input: { title: 'x' } }],
      ['Unused', { name: 'Stats', type: 'query' }, undefined],
    ])
    const v3 = importLocalPostman({ root, config: { collection: 'col' } })
    expect(v3.requests.map((r) => [r.name, r.method, r.operation])).toEqual([
      ['Viewer', 'POST', { name: 'Viewer', type: 'query' }],
    ])
  })

  it('pairs sites with requests by operation, not by URL alone', () => {
    const root = project({ 'c.json': V21 })
    const imported = importLocalPostman({ root, config: { collection: 'c.json' } })
    const model = applyPostman(scanProject({ root: fixture }), imported, {
      appOrigins: ['http://localhost:3000'],
    })
    const contract = (name: string) => model.requests.find((s) => s.operation?.name === name)?.contract?.name
    // urql sends the query as GET; the collection has it as POST. The operation decides.
    expect(contract('Todos')).toBe('Todos')
    expect(contract('AddTodo')).toBe('Add todo')
    expect(contract('Todo')).toBeUndefined()
    const flagged = model.requests.filter((s) => s.flags.some((f) => f.kind === 'not-in-collection'))
    expect(flagged.map((s) => s.operation?.name).sort()).toEqual(['Todo', 'ToggleTodo', 'Users'])
    const unused = model.postman?.requests.filter((r) => r.siteIds.length === 0).map((r) => r.name)
    expect(unused).toEqual(['Unused'])
    // Example types are the `data`, not the envelope.
    expect(model.postman?.requests[0]?.responseType?.shape).toMatchObject({
      kind: 'object',
      properties: [{ name: 'todos' }],
    })
  })
})
