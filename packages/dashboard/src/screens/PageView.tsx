import type { ComponentRef } from '@flow-checker/shared'
import { useState } from 'react'
import { useData } from '../context'
import { appUrl } from '../model-index'
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

        <Section title="Page-load requests">
          <Empty>Request detection is not part of the scan yet.</Empty>
        </Section>

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
