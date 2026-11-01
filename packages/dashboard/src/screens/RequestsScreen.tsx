// Every request site in the scan, searchable and filterable, with the selected one beside the list (M21).
import { endpointLabel, type RequestSite } from '@flow-checker/shared'
import { useMemo } from 'react'
import { useData } from '../context'
import {
  countWhen,
  endpointsOf,
  filterRequests,
  groupSame,
  REQUEST_STATUSES,
  REQUEST_WHEN,
  type RequestWhen,
  requestWhen,
  siteOwner,
  warnings,
} from '../lists'
import { ownerHref, RequestItem, RequestSummary, SiteBadges } from '../RequestView'
import { href, replaceScreen, type Screen } from '../router'
import { Badge, Empty, SearchBox, Select, ShowMore, SourceLink, usePaged } from '../ui'

type RequestsScreen = Extract<Screen, { name: 'requests' }>

const WHEN_LABEL: Record<RequestWhen, string> = {
  load: 'On load',
  event: 'On events',
  server: 'Server-side',
  unknown: 'Unknown trigger',
}

const WHEN_TITLE: Record<RequestWhen, string> = {
  load: 'Sent while a page renders or loads: server render, query hooks, effects',
  event: 'Sent when the user interacts',
  server: 'Sent by route handlers, server actions or middleware',
  unknown: 'The scan could not tell what starts these requests',
}

const STATUS_LABEL: Record<RequestSite['status'], string> = {
  verified: 'Verified',
  mismatch: 'Type mismatch',
  'needs-recheck': 'Needs re-check',
  inferred: 'Not captured yet',
}

export function RequestsScreen(screen: RequestsScreen) {
  const { index } = useData()
  const { siteId, q, status, when, transport, flagged } = screen
  // The "when" counts follow the other filters, so each button says what it would show.
  const unwhen = useMemo(
    () => filterRequests(index, { q, status, transport, flagged }),
    [index, q, status, transport, flagged],
  )
  const whenCounts = useMemo(() => countWhen(unwhen), [unwhen])
  const groups = useMemo(() => {
    const sites = when ? unwhen.filter((s) => requestWhen(s) === when) : unwhen
    return groupSame(sites)
  }, [unwhen, when])
  const shownSites = groups.reduce((n, g) => n + g.length, 0)
  const transports = useMemo(() => [...new Set(index.model.requests.map((s) => s.transport))].sort(), [index])
  const selectedIndex = siteId ? groups.findIndex((g) => g.some((s) => s.id === siteId)) : -1
  const paged = usePaged(groups, `${q}|${status}|${when}|${transport}|${flagged}`, selectedIndex)
  const go = (next: Partial<RequestsScreen>) => replaceScreen({ ...screen, ...next })
  const link = (id: string) => href({ ...screen, siteId: id })
  const selected = siteId ? index.requests.get(siteId) : undefined

  return (
    <div className="screen screen-split">
      <div className="split-main">
        <div className="toolbar">
          <SearchBox
            value={q}
            onChange={(next) => go({ q: next })}
            placeholder="Search URL, component or file"
          />
          <fieldset className="segmented" aria-label="When it is sent">
            <button type="button" aria-pressed={when === undefined} onClick={() => go({ when: undefined })}>
              All
            </button>
            {REQUEST_WHEN.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={when === w}
                title={WHEN_TITLE[w]}
                onClick={() => go({ when: w })}
              >
                {WHEN_LABEL[w]} <span className="count">{whenCounts[w]}</span>
              </button>
            ))}
          </fieldset>
          <Select
            label="Status"
            value={status ?? 'any'}
            options={[
              { value: 'any', label: 'Any status' },
              ...REQUEST_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
            ]}
            onChange={(value) => go({ status: value === 'any' ? undefined : value })}
          />
          {transports.length > 1 && (
            <Select
              label="Transport"
              value={transport ?? 'any'}
              options={[
                { value: 'any', label: 'Any transport' },
                ...transports.map((t) => ({ value: t, label: t })),
              ]}
              onChange={(value) => go({ transport: value === 'any' ? undefined : value })}
            />
          )}
          <button
            type="button"
            className="button"
            aria-pressed={Boolean(flagged)}
            title="Only requests with something to check"
            onClick={() => go({ flagged: flagged ? undefined : true })}
          >
            ⚠ Flagged
          </button>
          <span className="muted">
            {shownSites} of {index.model.requests.length}
          </span>
        </div>
        {groups.length === 0 ? (
          <Empty>{index.model.requests.length === 0 ? 'No requests found.' : 'No requests match.'}</Empty>
        ) : (
          <ul className="list entity-list request-list">
            {paged.items.map((group) => (
              <RequestRow key={group[0]?.id} group={group} siteId={siteId} link={link} />
            ))}
          </ul>
        )}
        <ShowMore more={paged.more} onClick={paged.showMore} />
      </div>

      <aside className="split-side">
        {selected ? (
          <RequestPanel site={selected} />
        ) : (
          <Empty>
            {siteId
              ? 'This request is not in the current scan.'
              : 'Select a request to see its types, server hops and captures.'}
          </Empty>
        )}
      </aside>
    </div>
  )
}

