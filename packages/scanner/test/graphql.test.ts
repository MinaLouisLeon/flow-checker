// GraphQL (M17) on patterns the fixture apps don't cover, scanned from an in-memory project with
// stubs of the client packages.
import { type AppModel, AppModelSchema, formatTypeShape, type RequestSite } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { beforeAll, describe, expect, it } from 'vitest'
import { scanProject } from '../src'

const lines = (...l: string[]) => `${l.join('\n')}\n`

const stub = (name: string, ...body: string[]): Record<string, string> => ({
  [`node_modules/${name}/package.json`]: JSON.stringify({ name, types: 'index.d.ts' }),
  [`node_modules/${name}/index.d.ts`]: lines(...body),
})

const SCHEMA = lines(
  'type Query { todos(status: TodoStatus): [Todo!]! todo(id: ID!): Todo viewer: User! search(text: String!): [SearchResult!]! }',
  'type Mutation { addTodo(input: AddTodoInput!): Todo! }',
  'type Todo { id: ID! title: String! done: Boolean! status: TodoStatus! owner: User! }',
  'type User { id: ID! name: String! }',
  'enum TodoStatus { OPEN DONE }',
  'input AddTodoInput { title: String! ownerId: ID }',
  'union SearchResult = Todo | User',
)

const FILES: Record<string, string> = {
  'package.json': JSON.stringify({ dependencies: { next: '^16.0.0' } }),
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      jsx: 'preserve',
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
      lib: ['dom', 'esnext'],
      paths: { '@/*': ['./src/*'] },
    },
  }),
  'schema.graphql': SCHEMA,
  'relay.config.json': JSON.stringify({
    src: './src',
    schema: './schema.graphql',
    artifactDirectory: './src/__generated__',
  }),
  'persisted_queries.json': JSON.stringify({ abc123: 'query RelayUsersQuery { viewer { id name } }' }),
  ...stub(
    '@apollo/client',
    'export declare function gql(literals: TemplateStringsArray, ...args: unknown[]): unknown',
    'export declare class InMemoryCache {}',
    'export declare class HttpLink { constructor(options: { uri: string }) }',
    'export declare class ApolloClient { constructor(options: unknown); query(options: unknown): Promise<unknown>; refetchQueries(options: unknown): unknown }',
  ),
  ...stub(
    '@apollo/client/react',
    'export declare function useQuery<D = unknown, V = unknown>(doc: unknown, options?: unknown): { data: D }',
    'export declare function useLazyQuery(doc: unknown, options?: unknown): [(options?: unknown) => void, unknown]',
    'export declare function useMutation(doc: unknown, options?: unknown): [(options?: unknown) => Promise<unknown>, unknown]',
    'export declare function useFragment(options: unknown): unknown',
    'export declare function useApolloClient(): import("@apollo/client").ApolloClient',
  ),
  ...stub(
    '@apollo/client/link/batch-http',
    'export declare class BatchHttpLink { constructor(options: { uri: string }) }',
  ),
  ...stub(
    'urql',
    'export declare function gql(literals: TemplateStringsArray, ...args: unknown[]): unknown',
    'export declare function createClient(options: unknown): unknown',
    'export declare const cacheExchange: unknown',
    'export declare const fetchExchange: unknown',
    'export declare function useQuery(options: unknown): [unknown, () => void]',
    'export declare function useMutation(doc: unknown): [unknown, (variables: unknown) => Promise<unknown>]',
  ),
  ...stub(
    'react-relay',
    'export declare function graphql(literals: TemplateStringsArray): unknown',
    'export declare function useLazyLoadQuery<T extends { response: unknown }>(doc: unknown, variables: unknown): T["response"]',
    'export declare function useFragment(doc: unknown, ref: unknown): unknown',
    'export declare function useQueryLoader(doc: unknown): [unknown, (variables: unknown) => void]',
    'export declare function usePreloadedQuery(doc: unknown, ref: unknown): unknown',
  ),
  ...stub('relay-runtime', 'export type FragmentRefs<T extends string> = { [K in T]: true }'),
  ...stub('next/navigation', 'export declare function useRouter(): { push(href: string): void }'),

  'src/lib/apollo.ts': lines(
    `import { ApolloClient, InMemoryCache } from '@apollo/client'`,
    `import { BatchHttpLink } from '@apollo/client/link/batch-http'`,
    `const link = new BatchHttpLink({ uri: '/api/graphql' })`,
    `export const client = new ApolloClient({ link, cache: new InMemoryCache() })`,
  ),
  'src/lib/urql.ts': lines(
    `import { cacheExchange, createClient, fetchExchange } from 'urql'`,
    `export const urqlClient = createClient({ url: '/urql', exchanges: [cacheExchange, fetchExchange] })`,
  ),
  // Codegen's client preset: `graphql()` returns a typed document.
  'src/gql/gql.ts': lines(
    `export interface TypedDocumentNode<R, V> { __apiType?: (variables: V) => R }`,
    `export type TodoRowFragment = { id: string; title: string } & { ' $fragmentName'?: 'TodoRowFragment' }`,
    `export type CodegenTodosQuery = { todos: Array<{ id: string } & { ' $fragmentRefs'?: { TodoRowFragment: TodoRowFragment } }> }`,
    `export function graphql(source: '\\n  query CodegenTodos($status: TodoStatus) { todos(status: $status) { id ...TodoRow } }\\n'): TypedDocumentNode<CodegenTodosQuery, { status?: 'OPEN' | 'DONE' | null }>`,
    `export function graphql(source: string): unknown`,
    `export function graphql(source: string): unknown { return source }`,
  ),
  'src/viewer.graphql': lines('query ViewerFromFile {', '  viewer { id name }', '}'),
  'src/graphql.d.ts': lines(
    `declare module '*.graphql' { const doc: unknown; export default doc; export const ViewerFromFile: unknown }`,
  ),

  // Apollo with gql tags.
  'src/app/page.tsx': lines(
    `import { TodoList } from '@/components/TodoList'`,
    `import { CodegenTodos } from '@/components/CodegenTodos'`,
    `import { UrqlTodos } from '@/components/UrqlTodos'`,
    `import { RelayTodos } from '@/components/RelayTodos'`,
    `import '@/lib/apollo'`,
    `import '@/lib/urql'`,
    `export default function Page() { return <><TodoList /><CodegenTodos /><UrqlTodos /><RelayTodos /></> }`,
  ),
  'src/components/fragments.ts': lines(
    `import { gql } from '@apollo/client'`,
    'export const TODO_FIELDS = gql`fragment TodoFields on Todo { id title }`',
    'export const TODOS = gql`',
    '  query Todos { todos { ...TodoFields } }',
    `  \${TODO_FIELDS}`,
    '`',
  ),
  'src/components/TodoList.tsx': lines(
    `'use client'`,
    `import { gql } from '@apollo/client'`,
    `import { useApolloClient, useFragment, useLazyQuery, useMutation, useQuery } from '@apollo/client/react'`,
    `import { useRouter } from 'next/navigation'`,
    `import { ViewerFromFile } from '../viewer.graphql'`,
    `import { TODO_FIELDS, TODOS } from './fragments'`,
    `interface TodosData { todos: { id: string; title: string }[] }`,
    'const SEARCH = gql`query Search($text: String!) { search(text: $text) { __typename ... on Todo { id title } ... on User { id name } } }`',
    'const ADD = gql`mutation AddTodo($input: AddTodoInput!) { addTodo(input: $input) { id } }`',
    `export function TodoList() {`,
    `  const router = useRouter()`,
    `  const { data } = useQuery<TodosData>(TODOS)`,
    `  useQuery(ViewerFromFile)`,
    `  const [search] = useLazyQuery(SEARCH)`,
    `  const [add] = useMutation(ADD, { refetchQueries: ['Todos'], onCompleted: () => router.push('/done') })`,
    `  const client = useApolloClient()`,
    `  useFragment({ fragment: TODO_FIELDS, from: data })`,
    `  return (`,
    `    <form onSubmit={() => { search({ variables: { text: 'x' } }); add({ variables: { input: { title: 'x' } } }) }}>`,
    `      <button type="button" onClick={() => client.refetchQueries({ include: ['Todos'] })}>Refresh</button>`,
    `    </form>`,
    `  )`,
    `}`,
  ),
  'src/components/CodegenTodos.tsx': lines(
    `'use client'`,
    `import { useQuery } from '@apollo/client/react'`,
    `import { graphql } from '@/gql/gql'`,
    'const CodegenTodosDoc = graphql(`\n  query CodegenTodos($status: TodoStatus) { todos(status: $status) { id ...TodoRow } }\n`)',
    'graphql(`fragment TodoRow on Todo { id title }`)',
    `export function CodegenTodos() {`,
    `  useQuery(CodegenTodosDoc, { variables: { status: 'OPEN' } })`,
    `  return null`,
    `}`,
  ),
  // urql: no types in the code, so they come from schema.graphql.
  'src/components/UrqlTodos.tsx': lines(
    `'use client'`,
    `import { gql, useMutation, useQuery } from 'urql'`,
    'const Q = gql`query UrqlTodos($status: TodoStatus) { todos(status: $status) { id title owner { name } } }`',
    'const M = gql`mutation UrqlAdd($input: AddTodoInput!) { addTodo(input: $input) { id } }`',
    `export function UrqlTodos() {`,
    `  useQuery({ query: Q, variables: { status: 'OPEN' } })`,
    `  const [, addTodo] = useMutation(M)`,
    `  return <button onClick={() => addTodo({ input: { title: 'x' } })}>Add</button>`,
    `}`,
  ),
  // Relay, with masked fragment data in the generated types.
  'src/components/RelayTodos.tsx': lines(
    `'use client'`,
    `import { graphql, useFragment, useLazyLoadQuery, useQueryLoader, usePreloadedQuery } from 'react-relay'`,
    `import type { RelayTodosQuery } from '@/__generated__/RelayTodosQuery.graphql'`,
    'const UsersQuery = graphql`query RelayUsersQuery { viewer { id name } }`',
    `export function RelayTodos() {`,
    '  const data = useLazyLoadQuery<RelayTodosQuery>(graphql`query RelayTodosQuery { todos { id ...RelayTodoItem_todo } }`, {})',
    `  const [ref, load] = useQueryLoader(UsersQuery)`,
    `  usePreloadedQuery(UsersQuery, ref)`,
    `  return <button onClick={() => load({})}><RelayTodoItem todo={data.todos[0]} /></button>`,
    `}`,
    `export function RelayTodoItem({ todo }: { todo: unknown }) {`,
    '  useFragment(graphql`fragment RelayTodoItem_todo on Todo { title done }`, todo)',
    `  return null`,
    `}`,
  ),
  'src/__generated__/RelayTodosQuery.graphql.ts': lines(
    `import type { FragmentRefs } from 'relay-runtime'`,
    `export type RelayTodosQuery$variables = Record<PropertyKey, never>`,
    `export type RelayTodosQuery$data = { readonly todos: ReadonlyArray<{ readonly id: string; readonly " $fragmentSpreads": FragmentRefs<"RelayTodoItem_todo"> }> }`,
    `export type RelayTodosQuery = { response: RelayTodosQuery$data; variables: RelayTodosQuery$variables }`,
  ),
  'src/__generated__/RelayTodoItem_todo.graphql.ts': lines(
    `import type { FragmentRefs } from 'relay-runtime'`,
    `export type RelayTodoItem_todo$data = { readonly title: string; readonly done: boolean; readonly " $fragmentType": "RelayTodoItem_todo" }`,
  ),
}

