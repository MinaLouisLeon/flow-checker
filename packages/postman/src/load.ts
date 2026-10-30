// Reads a Postman collection and environment from any supported source into the normalized
// import (imported.ts): a v2.1 JSON export, a git-native v3 YAML folder, or Postman's cloud API.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { resolveCaptureOptions } from '@flow-checker/runtime/options'
import { compileRules, createRedactor, type RedactRules } from '@flow-checker/runtime/redact'
import {
  HTTP_METHODS,
  type HttpMethod,
  type PostmanCloudSource,
  type PostmanConfig,
  type PostmanSource,
} from '@flow-checker/shared'
import { parse as parseYaml } from 'yaml'
import {
  IMPORT_VERSION,
  type ImportedRequest,
  type JsonBody,
  type PostmanImport,
  type Variable,
} from './imported'

/** A problem with the collection or environment, with a message for the user. */
export class PostmanError extends Error {
  override name = 'PostmanError'
}

export const DEFAULT_API_KEY_ENV = 'POSTMAN_API_KEY'
export const POSTMAN_API = 'https://api.getpostman.com'

export interface ImportOptions {
  /** Absolute project root; paths in the config are relative to it. */
  root: string
  config: PostmanConfig
  /** Redaction rules for example bodies and variables. Default: the capture defaults. */
  redact?: RedactRules
  /** Where the API key is read from. Default: `process.env`. */
  env?: Record<string, string | undefined>
  /** For the cloud API (tests). Default: global `fetch`. */
  fetch?: typeof fetch
  /** Postman API base URL (tests). */
  apiBase?: string
  now?: Date
}

/** Raw request before redaction and variable filtering. */
interface RawRequest {
  name: string
  folder: string[]
  method: HttpMethod
  url: string
  variables?: Variable[]
  body?: string
  examples: { name: string; status?: number; body?: string }[]
}

interface RawCollection {
  name: string
  variables: Variable[]
  requests: RawRequest[]
}

interface RawEnvironment {
  name: string
  values: Variable[]
}

/** Reads the configured collection (and environment) and normalizes it. */
export async function importPostman(options: ImportOptions): Promise<PostmanImport> {
  const { config } = options
  if (!config?.collection) throw new PostmanError('postman.collection is not set.')
  const [collection, collectionSource] = await readCollection(config.collection, options)
  const environment = config.environment ? await readEnvironment(config.environment, options) : undefined
  const rules = options.redact ?? compileRules(resolveCaptureOptions(undefined).redact)
  return normalize(collection, collectionSource, environment, rules, options.now ?? new Date())
}

/** `importPostman` for local files only (no network), without waiting. */
export function importLocalPostman(options: ImportOptions): PostmanImport {
  const { config } = options
  if (!config?.collection) throw new PostmanError('postman.collection is not set.')
  if (
    typeof config.collection !== 'string' ||
    (config.environment && typeof config.environment !== 'string')
  ) {
    throw new PostmanError('A cloud collection or environment needs "flow-checker postman import".')
  }
  const collection = localCollection(config.collection, options.root)
  const environment = config.environment ? localEnvironment(config.environment, options.root) : undefined
  const rules = options.redact ?? compileRules(resolveCaptureOptions(undefined).redact)
  return normalize(collection[0], collection[1], environment, rules, options.now ?? new Date())
}

async function readCollection(
  source: string | PostmanCloudSource,
  options: ImportOptions,
): Promise<[RawCollection, PostmanSource]> {
  if (typeof source !== 'string') {
    const json = await cloud(`collections/${encodeURIComponent(source.id)}`, source, options, 'collection')
    return [fromV21(json, `cloud collection ${source.id}`), { kind: 'cloud', id: source.id }]
  }
  return localCollection(source, options.root)
}

function localCollection(source: string, root: string): [RawCollection, PostmanSource] {
  const path = resolve(root, source)
  const shown = projectPath(root, path)
  if (!existsSync(path)) throw new PostmanError(`Postman collection not found: ${shown}`)
  if (statSync(path).isDirectory()) return [fromV3Folder(path), { kind: 'folder', path: shown }]
  return [fromV21(readJson(path, shown), shown), { kind: 'file', path: shown }]
}

async function readEnvironment(
  source: string | PostmanCloudSource,
  options: ImportOptions,
): Promise<[RawEnvironment, PostmanSource]> {
  if (typeof source !== 'string') {
    const json = await cloud(`environments/${encodeURIComponent(source.id)}`, source, options, 'environment')
    return [environmentFrom(json, `cloud environment ${source.id}`), { kind: 'cloud', id: source.id }]
  }
  return localEnvironment(source, options.root)
}

