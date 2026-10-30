// Masks sensitive data before a capture leaves the app (docs/PLAN.md 7.4).
// Masking keeps the shape: strings become "[REDACTED:string]", numbers 0 and booleans false,
// so comparing captured data with the declared types still works on redacted data.
// Running it twice gives the same result, so the tool server can apply it again as a safety net.
import type { Capture, CapturedBody } from '@flow-checker/shared'
import type { RuntimeCaptureOptions } from './options'

export const REDACTED_STRING = '[REDACTED:string]'
const REDACTED_PART = '[REDACTED]'

export interface Redactor {
  headers: (headers: Record<string, string>, path: string) => Record<string, string>
  body: (body: CapturedBody, path: string) => CapturedBody
  url: (url: string, path: string) => string
  /** Paths masked so far. */
  paths: Set<string>
}

/** Compiled rules. Create once per runtime and reuse. */
export interface RedactRules {
  headers: Set<string>
  keys: Set<string>
  patterns: RegExp[]
}

export function compileRules(options: RuntimeCaptureOptions['redact']): RedactRules {
  const patterns: RegExp[] = []
  for (const p of options.patterns) {
    try {
      patterns.push(new RegExp(p.source, p.flags.includes('g') ? p.flags : `${p.flags}g`))
    } catch {
      // An invalid user pattern must not break capture.
    }
  }
  return {
    headers: new Set(options.headers.map((h) => h.toLowerCase())),
    keys: new Set(options.keys.map(normalizeKey)),
    patterns,
  }
}

/** `access_token`, `Access-Token` and `accessToken` all match the key `accessToken`. */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function createRedactor(rules: RedactRules): Redactor {
  const paths = new Set<string>()

  const maskString = (value: string, path: string): string => {
    let out = value
    for (const re of rules.patterns) {
      re.lastIndex = 0
      out = out.replace(re, REDACTED_PART)
    }
    out = maskCardNumbers(out)
    if (out !== value) paths.add(path)
    return out
  }

  /** Masks every leaf below a sensitive key, keeping keys and array lengths. */
  const maskAll = (value: unknown): unknown => {
    if (typeof value === 'string') return value === REDACTED_STRING ? value : REDACTED_STRING
    if (typeof value === 'number' || typeof value === 'bigint') return 0
    if (typeof value === 'boolean') return false
    if (Array.isArray(value)) return value.map(maskAll)
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskAll(v)]))
    }
    return value
  }

  const walk = (value: unknown, path: string, depth: number): unknown => {
    if (depth > 50) return value
    if (typeof value === 'string') return maskString(value, path)
    if (Array.isArray(value)) return value.map((v, i) => walk(v, `${path}[${i}]`, depth + 1))
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const [key, v] of Object.entries(value)) {
        const childPath = `${path}.${key}`
        if (rules.keys.has(normalizeKey(key)) && v !== null && v !== undefined) {
          const masked = maskAll(v)
          if (!isAlreadyMasked(v)) paths.add(childPath)
          out[key] = masked
        } else {
          out[key] = walk(v, childPath, depth + 1)
        }
      }
      return out
    }
    return value
  }

  return {
    paths,
    headers(headers, path) {
      const out: Record<string, string> = {}
      for (const [name, value] of Object.entries(headers)) {
        const childPath = `${path}.${name}`
        if (rules.headers.has(name.toLowerCase())) {
          if (value !== REDACTED_STRING) paths.add(childPath)
          out[name] = REDACTED_STRING
        } else {
          out[name] = maskString(value, childPath)
        }
      }
      return out
    },
    body(body, path) {
      switch (body.kind) {
        case 'json':
          return { ...body, value: walk(body.value, path, 0) }
        case 'form':
          return { ...body, value: walk(body.value, path, 0) as typeof body.value }
        case 'text':
          return { ...body, value: maskString(body.value, path) }
        default:
          return body
      }
    },
    url(url, path) {
      // Relative URLs (server `parent.url`) are parsed against a dummy origin and written back relative.
      const relative = !/^[a-z][a-z\d+.-]*:/i.test(url)
      let parsed: URL
      try {
        parsed = new URL(url, 'http://relative.invalid')
      } catch {
        return maskString(url, path)
      }
      let changed = false
      const entries = [...parsed.searchParams].map(([key, value]): [string, string] => {
        if (!rules.keys.has(normalizeKey(key)) || value === REDACTED_STRING) return [key, value]
        paths.add(`${path}?${key}`)
        changed = true
        return [key, REDACTED_STRING]
      })
      if (changed) parsed.search = new URLSearchParams(entries).toString()
      // URLSearchParams encodes the brackets; keep the marker readable.
      const href = relative ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.href
      const text = changed ? href.replaceAll(encodeURIComponent(REDACTED_STRING), REDACTED_STRING) : url
      return maskString(text, path)
    },
  }
}

function isAlreadyMasked(value: unknown): boolean {
  if (value === REDACTED_STRING || value === 0 || value === false) return true
  if (Array.isArray(value)) return value.every(isAlreadyMasked)
  if (value && typeof value === 'object') return Object.values(value).every(isAlreadyMasked)
  return false
}

/** Masks 13–19 digit runs (spaces and dashes allowed) that pass the Luhn check. */
function maskCardNumbers(text: string): string {
  if (!/\d{4}/.test(text)) return text
  return text.replace(/\b\d(?:[ -]?\d){12,18}\b/g, (match) => {
    const digits = match.replace(/\D/g, '')
    return luhn(digits) ? REDACTED_PART : match
  })
}

function luhn(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

function redactedKey(r: Redactor, key: unknown[]): unknown[] {
  const body = r.body({ kind: 'json', value: key }, 'query.key')
  return body.kind === 'json' && Array.isArray(body.value) ? body.value : key
}

/** Returns a redacted copy of the capture. With `storeRaw`, returns it unchanged. */
export function redactCapture(capture: Capture, rules: RedactRules, storeRaw = false): Capture {
  if (storeRaw) return { ...capture, redacted: false }
  const r = createRedactor(rules)
  const out: Capture = {
    ...capture,
    pageUrl: capture.pageUrl === undefined ? undefined : r.url(capture.pageUrl, 'pageUrl'),
    request: {
      ...capture.request,
      url: r.url(capture.request.url, 'request.url'),
      headers: r.headers(capture.request.headers, 'request.headers'),
      body: r.body(capture.request.body, 'request.body'),
    },
    response: capture.response && {
      ...capture.response,
      headers: r.headers(capture.response.headers, 'response.headers'),
      body: r.body(capture.response.body, 'response.body'),
    },
    parent: capture.parent && { ...capture.parent, url: r.url(capture.parent.url, 'parent.url') },
    // Keys can hold ids, emails or tokens (`['user', email]`): masked like a JSON body.
    query: capture.query && {
      ...capture.query,
      ...(capture.query.key ? { key: redactedKey(r, capture.query.key) } : {}),
    },
  }
  if (out.pageUrl === undefined) delete out.pageUrl
  if (out.response === undefined) delete out.response
  if (out.parent === undefined) delete out.parent
  if (out.query === undefined) delete out.query
  out.redacted = true
  out.redactedPaths = [...new Set([...capture.redactedPaths, ...r.paths])]
  return out
}
