import { useData } from '../context'
import type { NoteKind, ScanNote } from '../model-index'
import { href } from '../router'
import { Empty, Section, SourceLink } from '../ui'

const NOTE_GROUPS: Record<NoteKind, string> = {
  'missing-page-component': 'Pages without a component',
  'unresolved-component': 'Components the scan could not trace',
  'unresolved-type': 'Types that are only partly resolved',
}

export function Overview() {
  const { index } = useData()
  const { model } = index
  const pages = model.routes.filter((r) => r.kind === 'page')
  const handlers = model.routes.filter((r) => r.kind === 'route-handler')
  const byKind = (kind: string) => model.components.filter((c) => c.kind === kind).length

  return (
    <div className="screen">
      <div className="stats">
        <Stat label="Pages" value={pages.length} link={href({ name: 'map', view: 'graph', q: '' })} />
        <Stat
          label="Route handlers"
          value={handlers.length}
          link={href({ name: 'map', view: 'tree', q: '' })}
        />
        <Stat
          label="Components"
          value={model.components.length}
          detail={`${byKind('server')} server · ${byKind('client')} client · ${byKind('shared')} shared`}
        />
        <Stat label="Types" value={model.types.length} link={href({ name: 'types', q: '' })} />
        <Stat label="Requests" value="—" detail="Not scanned yet" />
        <Stat label="Flows" value="—" detail="Not scanned yet" />
      </div>

      <Section title="Verification">
        <div className="progress" role="progressbar" aria-valuenow={0} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-bar" style={{ width: '0%' }} />
        </div>
        <p className="muted">
          Everything on this map comes from the code scan. Requests become verified once live capture records
          them while you use the app.
        </p>
      </Section>

      <Section title="To check" aside={<span className="count">{index.notes.length}</span>}>
        {index.notes.length === 0 ? (
          <Empty>The scan resolved every page, component and type.</Empty>
        ) : (
          <NoteGroups notes={index.notes} />
        )}
      </Section>

      <Section title="Pages">
        <ul className="list">
          {pages.map((route) => (
            <li key={route.id}>
              <a href={href({ name: 'page', routeId: route.id })}>
                <code>{route.path}</code>
              </a>
              {route.slot && <span className="muted"> @{route.slot}</span>}
              {route.intercepting && <span className="muted"> intercepts {route.intercepting.marker}</span>}
              <span className="spacer" />
              <SourceLink file={route.file} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Stat({
  label,
  value,
  detail,
  link,
}: {
  label: string
  value: number | string
  detail?: string
  link?: string
}) {
  const content = (
    <>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {detail && <span className="stat-detail">{detail}</span>}
    </>
  )
  return link ? (
    <a className="stat" href={link}>
      {content}
    </a>
  ) : (
    <div className="stat">{content}</div>
  )
}

function NoteGroups({ notes }: { notes: ScanNote[] }) {
  return (
    <>
      {(Object.keys(NOTE_GROUPS) as NoteKind[]).map((kind) => {
        const group = notes.filter((n) => n.kind === kind)
        if (group.length === 0) return null
        return (
          <div key={kind} className="note-group">
            <h3>
              {NOTE_GROUPS[kind]} <span className="count">{group.length}</span>
            </h3>
            <ul className="list">
              {group.map((note) => (
                <li key={`${note.file}:${note.line}:${note.message}`}>
                  <span className="warn-icon" aria-hidden>
                    ⚠
                  </span>
                  <NoteLink note={note} />
                  <span className="spacer" />
                  <SourceLink file={note.file} line={note.line} column={note.column} />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </>
  )
}

function NoteLink({ note }: { note: ScanNote }) {
  const target = note.routeId
    ? href({ name: 'page', routeId: note.routeId })
    : note.componentId
      ? href({ name: 'component', componentId: note.componentId })
      : note.typeId
        ? href({ name: 'types', typeId: note.typeId, q: '' })
        : undefined
  return target ? <a href={target}>{note.message}</a> : <span>{note.message}</span>
}
