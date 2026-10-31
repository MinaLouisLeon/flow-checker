// Hash routing: works from the tool server and from a static export folder alike.
import type { Component, RequestSite } from '@flow-checker/shared'
import { useEffect, useState } from 'react'
import {
  COMPONENT_HAS,
  COMPONENT_KINDS,
  COMPONENT_SORTS,
  type ComponentHas,
  type ComponentSort,
  REQUEST_STATUSES,
  REQUEST_WHEN,
  type RequestWhen,
  TRANSPORTS,
} from './lists'

export type Screen =
  | { name: 'overview' }
  | { name: 'map'; view: 'graph' | 'tree'; q: string }
  | { name: 'page'; routeId: string; componentId?: string }
  | { name: 'component'; componentId: string }
  /** Component list (M21); `componentId` is the one shown beside it. */
  | {
      name: 'components'
      componentId?: string
      q: string
      kind?: Component['kind']
      has?: ComponentHas
      sort?: ComponentSort
    }
  /** Request site list (M21); `siteId` is the one shown beside it. */
  | {
      name: 'requests'
      siteId?: string
      q: string
      status?: RequestSite['status']
      when?: RequestWhen
      transport?: RequestSite['transport']
      flagged?: boolean
    }
  | { name: 'types'; typeId?: string; q: string }
  | { name: 'live'; captureId?: string; q: string; filter?: MatchFilter }
  /** `flowId` is an inferred flow id, or a recorded flow id (`rec_...`, `var_...`). */
  | { name: 'flows'; flowId?: string; q: string }
  | { name: 'export' }
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
    case 'components':
      return {
        name: 'components',
        componentId: parts[1],
        q: params.get('q') ?? '',
        kind: oneOf(COMPONENT_KINDS, params.get('kind')),
        has: oneOf(COMPONENT_HAS, params.get('has')),
        sort: oneOf(COMPONENT_SORTS, params.get('sort')),
      }
    case 'requests':
      return {
        name: 'requests',
        siteId: parts[1],
        q: params.get('q') ?? '',
        status: oneOf(REQUEST_STATUSES, params.get('status')),
        when: oneOf(REQUEST_WHEN, params.get('when')),
        transport: oneOf(TRANSPORTS, params.get('transport')),
        flagged: params.get('flags') === '1' || undefined,
      }
    case 'types':
      return { name: 'types', typeId: parts[1], q: params.get('q') ?? '' }
    case 'flows':
      return { name: 'flows', flowId: parts[1], q: params.get('q') ?? '' }
    case 'export':
      return { name: 'export' }
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

/** The value when it is one of the allowed ones, else undefined (hand-edited or old URLs). */
function oneOf<T extends string>(allowed: readonly T[], value: string | null): T | undefined {
  return allowed.find((a) => a === value)
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
    case 'components':
      return withQuery(
        screen.componentId ? `/components/${encodeURIComponent(screen.componentId)}` : '/components',
        {
          q: screen.q,
          kind: screen.kind,
          has: screen.has,
          sort: screen.sort === 'name' ? undefined : screen.sort,
        },
      )
    case 'requests':
      return withQuery(screen.siteId ? `/requests/${encodeURIComponent(screen.siteId)}` : '/requests', {
        q: screen.q,
        status: screen.status,
        when: screen.when,
        transport: screen.transport,
        flags: screen.flagged ? '1' : undefined,
      })
    case 'types':
      return withQuery(screen.typeId ? `/types/${encodeURIComponent(screen.typeId)}` : '/types', {
        q: screen.q,
      })
    case 'export':
      return '#/export'
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