function localEnvironment(source: string, root: string): [RawEnvironment, PostmanSource] {
  const path = resolve(root, source)
  const shown = projectPath(root, path)
  if (!existsSync(path) || statSync(path).isDirectory()) {
    throw new PostmanError(`Postman environment not found: ${shown}`)
  }
  const data = /\.ya?ml$/i.test(path) ? readYaml(path, shown) : readJson(path, shown)
  return [environmentFrom(data, shown), { kind: 'file', path: shown }]
}

// --- Cloud ------------------------------------------------------------------------------------

async function cloud(
  path: string,
  source: PostmanCloudSource,
  options: ImportOptions,
  what: string,
): Promise<unknown> {
  const envName = source.apiKeyEnv ?? DEFAULT_API_KEY_ENV
  const key = (options.env ?? process.env)[envName]
  if (!key) {
    throw new PostmanError(
      `The Postman ${what} ${source.id} is in the cloud and needs an API key in the ${envName} environment variable.`,
    )
  }
  const doFetch = options.fetch ?? fetch
  let response: Response
  try {
    response = await doFetch(`${options.apiBase ?? POSTMAN_API}/${path}`, {
      headers: { 'X-Api-Key': key, Accept: 'application/json' },
    })
  } catch (error) {
    throw new PostmanError(`Could not reach the Postman API: ${(error as Error).message}`)
  }
  if (response.status === 401 || response.status === 403) {
    throw new PostmanError(`The Postman API refused the key in ${envName} (${response.status}).`)
  }
  if (response.status === 404) throw new PostmanError(`Postman ${what} ${source.id} was not found.`)
  if (!response.ok)
    throw new PostmanError(`The Postman API answered ${response.status} for ${what} ${source.id}.`)
  try {
    return await response.json()
  } catch {
    throw new PostmanError(`The Postman API sent an invalid answer for ${what} ${source.id}.`)
  }
}

// --- v2.1 JSON --------------------------------------------------------------------------------

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/** A v2.0 / v2.1 collection, as exported or as the cloud API sends it (`{ collection }`). */
export function fromV21(data: unknown, shown: string): RawCollection {
  const c = isObject(data) && isObject(data.collection) ? data.collection : data
  if (!isObject(c) || !isObject(c.info) || !Array.isArray(c.item)) {
    throw new PostmanError(`${shown} is not a Postman collection (v2.1 JSON export or v3 YAML folder).`)
  }
  const schema = str(c.info.schema) ?? ''
  if (schema && !/v2\.[01]/.test(schema)) {
    throw new PostmanError(`${shown} uses an unsupported collection format (${schema}). Export it as v2.1.`)
  }
  const requests: RawRequest[] = []
  const walk = (items: unknown[], folder: string[], inherited: Variable[]) => {
    for (const item of items) {
      if (!isObject(item)) continue
      const name = str(item.name) ?? ''
      const variables = [...inherited, ...variablesOf(item.variable)]
      if (Array.isArray(item.item)) {
        walk(item.item, [...folder, name], variables)
        continue
      }
      const request = v21Request(item, name, folder, inherited)
      if (request) requests.push(request)
    }
  }
  walk(c.item, [], [])
  return { name: str(c.info.name) ?? 'Collection', variables: variablesOf(c.variable), requests }
}

function v21Request(
  item: Json,
  name: string,
  folder: string[],
  variables: Variable[],
): RawRequest | undefined {
  const request = typeof item.request === 'string' ? { url: item.request } : item.request
  if (!isObject(request)) return undefined
  const method = toMethod(str(request.method) ?? 'GET')
  const url = v21Url(request.url)
  if (!method || url === undefined) return undefined
  const body = isObject(request.body) && request.body.mode === 'raw' ? str(request.body.raw) : undefined
  const examples = (Array.isArray(item.response) ? item.response : []).filter(isObject).map((r) => ({
    name: str(r.name) ?? '',
    ...(typeof r.code === 'number' ? { status: r.code } : {}),
    ...(str(r.body) ? { body: str(r.body) } : {}),
  }))
  return {
    name,
    folder,
    method,
    url,
    ...(variables.length > 0 ? { variables } : {}),
    ...(body ? { body } : {}),
    examples,
  }
}

