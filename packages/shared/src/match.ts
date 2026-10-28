// Matching captures to scanned request sites (M6, docs/PLAN.md 8).
// The tool server scores each capture against every request site. The result is stored on the
// capture (`Capture.match`), and sites with at least one matched capture become `verified`.
import { z } from 'zod'
import type { RequestUrl } from './model'

/** Evidence that links a capture to a request site. */
export const MATCH_SIGNALS = [
  /** The `Next-Action` id resolves (through Next's manifest) to the site's server action. */
  'server-action',
  /** A source-mapped stack frame points at the site's code. */
  'stack-source',
  /** A stack frame's function name is the site's component or a function on its call path. */
  'stack-name',
  /** Method and URL match the site's URL pattern. */
  'url',
  /** The interaction's React component chain includes the site's component. */
  'component',
  /** The page (or the incoming server request) is a route the site belongs to. */
  'route',
  /** The browser request this server call was made for matched a site that leads to this one. */
  'parent',
  /** What started the request fits the site's trigger, e.g. a submit for `onSubmit`. */
  'trigger',
  /** You assigned captures like this one to the site. */
  'manual',
] as const
export const MatchSignalSchema = z.enum(MATCH_SIGNALS)
export type MatchSignal = z.infer<typeof MatchSignalSchema>

export const MatchEvidenceSchema = z.object({
  signal: MatchSignalSchema,
  points: z.number(),
  /** Short explanation, e.g. `ProductsTable.useEffect at src/components/ProductsTable.tsx:12`. */
  detail: z.string().optional(),
})
export type MatchEvidence = z.infer<typeof MatchEvidenceSchema>

export const MatchCandidateSchema = z.object({
  siteId: z.string(),
  score: z.number(),
  evidence: z.array(MatchEvidenceSchema),
})
export type MatchCandidate = z.infer<typeof MatchCandidateSchema>

export const CaptureMatchSchema = z.object({
  /**
   * `matched`: one site scored above the threshold, clearly ahead of the rest.
   * `ambiguous`: several sites scored about the same. Pick one in the dashboard.
   * `unmatched`: no site fits. Usually something the scanner missed.
   */
  status: z.enum(['matched', 'ambiguous', 'unmatched']),
  /** `manual` when you assigned it in the dashboard. */
  by: z.enum(['auto', 'manual']),
  siteId: z.string().optional(),
  score: z.number(),
  /** Best candidates first (at most a few). */
  candidates: z.array(MatchCandidateSchema),
})
export type CaptureMatch = z.infer<typeof CaptureMatchSchema>

/** `.flow-checker/overrides.json`: your decisions, safe to commit. */
export const OverridesSchema = z.object({
  version: z.literal(1),
  /**
   * Manual assignments. Each one applies to every capture with the same fingerprint
   * (origin, method, URL shape, server action, component), so the choice is remembered.
   */
  matches: z
    .array(
      z.object({
        fingerprint: z.string(),
        /** `null` marks captures like this as not belonging to any site. */
        siteId: z.string().nullable(),
        /** ISO time of the decision. */
        at: z.string(),
      }),
    )
    .default([]),
})
export type Overrides = z.infer<typeof OverridesSchema>

/** Verification state of one request site, from its matched captures. */
export interface SiteVerification {
  /** Matched captures (among those the server keeps in memory). */
  captures: number
  lastCaptureId?: string
  lastAt?: string
}

/** `GET /api/verification`. */
export interface VerificationSummary {
  sites: Record<string, SiteVerification>
  counts: { matched: number; ambiguous: number; unmatched: number; manual: number }
}

// --- URL and route patterns -----------------------------------------------------------------

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Regex for a request site path pattern like `/users/:id` (a `:param` is one or more segments' text). */
export function pathPatternRegex(pattern: string): RegExp {
  const parts = pattern.split(/(:[A-Za-z_$][\w$]*)/)
  const body = parts
    .map((part) => (part.startsWith(':') && part.length > 1 ? '[^/?#]+' : escapeRegex(part)))
    .join('')
  // A trailing slash on either side does not matter.
  return new RegExp(`^${body.replace(/\/$/, '')}/?$`)
}

/** Regex for a route path in Next's bracket form, e.g. `/[locale]/users/[id]` or `/docs/[[...slug]]`. */
export function routePathRegex(path: string): RegExp {
  if (path === '/') return /^\/?$/
  let body = ''
  for (const segment of path.split('/').filter(Boolean)) {
    if (/^\[\[\.\.\..+\]\]$/.test(segment)) body += '(?:/.*)?'
    else if (/^\[\.\.\..+\]$/.test(segment)) body += '/.+'
    else if (/^\[.+\]$/.test(segment)) body += '/[^/]+'
    else body += `/${escapeRegex(segment)}`
  }
  return new RegExp(`^${body}/?$`)
}

export interface UrlMatch {
  /** `exact` when the site URL has no placeholders. */
  kind: 'exact' | 'pattern'
  /** The origin also matched the site's (non-env) base URL. */
  sameBase: boolean
  /** Query keys from the site's pattern that the URL has. */
  queryKeys: number
}

/**
 * Checks a captured URL against a site's URL pattern. `undefined` means it does not match.
 * A base taken from an env variable may be different at runtime, so only a fixed base is enforced.
 */
export function matchRequestUrl(site: RequestUrl, captured: URL): UrlMatch | undefined {
  if (site.confidence === 'unknown' || site.path === undefined) return undefined
  let base: URL | undefined
  try {
    base = site.base ? new URL(site.base) : undefined
  } catch {}
  let path = site.path
  // A base with a path (`http://api/v1`) puts that path in front.
  if (base && base.pathname !== '/') path = `${base.pathname.replace(/\/$/, '')}${path}`
  const sameBase = base ? base.origin === captured.origin : false
  if (base && !site.baseEnv && !sameBase) return undefined
  if (!pathPatternRegex(path).test(decodeSafe(captured.pathname))) return undefined
  let queryKeys = 0
  if (site.query) {
    for (const pair of site.query.split('&')) {
      const key = pair.split('=')[0]
      if (key && captured.searchParams.has(key)) queryKeys++
    }
  }
  const kind = /:[A-Za-z_$]/.test(path) || site.confidence === 'pattern' ? 'pattern' : 'exact'
  return { kind, sameBase, queryKeys }
}

function decodeSafe(path: string): string {
  try {
    return decodeURI(path)
  } catch {
    return path
  }
}

/** Path with id-like segments generalized, for fingerprints: `/users/42` → `/users/:x`. */
export function generalizePath(pathname: string): string {
  return pathname
    .split('/')
    .map((part) =>
      /^\d+$/.test(part) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part) ||
      /^[0-9a-f]{16,}$/i.test(part)
        ? ':x'
        : part,
    )
    .join('/')
}
