import { useData } from '../context'
import { href } from '../router'
import { TypeShapeView } from '../TypeShapeView'
import { Badge, Empty, KindBadge, RefBadges, Section, SourceLink } from '../ui'

export function ComponentPanel({ componentId, routeId }: { componentId: string; routeId?: string }) {
  const { index } = useData()
  const component = index.components.get(componentId)
  if (!component) return <Empty>This component is not in the current scan.</Empty>

  const parents = index.renderedBy.get(component.id) ?? []
  const routeIds = index.routesOf.get(component.id) ?? []
  const notes = index.notes.filter((n) => n.componentId === component.id)
  const link = (id: string) =>
    routeId ? href({ name: 'page', routeId, componentId: id }) : href({ name: 'component', componentId: id })

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
        <Empty>Request detection is not part of the scan yet.</Empty>
      </Section>

      <Section title="Renders">
        {component.children.length === 0 ? (
          <Empty>Renders no other components.</Empty>
        ) : (
          <ul className="list">
            {component.children.map((ref) => (
              <li key={`${ref.name}:${ref.loc.line}:${ref.loc.column}`}>
                {ref.componentId ? <a href={link(ref.componentId)}>{ref.name}</a> : <span>{ref.name}</span>}
                {ref.resolution === 'external' && (
                  <Badge tone="muted" title={ref.factory ? `Created by ${ref.factory}` : undefined}>
                    {ref.module ?? 'external'}
                  </Badge>
                )}
                <RefBadges site={ref} />
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
          <ul className="list">
            {parents.map((p) => (
              <li key={`${p.parentId}:${p.ref.loc.line}`}>
                <a href={link(p.parentId)}>{index.components.get(p.parentId)?.name ?? p.parentId}</a>
                <RefBadges site={p.ref} />
                <span className="spacer" />
                <SourceLink file={p.ref.loc.file} line={p.ref.loc.line} column={p.ref.loc.column} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="On pages">
        {routeIds.length === 0 ? (
          <Empty>Not reachable from any page.</Empty>
        ) : (
          <ul className="chips">
            {routeIds.map((id) => (
              <li key={id}>
                <a className="chip" href={href({ name: 'page', routeId: id, componentId: component.id })}>
                  {index.routes.get(id)?.path ?? id}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
