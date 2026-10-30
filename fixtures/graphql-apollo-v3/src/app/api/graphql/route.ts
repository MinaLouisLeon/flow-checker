import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSchema, execute, getOperationAST, parse, validate } from 'graphql'
import { rootValue } from '@/server/resolvers'

// A small hand-written GraphQL endpoint: POST (single or batched), GET, Apollo automatic
// persisted queries and Relay persisted documents (`doc_id`).

const schema = buildSchema(readFileSync(join(process.cwd(), 'schema.graphql'), 'utf8'))

// APQ: hash -> query text, filled when a query arrives together with its hash.
const persisted = new Map<string, string>()

interface GraphQLRequest {
  query?: string
  variables?: Record<string, unknown> | null
  operationName?: string | null
  extensions?: { persistedQuery?: { version?: number; sha256Hash?: string } } | null
  doc_id?: string
}

const fail = (message: string, code?: string) => ({
  errors: [{ message, ...(code ? { extensions: { code } } : {}) }],
})

/** Relay's compiler writes `{ "<id>": "<query text>" }` next to the app. */
function persistedDocument(id: string): string | undefined {
  try {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'persisted_queries.json'), 'utf8'))
    return manifest[id]
  } catch {
    return undefined
  }
}

async function run(request: GraphQLRequest, method: 'GET' | 'POST') {
  let query = request.query
  if (request.doc_id) {
    query = persistedDocument(request.doc_id)
    if (!query) return fail(`Unknown doc_id ${request.doc_id}`, 'PERSISTED_QUERY_NOT_FOUND')
  }
  const hash = request.extensions?.persistedQuery?.sha256Hash
  if (hash) {
    if (query) {
      if (createHash('sha256').update(query).digest('hex') !== hash) {
        return fail('provided sha does not match query', 'BAD_USER_INPUT')
      }
      persisted.set(hash, query)
    } else {
      query = persisted.get(hash)
      if (!query) return fail('PersistedQueryNotFound', 'PERSISTED_QUERY_NOT_FOUND')
    }
  }
  if (!query) return fail('Must provide query string.')

  let document: ReturnType<typeof parse>
  try {
    document = parse(query)
  } catch (error) {
    return { errors: [error] }
  }
  const errors = validate(schema, document)
  if (errors.length > 0) return { errors }
  const operation = getOperationAST(document, request.operationName)
  if (method === 'GET' && operation?.operation === 'mutation') {
    return fail('Mutations must be sent with POST.')
  }
  return execute({
    schema,
    document,
    rootValue,
    variableValues: request.variables ?? undefined,
    operationName: request.operationName ?? undefined,
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (Array.isArray(body)) {
    return Response.json(await Promise.all(body.map((item: GraphQLRequest) => run(item, 'POST'))))
  }
  if (!body || typeof body !== 'object') return Response.json(fail('Invalid JSON body'), { status: 400 })
  return Response.json(await run(body, 'POST'))
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const json = (name: string) => {
    const value = params.get(name)
    return value ? JSON.parse(value) : undefined
  }
  try {
    const result = await run(
      {
        query: params.get('query') ?? undefined,
        variables: json('variables'),
        operationName: params.get('operationName'),
        extensions: json('extensions'),
      },
      'GET',
    )
    return Response.json(result)
  } catch {
    return Response.json(fail('Invalid query parameters'), { status: 400 })
  }
}
