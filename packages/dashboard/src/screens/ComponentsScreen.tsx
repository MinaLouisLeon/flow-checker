// Every component in the scan, searchable and filterable, with the selected one beside the list (M21).
import { useMemo } from 'react'
import { useData } from '../context'
import {
  COMPONENT_KINDS,
  type ComponentHas,
  type ComponentSort,
  componentRows,
  filterComponents,
  sortComponents,
} from '../lists'
import { href, replaceScreen, type Screen } from '../router'
import { Badge, Empty, KindBadge, SearchBox, Select, ShowMore, SourceLink, usePaged } from '../ui'
import { ComponentPanel } from './ComponentPanel'

type ComponentsScreen = Extract<Screen, { name: 'components' }>

const HAS_OPTIONS: { value: ComponentHas | 'any'; label: string }[] = [
  { value: 'any', label: 'Any component' },
  { value: 'requests', label: 'Sends requests' },
  { value: 'notes', label: 'Has things to check' },
  { value: 'no-page', label: 'Not on any page' },
]

const SORT_OPTIONS: { value: ComponentSort; label: string }[] = [
  { value: 'name', label: 'Sort by name' },
  { value: 'requests', label: 'Most requests first' },
  { value: 'pages', label: 'On most pages first' },
]

export function ComponentsScreen(screen: ComponentsScreen) {
  const { index } = useData()
  const { componentId, q, kind, has, sort } = screen
  const rows = useMemo(() => componentRows(index), [index])
  // Kind counts follow the other filters, so each button says what it would show.
  const unkinded = useMemo(() => filterComponents(rows, { q, has }), [rows, q, has])
  const list = useMemo(
    () => sortComponents(kind ? unkinded.filter((r) => r.component.kind === kind) : unkinded, sort),
    [unkinded, kind, sort],
  )
  const selectedIndex = componentId ? list.findIndex((r) => r.component.id === componentId) : -1
  const paged = usePaged(list, `${q}|${kind}|${has}|${sort}`, selectedIndex)
  const go = (next: Partial<ComponentsScreen>) => replaceScreen({ ...screen, ...next })
  const link = (id: string) => href({ ...screen, componentId: id })

  return (
    <div className="screen screen-split">
      <div className="split-main">
        <div className="toolbar">
          <SearchBox
            value={q}
            onChange={(next) => go({ q: next })}
            placeholder="Search components and files"
          />
          <fieldset className="segmented" aria-label="Component kind">
            {[undefined, ...COMPONENT_KINDS].map((k) => (
              <button
                key={k ?? 'all'}
                type="button"
                aria-pressed={kind === k}
                onClick={() => go({ kind: k })}
              >
                {k ?? 'All'}
                {k && <span className="count">{unkinded.filter((r) => r.component.kind === k).length}</span>}
              </button>
            ))}
          </fieldset>
          <Select
            label="Show"
            value={has ?? 'any'}
            options={HAS_OPTIONS}
            onChange={(value) => go({ has: value === 'any' ? undefined : value })}
          />
          <Select
            label="Sort"
            value={sort ?? 'name'}
            options={SORT_OPTIONS}
            onChange={(value) => go({ sort: value })}
          />
          <span className="muted">
            {list.length} of {rows.length}
          </span>
        </div>
        {list.length === 0 ? (
          <Empty>{rows.length === 0 ? 'No components found.' : 'No components match.'}</Empty>
        ) : (
          <ul className="list entity-list component-list">
            {paged.items.map(({ component, pages, requests, notes }) => (
              <li key={component.id} className={component.id === componentId ? 'selected' : undefined}>
                <a href={link(component.id)}>{component.name}</a>
                <KindBadge component={component} />
                <span className="muted entity-counts">
                  {count(pages, 'page')} · {count(requests, 'request')}
                </span>
                {notes > 0 && (
                  <Badge tone="warn" title={`${count(notes, 'thing')} to check`}>
                    ⚠ {notes}
                  </Badge>
                )}
                <span className="spacer" />
                <SourceLink
                  file={component.loc.file}
                  line={component.loc.line}
                  column={component.loc.column}
                />
              </li>
            ))}
          </ul>
        )}
        <ShowMore more={paged.more} onClick={paged.showMore} />
      </div>

      <aside className="split-side">
        {componentId && index.components.has(componentId) ? (
          <ComponentPanel componentId={componentId} componentHref={link} />
        ) : (
          <Empty>
            {componentId
              ? 'This component is not in the current scan.'
              : 'Select a component to see its props, requests and where it is rendered.'}
          </Empty>
        )}
      </aside>
    </div>
  )
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}
