// Hash routing: works from the tool server and from a static export folder alike.
import {
  type Component,
  ENDPOINT_STATUSES,
  ENDPOINT_TRANSPORTS,
  type EndpointStatus,
  type EndpointTransport,
  type RequestSite,
  type SearchItem,
  type SummaryLink,
} from '@flow-checker/shared'
import { useEffect, useState } from 'react'
import {
  COMPONENT_HAS,
  COMPONENT_KINDS,
  COMPONENT_SORTS,
  type ComponentHas,
  type ComponentSort,
  ENDPOINT_SIDES,
  type EndpointSide,
  REQUEST_STATUSES,
  REQUEST_WHEN,
  type RequestWhen,
  TRANSPORTS,
} from './lists'

/** Map filter on page access (M31). */
export const ACCESS_FILTERS = ['guarded', 'open', 'unknown'] as const
export type AccessFilter = (typeof ACCESS_FILTERS)[number]

export type Screen =
  /** Start here (M32): the first screen. */
  | { name: 'start' }
  | { name: 'overview' }
  /** `handlers`: the route handlers as a list (M23). */
  /** `areas`: the Map graph draws a frame around each area's pages (M30). */
  /** `access`: only pages with that access label stand out (M31). */
  | { name: 'map'; view: MapView; q: string; areas?: boolean; access?: AccessFilter }
  /** Pages grouped by feature (M30); `areaId` is the one shown beside the cards. */
  | { name: 'areas'; areaId?: string; q: string }
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
  /** Backend endpoints by host (M29); `endpointId` (an endpoint key) is the one shown beside the list. */
  | {
      name: 'endpoints'
      endpointId?: string
      q: string
      host?: string
      transport?: EndpointTransport
      status?: EndpointStatus
      side?: EndpointSide
    }
  /** `unused`: also list types with no uses (M23). */
  | { name: 'types'; typeId?: string; q: string; unused?: boolean }
  | { name: 'live'; captureId?: string; q: string; filter?: MatchFilter }
  /** `flowId` is an inferred flow id, or a recorded flow id (`rec_...`, `var_...`). */
  | { name: 'flows'; flowId?: string; q: string }
  /** Guided walk-through (M35); `flowId` is listed first. */
  | { name: 'walk'; flowId?: string }
  /** Affected by changes (M36): what the latest re-scan's files affect. */
  | { name: 'changes' }
  | { name: 'export' }
  /** What each status, note and badge means (M34); `term` (`flag-dynamic-url`) is the one shown first. */
  | { name: 'glossary'; q: string; term?: string }
  | { name: 'not-found' }

