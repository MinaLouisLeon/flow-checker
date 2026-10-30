import type { ComponentRef, QueryLink, RequestSite, Route } from '@flow-checker/shared'
import { useState } from 'react'
import { useData } from '../context'
import { MiddlewareSection } from '../MiddlewareView'
import { appUrl, type ModelIndex } from '../model-index'
import { QueryLinkList, RequestList } from '../RequestView'
import { href } from '../router'
import { Badge, Empty, KindBadge, RefBadges, Section, SourceLink } from '../ui'
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
  const onLoad = requests.filter((s) => LOAD_TRIGGERS.has(s.trigger.kind))
  const onEvent = requests.filter((s) => !LOAD_TRIGGERS.has(s.trigger.kind))
  const links = pageLinks(index, routeId)

  return (
    <div className="screen screen-split">
      <div className="split-main">
        <header className="page-head">
          <h1>
            <code>{route.path}</code>
          </h1>
          <Badge>{route.kind === 'page' ? 'page' : 'route handler'}</Badge>
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

        <Section title="Page-load requests" aside={<span className="count">{onLoad.length}</span>}>
          <RequestList sites={onLoad} empty="Nothing is fetched when this page loads." open={false} />
        </Section>

        {onEvent.length > 0 && (
          <Section title="Requests on interaction" aside={<span className="count">{onEvent.length}</span>}>
            <RequestList sites={onEvent} empty="" open={false} />
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
                  <span className="muted">{flow.routeId === routeId ? 'starts here' : 'passes through'}</span>
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

/** React Query cache calls made by the page's components (M13). */
function pageLinks(index: ModelIndex, routeId: string): QueryLink[] {
  return index.model.queryLinks.filter(
    (l) => l.componentId && (index.routesOf.get(l.componentId) ?? []).includes(routeId),
  )
}

function RouteHandlerView({ route, index }: { route: Route; index: ModelIndex }) {
  const sends = index.handlerRequests.get(route.id) ?? []
  const callers = index.handlerCallers.get(route.id) ?? []
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

      <Section title="Called from" aside={<span className="count">{callers.length}</span>}>
        {callers.length === 0 ? (
          <Empty>No component in the scan calls this route.</Empty>
        ) : (
          <ul className="list">
            {callers.map((site) => {
              const c = site.componentId ? index.components.get(site.componentId) : undefined
              return (
                <li key={site.id}>
                  <span className={`method method-${(site.method ?? 'unknown').toLowerCase()}`}>
                    {site.method ?? '?'}
                  </span>
                  {c ? <a href={href({ name: 'component', componentId: c.id })}>{c.name}</a> : <span>?</span>}
                  <span className="spacer" />
                  {site.callStack[0] && (
                    <SourceLink
                      file={site.callStack[0].file}
                      line={site.callStack[0].line}
                      column={site.callStack[0].column}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title="Requests it sends" aside={<span className="count">{sends.length}</span>}>
        <RequestList sites={sends} empty="This handler sends no requests to other services." />
      </Section>
    </div>
  )
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
