// Backend endpoints (M29): one row per method + URL pattern the app calls, grouped by host, with
// the selected endpoint's call sites, pages, types and newest captures beside the list.
import {
  type CaptureSummary,
  ENDPOINT_STATUSES,
  type Endpoint,
  type EndpointHost,
  type EndpointStatus,
  type EndpointTransport,
  endpointLabel,
  type RequestSite,
} from '@flow-checker/shared'
import { useMemo } from 'react'
import { useCaptures } from '../api'
import { useData } from '../context'
import { type EndpointSide, endpointRows, endpointsOf, filterEndpoints, siteOwner } from '../lists'
import { TypeBlock } from '../RequestView'
import { href, replaceScreen, type Screen } from '../router'
import { StaleBadge, TypeCheckBadge } from '../TypeCheckView'
import { Badge, CappedList, Empty, SearchBox, Select, ShowMore, SourceLink, usePaged } from '../ui'

type EndpointsScreen = Extract<Screen, { name: 'endpoints' }>

export const ENDPOINT_STATUS_LABEL: Record<EndpointStatus, string> = {
  verified: 'Verified',
  mismatch: 'Type mismatch',
  'needs-recheck': 'Needs re-check',
  'not-captured': 'Not captured yet',
}

const TRANSPORT_LABEL: Record<EndpointTransport, string> = {
  http: 'HTTP',
  trpc: 'tRPC',
  graphql: 'GraphQL',
  sse: 'event stream',
  websocket: 'WebSocket',
  'server-action': 'server action',
}

const SIDE_LABEL: Record<EndpointSide | 'all', string> = {
  all: 'All',
  browser: 'From the browser',
  server: 'Server only',
}

const SIDE_TITLE: Record<EndpointSide, string> = {
  browser: 'Called by code that runs in the browser (client components, form actions)',
  server: 'Only called by server code: server components, route handlers, server actions, middleware',
}

export function EndpointsScreen(screen: EndpointsScreen) {
  const { index } = useData()
  const { endpointId: key, q, host, transport, status, side } = screen
  const list = endpointsOf(index)
  const rows = useMemo(() => endpointRows(index, list), [index, list])
  const shown = useMemo(
    () => filterEndpoints(rows, { q, host, transport, status, side }),
    [rows, q, host, transport, status, side],
  )
  const hosts = new Map(list.hosts.map((h) => [h.key, h]))
  const transports = useMemo(() => [...new Set(list.endpoints.map((e) => e.transport))].sort(), [list])
  const selectedIndex = key ? shown.findIndex((r) => r.endpoint.key === key) : -1
  const paged = usePaged(shown, `${q}|${host}|${transport}|${status}|${side}`, selectedIndex)
  const go = (next: Partial<EndpointsScreen>) => replaceScreen({ ...screen, ...next })
  const selected = key ? list.byKey.get(key) : undefined
  // Host headings, with how many of the host's endpoints the filters keep.
  const hostCounts = new Map<string, number>()
  for (const { endpoint } of shown) hostCounts.set(endpoint.host, (hostCounts.get(endpoint.host) ?? 0) + 1)

  return (
    <div className="screen screen-split">
      <div className="split-main">
        <div className="toolbar">
          <SearchBox
            value={q}
            onChange={(next) => go({ q: next })}
            placeholder="Search URL, host, page or component"
          />
          <fieldset className="segmented" aria-label="Where it is called from">
            {([undefined, 'browser', 'server'] as const).map((s) => (
              <button
                key={s ?? 'all'}
                type="button"
                aria-pressed={side === s}
                title={s ? SIDE_TITLE[s] : undefined}
                onClick={() => go({ side: s })}
              >
                {SIDE_LABEL[s ?? 'all']}
              </button>
            ))}
          </fieldset>
          {list.hosts.length > 1 && (
            <Select
              label="Host"
              value={host ?? 'any'}
              options={[
                { value: 'any', label: 'Any host' },
                ...list.hosts.map((h) => ({ value: h.key, label: `${h.label} (${h.endpoints.length})` })),
              ]}
              onChange={(value) => go({ host: value === 'any' ? undefined : value })}
            />
          )}
          {transports.length > 1 && (
            <Select
              label="Transport"
              value={transport ?? 'any'}
              options={[
                { value: 'any', label: 'Any transport' },
                ...transports.map((t) => ({ value: t, label: TRANSPORT_LABEL[t] })),
              ]}
              onChange={(value) => go({ transport: value === 'any' ? undefined : value })}
            />
          )}
          <Select
            label="Status"
            value={status ?? 'any'}
            options={[
              { value: 'any', label: 'Any status' },
              ...ENDPOINT_STATUSES.map((s) => ({ value: s, label: ENDPOINT_STATUS_LABEL[s] })),
            ]}
            onChange={(value) => go({ status: value === 'any' ? undefined : value })}
          />
          <span className="muted">
            {shown.length} of {list.endpoints.length}
          </span>
        </div>
        {shown.length === 0 ? (
          <Empty>{list.endpoints.length === 0 ? 'No endpoints found.' : 'No endpoints match.'}</Empty>
        ) : (
          <ul className="list entity-list request-list endpoint-list">
            {paged.items.map(({ endpoint }, i) => {
              const h = hosts.get(endpoint.host)
              const heading = i === 0 || paged.items[i - 1]?.endpoint.host !== endpoint.host
              return [
                heading && h && (
                  <li key={`host:${h.key}`} className="endpoint-host">
                    <HostTitle host={h} />
                    <span className="spacer" />
                    <span className="muted">
                      {hostCounts.get(h.key)} endpoint{hostCounts.get(h.key) === 1 ? '' : 's'}
                    </span>
                  </li>
                ),
                <EndpointRow
                  key={endpoint.key}
                  endpoint={endpoint}
                  selected={endpoint.key === key}
                  link={href({ ...screen, endpointId: endpoint.key })}
                />,
              ]
            })}
          </ul>
        )}
        <ShowMore more={paged.more} onClick={paged.showMore} />
      </div>

      <aside className="split-side">
        {selected ? (
          <EndpointPanel endpoint={selected} host={hosts.get(selected.host)} />
        ) : (
          <Empty>
            {key
              ? 'This endpoint is not in the current scan.'
              : 'Select an endpoint to see who calls it, its types and captures.'}
          </Empty>
        )}
      </aside>
    </div>
  )
}