export type MapView = 'graph' | 'tree' | 'handlers'
const MAP_VIEWS: MapView[] = ['graph', 'tree', 'handlers']

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
    case 'start':
      return { name: 'start' }
    case 'overview':
      return { name: 'overview' }
    case 'map':
      return {
        name: 'map',
        view: oneOf(MAP_VIEWS, params.get('view')) ?? 'graph',
        q: params.get('q') ?? '',
        areas: params.get('areas') === '1' || undefined,
        access: oneOf(ACCESS_FILTERS, params.get('access')),
      }
    case 'areas':
      return { name: 'areas', areaId: parts[1], q: params.get('q') ?? '' }
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
    case 'endpoints':
      return {
        name: 'endpoints',
        endpointId: parts[1],
        q: params.get('q') ?? '',
        host: params.get('host') || undefined,
        transport: oneOf(ENDPOINT_TRANSPORTS, params.get('transport')),
        status: oneOf(ENDPOINT_STATUSES, params.get('status')),
        side: oneOf(ENDPOINT_SIDES, params.get('side')),
      }
    case 'types':
      return {
        name: 'types',
        typeId: parts[1],
        q: params.get('q') ?? '',
        unused: params.get('all') === '1' || undefined,
      }
    case 'flows':
      return { name: 'flows', flowId: parts[1], q: params.get('q') ?? '' }
    case 'walk':
      return { name: 'walk', flowId: parts[1] }
    case 'export':
      return { name: 'export' }
    case 'changes':
      return { name: 'changes' }
    case 'glossary':
      return { name: 'glossary', q: params.get('q') ?? '', term: params.get('term') ?? undefined }
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
    case 'start':
      return '#/'
    case 'overview':
      return '#/overview'
    case 'map':
      return withQuery('/map', {
        view: screen.view === 'graph' ? undefined : screen.view,
        q: screen.q,
        areas: screen.areas ? '1' : undefined,
        access: screen.access,
      })
    case 'areas':
      return withQuery(screen.areaId ? `/areas/${encodeURIComponent(screen.areaId)}` : '/areas', {
        q: screen.q,
      })
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
    case 'endpoints':
      return withQuery(
        screen.endpointId ? `/endpoints/${encodeURIComponent(screen.endpointId)}` : '/endpoints',
        {
          q: screen.q,
          host: screen.host,
          transport: screen.transport,
          status: screen.status,
          side: screen.side,
        },
      )
    case 'types':
      return withQuery(screen.typeId ? `/types/${encodeURIComponent(screen.typeId)}` : '/types', {
        q: screen.q,
        all: screen.unused ? '1' : undefined,
      })
    case 'export':
      return '#/export'
    case 'changes':
      return '#/changes'
    case 'glossary':
      return withQuery('/glossary', { q: screen.q, term: screen.term })
    case 'live':
      return withQuery(screen.captureId ? `/live/${encodeURIComponent(screen.captureId)}` : '/live', {
        q: screen.q,
        match: screen.filter,
      })
    case 'flows':
      return withQuery(screen.flowId ? `/flows/${encodeURIComponent(screen.flowId)}` : '/flows', {
        q: screen.q,
      })
    case 'walk':
      return screen.flowId ? `#/walk/${encodeURIComponent(screen.flowId)}` : '#/walk'
    case 'not-found':
      return '#/'
  }
}

/** The screen a Start here item leads to (M32). */
export function summaryScreen(link: SummaryLink): Screen {
  switch (link.to) {
    case 'overview':
      return { name: 'overview' }
    case 'map':
      return { name: 'map', view: link.view ?? 'graph', q: '' }
    case 'page':
      return { name: 'page', routeId: link.routeId }
    case 'middleware':
      return link.routeId ? { name: 'page', routeId: link.routeId } : { name: 'map', view: 'graph', q: '' }
    case 'areas':
      return { name: 'areas', q: '' }
    case 'area':
      return { name: 'areas', areaId: link.areaId, q: '' }
    case 'flows':
      return { name: 'flows', q: '' }
    case 'flow':
      return { name: 'flows', flowId: link.flowId, q: '' }
    case 'endpoints':
      return { name: 'endpoints', q: '', host: link.host }
    case 'components':
      return { name: 'components', q: '', kind: link.kind }
    case 'component':
      return { name: 'component', componentId: link.componentId }
    case 'requests':
      return { name: 'requests', siteId: link.siteId, q: link.q ?? '', transport: link.transport }
    case 'types':
      return { name: 'types', q: '' }
    case 'type':
      return { name: 'types', typeId: link.typeId, q: '' }
  }
}

/** The screen a global search result opens (M33). */
export function searchScreen(item: SearchItem): Screen {
  switch (item.kind) {
    case 'page':
    case 'handler':
      return { name: 'page', routeId: item.id }
    case 'component':
      return { name: 'component', componentId: item.id }
    case 'request':
      return { name: 'requests', siteId: item.id, q: '' }
    case 'endpoint':
      return { name: 'endpoints', endpointId: item.id, q: '' }
    case 'type':
      return { name: 'types', typeId: item.id, q: '' }
    case 'flow':
      return { name: 'flows', flowId: item.id, q: '' }
    case 'area':
      return { name: 'areas', areaId: item.id, q: '' }
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

/**
 * Changes the screen without adding a history entry (for search boxes and toggles). The entry's
 * state is kept, so its scroll position is too.
 */
export function replaceScreen(screen: Screen) {
  const url = `${window.location.pathname}${window.location.search}${href(screen)}`
  window.history.replaceState(window.history.state, '', url)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
