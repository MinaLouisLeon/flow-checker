// Areas (M30): one card per feature area (pages grouped by URL segment or feature folder), with the
// selected area's pages, components, flows, endpoints and open notes beside the cards.
import type { Area, AreaList } from '@flow-checker/shared'
import { type ReactNode, useMemo } from 'react'
import { useData } from '../context'
import { areaRows, areasOf, endpointsOf, filterAreas } from '../lists'
import { href, replaceScreen } from '../router'
import { Badge, CappedList, Empty, SearchBox, ShowMore, SourceLink, usePaged } from '../ui'
import { EndpointStatusBadge, EndpointSummary } from './EndpointsScreen'

/** The `areaId` of the card that lists what most areas share. */
export const SHARED_AREA = 'shared'

const BY_TEXT: Record<AreaList['by'], string> = {
  route: 'Pages are grouped by the first part of their URL.',
  folder:
    'The URLs give a single area, so pages are grouped by the feature folder that holds their components.',
}

export function AreasScreen({ areaId, q }: { areaId?: string; q: string }) {
  const { index } = useData()
  const list = areasOf(index)
  const rows = useMemo(() => areaRows(index, list), [index, list])
  const shown = useMemo(() => filterAreas(rows, q), [rows, q])
  const selectedIndex = areaId ? shown.findIndex((a) => a.id === areaId) : -1
  const paged = usePaged(shown, q, selectedIndex)
  const go = (next: { areaId?: string; q?: string }) => replaceScreen({ name: 'areas', areaId, q, ...next })
  const selected = areaId ? list.byId.get(areaId) : undefined
  const hasShared = list.sharedComponentIds.length > 0

  return (
    <div className="screen screen-split">
      <div className="split-main">
        <div className="toolbar">
          <SearchBox
            value={q}
            onChange={(next) => go({ q: next })}
            placeholder="Search areas, pages and components"
          />
          <span className="muted">
            {shown.length} of {list.areas.length}
          </span>
          <span className="spacer" />
          <a href={href({ name: 'map', view: 'graph', q: '', areas: true })}>Show on the map</a>
        </div>
        <p className="muted">
          {BY_TEXT[list.by]} Rename or merge areas with the <code>areas</code> option in{' '}
          <code>flow-checker.config.ts</code>.
        </p>
        {list.unknownConfig.length > 0 && (
          <div className="banner banner-warn">
            The <code>areas</code> config names {list.unknownConfig.length === 1 ? 'an area' : 'areas'} the
            scan didn't find: {list.unknownConfig.join(', ')}.
          </div>
        )}
        {shown.length === 0 ? (
          <Empty>{list.areas.length === 0 ? 'No pages found.' : 'No areas match.'}</Empty>
        ) : (
          <ul className="area-cards">
            {paged.items.map((area) => (
              <AreaCard
                key={area.id}
                area={area}
                selected={area.id === areaId}
                link={href({ name: 'areas', areaId: area.id, q })}
              />
            ))}
            {hasShared && paged.more === 0 && !q.trim() && (
              <li className={`area-card area-card-shared${areaId === SHARED_AREA ? ' selected' : ''}`}>
                <a className="area-card-link" href={href({ name: 'areas', areaId: SHARED_AREA, q })}>
                  <span className="area-card-name">Shared</span>
                  <span className="muted">used by more than half of the areas</span>
                  <span className="area-card-stats">
                    <span>
                      <strong>{list.sharedComponentIds.length}</strong> component
                      {list.sharedComponentIds.length === 1 ? '' : 's'}
                    </span>
                    <span>
                      <strong>{list.sharedRequestIds.length}</strong> request
                      {list.sharedRequestIds.length === 1 ? '' : 's'}
                    </span>
                  </span>
                </a>
              </li>
            )}
          </ul>
        )}
        <ShowMore more={paged.more} onClick={paged.showMore} />
      </div>

      <aside className="split-side">
        {areaId === SHARED_AREA && hasShared ? (
          <SharedPanel list={list} />
        ) : selected ? (
          <AreaPanel area={selected} />
        ) : (
          <Empty>
            {areaId
              ? 'This area is not in the current scan.'
              : 'Select an area to see its pages, components, flows and endpoints.'}
          </Empty>
        )}
      </aside>
    </div>
  )
}

function AreaCard({ area, selected, link }: { area: Area; selected: boolean; link: string }) {
  const stat = (n: number, one: string, many = `${one}s`) => (
    <span>
      <strong>{n}</strong> {n === 1 ? one : many}
    </span>
  )
  return (
    <li className={`area-card${selected ? ' selected' : ''}`}>
      <a className="area-card-link" href={link}>
        <span className="area-card-name">{area.name}</span>
        <code className="muted area-card-from">{area.from.join(', ')}</code>
        <span className="area-card-stats">
          {stat(area.routeIds.length, 'page')}
          {stat(area.flowIds.length, 'flow')}
          {stat(area.endpointKeys.length, 'endpoint')}
          {stat(area.sharedComponentIds.length, 'shared component')}
          {area.notes.length > 0 && (
            <span className="warn">
              ⚠ <strong>{area.notes.length}</strong> to check
            </span>
          )}
        </span>
      </a>
    </li>
  )
}

