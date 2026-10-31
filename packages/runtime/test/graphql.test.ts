// GraphQL captures (M17): operations read from bodies and GET queries, batches split.
import type { Capture } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { operationIn, readGraphqlPayload, splitGraphqlCapture } from '../src/graphql'

const base = (request: Partial<Capture['request']>, response?: Capture['response']): Capture => ({
  id: 'c1',
  sessionId: 's',
  origin: 'browser',
  transport: 'fetch',
  timestamp: '2026-10-30T00:00:00.000Z',
  durationMs: 1,
  request: {
    method: 'POST',
    url: 'http://localhost:3000/api/graphql',
    headers: {},
    body: { kind: 'none' },
    ...request,
  },
  ...(response ? { response } : {}),
  stack: [],
  redacted: true,
  redactedPaths: [],
})

describe('operationIn', () => {
  it('reads the name and type', () => {
    expect(operationIn('query Todos($s: String) { todos { id } }')).toEqual({ name: 'Todos', type: 'query' })
    expect(operationIn('  # comment\n mutation AddTodo { addTodo { id } }')).toEqual({
      name: 'AddTodo',
      type: 'mutation',
    })
    expect(operationIn('{ todos { id } }')).toEqual({ type: 'query' })
    expect(operationIn('query { todos { id } }')).toEqual({ type: 'query' })
  })

  it('picks the operation named by operationName', () => {
    const text = 'query A { a } mutation B { b }'
    expect(operationIn(text, 'B')).toEqual({ name: 'B', type: 'mutation' })
  })

  it('ignores text that is not GraphQL', () => {
    expect(operationIn('hello world')).toBeUndefined()
    expect(operationIn('SELECT * FROM todos')).toBeUndefined()
  })
})

describe('readGraphqlPayload', () => {
  it('reads persisted queries', () => {
    expect(
      readGraphqlPayload({
        operationName: 'Todos',
        extensions: { persistedQuery: { version: 1, sha256Hash: 'abc' } },
      }),
    ).toEqual({ name: 'Todos', hash: 'abc', persisted: true })
    expect(readGraphqlPayload({ doc_id: 'x1', variables: {} })).toEqual({ hash: 'x1', persisted: true })
    expect(readGraphqlPayload({ id: 'x2', variables: {} })).toEqual({ hash: 'x2', persisted: true })
  })

  it('is not fooled by REST bodies', () => {
    expect(readGraphqlPayload({ id: 'x', title: 'y' })).toBeUndefined()
    expect(readGraphqlPayload({ query: 'shoes' })).toBeUndefined()
  })
})

describe('splitGraphqlCapture', () => {
  it('tags a single operation', () => {
    const [c] = splitGraphqlCapture(
      base({
        body: { kind: 'json', value: { operationName: 'Todos', query: 'query Todos { todos { id } }' } },
      }),
    )
    expect(c?.operation).toEqual({ name: 'Todos', type: 'query' })
  })

  it('splits a batch into one capture per operation', () => {
    const pieces = splitGraphqlCapture(
      base(
        {
          body: {
            kind: 'json',
            value: [
              { operationName: 'Viewer', query: 'query Viewer { viewer { id } }' },
              {
                operationName: 'Todos',
                query: 'query Todos { todos { id } }',
                variables: { status: 'OPEN' },
              },
            ],
          },
        },
        {
          status: 200,
          headers: {},
          body: { kind: 'json', value: [{ data: { viewer: { id: 'u1' } } }, { data: { todos: [] } }] },
        },
      ),
    )
    expect(pieces.map((p) => [p.id, p.operation?.name, p.operation?.batch?.index])).toEqual([
      ['c1-0', 'Viewer', 0],
      ['c1-1', 'Todos', 1],
    ])
    expect(pieces[1]?.response?.body).toEqual({ kind: 'json', value: { data: { todos: [] } } })
    expect(pieces[1]?.request.body).toEqual({
      kind: 'json',
      value: { operationName: 'Todos', query: 'query Todos { todos { id } }', variables: { status: 'OPEN' } },
    })
  })

  it('moves a GET payload to the body', () => {
    const query = encodeURIComponent('query Todos($s: TodoStatus) { todos(status: $s) { id } }')
    const variables = encodeURIComponent(JSON.stringify({ s: 'OPEN' }))
    const [c] = splitGraphqlCapture(
      base({
        method: 'GET',
        url: `http://localhost:3000/api/graphql?query=${query}&operationName=Todos&variables=${variables}`,
      }),
    )
    expect(c?.request.url).toBe('http://localhost:3000/api/graphql')
    expect(c?.operation).toEqual({ name: 'Todos', type: 'query' })
    expect(c?.request.body).toMatchObject({
      kind: 'json',
      value: { operationName: 'Todos', variables: { s: 'OPEN' } },
    })
  })

  it('leaves other requests alone', () => {
    const plain = base({ body: { kind: 'json', value: { title: 'x' } } })
    expect(splitGraphqlCapture(plain)).toEqual([plain])
    const get = base({ method: 'GET', url: 'http://localhost:3000/api/todos?status=open' })
    expect(splitGraphqlCapture(get)).toEqual([get])
  })
})
