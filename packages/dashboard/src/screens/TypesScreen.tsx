import { useData } from '../context'
import { RequestList } from '../RequestView'
import { href, replaceScreen } from '../router'
import { TypeShapeView } from '../TypeShapeView'
import { Badge, Empty, matches, SearchBox, Section, SourceLink } from '../ui'

export function TypesScreen({ typeId, q }: { typeId?: string; q: string }) {
  const { index } = useData()
  const types = index.model.types.filter((t) => matches(q, t.name, t.definedAt.file))
  const selected = typeId ? index.types.get(typeId) : undefined

  return (
    <div className="screen screen-split">
      <div className="split-main">
        <div className="toolbar">
          <SearchBox
            value={q}
            onChange={(next) => replaceScreen({ name: 'types', typeId, q: next })}
            placeholder="Search types and files"
          />
          <span className="muted">
            {types.length} of {index.model.types.length}
          </span>
        </div>
        {types.length === 0 ? (
          <Empty>{index.model.types.length === 0 ? 'No project types found.' : 'No types match.'}</Empty>
        ) : (
          <ul className="list type-list">
            {types.map((t) => {
              const u = index.typeUsage.get(t.id)
              const uses = (u?.props.length ?? 0) + (u?.usedBy.length ?? 0) + (u?.inTypes.length ?? 0)
              return (
                <li key={t.id} className={t.id === typeId ? 'selected' : undefined}>
                  <a href={href({ name: 'types', typeId: t.id, q })}>{t.name}</a>
                  <Badge tone="muted">{t.declarationKind}</Badge>
                  <span className="muted">
                    {uses} use{uses === 1 ? '' : 's'}
                  </span>
                  <span className="spacer" />
                  <SourceLink file={t.definedAt.file} line={t.definedAt.line} column={t.definedAt.column} />
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <aside className="split-side">
        {selected ? (
          <TypeDetail typeId={selected.id} />
        ) : (
          <Empty>
            {typeId ? 'This type is not in the current scan.' : 'Select a type to see its shape.'}
          </Empty>
        )}
      </aside>
    </div>
  )
}

function TypeDetail({ typeId }: { typeId: string }) {
  const { index } = useData()
  const type = index.types.get(typeId)
  if (!type) return null
  const usage = index.typeUsage.get(typeId) ?? { props: [], usedBy: [], inTypes: [], requests: [] }
  const componentLinks = (ids: string[]) => (
    <ul className="chips">
      {ids.map((id) => (
        <li key={id}>
          <a className="chip" href={href({ name: 'component', componentId: id })}>
            {index.components.get(id)?.name ?? id}
          </a>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="panel">
      <header className="panel-head">
        <h2>{type.name}</h2>
        <Badge tone="muted">{type.declarationKind}</Badge>
        <span className="spacer" />
        <SourceLink file={type.definedAt.file} line={type.definedAt.line} column={type.definedAt.column} />
      </header>

      <Section title="Shape">
        <TypeShapeView shape={type.shape} />
      </Section>

      <Section title="Props of">
        {usage.props.length ? componentLinks(usage.props) : <Empty>Not used as props.</Empty>}
      </Section>
      <Section title="Used in">
        {usage.usedBy.length ? componentLinks(usage.usedBy) : <Empty>Not used in component bodies.</Empty>}
      </Section>
      <Section title="Referenced by types">
        {usage.inTypes.length ? (
          <ul className="chips">
            {usage.inTypes.map((id) => (
              <li key={id}>
                <a className="chip" href={href({ name: 'types', typeId: id, q: '' })}>
                  {index.types.get(id)?.name ?? id}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No other type refers to it.</Empty>
        )}
      </Section>
      <Section title="Requests">
        <RequestList
          sites={usage.requests.map((id) => index.requests.get(id)).filter((s) => s !== undefined)}
          empty="No request body or response uses it."
          open={false}
        />
      </Section>
    </div>
  )
}