function AreaPanel({ area }: { area: Area }) {
  const { index } = useData()
  const endpoints = endpointsOf(index)
  const component = (id: string) => index.components.get(id)
  return (
    <div className="panel">
      <header className="panel-head">
        <h2>{area.name}</h2>
        {area.name !== area.key && <Badge tone="muted">{area.key}</Badge>}
        <span className="spacer" />
        <a href={href({ name: 'map', view: 'graph', q: '', areas: true })}>Map</a>
      </header>
      <p className="muted">
        From <code>{area.from.join(', ')}</code>
      </p>

      <AreaSection title="Pages" count={area.routeIds.length}>
        <CappedList
          className="list"
          items={area.routeIds}
          render={(id) => {
            const route = index.routes.get(id)
            return (
              <li key={id}>
                <a href={href({ name: 'page', routeId: id })}>
                  <code>{route?.path ?? id}</code>
                </a>
                <span className="spacer" />
                {route && <SourceLink file={route.file} />}
              </li>
            )
          }}
        />
      </AreaSection>

      <AreaSection title="Flows" count={area.flowIds.length} empty="No flows start here.">
        <CappedList
          className="list"
          items={area.flowIds}
          render={(id) => (
            <li key={id}>
              <a href={href({ name: 'flows', flowId: id, q: '' })}>{index.flows.get(id)?.name ?? id}</a>
            </li>
          )}
        />
      </AreaSection>

      <AreaSection title="Endpoints called" count={area.endpointKeys.length} empty="No requests.">
        <CappedList
          className="list"
          items={area.endpointKeys}
          render={(key) => {
            const ep = endpoints.byKey.get(key)
            if (!ep) return null
            return (
              <li key={key}>
                <a href={href({ name: 'endpoints', endpointId: key, q: '' })}>
                  <EndpointSummary endpoint={ep} />
                </a>
                <span className="spacer" />
                <EndpointStatusBadge endpoint={ep} />
              </li>
            )
          }}
        />
      </AreaSection>

      <AreaSection title="Components" count={area.componentIds.length}>
        <ComponentChips ids={area.componentIds} name={(id) => component(id)?.name} />
      </AreaSection>

      <AreaSection title="Shared components used" count={area.sharedComponentIds.length} empty="None.">
        <ComponentChips ids={area.sharedComponentIds} name={(id) => component(id)?.name} />
      </AreaSection>

      <AreaSection title="To check" count={area.notes.length} empty="Nothing open.">
        <CappedList
          className="list"
          items={area.notes}
          render={(note) => (
            <li key={`${note.kind}:${note.requestId ?? note.componentId ?? note.routeId}:${note.message}`}>
              <span className="warn-icon" aria-hidden>
                ⚠
              </span>
              {note.requestId ? (
                <a href={href({ name: 'requests', siteId: note.requestId, q: '' })}>{note.message}</a>
              ) : (
                <span>{note.message}</span>
              )}
              <span className="spacer" />
              {note.file && <SourceLink file={note.file} line={note.line} column={note.column} />}
            </li>
          )}
        />
      </AreaSection>
    </div>
  )
}

function SharedPanel({ list }: { list: AreaList }) {
  const { index } = useData()
  return (
    <div className="panel">
      <header className="panel-head">
        <h2>Shared</h2>
      </header>
      <p className="muted">
        Components used by more than half of the areas (layouts, headers, providers) and the requests only
        they send.
      </p>
      <AreaSection title="Components" count={list.sharedComponentIds.length}>
        <ComponentChips ids={list.sharedComponentIds} name={(id) => index.components.get(id)?.name} />
      </AreaSection>
      <AreaSection title="Requests" count={list.sharedRequestIds.length} empty="None.">
        <CappedList
          className="list"
          items={list.sharedRequestIds}
          render={(id) => {
            const site = index.requests.get(id)
            return (
              <li key={id}>
                <a href={href({ name: 'requests', siteId: id, q: '' })}>
                  <code>
                    {site ? `${site.method ?? '?'} ${site.url?.text ?? site.serverAction?.name ?? '?'}` : id}
                  </code>
                </a>
              </li>
            )
          }}
        />
      </AreaSection>
    </div>
  )
}

function AreaSection({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count: number
  empty?: string
  children: ReactNode
}) {
  if (count === 0 && !empty) return null
  return (
    <div className="request-chain">
      <h4>
        {title} <span className="count">{count}</span>
      </h4>
      {count === 0 ? <p className="muted">{empty}</p> : children}
    </div>
  )
}

const MAX_CHIPS = 24

function ComponentChips({ ids, name }: { ids: string[]; name: (id: string) => string | undefined }) {
  return (
    <ul className="chips">
      {ids.slice(0, MAX_CHIPS).map((id) => (
        <li key={id}>
          <a className="chip" href={href({ name: 'component', componentId: id })}>
            {name(id) ?? id}
          </a>
        </li>
      ))}
      {ids.length > MAX_CHIPS && <li className="muted">and {ids.length - MAX_CHIPS} more</li>}
    </ul>
  )
}
