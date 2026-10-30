// GraphQL (M17): what the scan reads before walking components. The documents in the project,
// the clients and the endpoint they send to, the schema (file, else a live introspection the CLI
// fetched), a persisted query manifest and the Relay compiler's generated files.
import { posix } from 'node:path'
import {
  type GraphqlClient,
  type GraphqlInfo,
  type RequestUrl,
  type Route,
  routePathRegex,
} from '@flow-checker/shared'
import type { FileSystemHost, Project, SourceFile } from 'ts-morph'
import { findClients, GraphqlCatalog, parseDefinitions, readManifest } from './graphql'
import { type GraphQLSchema, readSchema, schemaFromIntrospection, schemaTypeCount } from './graphql-schema'
import { relativeTo } from './paths'
import type { GraphqlState, RequestScanner } from './requests'

export interface GraphqlScanOptions {
  /** Schema file, relative to the root (config `graphql.schema`). Default: found from the Relay / codegen config. */
  schema?: string
  /** Persisted query manifest, relative to the root (config `graphql.persistedQueries`). */
  persistedQueries?: string
  /** Where operations are sent when the clients don't say (config `graphql.endpoint`). */
  endpoint?: string
  /** A live introspection result the CLI fetched (config `graphql.introspection`). */
  introspection?: { url: string; fetchedAt: string; result: unknown }
}

const DEFAULT_SCHEMAS = [
  'schema.graphql',
  'schema.gql',
  'src/schema.graphql',
  'graphql/schema.graphql',
  'schema.json',
  'graphql.schema.json',
]
const DEFAULT_MANIFESTS = [
  'persisted-documents.json',
  'persisted-query-manifest.json',
  'persisted_queries.json',
  'src/gql/persisted-documents.json',
]
const CODEGEN_CONFIGS = [
  'codegen.ts',
  'codegen.mts',
  'codegen.js',
  'codegen.yml',
  'codegen.yaml',
  'codegen.json',
  '.graphqlrc.yml',
  '.graphqlrc.yaml',
  '.graphqlrc.json',
  'graphql.config.ts',
  'graphql.config.js',
  'graphql.config.yml',
]
const RELAY_CONFIGS = ['relay.config.json', 'relay.config.js', 'relay.config.cjs', 'relay.config.mjs']

export interface GraphqlFound {
  state: GraphqlState
  base: Omit<GraphqlInfo, 'operations' | 'fragments' | 'clients'>
}

export function findGraphql(
  project: Project,
  root: string,
  fs: FileSystemHost,
  handlers: Route[],
  scanned: (file: string) => boolean,
  requests: RequestScanner,
  options: GraphqlScanOptions = {},
): GraphqlFound {
  const files = project
    .getSourceFiles()
    .filter((f) => !f.isInNodeModules() && !f.isDeclarationFile() && scanned(f.getFilePath()))
  const catalog = new GraphqlCatalog(root, fs)
  for (const file of files) catalog.addFile(file)

  const clients: GraphqlClient[] = findClients(files).map((c) => {
    const file = c.node.getSourceFile()
    const { line, column } = file.getLineAndColumnAtPos(c.node.getStart())
    const endpoint = c.url ? requests.urlOf(c.url) : undefined
    return {
      library: c.library,
      loc: { file: relativeTo(root, file.getFilePath()), line, column },
      ...(endpoint && endpoint.confidence !== 'unknown' ? { endpoint } : {}),
      ...(c.batching ? { batching: true } : {}),
      ...(c.persisted ? { persisted: true } : {}),
      ...(c.getForQueries ? { getForQueries: true } : {}),
    }
  })

  const handler = handlers.find((r) => /\/graphql$/i.test(r.path))
  const endpoint: RequestUrl | undefined = options.endpoint
    ? urlFromText(options.endpoint)
    : (clients.find((c) => c.endpoint)?.endpoint ??
      (handler ? { text: handler.path, confidence: 'exact', path: handler.path } : undefined))
  const routeId =
    endpoint?.path && !endpoint.base
      ? handlers.find((r) => routePathRegex(r.path).test(endpoint.path as string))?.id
      : undefined

  const relay = readRelayConfig(fs, root)
  const schema = loadSchema(fs, root, options, relay?.schema)
  const manifest = loadManifest(fs, root, options.persistedQueries ?? relay?.persisted)

  // Relay writes `<Name>.graphql.ts` to the artifact directory, or `__generated__` next to the source.
  const artifactDirs = new Set<string>()
  if (relay?.artifactDirectory) artifactDirs.add(posix.join(root, relay.artifactDirectory))
  for (const op of catalog.operations.values()) {
    if (op.doc.relay) artifactDirs.add(posix.join(root, posix.dirname(op.doc.loc.file), '__generated__'))
  }
  for (const frag of catalog.fragments.values()) {
    if (frag.doc.relay) artifactDirs.add(posix.join(root, posix.dirname(frag.doc.loc.file), '__generated__'))
  }
  const artifacts = new Map<string, SourceFile | null>()
  const relayArtifact = (name: string): SourceFile | undefined => {
    const cached = artifacts.get(name)
    if (cached !== undefined) return cached ?? undefined
    let found: SourceFile | undefined
    for (const dir of artifactDirs) {
      const path = `${dir}/${name}.graphql.ts`
      found =
        project.getSourceFile(path) ??
        (fs.fileExistsSync(path) ? project.addSourceFileAtPath(path) : undefined)
      if (found) break
    }
    artifacts.set(name, found ?? null)
    return found
  }

  const state: GraphqlState = {
    catalog,
    ...(endpoint ? { endpoint } : {}),
    clients,
    ...(schema.schema ? { schema: { schema: schema.schema, from: schema.from } } : {}),
    ...(artifactDirs.size > 0 ? { relayArtifact } : {}),
    ...(manifest ? { manifest: manifest.byName } : {}),
  }
  return {
    state,
    base: {
      ...(endpoint ? { endpoint } : {}),
      ...(routeId ? { routeId } : {}),
      ...(schema.info ? { schema: schema.info } : {}),
      ...(manifest ? { manifest: manifest.info } : {}),
    },
  }
}