function v21Url(url: unknown): string | undefined {
  if (typeof url === 'string') return url
  if (!isObject(url)) return undefined
  if (typeof url.raw === 'string') return url.raw
  const host = Array.isArray(url.host) ? url.host.join('.') : (str(url.host) ?? '')
  const path = Array.isArray(url.path) ? url.path.map((p) => (isObject(p) ? str(p.value) : p)).join('/') : ''
  const protocol = str(url.protocol)
  const port = str(url.port)
  return `${protocol ? `${protocol}://` : ''}${host}${port ? `:${port}` : ''}/${path}`
}

function variablesOf(list: unknown): Variable[] {
  if (!Array.isArray(list)) return []
  const out: Variable[] = []
  for (const v of list) {
    if (!isObject(v) || v.disabled === true || v.enabled === false || v.type === 'secret') continue
    const key = str(v.key) ?? str(v.id)
    if (!key || v.value === undefined || v.value === null) continue
    out.push({ key, value: typeof v.value === 'string' ? v.value : String(v.value) })
  }
  return out
}

// --- v3 YAML folder ---------------------------------------------------------------------------

/** A git-native v3 collection: one folder, one file per request and per saved example. */
export function fromV3Folder(dir: string): RawCollection {
  const requests: RawRequest[] = []
  const root = definition(dir)
  const walk = (folderDir: string, folder: string[], inherited: Variable[]) => {
    const entries = readdirSync(folderDir, { withFileTypes: true })
    const items: { order: number; name: string; run: () => void }[] = []
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const path = join(folderDir, entry.name)
      if (entry.isDirectory()) {
        const def = definition(path)
        const name = def.name ?? entry.name
        items.push({
          order: def.order ?? Number.POSITIVE_INFINITY,
          name,
          run: () => walk(path, [...folder, name], [...inherited, ...def.variables]),
        })
      } else if (/\.request\.ya?ml$/i.test(entry.name)) {
        const doc = readYaml(path, entry.name)
        if (!isObject(doc) || doc.$kind !== 'http-request') continue
        const stem = entry.name.replace(/\.request\.ya?ml$/i, '')
        const name = str(doc.name) ?? stem
        items.push({
          order: typeof doc.order === 'number' ? doc.order : Number.POSITIVE_INFINITY,
          name,
          run: () => {
            const request = v3Request(doc, name, stem, folderDir, folder, inherited)
            if (request) requests.push(request)
          },
        })
      }
    }
    items.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    for (const item of items) item.run()
  }
  walk(dir, [], [])
  if (requests.length === 0) {
    throw new PostmanError(
      `No HTTP requests (*.request.yaml) found in the Postman collection folder ${basename(dir)}.`,
    )
  }
  return { name: root.name ?? basename(dir), variables: root.variables, requests }
}

function definition(dir: string): { name?: string; order?: number; variables: Variable[] } {
  const file = join(dir, '.resources', 'definition.yaml')
  if (!existsSync(file)) return { variables: [] }
  const doc = readYaml(file, file)
  if (!isObject(doc)) return { variables: [] }
  return {
    ...(str(doc.name) ? { name: str(doc.name) } : {}),
    ...(typeof doc.order === 'number' ? { order: doc.order } : {}),
    variables: variablesOf(doc.variables),
  }
}

function v3Request(
  doc: Json,
  name: string,
  stem: string,
  dir: string,
  folder: string[],
  variables: Variable[],
): RawRequest | undefined {
  const method = toMethod(str(doc.method) ?? 'GET')
  const url = str(doc.url)
  if (!method || url === undefined) return undefined
  const body =
    isObject(doc.body) && typeof doc.body.content === 'string' && doc.body.type !== 'none'
      ? doc.body.content
      : undefined
  const examplesDir = str(doc.examples)
    ? resolve(dir, str(doc.examples) as string)
    : join(dir, '.resources', `${stem}.resources`, 'examples')
  const examples: RawRequest['examples'] = []
  if (existsSync(examplesDir) && statSync(examplesDir).isDirectory()) {
    const files = readdirSync(examplesDir)
      .filter((f) => /\.example\.ya?ml$/i.test(f))
      .map((f) => ({ f, doc: readYaml(join(examplesDir, f), f) }))
      .filter((e): e is { f: string; doc: Json } => isObject(e.doc) && e.doc.$kind === 'http-example')
      .sort(
        (a, b) =>
          (typeof a.doc.order === 'number' ? a.doc.order : Number.POSITIVE_INFINITY) -
            (typeof b.doc.order === 'number' ? b.doc.order : Number.POSITIVE_INFINITY) ||
          a.f.localeCompare(b.f),
      )
    for (const { f, doc: example } of files) {
      const response = isObject(example.response) ? example.response : {}
      const content = isObject(response.body) ? str(response.body.content) : undefined
      examples.push({
        name: str(example.name) ?? f.replace(/\.example\.ya?ml$/i, ''),
        ...(typeof response.statusCode === 'number' ? { status: response.statusCode } : {}),
        ...(content ? { body: content } : {}),
      })
    }
  }
  return {
    name,
    folder,
    method,
    url,
    ...(variables.length > 0 ? { variables } : {}),
    ...(body ? { body } : {}),
    examples,
  }
}

