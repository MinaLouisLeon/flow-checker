// Client boundaries (M43): where the page's browser part starts, what each boundary brings to the
// browser, the code that needs the browser, and boundaries that could move lower.
import {
  bundleText,
  CLIENT_USE_LABELS,
  type ClientBoundary,
  type ClientUse,
  clientBoundaryOf,
  clientSummary,
  edgeWhere,
  lowerText,
  type ModelIndex,
  type PageClientBoundary,
  type Route,
} from '@flow-checker/shared'
import { useData } from './context'
import { useShowDetails } from './details'
import { href } from './router'
import { Badge, CappedList, CodeText, Section, SourceLink } from './ui'

export function ClientSection({ route }: { route: Route }) {
  const { index } = useData()
  const client = route.client
  if (!client) {
    return (
      <Section title="Client boundaries">
        <p className="muted">
          Scanned by an older version; scan again to see where this page's browser part starts.
        </p>
      </Section>
    )
  }
  return (
    <Section
      title="Client boundaries"
      aside={
        client.boundaries.length > 0 ? <span className="count">{client.boundaries.length}</span> : undefined
      }
    >
      <p className="muted" data-client-summary>
        <CodeText text={clientSummary(client)} />
      </p>
      {client.boundaries.length > 0 && (
        <CappedList
          className="list client-list"
          items={client.boundaries}
          render={(edge) => (
            <ClientBoundaryRow
              key={`${edge.componentId}<${edge.parentId ?? ''}`}
              edge={edge}
              route={route}
              index={index}
            />
          )}
        />
      )}
    </Section>
  )
}

function ClientBoundaryRow({
  edge,
  route,
  index,
}: {
  edge: PageClientBoundary
  route: Route
  index: ModelIndex
}) {
  const details = useShowDetails()
  const component = index.components.get(edge.componentId)
  const boundary = clientBoundaryOf(index.model, edge.componentId)
  const name = (id: string) => index.components.get(id)?.name ?? '?'
  return (
    <li data-client={component?.name}>
      <div className="cache-row">
        <Badge tone="client" term={['client', 'boundary']}>
          use client
        </Badge>
        <a href={href({ name: 'page', routeId: route.id, componentId: edge.componentId })}>
          {component?.name ?? '?'}
        </a>
        <span className="muted">
          <CodeText text={edgeWhere(edge, name)} />
        </span>
        {edge.via && (
          <span className="muted" data-client-via>
            · through <code>{edge.via}</code>
          </span>
        )}
        {details && edge.dynamic && (
          <Badge tone="muted" term={['component', 'lazy']}>
            lazy
          </Badge>
        )}
        {boundary?.lower && (
          <Badge tone="warn" term={['client', 'lower']}>
            could move lower
          </Badge>
        )}
        <span className="spacer" />
        {boundary && (
          <span className="muted" title="Components, project modules and their source size (an estimate)">
            {bundleText(boundary)}
          </span>
        )}
        <SourceLink file={edge.loc.file} line={edge.loc.line} column={edge.loc.column} />
      </div>
      {boundary?.lower && (
        <div className="muted" data-client-lower>
          <CodeText text={lowerText(boundary, name)} />
        </div>
      )}
      {boundary && boundary.packages.length > 0 && (
        <div className="muted">
          packages:{' '}
          {boundary.packages.map((p, i) => (
            <span key={p}>
              {i > 0 && ', '}
              <code>{p}</code>
            </span>
          ))}
        </div>
      )}
      {details && boundary && <BoundaryDetails boundary={boundary} route={route} index={index} />}
    </li>
  )
}

/** Why it needs the browser, and everything it brings, behind a toggle. */
function BoundaryDetails({
  boundary,
  route,
  index,
}: {
  boundary: ClientBoundary
  route: Route
  index: ModelIndex
}) {
  return (
    <details className="client-details">
      <summary className="muted">What it brings and why</summary>
      {boundary.uses.length > 0 && (
        <div className="muted">
          needs the browser for: <UseList uses={boundary.uses} />
        </div>
      )}
      <div className="muted">
        components:{' '}
        {boundary.componentIds.map((id, i) => {
          const c = index.components.get(id)
          return (
            <span key={id}>
              {i > 0 && ', '}
              <a href={href({ name: 'page', routeId: route.id, componentId: id })}>{c?.name ?? '?'}</a>
              {c?.kind === 'shared' && (
                <span title="Also rendered by server components"> (also on the server)</span>
              )}
            </span>
          )
        })}
      </div>
      <CappedList
        className="list client-modules"
        items={boundary.modules}
        render={(file) => (
          <li key={file}>
            <SourceLink file={file} />
          </li>
        )}
      />
    </details>
  )
}

/** "`useState` (hook), `onClick` (event handler)", each with a link to its line. */
export function UseList({ uses }: { uses: readonly ClientUse[] }) {
  return (
    <>
      {uses.map((use, i) => (
        <span key={`${use.kind}-${use.name}`} data-client-use={use.kind}>
          {i > 0 && ', '}
          <code>{use.name}</code> ({CLIENT_USE_LABELS[use.kind]}){' '}
          <SourceLink file={use.loc.file} line={use.loc.line} column={use.loc.column} />
        </span>
      ))}
    </>
  )
}
