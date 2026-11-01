import { useData } from '../context'
import { CAP, type TypeRow, typeRows } from '../lists'
import { RequestList } from '../RequestView'
import { href, replaceScreen } from '../router'
import { TypeShapeView } from '../TypeShapeView'
import { Badge, CappedList, Empty, SearchBox, Section, SourceLink } from '../ui'

export function TypesScreen({ typeId, q, unused }: { typeId?: string; q: string; unused?: boolean }) {
  const { index } = useData()
  const { rows, unused: hiddenUnused } = typeRows(index, { q, unused, keep: typeId })
  const selected = typeId ? index.types.get(typeId) : undefined
  const shownTypes = rows.reduce((n, r) => n + r.types.length, 0)

  return (
    <div className="screen screen-split">
      <div className="split-main">
        <div className="toolbar">
          <SearchBox
            value={q}
            onChange={(next) => replaceScreen({ name: 'types', typeId, q: next, unused })}
            placeholder="Search types and files"
          />
          <span className="muted">
            {shownTypes} of {index.model.types.length}
          </span>
          {(unused || hiddenUnused > 0) && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={Boolean(unused)}
                onChange={(e) =>
                  replaceScreen({ name: 'types', typeId, q, unused: e.target.checked || undefined })
                }
              />{' '}
              Show unused{hiddenUnused > 0 ? ` (${hiddenUnused})` : ''}
            </label>
          )}
        </div>
        {rows.length === 0 ? (
          <Empty>
            {index.model.types.length === 0
              ? 'No project types found.'
              : hiddenUnused > 0
                ? 'No used types match. Show unused ones to see the rest.'
                : 'No types match.'}
          </Empty>
        ) : (
          <ul className="list type-list">
            {rows.map((row) => (
              <TypeListRow key={row.types[0]?.id} row={row} typeId={typeId} q={q} unused={unused} />
            ))}
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

const usesText = (n: number) => `${n} use${n === 1 ? '' : 's'}`

/** One type, or a generic with its instantiations under it. */
function TypeListRow({
  row,
  typeId,
  q,
  unused,
}: {
  row: TypeRow
  typeId?: string
  q: string
  unused?: boolean
}) {
  const first = row.types[0]
  if (!first) return null
  const link = (id: string) => href({ name: 'types', typeId: id, q, unused })
  const at = first.definedAt
  if (row.types.length === 1 && row.name === first.name) {
    return (
      <li className={first.id === typeId ? 'selected' : undefined}>
        <a href={link(first.id)}>{first.name}</a>
        <Badge tone="muted">{first.declarationKind}</Badge>
        <span className="muted">{usesText(row.total)}</span>
        <span className="spacer" />
        <SourceLink file={at.file} line={at.line} column={at.column} />
      </li>
    )
  }
  const open = row.types.some((t) => t.id === typeId)
  return (
    <li className="type-group">
      <details open={open || undefined}>
        <summary>
          <span className="type-group-name">{row.name}</span>
          <Badge tone="muted">generic</Badge>
          <span className="muted">
            {row.types.length} instantiation{row.types.length === 1 ? '' : 's'} · {usesText(row.total)}
          </span>
          <span className="spacer" />
          <SourceLink file={at.file} line={at.line} column={at.column} />
        </summary>
        <ul className="list type-instances">
          {row.types.map((t, i) => (
            <li key={t.id} className={t.id === typeId ? 'selected' : undefined}>
              <a href={link(t.id)}>{t.name}</a>
              <span className="muted">{usesText(row.uses[i] ?? 0)}</span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  )
}

function TypeDetail({ typeId }: { typeId: string }) {
  const { index } = useData()
  const type = index.types.get(typeId)
  if (!type) return null
  const usage = index.typeUsage.get(typeId) ?? { props: [], usedBy: [], inTypes: [], requests: [] }
  const componentLinks = (ids: string[]) => (
    <CappedList
      className="chips"
      items={ids}
      render={(id) => (
        <li key={id}>
          <a className="chip" href={href({ name: 'component', componentId: id })}>
            {index.components.get(id)?.name ?? id}
          </a>
        </li>
      )}
    />
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
          <CappedList
            className="chips"
            items={usage.inTypes}
            render={(id) => (
              <li key={id}>
                <a className="chip" href={href({ name: 'types', typeId: id, q: '' })}>
                  {index.types.get(id)?.name ?? id}
                </a>
              </li>
            )}
          />
        ) : (
          <Empty>No other type refers to it.</Empty>
        )}
      </Section>
      <Section title="Requests">
        <RequestList
          sites={usage.requests.map((id) => index.requests.get(id)).filter((s) => s !== undefined)}
          empty="No request body or response uses it."
          open={false}
          limit={CAP}
        />
      </Section>
    </div>
  )
}