/** One request, or the same request sent from several places folded into one row. */
function RequestRow({
  group,
  siteId,
  link,
}: {
  group: RequestSite[]
  siteId?: string
  link: (id: string) => string
}) {
  const { index } = useData()
  const first = group[0] as RequestSite
  const isSelected = group.some((s) => s.id === siteId)
  if (group.length === 1) {
    return (
      <li className={isSelected ? 'selected' : undefined}>
        <a className="row-link" href={link(first.id)}>
          <RequestSummary site={first} />
        </a>
        <span className="muted request-owner">from {siteOwner(first, index)}</span>
        <span className="spacer" />
        <SiteBadges site={first} />
      </li>
    )
  }
  const owners = [...new Set(group.map((s) => siteOwner(s, index)))]
  return (
    <li className="request-row-group">
      <details className="row-group" open={isSelected}>
        <summary>
          <RequestSummary site={first} />
          <span className="muted request-owner" title={owners.join(', ')}>
            from {owners.length === 1 ? owners[0] : `${owners.length} places`}
          </span>
          <span className="spacer" />
          <Badge tone="neutral" title={`Sent from ${group.length} places in the code`}>
            ×{group.length}
          </Badge>
          <SiteBadges site={first} />
        </summary>
        <ul className="list sublist">
          {group.map((site) => {
            const call = site.callStack[0]
            return (
              <li key={site.id} className={site.id === siteId ? 'selected' : undefined}>
                <a href={link(site.id)}>{siteOwner(site, index)}</a>
                {warnings(site).length > 0 && <Badge tone="warn">⚠ {warnings(site).length}</Badge>}
                <span className="spacer" />
                {call && <SourceLink file={call.file} line={call.line} column={call.column} />}
              </li>
            )
          })}
        </ul>
      </details>
    </li>
  )
}

const MAX_PAGES = 12

function RequestPanel({ site }: { site: RequestSite }) {
  const { index } = useData()
  const call = site.callStack[0]
  const owner = ownerHref(site)
  const routeIds = site.componentId
    ? (index.routesOf.get(site.componentId) ?? [])
    : site.routeId
      ? [site.routeId]
      : []
  const endpoints = endpointsOf(index).bySite.get(site.id) ?? []

  return (
    <div className="panel">
      <header className="panel-head">
        <h2>
          <RequestSummary site={site} />
        </h2>
        <span className="spacer" />
        {call && <SourceLink file={call.file} line={call.line} column={call.column} />}
      </header>
      <dl className="request-facts">
        <dt>Sent from</dt>
        <dd>
          {owner ? <a href={owner}>{siteOwner(site, index)}</a> : siteOwner(site, index)}{' '}
          <span className="muted">{ORIGIN_LABEL[site.origin]}</span>
        </dd>
        {endpoints.length > 0 && (
          <>
            <dt>Endpoint</dt>
            <dd>
              {endpoints.map((e, i) => (
                <span key={e.key}>
                  {i > 0 && <span className="muted"> then forwarded to </span>}
                  <a href={href({ name: 'endpoints', endpointId: e.key, q: '' })}>
                    <code>{endpointLabel(e)}</code>
                  </a>
                </span>
              ))}
            </dd>
          </>
        )}
        {routeIds.length > 0 && (
          <>
            <dt>On pages</dt>
            <dd>
              <ul className="chips">
                {routeIds.slice(0, MAX_PAGES).map((id) => (
                  <li key={id}>
                    <a
                      className="chip"
                      href={href({ name: 'page', routeId: id, componentId: site.componentId })}
                    >
                      {index.routes.get(id)?.path ?? id}
                    </a>
                  </li>
                ))}
                {routeIds.length > MAX_PAGES && (
                  <li className="muted">and {routeIds.length - MAX_PAGES} more</li>
                )}
              </ul>
            </dd>
          </>
        )}
      </dl>
      <RequestItem site={site} open />
    </div>
  )
}

const ORIGIN_LABEL: Record<RequestSite['origin'], string> = {
  component: 'component',
  'route-handler': 'route handler',
  'server-action': 'server action',
  middleware: 'middleware',
}
