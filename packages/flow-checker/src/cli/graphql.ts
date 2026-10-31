// GraphQL (M17): the options every scan gets from the config, live introspection (fetched on
// `dev` and `scan`, cached in `.flow-checker/cache/`), and the doctor check.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { type GraphqlScanOptions, readGraphqlSchema } from '@flow-checker/scanner'
import type { FlowCheckerConfig, GraphqlConfig } from '@flow-checker/shared'
import { getIntrospectionQuery } from 'graphql'
import type { Check } from './doctor'
import type { Progress } from './progress'
import type { CliIO } from './run'

export const INTROSPECTION_CACHE = '.flow-checker/cache/graphql-introspection.json'
const TIMEOUT_MS = 10_000

interface Cached {
  url: string
  fetchedAt: string
  result: unknown
}

/** `env:NAME` header values, read from the environment. Missing variables are listed. */
export function introspectionHeaders(config: GraphqlConfig['introspection']): {
  headers: Record<string, string>
  missing: string[]
} {
  const headers: Record<string, string> = {}
  const missing: string[] = []
  for (const [name, value] of Object.entries(config?.headers ?? {})) {
    const env = /^env:(.+)$/.exec(value)?.[1]
    if (!env) headers[name] = value
    else if (process.env[env] !== undefined) headers[name] = process.env[env] as string
    else missing.push(env)
  }
  return { headers, missing }
}

/** Asks the endpoint for its schema. Throws with a short message when it can't. */
export async function fetchIntrospection(
  config: NonNullable<GraphqlConfig['introspection']>,
): Promise<unknown> {
  const { headers } = introspectionHeaders(config)
  const res = await fetch(config.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify({ query: getIntrospectionQuery(), operationName: 'IntrospectionQuery' }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`${config.url} answered ${res.status}`)
  const json = (await res.json()) as { data?: { __schema?: unknown }; errors?: { message?: string }[] }
  if (!json.data?.__schema) {
    throw new Error(
      json.errors?.[0]?.message ?? `${config.url} sent no schema (is introspection turned off?)`,
    )
  }
  return json.data
}

function readCached(root: string): Cached | undefined {
  try {
    return JSON.parse(readFileSync(join(root, INTROSPECTION_CACHE), 'utf8')) as Cached
  } catch {
    return undefined
  }
}

/**
 * The `graphql` scan options: the config's, plus a live introspection result when one is
 * configured. `refresh`: ask the endpoint now (else the cache). A failed request falls back to
 * the cache with a warning.
 */
export async function graphqlForScan(
  root: string,
  config: FlowCheckerConfig,
  io: CliIO,
  progress: Progress | undefined,
  { refresh = false, save = true }: { refresh?: boolean; save?: boolean } = {},
): Promise<GraphqlScanOptions | undefined> {
  const graphql = config.graphql
  if (!graphql) return undefined
  const { introspection, ...rest } = graphql
  const options: GraphqlScanOptions = { ...rest }
  if (!introspection) return options
  let cached = readCached(root)
  if (cached && cached.url !== introspection.url) cached = undefined
  // A schema file wins over introspection, so there is no need to ask.
  const schemaFile = graphql.schema && existsSync(resolve(root, graphql.schema))
  if (refresh && !schemaFile) {
    try {
      const result = await fetchIntrospection(introspection)
      cached = { url: introspection.url, fetchedAt: new Date().toISOString(), result }
      if (save) {
        const file = join(root, INTROSPECTION_CACHE)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, `${JSON.stringify(cached)}\n`)
      }
      progress?.detail(`graphql: schema from ${introspection.url}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      io.err(
        `Warning: GraphQL introspection failed (${message}).${
          cached ? ` Using the schema fetched ${cached.fetchedAt}.` : ''
        }`,
      )
    }
  }
  return cached ? { ...options, introspection: cached } : options
}

/** Doctor: the schema file and introspection settings. `undefined` without a `graphql` config. */
export function checkGraphql(root: string, config: FlowCheckerConfig): Check | undefined {
  const graphql = config.graphql
  if (!graphql) return undefined
  if (graphql.schema) {
    const file = resolve(root, graphql.schema)
    if (!existsSync(file)) {
      return {
        name: 'GraphQL',
        status: 'fail',
        message: `graphql.schema ${graphql.schema} was not found`,
        hint: 'Point graphql.schema at an SDL file (.graphql) or an introspection result (.json).',
      }
    }
    try {
      readGraphqlSchema(readFileSync(file, 'utf8'))
    } catch (error) {
      return {
        name: 'GraphQL',
        status: 'fail',
        message: `${graphql.schema} could not be read: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`,
      }
    }
    return { name: 'GraphQL', status: 'ok', message: `schema from ${graphql.schema}` }
  }
  const introspection = graphql.introspection
  if (!introspection) return { name: 'GraphQL', status: 'ok', message: 'schema found from the project setup' }
  const { missing } = introspectionHeaders(introspection)
  const cached = readCached(root)
  if (missing.length > 0) {
    return {
      name: 'GraphQL',
      status: 'warn',
      message: `introspection header variable ${missing.join(', ')} is not set`,
      hint: `Set ${missing.join(', ')} before "flow-checker dev", or add graphql.schema.`,
    }
  }
  return {
    name: 'GraphQL',
    status: 'ok',
    message: `introspection of ${introspection.url}${cached ? ` (cached ${cached.fetchedAt})` : ', fetched on dev and scan'}`,
  }
}
