import { useData } from '../context'
import { useShowDetails } from '../details'
import { RequestList } from '../RequestView'
import { href } from '../router'
import { TypeShapeView } from '../TypeShapeView'
import { Badge, CappedList, Empty, KindBadge, PageAccess, RefBadges, Section, SourceLink } from '../ui'

export function ComponentPanel({
  componentId,
  routeId,
  componentHref,
}: {
  componentId: string
  routeId?: string
  /** Where links to other components go. Default: the page view, or the component's own screen. */
  componentHref?: (id: string) => string
}) {
  const { index } = useData()
  const details = useShowDetails()
  const component = index.components.get(componentId)
  if (!component) {
    return (
      <Empty>
        This component is not in the current scan. <a href={href({ name: 'overview' })}>Back to overview</a>
      </Empty>
    )
  }

  const parents = index.renderedBy.get(component.id) ?? []
  const routeIds = index.routesOf.get(component.id) ?? []
  const notes = index.notes.filter((n) => n.componentId === component.id)
  const link =
    componentHref ??
    ((id: string) =>
      routeId
        ? href({ name: 'page', routeId, componentId: id })
        : href({ name: 'component', componentId: id }))

  return (
    <div className="panel">
      <header className="panel-head">
        <h2>{component.name}</h2>
        <KindBadge component={component} />
        <span className="spacer" />
        <SourceLink file={component.loc.file} line={component.loc.line} column={component.loc.column} />
      </header>

      {notes.length > 0 && (
        <ul className="notes">
          {notes.map((n) => (
            <li key={`${n.file}:${n.line}:${n.message}`}>⚠ {n.message}</li>
          ))}
        </ul>
      )}

      <Section title="Props">
        {component.propsType ? (
          <div className="props">
            <code className="muted">{component.propsType.text}</code>
            <TypeShapeView shape={component.propsType.shape} />
          </div>
        ) : (
          <Empty>Takes no props.</Empty>
        )}
      </Section>

      <Section title="Uses types">
        {component.usedTypes.length === 0 ? (
          <Empty>No project types used in the body.</Empty>
        ) : (
          <ul className="chips">
            {component.usedTypes.map((id) => (
              <li key={id}>
                <a className="chip" href={href({ name: 'types', typeId: id, q: '' })}>
                  {index.types.get(id)?.name ?? id}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Requests">
        <RequestList sites={index.requestsByComponent.get(component.id) ?? []} empty="Sends no requests." />
      </Section>

      <Section title="Renders">
        {component.children.length === 0 ? (
          <Empty>Renders no other components.</Empty>
        ) : (
          <ul className="list">
            {component.children.map((ref) => (
              <li key={`${ref.name}:${ref.loc.line}:${ref.loc.column}`}>
                {ref.componentId ? <a href={link(ref.componentId)}>{ref.name}</a> : <span>{ref.name}</span>}
                {details && ref.resolution === 'external' && (
                  <Badge tone="muted" title={ref.factory ? `Created by ${ref.factory}` : undefined}>
                    {ref.module ?? 'external'}
                  </Badge>
                )}
                <RefBadges site={ref} details={details} />
                <span className="spacer" />
                <SourceLink file={ref.loc.file} line={ref.loc.line} column={ref.loc.column} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Rendered by">
        {parents.length === 0 ? (
          <Empty>Not rendered by another project component.</Empty>
        ) : (
          <CappedList
            className="list"
            items={parents}
            render={(p) => (
              <li key={`${p.parentId}:${p.ref.loc.line}`}>
                <a href={link(p.parentId)}>{index.components.get(p.parentId)?.name ?? p.parentId}</a>
                <RefBadges site={p.ref} details={details} />
                <span className="spacer" />
                <SourceLink file={p.ref.loc.file} line={p.ref.loc.line} column={p.ref.loc.column} />
              </li>
            )}
          />
        )}
      </Section>

      <Section title="On pages">
        {routeIds.length === 0 ? (
          <Empty>Not reachable from any page.</Empty>
        ) : (
          <CappedList
            className="chips"
            items={routeIds}
            render={(id) => (
              <li key={id}>
                <a className="chip" href={href({ name: 'page', routeId: id, componentId: component.id })}>
                  {index.routes.get(id)?.path ?? id}
                </a>
                <PageAccess route={index.routes.get(id)} />
              </li>
            )}
          />
        )}
      </Section>
    </div>
  )
}