function HostTitle({ host }: { host: EndpointHost }) {
  return (
    <span className="endpoint-host-title">
      <strong>{host.kind === 'app' ? host.label : <code>{host.label}</code>}</strong>{' '}
      {host.kind === 'app' && <span className="muted">route handlers and server actions</span>}
      {host.kind === 'unknown' && <span className="muted">the scan could not read the base URL</span>}
    </span>
  )
}

function EndpointRow({ endpoint, selected, link }: { endpoint: Endpoint; selected: boolean; link: string }) {
  const { index } = useData()
  const pages = endpoint.routeIds.length
  const callers = endpoint.siteIds.length + endpoint.forwardedSiteIds.length
  return (
    <li className={selected ? 'selected' : undefined}>
      <a className="row-link" href={link}>
        <EndpointSummary endpoint={endpoint} />
      </a>
      <span className="muted request-owner">
        {callers === 0
          ? 'not called in the code'
          : `${callers} call site${callers === 1 ? '' : 's'}${pages > 0 ? ` · ${pages} page${pages === 1 ? '' : 's'}` : ''}`}
        {pages === 1 && endpoint.routeIds[0]
          ? ` (${index.routes.get(endpoint.routeIds[0])?.path ?? ''})`
          : ''}
      </span>
      <span className="spacer" />
      <EndpointBadges endpoint={endpoint} />
    </li>
  )
}

export function EndpointSummary({ endpoint }: { endpoint: Endpoint }) {
  const method = endpoint.transport === 'server-action' ? 'POST' : endpoint.method
  return (
    <span className="request-summary">
      <span className={`method method-${method === '?' ? 'unknown' : method.toLowerCase()}`}>{method}</span>
      <code className="request-url">
        {endpoint.transport === 'graphql' || endpoint.transport === 'server-action'
          ? endpointLabel(endpoint)
          : endpoint.pattern}
      </code>
    </span>
  )
}