let model: AppModel
const sites = () => model.requests.filter((s) => s.transport === 'graphql')
const site = (name: string): RequestSite => {
  const found = sites().find((s) => s.operation?.name === name)
  if (!found)
    throw new Error(
      `no site for ${name}: ${sites()
        .map((s) => s.operation?.name)
        .join(', ')}`,
    )
  return found
}
const op = (name: string) => {
  const found = model.graphql?.operations.find((o) => o.name === name)
  if (!found) throw new Error(`no operation ${name}`)
  return found
}

beforeAll(() => {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries(FILES)) fs.writeFileSync(`/app/${path}`, text)
  model = scanProject({ root: '/app', fileSystem: fs })
}, 60_000)

describe('GraphQL scan', () => {
  it('produces a valid model', () => {
    expect(() => AppModelSchema.parse(model)).not.toThrow()
  })

  it('finds the clients and the endpoint', () => {
    expect(model.graphql?.clients.map((c) => [c.library, c.endpoint?.path, c.batching ?? false])).toEqual([
      ['apollo', '/api/graphql', true],
      ['urql', '/urql', false],
    ])
    expect(model.graphql?.endpoint?.path).toBe('/api/graphql')
  })

  it('reads documents from tags, codegen calls and .graphql files', () => {
    const names = model.graphql?.operations.map((o) => `${o.name}:${o.type}:${o.source}`).sort()
    expect(names).toEqual([
      'AddTodo:mutation:tag',
      'CodegenTodos:query:codegen',
      'RelayTodosQuery:query:tag',
      'RelayUsersQuery:query:tag',
      'Search:query:tag',
      'Todos:query:tag',
      'UrqlAdd:mutation:tag',
      'UrqlTodos:query:tag',
      'ViewerFromFile:query:file',
    ])
    expect(op('Todos').fragments).toEqual(['TodoFields'])
    expect(op('ViewerFromFile').loc).toMatchObject({ file: 'src/viewer.graphql', line: 1 })
  })

  it('creates a site per operation call, with URL, method and trigger', () => {
    const summary = sites()
      .map(
        (s) =>
          `${s.operation?.name} ${s.method} ${s.url?.path ?? '?'} ${s.trigger.kind}${s.trigger.event ? `:${s.trigger.event}` : ''}`,
      )
      .sort()
    expect(summary).toEqual([
      'AddTodo POST /api/graphql event:onSubmit',
      'CodegenTodos POST /api/graphql page-load',
      'RelayTodosQuery POST /api/graphql page-load',
      'RelayUsersQuery POST /api/graphql event:onClick',
      'Search POST /api/graphql event:onSubmit',
      'Todos POST /api/graphql page-load',
      'UrqlAdd POST /urql event:onClick',
      // urql sends queries as GET by default.
      'UrqlTodos GET /urql page-load',
      'ViewerFromFile POST /api/graphql page-load',
    ])
  })

  it('takes types from type arguments, codegen, Relay and the schema, in that order', () => {
    expect(site('Todos').responseType?.text).toBe('TodosData')
    expect(op('Todos').typesFrom).toBe('code')
    expect(op('CodegenTodos').typesFrom).toBe('codegen')
    expect(op('RelayTodosQuery').typesFrom).toBe('relay')
    expect(op('UrqlTodos').typesFrom).toBe('schema')
    expect(site('UrqlTodos').responseType?.text).toBe('UrqlTodosQuery')
    expect(
      formatTypeShape(site('UrqlTodos').responseType?.shape ?? { kind: 'primitive', name: 'never' }),
    ).toBe('{ todos: { id: string; title: string; owner: { name: string } }[] }')
    expect(formatTypeShape(site('UrqlTodos').bodyType?.shape ?? { kind: 'primitive', name: 'never' })).toBe(
      '{ status?: "OPEN" | "DONE" | null }',
    )
  })

  it('merges masked fragment data back into generated types', () => {
    const codegen = formatTypeShape(
      op('CodegenTodos').resultType?.shape ?? { kind: 'primitive', name: 'never' },
    )
    expect(codegen).toContain('title: string')
    expect(codegen).not.toContain('$fragment')
    const relay = formatTypeShape(
      op('RelayTodosQuery').resultType?.shape ?? { kind: 'primitive', name: 'never' },
    )
    expect(relay).toContain('title: string')
    expect(relay).toContain('done: boolean')
    expect(relay).not.toContain('$fragment')
  })

  it('works out union results from the schema', () => {
    const search = formatTypeShape(op('Search').resultType?.shape ?? { kind: 'primitive', name: 'never' })
    expect(search).toBe(
      '{ search: ({ __typename: "Todo"; id: string; title: string } | { __typename: "User"; id: string; name: string })[] }',
    )
  })

  it('records useFragment as a data dependency of the component', () => {
    const fragments = Object.fromEntries(
      (model.graphql?.fragments ?? []).map((f) => [f.name, f.componentIds.length]),
    )
    expect(fragments).toEqual({ RelayTodoItem_todo: 1, TodoFields: 1, TodoRow: 0 })
  })

  it('links refetchQueries and client.refetchQueries to the queries by operation name', () => {
    const links = model.queryLinks.filter((l) => l.operation)
    expect(links.map((l) => [l.operation, l.trigger.kind, l.fromSiteIds.length, l.targetSiteIds])).toEqual([
      ['Todos', 'event', 1, [site('Todos').id]],
      ['Todos', 'event', 0, [site('Todos').id]],
    ])
  })

  it('maps persisted query ids from the manifest', () => {
    expect(op('RelayUsersQuery').hashes).toContain('abc123')
    expect(model.graphql?.manifest).toEqual({ path: 'persisted_queries.json', operations: 1 })
    expect(op('Todos').hashes.length).toBeGreaterThan(0)
  })

  it('follows mutation callbacks to the navigation after them', () => {
    const nav = model.navigations.find((n) => n.href.path === '/done')
    expect(nav?.outcome).toBe('success')
    expect(nav?.trigger.kind).toBe('event')
  })
})
