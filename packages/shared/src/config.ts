// Shape of `flow-checker.config.ts` (docs/PLAN.md 12, docs/config.md).

export interface RedactConfig {
  /** Header names to mask (case-insensitive). Extends the defaults. */
  headers?: string[]
  /** Body keys to mask at any depth (case-insensitive). Extends the defaults. */
  keys?: string[]
  /** Value patterns to mask (e.g. JWTs). Extends the defaults. */
  patterns?: RegExp[]
}

export interface CaptureConfig {
  /** Save captured requests unmasked. Default: false (redacted). Local debugging only. */
  storeRaw?: boolean
  redact?: RedactConfig
  /** Bodies larger than this are truncated. Default: 256_000. */
  maxBodyBytes?: number
  /** URL globs never captured. */
  ignore?: string[]
  /** Event stream (SSE) messages kept per connection. Later ones are only counted. Default: 200. */
  maxMessages?: number
  /** Messages larger than this are kept without their data. Default: 64_000. */
  maxMessageBytes?: number
}

/**
 * A module whose calls are requests, e.g. an HTTP library (`ky`, `ofetch`) or a generated or
 * shared API client the scanner can't follow into (it only follows project code to fetch/axios).
 */
export interface ApiClientConfig {
  /** Import specifier as written in your code: a package (`ky`) or a project path (`@/lib/api`). */
  module: string
  /**
   * Exported functions or client methods that send a request: `get` matches `get(url)`,
   * `api.get(url)` and `client.get(url)` on an instance created from the module. `default`
   * matches calling the default import itself (`ofetch(url)`).
   */
  methods: string[]
}

/** A Postman collection or environment in Postman's cloud, fetched with an API key (M15). */
export interface PostmanCloudSource {
  /** Collection or environment id (or uid). */
  id: string
  /** Env variable that holds the Postman API key. Default: `POSTMAN_API_KEY`. Never stored. */
  apiKeyEnv?: string
}

/** A Postman collection used as the API contract, a types source and for URL resolution (M15). */
export interface PostmanConfig {
  /**
   * A v2.1 JSON export (`api.postman_collection.json`), a git-native v3 YAML folder
   * (`postman/collections/my-api`), or a cloud collection (`{ id, apiKeyEnv }`). Paths are
   * relative to the project root.
   */
  collection: string | PostmanCloudSource
  /** Environment for `{{variables}}`: a JSON export, a v3 YAML file, or a cloud environment. */
  environment?: string | PostmanCloudSource
}

/** GraphQL (M17): where operation types come from when the code doesn't have them. */
export interface GraphqlConfig {
  /**
   * The schema: SDL (`.graphql` / `.gql`) or an introspection result (`.json`), relative to the
   * project root. Default: the `schema` of `relay.config.json` or of the codegen config, else
   * `schema.graphql` in the root or `src/`.
   */
  schema?: string
  /**
   * Asks a running endpoint for its schema (dev only, when there is no schema file). The result
   * is cached in `.flow-checker/cache/`. Header values `env:NAME` are read from that variable.
   */
  introspection?: { url: string; headers?: Record<string, string> }
  /**
   * Persisted query manifest that maps ids to documents: codegen's `persisted-documents.json`,
   * Apollo's `persisted-query-manifest.json` or Relay's `persisted_queries.json`. Default: found
   * by those names in the root (or the Relay config's `persistConfig.file`).
   */
  persistedQueries?: string
  /** Where operations are sent, when the client setup doesn't say (`/api/graphql`, a full URL). */
  endpoint?: string
}

/**
 * Areas (M30): how pages are grouped by feature. By default each page goes in the area named after
 * the first static segment of its URL (`/billing/invoices` → `billing`), or after its feature
 * folder when the URLs give a single area.
 */
export interface AreasConfig {
  /** Display names, by area: `{ billing: 'Billing & invoices' }`. */
  rename?: Record<string, string>
  /** Areas folded into another one: `{ account: ['profile', 'settings'] }`. The target may be new. */
  merge?: Record<string, string[]>
}

/** Default `include`: every file under the project root. */
export const DEFAULT_INCLUDE: readonly string[] = ['**']

/** Default `exclude`: tests, stories and mocks. */
export const DEFAULT_EXCLUDE: readonly string[] = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.stories.*',
  '**/__tests__/**',
  '**/__mocks__/**',
]

export interface FlowCheckerConfig {
  /** Project root, relative to the config file's folder. Default: `.` (the config file's folder). */
  root?: string
  /** App Router directory, relative to the project root. Auto-detected (`src/app` or `app`). */
  appDir?: string
  /** Command that starts the app. Default: the `dev` script, or `next dev`. */
  devCommand?: string
  /** Dashboard port (default 4400) and the port your app runs on (default 3000). */
  ports?: { dashboard?: number; app?: number }
  /** Globs (relative to the root) of files the scan reads. Default: `['**']`. Replaces the default. */
  include?: string[]
  /** Globs of files the scan skips. Default: tests, stories and mocks. Replaces the default. */
  exclude?: string[]
  /** Modules whose calls are requests. Default: none (fetch, axios and wrappers around them are found). */
  apiClients?: ApiClientConfig[]
  capture?: CaptureConfig
  types?: {
    /** Nesting depth of anonymous types before expansion stops. Default: 6. */
    maxDepth?: number
  }
  /** Postman collection to check the code against (`flow-checker postman import`). */
  postman?: PostmanConfig
  /** GraphQL schema, live introspection and persisted queries (M17). */
  graphql?: GraphqlConfig
  /** Rename or merge the areas pages are grouped into (M30). */
  areas?: AreasConfig
  /** Default export folders: Markdown (default `docs/flow`) and the static site (`.flow-checker/site`). */
  export?: { md?: string; html?: string }
}

/** Identity helper that gives `flow-checker.config.ts` type checking. */
export function defineConfig(config: FlowCheckerConfig): FlowCheckerConfig {
  return config
}
