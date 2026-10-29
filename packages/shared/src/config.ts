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
  /** Default export folders: Markdown (default `docs/flow`) and the static site (`.flow-checker/site`). */
  export?: { md?: string; html?: string }
}

/** Identity helper that gives `flow-checker.config.ts` type checking. */
export function defineConfig(config: FlowCheckerConfig): FlowCheckerConfig {
  return config
}
