// Request site status from live captures (M6 matching + M8 type comparison). The tool server
// applies it to `/api/model`, and the dashboard applies it again on live updates.
import type { SiteVerification, VerificationSummary } from './match'
import type { AppModel, Flag, RequestSite } from './model'
import type { TypeCheck, TypeCheckPart, TypeMismatch } from './type-check'

/** One distinct mismatch across a site's captures. */
export interface SiteMismatch extends TypeMismatch {
  part: TypeCheckPart['part']
  /** Captures that had it. */
  captures: number
  /** The newest of them. */
  captureId: string
}

export interface SiteTypeCheck {
  /** Matched captures whose data was compared (not skipped). */
  checked: number
  /** Of those, the ones with at least one mismatch. */
  mismatched: number
  /** Distinct mismatches, by part and path. */
  mismatches: SiteMismatch[]
}

const MAX_SITE_MISMATCHES = 50

/** Merges the type checks of a site's captures, oldest first. */
export function summarizeTypeChecks(
  checks: readonly { captureId: string; check: TypeCheck }[],
): SiteTypeCheck | undefined {
  if (checks.length === 0) return undefined
  const out: SiteTypeCheck = { checked: 0, mismatched: 0, mismatches: [] }
  const byKey = new Map<string, SiteMismatch>()
  for (const { captureId, check } of checks) {
    if (check.parts.every((p) => p.status === 'skipped')) continue
    out.checked++
    if (check.parts.some((p) => p.status === 'mismatch')) out.mismatched++
    for (const part of check.parts) {
      for (const m of part.mismatches) {
        const key = `${part.part}\u0000${m.kind}\u0000${m.path}`
        const existing = byKey.get(key)
        if (existing) {
          existing.captures++
          existing.captureId = captureId
          existing.actual = m.actual
        } else {
          const { count: _, ...rest } = m
          byKey.set(key, { ...rest, part: part.part, captures: 1, captureId })
        }
      }
    }
  }
  out.mismatches = [...byKey.values()].slice(0, MAX_SITE_MISMATCHES)
  return out
}

/** Path inside the body, e.g. `user.email`, `[].id`, or `the body` for the root. */
export function mismatchField(path: string): string {
  const inner = path.replace(/^(request|response)\.body\.?/, '')
  return inner === '' ? 'the body' : inner
}

/** One line, e.g. `id is string "1" (expected number)`. */
export function describeMismatch(m: TypeMismatch): string {
  const field = mismatchField(m.path)
  switch (m.kind) {
    case 'missing-field':
      return `${field} is missing (expected ${m.expected})`
    case 'extra-field':
      return `${field} is not in the type`
    case 'null':
      return `${field} is null (expected ${m.expected})`
    case 'wrong-type':
      return `${field} is ${m.actual} (expected ${m.expected})`
  }
}

function typeMismatchFlag(site: RequestSite, check: SiteTypeCheck): Flag {
  const parts: string[] = []
  for (const part of ['response', 'request'] as const) {
    const list = check.mismatches.filter((m) => m.part === part)
    if (list.length === 0) continue
    const type = part === 'response' ? site.responseType?.text : site.bodyType?.text
    const shown = list.slice(0, 3).map(describeMismatch).join('; ')
    const more = list.length > 3 ? ` (+${list.length - 3} more)` : ''
    parts.push(
      `${part === 'response' ? 'Response' : 'Request body'} doesn't match ${type ?? 'its type'}: ${shown}${more}`,
    )
  }
  const of = `${check.mismatched} of ${check.checked} capture${check.checked === 1 ? '' : 's'}`
  return { kind: 'type-mismatch', message: `${parts.join('. ')} (${of}).` }
}

/** Every matched capture was taken before the site's code last changed. */
export function needsRecheck(verification: SiteVerification | undefined): boolean {
  return !!verification && verification.captures > 0 && (verification.stale ?? 0) >= verification.captures
}

/**
 * Status from captures: `verified` when one matched, `mismatch` when its data didn't fit the
 * types, `needs-recheck` when the code changed after every capture.
 */
export function siteStatus(verification: SiteVerification | undefined): RequestSite['status'] {
  if (!verification || verification.captures === 0) return 'inferred'
  if (needsRecheck(verification)) return 'needs-recheck'
  return verification.typeCheck?.mismatched ? 'mismatch' : 'verified'
}

function staleFlag(verification: SiteVerification): Flag {
  const n = verification.captures
  return {
    kind: 'stale',
    message:
      `The code changed after the last capture (${n} capture${n === 1 ? '' : 's'} from before the change). ` +
      'Use the app again to re-check it.',
  }
}

/**
 * Applies verification to the scanned sites: status, and a `type-mismatch` flag listing what
 * didn't fit. Safe to call again on a model it already updated. Returns the same model when
 * nothing changed.
 */
export function applyVerification(model: AppModel, summary: Pick<VerificationSummary, 'sites'>): AppModel {
  let changed = false
  const requests = model.requests.map((site) => {
    const verification = summary.sites[site.id]
    const status = siteStatus(verification)
    const flags = site.flags.filter((f) => f.kind !== 'type-mismatch' && f.kind !== 'stale')
    const check = verification?.typeCheck
    if (status === 'mismatch' && check) flags.push(typeMismatchFlag(site, check))
    if (status === 'needs-recheck' && verification) flags.push(staleFlag(verification))
    if (status === site.status && JSON.stringify(flags) === JSON.stringify(site.flags)) return site
    changed = true
    return { ...site, status, flags }
  })
  return changed ? { ...model, requests } : model
}

/** Matched by live capture (with or without a type mismatch). */
export function isVerified(site: Pick<RequestSite, 'status'>): boolean {
  return site.status === 'verified' || site.status === 'mismatch'
}

/** Has matched captures, current or from before a code change. */
export function hasCaptures(site: Pick<RequestSite, 'status'>): boolean {
  return isVerified(site) || site.status === 'needs-recheck'
}