function EndpointBadges({ endpoint }: { endpoint: Endpoint }) {
  return (
    <>
      {endpoint.transport !== 'http' && <Badge tone="muted">{TRANSPORT_LABEL[endpoint.transport]}</Badge>}
      <Badge
        tone={endpoint.browser ? 'client' : 'server'}
        title={endpoint.browser ? SIDE_TITLE.browser : SIDE_TITLE.server}
      >
        {endpoint.browser ? (endpoint.server ? 'browser + server' : 'browser') : 'server'}
      </Badge>
      {endpoint.contracts.length > 0 && (
        <Badge tone="muted" title={`Postman: ${endpoint.contracts.map((c) => c.name).join(', ')}`}>
          Postman
        </Badge>
      )}
      <EndpointStatusBadge endpoint={endpoint} />
    </>
  )
}

export function EndpointStatusBadge({ endpoint }: { endpoint: Endpoint }) {
  const of = endpoint.siteIds.length > 1 ? ` (${endpoint.verifiedSites} of ${endpoint.siteIds.length})` : ''
  switch (endpoint.status) {
    case 'verified':
      return (
        <Badge tone="ok" title="Live capture recorded a call to it">
          ✓ verified{of}
        </Badge>
      )
    case 'mismatch':
      return (
        <Badge tone="warn" title="Captured data doesn't match the types of a call site">
          ✗ type mismatch
        </Badge>
      )
    case 'needs-recheck':
      return (
        <Badge tone="warn" title="The code changed after the last capture. Use the app again to re-check it.">
          ↻ needs re-check
        </Badge>
      )
    case 'not-captured':
      return null
  }
}

const MAX_PAGES = 12

function EndpointPanel({ endpoint, host }: { endpoint: Endpoint; host?: EndpointHost }) {
  const { index } = useData()
  const sites = endpoint.siteIds.map((id) => index.requests.get(id)).filter((s): s is RequestSite => !!s)
  const forwarded = endpoint.forwardedSiteIds
    .map((id) => index.requests.get(id))
    .filter((s): s is RequestSite => !!s)
  const handler = endpoint.routeId ? index.routes.get(endpoint.routeId) : undefined
  const postman = index.model.postman

  return (
    <div className="panel">
      <header className="panel-head">
        <h2>
          <EndpointSummary endpoint={endpoint} />
        </h2>
        <span className="spacer" />
        <EndpointStatusBadge endpoint={endpoint} />
      </header>
      <dl className="request-facts">
        <dt>Host</dt>
        <dd>
          {host ? (
            <a href={href({ name: 'endpoints', q: '', host: host.key })}>
              {host.kind === 'app' ? host.label : <code>{host.label}</code>}
            </a>
          ) : (
            endpoint.host
          )}
          {host?.baseEnv && host.base && (
            <span className="muted">
              {' '}
              <code>process.env.{host.baseEnv}</code>, falls back to <code>{host.base}</code>
            </span>
          )}
        </dd>
        <dt>Transport</dt>
        <dd>
          {TRANSPORT_LABEL[endpoint.transport]}
          {endpoint.procedure && <span className="muted"> · {endpoint.procedure.type}</span>}
        </dd>
        <dt>Called from</dt>
        <dd>
          {endpoint.browser && endpoint.server
            ? 'the browser and the server'
            : endpoint.browser
              ? 'the browser'
              : endpoint.siteIds.length + endpoint.forwardedSiteIds.length > 0
                ? 'the server only'
                : 'nothing in the code'}
        </dd>
        {handler && (
          <>
            <dt>Served by</dt>
            <dd>
              <a href={href({ name: 'page', routeId: handler.id })}>
                <code>{handler.path}</code>
              </a>{' '}
              <span className="muted">route handler</span>
            </dd>
          </>
        )}
        {endpoint.queries.length > 0 && (
          <>
            <dt>Query</dt>
            <dd>
              {endpoint.queries.map((query, i) => (
                <span key={query}>
                  {i > 0 && ', '}
                  <code>?{query}</code>
                </span>
              ))}
            </dd>
          </>
        )}
        {endpoint.contracts.length > 0 && (
          <>
            <dt>Postman</dt>
            <dd>
              {endpoint.contracts.map((c) => c.name).join(', ')}
              {postman && <span className="muted"> in {postman.collection.name}</span>}
            </dd>
          </>
        )}
        {endpoint.routeIds.length > 0 && (
          <>
            <dt>On pages</dt>
            <dd>
              <ul className="chips">
                {endpoint.routeIds.slice(0, MAX_PAGES).map((id) => (
                  <li key={id}>
                    <a className="chip" href={href({ name: 'page', routeId: id })}>
                      {index.routes.get(id)?.path ?? id}
                    </a>
                  </li>
                ))}
                {endpoint.routeIds.length > MAX_PAGES && (
                  <li className="muted">and {endpoint.routeIds.length - MAX_PAGES} more</li>
                )}
              </ul>
            </dd>
          </>
        )}
        {endpoint.componentIds.length > 0 && (
          <>
            <dt>Components</dt>
            <dd>
              <ul className="chips">
                {endpoint.componentIds.slice(0, MAX_PAGES).map((id) => (
                  <li key={id}>
                    <a className="chip" href={href({ name: 'component', componentId: id })}>
                      {index.components.get(id)?.name ?? id}
                    </a>
                  </li>
                ))}
                {endpoint.componentIds.length > MAX_PAGES && (
                  <li className="muted">and {endpoint.componentIds.length - MAX_PAGES} more</li>
                )}
              </ul>
            </dd>
          </>
        )}
      </dl>

      <div className="request-chain">
        <h4>
          Call sites <span className="count">{sites.length}</span>
        </h4>
        {sites.length === 0 ? (
          <Empty>
            {forwarded.length > 0
              ? 'Only reached through the proxy below.'
              : 'Nothing in the code calls it. It may be called by other apps, webhooks or by hand.'}
          </Empty>
        ) : (
          <SiteList sites={sites} />
        )}
      </div>
      {forwarded.length > 0 && (
        <div className="request-chain">
          <h4>
            Forwarded here <span className="count">{forwarded.length}</span>
          </h4>
          <p className="muted">Requests to a catch-all route handler that sends them on to this URL.</p>
          <SiteList sites={forwarded} />
        </div>
      )}

      <TypeBlock
        title="Request body"
        text={endpoint.bodyType?.text}
        shape={endpoint.bodyType?.shape}
        source={endpoint.bodyType?.source}
      />
      {endpoint.transport !== 'sse' && endpoint.transport !== 'websocket' && (
        <TypeBlock
          title="Response"
          text={endpoint.responseType?.text}
          shape={endpoint.responseType?.shape}
          source={endpoint.responseType?.source}
          empty={sites.length > 0 ? 'Not found in the code. Live capture will fill it in.' : undefined}
        />
      )}
      <EndpointCaptures endpoint={endpoint} />
    </div>
  )
}

