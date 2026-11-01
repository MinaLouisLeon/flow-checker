import {
  accessOf,
  type ComponentRef,
  guardAction,
  guardWhen,
  type Navigation,
  type QueryLink,
  type RequestSite,
  type Route,
  urlText,
} from '@flow-checker/shared'
import { useState } from 'react'
import { useData } from '../context'
import { areasOf, CAP, callerGroups, groupNavigations, sendLine, siteOwner } from '../lists'
import { MiddlewareSection } from '../MiddlewareView'
import { appUrl, type ModelIndex } from '../model-index'
import { ownerHref, QueryLinkList, RequestList, RequestSummary, triggerLabel } from '../RequestView'
import { href } from '../router'
import {
  AccessBadge,
  Badge,
  CappedList,
  CodeText,
  Empty,
  KindBadge,
  RefBadges,
  SearchBox,
  Section,
  SourceLink,
} from '../ui'
import { ComponentPanel } from './ComponentPanel'

export function PageView({ routeId, componentId }: { routeId: string; componentId?: string }) {
  const { index, meta } = useData()
  const route = index.routes.get(routeId)
  if (!route) {
    return (
      <div className="screen">
        <Empty>
          This page is not in the current scan. <a href={href({ name: 'overview' })}>Back to overview</a>
        </Empty>
      </div>
    )
  }

  const selected = componentId ?? route.componentId
  const open = appUrl(route, meta.appPort)
  if (route.kind === 'route-handler') return <RouteHandlerView route={route} index={index} />
  const requests = pageRequests(index, routeId)
  // The page's own tree, apart from what its layouts send on every page under them.
  const own = index.pageTree.get(route.id) ?? new Set<string>()
  const fromPage = requests.filter((s) => own.has(s.componentId as string))
  const fromLayouts = requests.filter((s) => !own.has(s.componentId as string))
  const onLoad = fromPage.filter((s) => LOAD_TRIGGERS.has(s.trigger.kind))
  const onEvent = fromPage.filter((s) => !LOAD_TRIGGERS.has(s.trigger.kind))
  const allLinks = pageLinks(index, routeId)
  const links = allLinks.filter((l) => own.has(l.componentId as string))
  const layoutLinks = allLinks.filter((l) => !own.has(l.componentId as string))
  const navigations = index.model.navigations.filter((n) => n.componentId && own.has(n.componentId))
  const area = areasOf(index).byRoute.get(route.id)

  return (
    <div className="screen screen-split">
      <div className="split-main">
        <header className="page-head">
          <h1>
            <code>{route.path}</code>
          </h1>
          <Badge>{route.kind === 'page' ? 'page' : 'route handler'}</Badge>
          <AccessBadge route={route} />
          {route.slot && <Badge tone="muted">slot @{route.slot}</Badge>}
          {route.intercepting && (
            <Badge tone="muted" title={`From ${route.intercepting.from}`}>
              intercepts {route.intercepting.marker}
            </Badge>
          )}
          <span className="spacer" />
          {open && (
            <a className="button" href={open} target="_blank" rel="noreferrer">
              Open in app ↗
            </a>
          )}
        </header>
        <div className="page-file">
          <SourceLink file={route.file} />
          {area && (
            <span className="muted">
              {' '}
              · area <a href={href({ name: 'areas', areaId: area.id, q: '' })}>{area.name}</a>
            </span>
          )}
        </div>

        {route.segments.some((s) => s.kind !== 'static') && (
          <Section title="Segments">
            <ul className="chips">
              {route.segments.map((s) => (
                <li key={s.raw}>
                  <span className={`chip seg-${s.kind}`} title={s.kind}>
                    {s.raw}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <AccessSection route={route} index={index} routeId={routeId} />

        <Section title="Layout chain">
          {route.layoutChain.length === 0 ? (
            <Empty>No layouts.</Empty>
          ) : (
            <ol className="list layout-chain">
              {route.layoutChain.map((l) => {
                const c = l.componentId ? index.components.get(l.componentId) : undefined
                return (
                  <li key={l.file}>
                    <Badge tone="muted">{l.kind}</Badge>
                    {c ? (
                      <a href={href({ name: 'page', routeId, componentId: c.id })}>{c.name}</a>
                    ) : (
                      <span className="muted">no component</span>
                    )}
                    <span className="spacer" />
                    <SourceLink file={l.file} />
                  </li>
                )
              })}
            </ol>
          )}
        </Section>

        <MiddlewareSection index={index} routeId={routeId} />

        {navigations.length > 0 && (
          <Section
            title="Leaves this page"
            aside={<span className="count">{groupNavigations(navigations).length}</span>}
          >
            <NavigationList navigations={navigations} />
          </Section>
        )}

        <Section title="Page-load requests" aside={<span className="count">{onLoad.length}</span>}>
          <RequestList sites={onLoad} empty="This page fetches nothing when it loads." open={false} owners />
        </Section>

        {onEvent.length > 0 && (
          <Section title="Requests on interaction" aside={<span className="count">{onEvent.length}</span>}>
            <RequestList sites={onEvent} empty="" open={false} owners />
          </Section>
        )}

        {fromLayouts.length + layoutLinks.length > 0 && (
          <Section
            title="From layouts"
            aside={<span className="count">{fromLayouts.length + layoutLinks.length}</span>}
          >
            <details className="layout-requests">
              <summary className="muted">
                Sent by the layouts around this page, on every page under them. Show them.
              </summary>
              <RequestList sites={fromLayouts} empty="" open={false} owners limit={CAP} />
              {layoutLinks.length > 0 && <QueryLinkList links={layoutLinks} />}
            </details>
          </Section>
        )}

        {links.length > 0 && (
          <Section title="Query cache" aside={<span className="count">{links.length}</span>}>
            <QueryLinkList links={links} />
          </Section>
        )}

        {(index.flowsByRoute.get(routeId) ?? []).length > 0 && (
          <Section
            title="Flows"
            aside={<span className="count">{index.flowsByRoute.get(routeId)?.length}</span>}
          >
            <ul className="list">
              {(index.flowsByRoute.get(routeId) ?? []).map((flow) => (
                <li key={flow.id}>
                  <a href={href({ name: 'flows', flowId: flow.id, q: '' })}>{flow.name}</a>
                  <span className="spacer" />
                  <span className="muted">
                    {flow.routeId === routeId
                      ? 'starts here'
                      : flow.startRouteIds?.includes(routeId)
                        ? 'starts here (in a layout)'
                        : 'passes through'}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Component tree">
          {route.componentId ? (
            <ul className="tree component-tree">
              <TreeItem
                componentId={route.componentId}
                routeId={routeId}
                selected={selected}
                ancestors={new Set()}
              />
            </ul>
          ) : (
            <Empty>No default-export component was found in this file.</Empty>
          )}
        </Section>
      </div>

      <aside className="split-side">
        {selected ? (
          <ComponentPanel componentId={selected} routeId={routeId} />
        ) : (
          <Empty>Select a component to see its details.</Empty>
        )}
      </aside>
    </div>
  )
}

const LOAD_TRIGGERS = new Set<RequestSite['trigger']['kind']>(['server-render', 'page-load', 'effect'])

/** Requests started by the page's components and layouts. */
function pageRequests(index: ModelIndex, routeId: string): RequestSite[] {
  return index.model.requests.filter(
    (s) => s.componentId && (index.routesOf.get(s.componentId) ?? []).includes(routeId),
  )
}

const NAV_LABEL: Record<Navigation['kind'], string> = {
  link: 'link',
  push: 'router.push',
  replace: 'router.replace',
  redirect: 'redirect',
  'permanent-redirect': 'permanent redirect',
}

/**
 * Where the page sends the user: redirects while it renders, links and router calls. The same
 * navigation found in several components (a shared hook) is one row.
 */
function NavigationList({ navigations }: { navigations: Navigation[] }) {
  const { index } = useData()
  // Redirects first: a page that only redirects is mostly that.
  const groups = groupNavigations(navigations).sort((a, b) => Number(isRedirect(b)) - Number(isRedirect(a)))
  return (
    <CappedList
      className="list nav-list"
      items={groups}
      render={(group) => {
        const nav = group[0] as Navigation
        const target = nav.targetRouteId ? index.routes.get(nav.targetRouteId) : undefined
        const options = target ? [] : candidatePages(index, nav.href)
        const owners = [
          ...new Set(
            group.flatMap((n) => (n.componentId ? [index.components.get(n.componentId)?.name ?? '?'] : [])),
          ),
        ]
        return (
          <li key={nav.id}>
            <Badge tone={isRedirect(group) ? 'warn' : 'muted'}>{NAV_LABEL[nav.kind]}</Badge>
            {target ? (
              <a href={href({ name: 'page', routeId: target.id })}>
                <code>{target.path}</code>
              </a>
            ) : (
              <code className="break" title={nav.href.text}>
                {urlText(nav.href)}
              </code>
            )}
            {options.length > 0 && (
              <span className="muted">
                {' '}
                one of{' '}
                {options.map((r, i) => (
                  <span key={r.id}>
                    {i > 0 && ', '}
                    <a href={href({ name: 'page', routeId: r.id })}>
                      <code>{r.path}</code>
                    </a>
                  </span>
                ))}
              </span>
            )}
            <span className="spacer" />
            <span className="muted" title={owners.length > 1 ? owners.join(', ') : undefined}>
              {triggerLabel(nav.trigger)}
              {owners.length === 1 ? ` · ${owners[0]}` : ''}
              {owners.length > 1 ? ` · from ${owners.length} components` : ''}
            </span>
            <SourceLink file={nav.loc.file} line={nav.loc.line} column={nav.loc.column} />
          </li>
        )
      }}
    />
  )
}

const isRedirect = (group: Navigation[]) => (group[0] as Navigation).kind.includes('redirect')

/** Pages an href with placeholders could go to: `/:locale/jobs/:param` -> `/[locale]/jobs/applied`, ... */
function candidatePages(index: ModelIndex, url: Navigation['href']): Route[] {
  if (!url.path) return []
  const want = url.path.split('/').filter(Boolean)
  const found: Route[] = []
  for (const route of index.model.routes) {
    if (route.kind !== 'page' || route.slot || route.intercepting) continue
    const have = route.path.split('/').filter(Boolean)
    if (have.length !== want.length) continue
    const fits = have.every((seg, i) => {
      const w = want[i] as string
      return w.startsWith(':') || (seg.startsWith('[') && !seg.startsWith('[...')) || seg === w
    })
    if (fits) found.push(route)
  }
  // Only worth listing when the placeholders leave a few pages.
  return found.length <= 6 ? found : []
}

/** React Query cache calls made by the page's components (M13). */
function pageLinks(index: ModelIndex, routeId: string): QueryLink[] {
  return index.model.queryLinks.filter(
    (l) => l.componentId && (index.routesOf.get(l.componentId) ?? []).includes(routeId),
  )
}

/**
 * A route handler: what it sends on, then who calls it, grouped by the URL each caller sends (for a
 * catch-all handler, the concrete paths), with callers at the same line folded into one row.
 */
function RouteHandlerView({ route, index }: { route: Route; index: ModelIndex }) {
  const [q, setQ] = useState('')
  const sends = index.handlerRequests.get(route.id) ?? []
  const callers = index.handlerCallers.get(route.id) ?? []
  const groups = callerGroups(callers, index, q)
  return (
    <div className="screen">
      <header className="page-head">
        <h1>
          <code>{route.path}</code>
        </h1>
        <Badge>route handler</Badge>
        {(route.methods ?? []).map((m) => (
          <span key={m} className={`method method-${m.toLowerCase()}`}>
            {m}
          </span>
        ))}
      </header>
      <div className="page-file">
        <SourceLink file={route.file} />
      </div>

      <MiddlewareSection index={index} routeId={route.id} />

      <Section title="Requests it sends" aside={<span className="count">{sends.length}</span>}>
        <RequestList sites={sends} empty="This handler sends no requests to other services." />
      </Section>

      <Section title="Called from" aside={<span className="count">{callers.length}</span>}>
        {callers.length === 0 ? (
          <Empty>No component in the scan calls this route.</Empty>
        ) : (
          <>
            {callers.length > CAP && (
              <div className="toolbar">
                <SearchBox value={q} onChange={setQ} placeholder="Search callers by URL, component or file" />
                <span className="muted">
                  {groups.reduce((n, g) => n + g.count, 0)} of {callers.length}
                </span>
              </div>
            )}
            {groups.length === 0 ? (
              <Empty>No caller matches.</Empty>
            ) : (
              <ul className="list caller-groups">
                {groups.map((group) => (
                  <li key={group.label} className="caller-group">
                    <div className="caller-url">
                      <RequestSummary site={(group.rows[0] as RequestSite[])[0] as RequestSite} />
                      <span className="spacer" />
                      <span className="count">{group.count}</span>
                    </div>
                    <CappedList
                      className="list callers"
                      items={group.rows}
                      render={(row) => <CallerRow key={(row[0] as RequestSite).id} row={row} />}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>
    </div>
  )
}

/** Callers that send the request from the same line: their components, and that line. */
function CallerRow({ row }: { row: RequestSite[] }) {
  const { index } = useData()
  const first = row[0] as RequestSite
  const owners = [...new Map(row.map((s) => [s.componentId ?? s.id, s])).values()]
  const at = sendLine(first)
  return (
    <li>
      {owners.length === 1 ? (
        <OwnerLink site={first} />
      ) : (
        <span title={owners.map((s) => siteOwner(s, index)).join(', ')}>
          from {owners.length} {first.componentId ? 'components' : 'places'}:{' '}
          {owners.slice(0, CAP).map((s, i) => (
            <span key={s.id}>
              {i > 0 && ', '}
              <OwnerLink site={s} />
            </span>
          ))}
          {owners.length > CAP && <span className="muted"> and {owners.length - CAP} more</span>}
        </span>
      )}
      {first.trigger.kind !== 'unknown' && <span className="muted"> · {triggerLabel(first.trigger)}</span>}
      <span className="spacer" />
      {at && <SourceLink file={at.file} line={at.line} column={at.column} />}
    </li>
  )
}

function OwnerLink({ site }: { site: RequestSite }) {
  const { index } = useData()
  const to = ownerHref(site)
  const name = siteOwner(site, index)
  return to ? <a href={to}>{name}</a> : <span>{name}</span>
}

function TreeItem({
  componentId,
  routeId,
  selected,
  ancestors,
  site,
}: {
  componentId: string
  routeId: string
  selected?: string
  ancestors: Set<string>
  site?: ComponentRef
}) {
  const { index } = useData()
  const [open, setOpen] = useState(true)
  const component = index.components.get(componentId)
  if (!component) return null

  const cycle = ancestors.has(componentId)
  const nextAncestors = new Set(ancestors).add(componentId)
  const hasChildren = !cycle && component.children.length > 0
  const noteCount = index.notes.filter((n) => n.componentId === componentId).length
  const requestCount = index.requestsByComponent.get(componentId)?.length ?? 0

  return (
    <li>
      <div className={`tree-row${selected === componentId ? ' selected' : ''}`}>
        {hasChildren ? (
          <button
            type="button"
            className="caret-button"
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="caret-space" />
        )}
        <a href={href({ name: 'page', routeId, componentId })}>{component.name}</a>
        <KindBadge component={component} />
        {site && <RefBadges site={site} />}
        {requestCount > 0 && (
          <Badge tone="neutral" title={`Sends ${requestCount} request${requestCount === 1 ? '' : 's'}`}>
            ⇄ {requestCount}
          </Badge>
        )}
        {noteCount > 0 && <Badge tone="warn">⚠ {noteCount}</Badge>}
        {cycle && <Badge tone="muted">recursive</Badge>}
      </div>
      {hasChildren && open && (
        <ul>
          {component.children.map((ref) =>
            ref.componentId ? (
              <TreeItem
                key={`${ref.name}:${ref.loc.line}:${ref.loc.column}`}
                componentId={ref.componentId}
                routeId={routeId}
                selected={selected}
                ancestors={nextAncestors}
                site={ref}
              />
            ) : (
              <li key={`${ref.name}:${ref.loc.line}:${ref.loc.column}`}>
                <div className="tree-row">
                  <span className="caret-space" />
                  <span className="muted">{ref.name}</span>
                  {ref.resolution === 'external' && <Badge tone="muted">{ref.module ?? 'external'}</Badge>}
                  <RefBadges site={ref} />
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </li>
  )
}

const GUARD_PLACE: Record<string, string> = {
  middleware: 'middleware',
  layout: 'layout',
  page: 'page',
  component: 'component',
}

/** What can stop the page from rendering (M31): middleware, layouts, the page and its components. */
function AccessSection({ route, index, routeId }: { route: Route; index: ModelIndex; routeId: string }) {
  const { seenGuards } = useData()
  const access = accessOf(route)
  const seen = seenGuards?.get(routeId)
  const summary =
    access.status === 'guarded'
      ? 'This page redirects or stops under the conditions below.'
      : access.status === 'open'
        ? 'Nothing in the middleware, the layouts or the page redirects or stops it.'
        : "Something may redirect or stop this page, but the scan can't say when."
  return (
    <Section title="Access" aside={<AccessBadge route={route} />}>
      <p className="muted">{summary}</p>
      {access.guards.length > 0 && (
        <ul className="list guard-list">
          {access.guards.map((guard) => {
            const target = guard.targetRouteId ? index.routes.get(guard.targetRouteId) : undefined
            const component = guard.componentId ? index.components.get(guard.componentId) : undefined
            return (
              <li key={guard.id} data-guard={guard.kind}>
                <Badge tone="muted">{GUARD_PLACE[guard.in]}</Badge>
                <span>
                  {target ? (
                    <>
                      <CodeText text={guardAction({ ...guard, target: undefined })} /> to{' '}
                      <a href={href({ name: 'page', routeId: target.id })}>
                        <code>{guard.target ?? target.path}</code>
                      </a>
                    </>
                  ) : (
                    <CodeText text={guardAction(guard)} />
                  )}{' '}
                  <CodeText text={guardWhen(guard)} />
                  {component && guard.in !== 'middleware' && (
                    <span className="muted"> · {component.name}</span>
                  )}
                </span>
                {seen?.has(guard.id) && (
                  <Badge tone="ok" title="A captured page visit was redirected or stopped like this">
                    seen
                  </Badge>
                )}
                <span className="spacer" />
                <SourceLink file={guard.loc.file} line={guard.loc.line} column={guard.loc.column} />
              </li>
            )
          })}
        </ul>
      )}
      {(access.reasons ?? []).length > 0 && (
        <ul className="list">
          {(access.reasons ?? []).map((reason) => (
            <li key={reason.text}>
              <Badge tone="muted">?</Badge>
              <span>
                <CodeText text={reason.text} />
              </span>
              <span className="spacer" />
              {reason.loc && <SourceLink file={reason.loc.file} line={reason.loc.line} />}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