// --- Environments -----------------------------------------------------------------------------

/** A v2.1 JSON environment export, a v3 YAML environment, or the cloud API's `{ environment }`. */
export function environmentFrom(data: unknown, shown: string): RawEnvironment {
  const e = isObject(data) && isObject(data.environment) ? data.environment : data
  if (!isObject(e) || !Array.isArray(e.values)) {
    throw new PostmanError(`${shown} is not a Postman environment (it has no "values" list).`)
  }
  return { name: str(e.name) ?? basename(shown), values: variablesOf(e.values) }
}

// --- Normalizing ------------------------------------------------------------------------------

const VARIABLE = /\{\{([^{}]+)\}\}/g

function normalize(
  collection: RawCollection,
  source: PostmanSource,
  environment: [RawEnvironment, PostmanSource] | undefined,
  rules: RedactRules,
  now: Date,
): PostmanImport {
  // Only variables a URL uses (directly or through another variable) are kept.
  const all = [
    ...collection.variables,
    ...(environment?.[0].values ?? []),
    ...collection.requests.flatMap((r) => r.variables ?? []),
  ]
  const used = new Set<string>()
  const pending = collection.requests.map((r) => r.url)
  while (pending.length > 0) {
    const text = pending.pop() as string
    for (const m of text.matchAll(VARIABLE)) {
      const key = (m[1] as string).trim()
      if (used.has(key)) continue
      used.add(key)
      for (const v of all) if (v.key === key) pending.push(v.value)
    }
  }
  const keep = (list: Variable[]) => list.filter((v) => used.has(v.key) && !isSensitive(v, rules))
  const requests: ImportedRequest[] = collection.requests.map((r) => {
    const variables = r.variables ? keep(r.variables) : []
    const body = r.body ? jsonBody(r.body, 'request.body', rules) : undefined
    return {
      name: r.name,
      folder: r.folder,
      method: r.method,
      url: r.url.trim(),
      ...(variables.length > 0 ? { variables } : {}),
      ...(body ? { body } : {}),
      examples: r.examples.map((e) => {
        const exampleBody = e.body ? jsonBody(e.body, 'response.body', rules) : undefined
        return {
          name: e.name,
          ...(e.status !== undefined ? { status: e.status } : {}),
          ...(exampleBody ? { body: exampleBody } : {}),
        }
      }),
    }
  })
  return {
    version: IMPORT_VERSION,
    importedAt: now.toISOString(),
    collection: { name: collection.name, source },
    ...(environment ? { environment: { name: environment[0].name, source: environment[1] } } : {}),
    variables: keep(collection.variables),
    environmentValues: keep(environment?.[0].values ?? []),
    requests,
  }
}

/** A key the redaction rules mask, or a value one of its patterns hits. */
function isSensitive(v: Variable, rules: RedactRules): boolean {
  const redactor = createRedactor(rules)
  redactor.body({ kind: 'json', value: { [v.key]: v.value } }, 'v')
  return redactor.paths.size > 0
}

/** Parses a saved JSON body and masks it like a capture. Not JSON: `undefined`. */
function jsonBody(text: string, path: string, rules: RedactRules): JsonBody | undefined {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return undefined
  }
  const redactor = createRedactor(rules)
  const out = redactor.body({ kind: 'json', value }, path)
  return { value: out.kind === 'json' ? out.value : value, redactedPaths: [...redactor.paths].sort() }
}

// --- Helpers ----------------------------------------------------------------------------------

function toMethod(method: string): HttpMethod | undefined {
  const upper = method.toUpperCase()
  return (HTTP_METHODS as readonly string[]).includes(upper) ? (upper as HttpMethod) : undefined
}

function readJson(path: string, shown: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new PostmanError(`Could not read ${shown}: ${(error as Error).message}`)
  }
}

function readYaml(path: string, shown: string): unknown {
  try {
    return parseYaml(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new PostmanError(`Could not read ${shown}: ${(error as Error).message}`)
  }
}

/** Project-relative with forward slashes, or absolute when outside the project. */
function projectPath(root: string, path: string): string {
  const rel = relative(root, path)
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel.split(sep).join('/') : path
}