function SiteList({ sites }: { sites: RequestSite[] }) {
  const { index } = useData()
  return (
    <CappedList
      className="list"
      items={sites}
      render={(site) => {
        const call = site.callStack[0]
        return (
          <li key={site.id}>
            <a href={href({ name: 'requests', siteId: site.id, q: '' })}>{siteOwner(site, index)}</a>
            {site.method && site.method !== sites[0]?.method && <span className="muted"> {site.method}</span>}
            <span className="spacer" />
            {call && <SourceLink file={call.file} line={call.line} column={call.column} />}
          </li>
        )
      }}
    />
  )
}

/** The newest captures matched to any of the endpoint's call sites. */
function EndpointCaptures({ endpoint }: { endpoint: Endpoint }) {
  const { meta } = useData()
  const captures = useCaptures(Boolean(meta.capture))
  const list = useMemo(() => {
    const ids = new Set(endpoint.siteIds)
    return (captures.data ?? []).filter((c) => matched(c).some((id) => ids.has(id)))
  }, [captures.data, endpoint])
  if (!meta.capture || list.length === 0) return null
  return (
    <div className="request-captures">
      <h4>
        Captured <span className="count">{list.length}</span>
      </h4>
      <ul>
        {list.slice(0, 5).map((c) => (
          <li key={c.id}>
            <a href={href({ name: 'live', captureId: c.id, q: '' })}>
              <code>
                {c.method} {c.url}
              </code>
            </a>
            <span className="spacer" />
            <TypeCheckBadge status={c.typeCheck} quiet /> <StaleBadge stale={c.stale} />{' '}
            <span className={c.status !== undefined && c.status < 400 ? 'muted' : 'warn'}>
              {c.status ?? 'failed'}
            </span>
            <span className="muted"> · {new Date(c.timestamp).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function matched(c: CaptureSummary): string[] {
  if (c.match?.status !== 'matched' || !c.match.siteId) return []
  return [c.match.siteId, ...(c.match.sharedWith ?? [])]
}
