// Shape of `flow-checker.config.ts`. Fields are filled in as milestones land;
// see docs/PLAN.md section 12.

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

export interface FlowCheckerConfig {
  root?: string
  /** Auto-detected (`src/app` or `app`) when omitted. */
  appDir?: string
  /** Auto-detected from package.json when omitted. */
  devCommand?: string
  ports?: { dashboard?: number; app?: number }
  include?: string[]
  exclude?: string[]
  /** Hints for custom API client wrappers the scanner should treat as requests. */
  apiClients?: { module: string; methods: string[] }[]
  capture?: CaptureConfig
  types?: { maxDepth?: number }
  export?: { md?: string; html?: string }
}

/** Identity helper that gives `flow-checker.config.ts` type checking. */
export function defineConfig(config: FlowCheckerConfig): FlowCheckerConfig {
  return config
}
