// Guarded pages (M31): wording shared by the CLI text, the dashboard and the export, and the
// check of captured redirects against the guards.
import type { PageGuard, Route, RouteAccess } from './model'

/** A page's access; models written before M31 have none, which reads as `unknown`. */
export function accessOf(route: Route): RouteAccess {
  return (
    route.access ?? {
      status: 'unknown',
      guards: [],
      reasons: [{ text: 'scanned by an older version; scan again' }],
    }
  )
}

/** What the guard does: "redirects to `/login`", "shows the not-found page". */
export function guardAction(guard: PageGuard): string {
  const to = guard.target ? ` to \`${guard.target}\`` : ''
  switch (guard.kind) {
    case 'redirect':
      return `redirects${to}`
    case 'client-redirect':
      return `redirects in the browser${to}`
    case 'not-found':
      return 'shows the not-found page (404)'
    case 'forbidden':
      return 'shows the forbidden page (403)'
    case 'unauthorized':
      return 'shows the unauthorized page (401)'
    case 'respond':
      return guard.status !== undefined ? `answers with status ${guard.status}` : 'answers the request itself'
  }
}

/** When: "when `!session`", "always", or why the scan can't say. */
export function guardWhen(guard: PageGuard): string {
  if (guard.unclear) {
    return guard.condition
      ? `when \`${guard.condition}\` (not sure: ${guard.unclear})`
      : `under a condition the scan can't read (${guard.unclear})`
  }
  if (guard.always) return 'always'
  return guard.condition ? `when \`${guard.condition}\`` : 'always'
}

const PLACES: Record<PageGuard['in'], string> = {
  middleware: 'middleware',
  layout: 'layout',
  page: 'page',
  component: 'component',
}

/** One line: "redirects to `/login` when `!session` (middleware)". */
export function guardText(guard: PageGuard): string {
  return `${guardAction(guard)} ${guardWhen(guard)} (${PLACES[guard.in]})`
}

/** The short label for a badge. */
export const ACCESS_LABELS: Record<RouteAccess['status'], string> = {
  guarded: 'guarded',
  open: 'open',
  unknown: 'access unknown',
}

/** A page that didn't render in a captured session (M31). */
export interface ObservedStop {
  routeId: string
  /** Where it went, for a redirect. */
  toRouteId?: string
  /** 401 / 403 / 404, for a page that answered with an error. */
  status?: number
  /** Moved in the browser right after it loaded (an effect), not by the server. */
  inBrowser?: boolean
}

const STATUS_KINDS: Record<number, PageGuard['kind']> = {
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
}

/**
 * The guards each captured stop fits, by page: a redirect to the guard's target page (or one whose
 * target didn't resolve), or the status Next answers with. Every guard that fits counts.
 */
export function seenGuards(
  routes: readonly Route[],
  stops: readonly ObservedStop[],
): Record<string, string[]> {
  const byId = new Map(routes.map((r) => [r.id, r]))
  const out: Record<string, string[]> = {}
  for (const stop of stops) {
    const route = byId.get(stop.routeId)
    if (!route) continue
    for (const guard of accessOf(route).guards) {
      if (!fits(guard, stop)) continue
      const list = out[route.id] ?? []
      if (!list.includes(guard.id)) list.push(guard.id)
      out[route.id] = list
    }
  }
  return out
}

function fits(guard: PageGuard, stop: ObservedStop): boolean {
  if (stop.status !== undefined) {
    if (guard.kind === 'respond') return guard.status === stop.status
    return STATUS_KINDS[stop.status] === guard.kind
  }
  const kinds: PageGuard['kind'][] = stop.inBrowser ? ['client-redirect', 'redirect'] : ['redirect']
  if (!kinds.includes(guard.kind)) return false
  if (stop.inBrowser && guard.in === 'middleware') return false
  return !guard.targetRouteId || guard.targetRouteId === stop.toRouteId
}
