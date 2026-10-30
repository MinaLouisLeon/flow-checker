import { isVerified } from '@flow-checker/shared'
import { useFlows, useVerification } from '../api'
import { useData } from '../context'
import { GraphqlSection } from '../GraphqlView'
import type { NoteKind, ScanNote } from '../model-index'
import { isPostmanNote, PostmanSection } from '../PostmanView'
import { href } from '../router'
import { TrpcSection } from '../TrpcView'
import { Empty, Section, SourceLink } from '../ui'

const NOTE_GROUPS: Record<NoteKind, string> = {
  'needs-recheck': 'Requests whose code changed since they were captured',
  'type-mismatch': "Requests whose data doesn't match the types",
  'missing-page-component': 'Pages without a component',
  'unresolved-component': 'Components the scan could not trace',
  'unresolved-type': 'Types that are only partly resolved',
  request: 'Requests the scan could not fully resolve',
  middleware: 'Middleware the scan could not fully read',
}

export function Overview() {
  const { index, meta } = useData()
  const verification = useVerification(Boolean(meta.capture))
  const flowRuns = useFlows(Boolean(meta.capture)).data
  const confirmedFlows = index.model.flows.filter((f) => flowRuns?.flows[f.id]?.status === 'confirmed').length
  const counts = verification.data?.counts
  const { model } = index
  const pages = model.routes.filter((r) => r.kind === 'page')
  const handlers = model.routes.filter((r) => r.kind === 'route-handler')
  const byKind = (kind: string) => model.components.filter((c) => c.kind === kind).length
  const clientRequests = model.requests.filter((s) => s.origin === 'component')
  const onLoad = clientRequests.filter((s) =>
    ['server-render', 'page-load', 'effect'].includes(s.trigger.kind),
  ).length
  const onEvent = clientRequests.filter((s) => s.trigger.kind === 'event').length
  const serverHops = model.requests.length - clientRequests.length
  const verified = model.requests.filter(isVerified).length
  const mismatched = model.requests.filter((s) => s.status === 'mismatch').length
  // Postman flags get their own section below, not the generic "could not resolve" group.
  const notes = index.notes.filter((n) => !isPostmanNote(n, index))
  const percent = model.requests.length > 0 ? Math.round((verified / model.requests.length) * 100) : 0

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
        <Stat
          label="Requests"
          value={model.requests.length}
          detail={`${onLoad} on load · ${onEvent} on events · ${serverHops} server-side`}
        />
        <Stat
          label="Flows"
          value={model.flows.length}
          detail={
            meta.capture ? `${confirmedFlows} confirmed` : `${model.navigations.length} navigation links`
          }
          link={href({ name: 'flows', q: '' })}
        />
      </div>

      <Section title="Verification">
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="progress-bar" style={{ width: `${percent}%` }} />
        </div>
        <p className="muted">
          {verified} of {model.requests.length} requests verified. Everything on this map comes from the code
          scan. Requests become verified once live capture records them while you use the app.
        </p>
        {counts && counts.matched + counts.ambiguous + counts.unmatched > 0 && (
          <ul className="list">
            <li>
              <a href={href({ name: 'live', q: '', filter: 'matched' })}>
                {counts.matched} captured requests matched to a request site
              </a>
              {counts.manual > 0 && <span className="muted"> ({counts.manual} assigned by you)</span>}
            </li>
            {counts.ambiguous > 0 && (
              <li>
                <span className="warn-icon" aria-hidden>
                  ⚠
                </span>
                <a href={href({ name: 'live', q: '', filter: 'ambiguous' })}>
                  {counts.ambiguous} could be more than one request site. Pick the right one.
                </a>
              </li>
            )}
            {mismatched > 0 && (
              <li>
                <span className="warn-icon" aria-hidden>
                  ⚠
                </span>
                <a href={href({ name: 'live', q: '', filter: 'mismatch' })}>
                  {mismatched} request{mismatched === 1 ? '' : 's'} sent or received data that doesn't match
                  the types in the code.
                </a>
              </li>
            )}
            {counts.unmatched > 0 && (
              <li>
                <span className="warn-icon" aria-hidden>
                  ⚠
                </span>
                <a href={href({ name: 'live', q: '', filter: 'unmatched' })}>
                  {counts.unmatched} match no request site. The scanner probably missed them.
                </a>
              </li>
            )}
          </ul>
        )}
      </Section>

      <Section title="To check" aside={<span className="count">{notes.length}</span>}>
        {notes.length === 0 ? (
          <Empty>The scan resolved every page, component, type and request.</Empty>
        ) : (
          <NoteGroups notes={notes} />
        )}
      </Section>

      <PostmanSection index={index} />

      <TrpcSection index={index} />

      <GraphqlSection index={index} />

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
