// Settings the tool passes to the runtime through environment variables, and their defaults.
// No dependencies: this file ends up in the user's browser bundle.
import type { CaptureConfig } from '@flow-checker/shared'

/** Header the browser runtime adds to same-origin requests, so server captures link back to them. */
export const LINK_HEADER = 'x-flow-checker-link'

/** Server-side env vars set by `flow-checker dev`. */
export const ENV = {
  enabled: 'FLOW_CHECKER',
  /** JSON `RuntimeConfig` for the server runtime. */
  server: 'FLOW_CHECKER_RUNTIME',
  /** JSON `RuntimeConfig` for the browser runtime (inlined into the client bundle by Next). */
  client: 'NEXT_PUBLIC_FLOW_CHECKER',
} as const

export const DEFAULT_REDACT = {
  headers: ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'proxy-authorization'],
  keys: [
    'password',
    'pass',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'otp',
    'code',
    'cvv',
    'cardNumber',
    'ssn',
  ],
  patterns: [
    // JWT
    { source: 'eyJ[A-Za-z0-9_-]{5,}\\.[A-Za-z0-9_-]{5,}\\.[A-Za-z0-9_-]{5,}', flags: 'g' },
    // Bearer token
    { source: '\\bBearer\\s+[A-Za-z0-9\\-._~+/]+=*', flags: 'gi' },
  ],
}

export const DEFAULT_IGNORE = [
  '/_next/*',
  '/__nextjs*',
  '/__webpack*',
  '/favicon.ico',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.svg',
  '*.webp',
  '*.ico',
  '*.css',
  '*.woff',
  '*.woff2',
  '*.map',
  '*://telemetry.nextjs.org/*',
  '*://registry.npmjs.org/*',
  // Next 13.4–13.5 dev server talking to its own render workers over local HTTP.
  '*/?key=*&method=*',
]

export const DEFAULT_MAX_BODY_BYTES = 256_000

export interface SerializedPattern {
  source: string
  flags: string
}

/** Capture settings in a JSON-friendly form (RegExps become `{ source, flags }`). */
export interface RuntimeCaptureOptions {
  storeRaw: boolean
  redact: { headers: string[]; keys: string[]; patterns: SerializedPattern[] }
  maxBodyBytes: number
  ignore: string[]
}

export interface RuntimeConfig {
  /** Absolute URL of the tool server's ingest endpoint. */
  ingest: string
  /** Per-run secret checked by the ingest endpoint. */
  token: string
  capture: RuntimeCaptureOptions
}

/** Merges the user's `capture` config with the defaults. User rules extend the defaults. */
export function resolveCaptureOptions(config: CaptureConfig = {}): RuntimeCaptureOptions {
  return {
    storeRaw: config.storeRaw === true,
    redact: {
      headers: unique([...DEFAULT_REDACT.headers, ...(config.redact?.headers ?? [])]),
      keys: unique([...DEFAULT_REDACT.keys, ...(config.redact?.keys ?? [])]),
      patterns: [
        ...DEFAULT_REDACT.patterns,
        ...(config.redact?.patterns ?? []).map((p) => ({ source: p.source, flags: p.flags })),
      ],
    },
    maxBodyBytes: config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
    ignore: unique([...DEFAULT_IGNORE, ...(config.ignore ?? [])]),
  }
}

/** Reads a `RuntimeConfig` from an env var value. `undefined` when missing or malformed. */
export function parseRuntimeConfig(value: unknown): RuntimeConfig | undefined {
  try {
    const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value
    if (!parsed || typeof parsed !== 'object') return undefined
    const config = parsed as Partial<RuntimeConfig>
    if (typeof config.ingest !== 'string' || typeof config.token !== 'string') return undefined
    return { ingest: config.ingest, token: config.token, capture: config.capture ?? resolveCaptureOptions() }
  } catch {
    return undefined
  }
}

/** Compiles `ignore` globs (`*` matches anything) into one matcher over the full URL and its path. */
export function createIgnoreMatcher(globs: string[]): (url: URL) => boolean {
  const regexes = globs.map((glob) => new RegExp(`^${glob.split('*').map(escapeRegExp).join('.*')}$`, 'i'))
  return (url) => {
    const path = url.pathname
    const full = url.href
    return regexes.some((re) => re.test(path) || re.test(full))
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

/** Short random id. Not cryptographic. */
export function randomId(prefix: string): string {
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${time}${rand}`
}