/** `/api/graphql` or `https://api.example.com/graphql`. */
function urlFromText(text: string): RequestUrl {
  const origin = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i.exec(text)
  if (!origin) return { text, confidence: 'exact', path: text.startsWith('/') ? text : `/${text}` }
  return { text, confidence: 'exact', base: origin[0], path: text.slice(origin[0].length) || '/' }
}

interface RelayConfig {
  schema?: string
  artifactDirectory?: string
  persisted?: string
}

/** `relay.config.json` (or `.js`, read loosely): schema, artifact directory and persisted query file. */
function readRelayConfig(fs: FileSystemHost, root: string): RelayConfig | undefined {
  for (const name of RELAY_CONFIGS) {
    const path = `${root}/${name}`
    if (!fs.fileExistsSync(path)) continue
    const text = fs.readFileSync(path)
    if (name.endsWith('.json')) {
      try {
        const json = JSON.parse(text) as {
          schema?: string
          artifactDirectory?: string
          persistConfig?: { file?: string }
        }
        return {
          ...(json.schema ? { schema: json.schema } : {}),
          ...(json.artifactDirectory ? { artifactDirectory: json.artifactDirectory } : {}),
          ...(json.persistConfig?.file ? { persisted: json.persistConfig.file } : {}),
        }
      } catch {
        return undefined
      }
    }
    const read = (key: string) => new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`).exec(text)?.[1]
    const schema = read('schema')
    const artifactDirectory = read('artifactDirectory')
    const persisted = /persistConfig\s*:\s*\{[^}]*file\s*:\s*['"]([^'"]+)['"]/.exec(text)?.[1]
    return {
      ...(schema ? { schema } : {}),
      ...(artifactDirectory ? { artifactDirectory } : {}),
      ...(persisted ? { persisted } : {}),
    }
  }
  return undefined
}

/** A local schema path from the codegen config (`schema: 'schema.graphql'`), not a URL. */
function codegenSchema(fs: FileSystemHost, root: string): string | undefined {
  for (const name of CODEGEN_CONFIGS) {
    const path = `${root}/${name}`
    if (!fs.fileExistsSync(path)) continue
    const text = fs.readFileSync(path)
    const match = /["']?schema["']?\s*:\s*["']([^"']+)["']/.exec(text)
    if (match?.[1] && !/^https?:/.test(match[1]) && !/[*{]/.test(match[1])) return match[1]
  }
  return undefined
}

interface SchemaLoaded {
  schema?: GraphQLSchema
  from: 'schema' | 'introspection'
  info?: GraphqlInfo['schema']
}

function loadSchema(
  fs: FileSystemHost,
  root: string,
  options: GraphqlScanOptions,
  relaySchema: string | undefined,
): SchemaLoaded {
  const given = options.schema ?? relaySchema ?? codegenSchema(fs, root)
  const candidates = given ? [given] : DEFAULT_SCHEMAS
  for (const rel of candidates) {
    const path = posix.join(root, rel)
    const relPath = relativeTo(root, path)
    if (!fs.fileExistsSync(path)) {
      if (options.schema) {
        return { from: 'schema', info: { source: 'file', path: relPath, types: 0, error: 'File not found.' } }
      }
      continue
    }
    try {
      const schema = readSchema(fs.readFileSync(path))
      return {
        schema,
        from: 'schema',
        info: { source: 'file', path: relPath, types: schemaTypeCount(schema) },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        from: 'schema',
        info: { source: 'file', path: relPath, types: 0, error: message.split('\n')[0] },
      }
    }
  }
  const live = options.introspection
  if (live) {
    try {
      const schema = schemaFromIntrospection(live.result)
      return {
        schema,
        from: 'introspection',
        info: {
          source: 'introspection',
          url: live.url,
          fetchedAt: live.fetchedAt,
          types: schemaTypeCount(schema),
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        from: 'introspection',
        info: { source: 'introspection', url: live.url, fetchedAt: live.fetchedAt, types: 0, error: message },
      }
    }
  }
  return { from: 'schema' }
}

function loadManifest(
  fs: FileSystemHost,
  root: string,
  given: string | undefined,
): { byName: Map<string, string[]>; info: NonNullable<GraphqlInfo['manifest']> } | undefined {
  for (const rel of given ? [given] : DEFAULT_MANIFESTS) {
    const path = posix.join(root, rel)
    if (!fs.fileExistsSync(path)) continue
    try {
      const entries = readManifest(fs.readFileSync(path))
      const byName = new Map<string, string[]>()
      for (const [id, text] of entries) {
        const op = parseDefinitions(text)?.find((d) => d.kind === 'operation')
        if (!op?.name) continue
        byName.set(op.name, [...(byName.get(op.name) ?? []), id])
      }
      return { byName, info: { path: relativeTo(root, path), operations: entries.size } }
    } catch {
      return undefined
    }
  }
  return undefined
}
