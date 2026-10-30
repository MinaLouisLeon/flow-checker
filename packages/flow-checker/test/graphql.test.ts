// M17: live GraphQL introspection (fetched by scan, cached, used for types) and the doctor check.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { AppModel } from '@flow-checker/shared'
import { buildSchema, graphql } from 'graphql'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { runDoctor } from '../src/cli/doctor'
import { INTROSPECTION_CACHE } from '../src/cli/graphql'
import { type CliIO, runCli } from '../src/cli/run'

function capture() {
  const out: string[] = []
  const err: string[] = []
  const io: CliIO = { out: (t) => out.push(t), err: (t) => err.push(t) }
  return { io, out, err }
}

const schema = buildSchema('type Query { todos: [Todo!]! } type Todo { id: ID! title: String! }')
let server: Server
let url: string
let seenAuth: string | undefined

beforeAll(async () => {
  server = createServer((req, res) => {
    seenAuth = req.headers.authorization
    let body = ''
    req.on('data', (c) => {
      body += c
    })
    req.on('end', async () => {
      const { query } = JSON.parse(body) as { query: string }
      const result = await graphql({ schema, source: query })
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(result))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/graphql`
})
afterAll(() => {
  server.close()
})

const PAGE = [
  `'use client'`,
  `import { gql, useQuery } from '@apollo/client/react'`,
  'const TODOS = gql`query Todos { todos { id title } }`',
  'export default function Home() {',
  '  useQuery(TODOS)',
  '  return null',
  '}',
].join('\n')

describe('graphql introspection', () => {
  const dirs: string[] = []
  const project = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-checker-graphql-'))
    dirs.push(dir)
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true })
      writeFileSync(join(dir, path), text)
    }
    return dir
  }
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  const files = (config: string) => ({
    'package.json': JSON.stringify({ dependencies: { next: '16.0.0' } }),
    'app/page.tsx': PAGE,
    'node_modules/@apollo/client/package.json': JSON.stringify({
      name: '@apollo/client',
      types: 'index.d.ts',
    }),
    'node_modules/@apollo/client/react/index.d.ts': [
      'export declare function gql(l: TemplateStringsArray): unknown',
      'export declare function useQuery(doc: unknown): unknown',
    ].join('\n'),
    'flow-checker.config.mjs': config,
  })

  it('scan types operations from the live schema and caches it', async () => {
    process.env.FC_TEST_GQL_TOKEN = 'secret'
    const root = project(
      files(
        `export default { graphql: { introspection: { url: '${url}', headers: { Authorization: 'env:FC_TEST_GQL_TOKEN' } } } }`,
      ),
    )
    const { io } = capture()
    expect(await runCli(['scan', '--root', root, '--quiet'], io)).toBe(0)
    expect(seenAuth).toBe('secret')
    expect(existsSync(join(root, INTROSPECTION_CACHE))).toBe(true)
    const model = JSON.parse(readFileSync(join(root, '.flow-checker/model.json'), 'utf8')) as AppModel
    expect(model.graphql?.schema).toMatchObject({ source: 'introspection', url, types: 2 })
    const op = model.graphql?.operations[0]
    expect(op?.typesFrom).toBe('introspection')
    expect(model.requests[0]?.responseType?.text).toBe('TodosQuery')
  })

  it('falls back to the cache when the endpoint is down', async () => {
    const root = project(
      files(`export default { graphql: { introspection: { url: 'http://127.0.0.1:1/graphql' } } }`),
    )
    const result = await graphql({ schema, source: (await import('graphql')).getIntrospectionQuery() })
    mkdirSync(join(root, '.flow-checker/cache'), { recursive: true })
    writeFileSync(
      join(root, INTROSPECTION_CACHE),
      JSON.stringify({
        url: 'http://127.0.0.1:1/graphql',
        fetchedAt: '2026-10-30T00:00:00.000Z',
        result: result.data,
      }),
    )
    const { io, err } = capture()
    expect(await runCli(['scan', '--root', root, '--quiet'], io)).toBe(0)
    expect(err.join('\n')).toContain('GraphQL introspection failed')
    expect(err.join('\n')).toContain('Using the schema fetched 2026-10-30')
    const model = JSON.parse(readFileSync(join(root, '.flow-checker/model.json'), 'utf8')) as AppModel
    expect(model.graphql?.operations[0]?.typesFrom).toBe('introspection')
  })

  it('doctor reports a missing schema file and unset header variables', async () => {
    const missing = project(files(`export default { graphql: { schema: 'nope.graphql' } }`))
    const checks = await runDoctor({ root: missing })
    expect(checks.find((c) => c.name === 'GraphQL')).toMatchObject({ status: 'fail' })
    const headers = project(
      files(
        `export default { graphql: { introspection: { url: '${url}', headers: { Authorization: 'env:FC_TEST_UNSET_VAR' } } } }`,
      ),
    )
    const check = (await runDoctor({ root: headers })).find((c) => c.name === 'GraphQL')
    expect(check).toMatchObject({ status: 'warn' })
    expect(check?.message).toContain('FC_TEST_UNSET_VAR')
  })
}, 60_000)
