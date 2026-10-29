// Hash routing: works from the tool server and from a static export folder alike.
import { useEffect, useState } from 'react'

export type Screen =
  | { name: 'overview' }
  | { name: 'map'; view: 'graph' | 'tree'; q: string }
  | { name: 'page'; routeId: string; componentId?: string }
  | { name: 'component'; componentId: string }
  | { name: 'types'; typeId?: string; q: string }
  | { name: 'live'; captureId?: string; q: string; filter?: MatchFilter }
  /** `flowId` is an inferred flow id, or a recorded flow id (`rec_...`, `var_...`). */
  | { name: 'flows'; flowId?: string; q: string }
  | { name: 'not-found' }

/** Live screen: show only captures with this match status. */
/** Match status, or `mismatch`: matched captures whose data doesn't fit the site's types. */
export type MatchFilter = 'matched' | 'ambiguous' | 'unmatched' | 'mismatch'
const MATCH_FILTERS: MatchFilter[] = ['matched', 'ambiguous', 'unmatched', 'mismatch']

export function parseHash(hash: string): Screen {
  const raw = hash.replace(/^#/, '') || '/'
  const [pathPart = '/', query = ''] = raw.split('?')
  const params = new URLSearchParams(query)
  const parts = pathPart.split('/').filter(Boolean).map(decodeURIComponent)

  switch (parts[0]) {
    case undefined:
      return { name: 'overview' }
    case 'map':
      return { name: 'map', view: params.get('view') === 'tree' ? 'tree' : 'graph', q: params.get('q') ?? '' }
    case 'page':
      if (!parts[1]) break
      return { name: 'page', routeId: parts[1], componentId: params.get('c') ?? undefined }
    case 'component':
      if (!parts[1]) break
      return { name: 'component', componentId: parts[1] }
    case 'types':
      return { name: 'types', typeId: parts[1], q: params.get('q') ?? '' }
    case 'flows':
      return { name: 'flows', flowId: parts[1], q: params.get('q') ?? '' }
    case 'live':
      return {
        name: 'live',
        captureId: parts[1],
        q: params.get('q') ?? '',
        filter: MATCH_FILTERS.find((f) => f === params.get('match')),
      }
  }
  return { name: 'not-found' }
}

/** Builds a `#/...` link for a screen. */
export function href(screen: Screen): string {
  const withQuery = (path: string, params: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
    const s = q.toString()
    return `#${path}${s ? `?${s}` : ''}`
  }
  switch (screen.name) {
    case 'overview':
      return '#/'
    case 'map':
      return withQuery('/map', { view: screen.view === 'tree' ? 'tree' : undefined, q: screen.q })
    case 'page':
      return withQuery(`/page/${encodeURIComponent(screen.routeId)}`, { c: screen.componentId })
    case 'component':
      return `#/component/${encodeURIComponent(screen.componentId)}`
    case 'types':
      return withQuery(screen.typeId ? `/types/${encodeURIComponent(screen.typeId)}` : '/types', {
        q: screen.q,
      })
    case 'live':
      return withQuery(screen.captureId ? `/live/${encodeURIComponent(screen.captureId)}` : '/live', {
        q: screen.q,
        match: screen.filter,
      })
    case 'flows':
      return withQuery(screen.flowId ? `/flows/${encodeURIComponent(screen.flowId)}` : '/flows', {
        q: screen.q,
      })
    case 'not-found':
      return '#/'
  }
}

export function useScreen(): Screen {
  const [screen, setScreen] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setScreen(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return screen
}

/** Changes the screen without adding a history entry (for search boxes and toggles). */
export function replaceScreen(screen: Screen) {
  const url = `${window.location.pathname}${window.location.search}${href(screen)}`
  window.history.replaceState(null, '', url)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
