// GraphQL (M17): operations, fragments, clients and the schema on the overview, the operation a
// request site sends, and the operation a capture carried.
import { type Capture, type GraphqlOperation, type RequestSite, urlText } from '@flow-checker/shared'
import type { ModelIndex } from './model-index'
import { siteHref, siteLabel } from './RequestView'
import { href } from './router'
import { Badge, Empty, Section, SourceLink } from './ui'

const TYPES_FROM: Record<NonNullable<GraphqlOperation['typesFrom']>, string> = {
  code: 'types from the code',
  codegen: 'types from codegen',
  relay: 'types from the Relay compiler',
  schema: 'types from the schema',
  introspection: 'types from introspection',
}

/** The "GraphQL" fact on a request site. */
export function GraphqlFact({ site, index }: { site: RequestSite; index: ModelIndex }) {
  if (site.transport !== 'graphql') return null
  const op = site.operation && index.model.graphql?.operations.find((o) => o.id === site.operation?.id)
  return (
    <>
      <dt>GraphQL</dt>
      <dd>
        {site.operation ? (
          <>
            <code>{site.operation.name || '(anonymous)'}</code>{' '}
            <span className="muted">{site.operation.type}</span>
            {op && (
              <>
                {op.typesFrom && <span className="muted"> · {TYPES_FROM[op.typesFrom]}</span>}{' '}
                <SourceLink file={op.loc.file} line={op.loc.line} column={op.loc.column} />
              </>
            )}
          </>
        ) : (
          <span className="warn">the document could not be found</span>
        )}
        {op?.errors?.map((e) => (
          <div key={e} className="warn">
            {e}
          </div>
        ))}
      </dd>
    </>
  )
}

/** The "GraphQL" fact on a capture: the operation and, for a split batch, where it came from. */
export function GraphqlCaptureFact({ capture, q }: { capture: Capture; q: string }) {
  const op = capture.operation
  if (!op) return null
  const batch = op.batch
  return (
    <>
      <dt>GraphQL</dt>
      <dd>
        <code>{op.name || (op.hash ? `#${op.hash.slice(0, 12)}` : '(anonymous)')}</code>{' '}
        {op.type && <span className="muted">{op.type}</span>}
        {op.persisted && <span className="muted"> · persisted id only</span>}
        {batch && (
          <span className="muted">
            {' '}
            · operation {batch.index + 1} of {batch.size} in one batched request
            {batch.index > 0 && (
              <>
                {' '}
                (first: <a href={href({ name: 'live', captureId: `${batch.id}-0`, q })}>{batch.id}-0</a>)
              </>
            )}
          </span>
        )}
      </dd>
    </>
  )
}

export function GraphqlSection({ index }: { index: ModelIndex }) {
  const graphql = index.model.graphql
  if (!graphql) return null
  const route = graphql.routeId ? index.routes.get(graphql.routeId) : undefined
  const unused = graphql.operations.filter((o) => o.siteIds.length === 0).length
  const schema = graphql.schema
  return (
    <Section title="GraphQL" aside={<span className="count">{graphql.operations.length}</span>}>
      <p className="middleware-file">
        <span>
          endpoint <code>{graphql.endpoint ? urlText(graphql.endpoint) : 'not found'}</code>
        </span>
        {route && (
          <a className="muted" href={href({ name: 'page', routeId: route.id })}>
            {route.file}
          </a>
        )}
        <span className="spacer" />
        {graphql.clients.map((c) => (
          <span key={`${c.loc.file}:${c.loc.line}`} className="muted">
            {c.library}
            {c.batching && ' · batching'}
            {c.persisted && ' · persisted queries'}
            {c.getForQueries && ' · GET queries'}{' '}
            <SourceLink file={c.loc.file} line={c.loc.line} column={c.loc.column} />
          </span>
        ))}
      </p>
      <p className="muted">
        {schema ? (
          schema.error ? (
            <span className="warn">
              The schema ({schema.path ?? schema.url}) could not be read: {schema.error}
            </span>
          ) : (
            <>
              Schema:{' '}
              {schema.source === 'file' ? (
                <code>{schema.path}</code>
              ) : (
                <>
                  introspection of <code>{schema.url}</code>
                </>
              )}{' '}
              ({schema.types} types)
            </>
          )
        ) : (
          'No schema: operations without generated or written types have none.'
        )}
        {graphql.manifest && (
          <>
            {' '}
            · persisted queries from <code>{graphql.manifest.path}</code>
          </>
        )}
      </p>
      {graphql.operations.length === 0 ? (
        <Empty>No GraphQL documents were found.</Empty>
      ) : (
        <>
          <p className="muted">
            {graphql.operations.length - unused} of {graphql.operations.length} operation
            {graphql.operations.length === 1 ? '' : 's'} sent by the code
          </p>
          <ul className="list">
            {graphql.operations.map((op) => (
              <li key={op.id}>
                <Badge tone={op.type === 'mutation' ? 'neutral' : 'muted'}>{op.type}</Badge>
                <code title={op.document}>{op.name || '(anonymous)'}</code>
                {op.variablesType && (
                  <span className="muted">
                    variables <code>{op.variablesType.text}</code>
                  </span>
                )}
                {op.resultType && (
                  <span className="muted">
                    data <code>{op.resultType.text}</code>
                  </span>
                )}
                {op.typesFrom && <span className="muted">{op.typesFrom}</span>}
                {op.errors && op.errors.length > 0 && (
                  <span className="warn" title={op.errors.join('\n')}>
                    {op.errors.length} schema error{op.errors.length === 1 ? '' : 's'}
                  </span>
                )}
                <span className="spacer" />
                {op.siteIds.length === 0 ? (
                  <span className="muted">not sent</span>
                ) : (
                  op.siteIds.map((id) => {
                    const site = index.requests.get(id)
                    const link = site && siteHref(site)
                    const label = site ? siteLabel(site, index).split(' · ')[0] : id
                    return link ? (
                      <a key={id} href={link}>
                        {label}
                      </a>
                    ) : (
                      <span key={id}>{label}</span>
                    )
                  })
                )}
                <SourceLink file={op.loc.file} line={op.loc.line} column={op.loc.column} />
              </li>
            ))}
          </ul>
        </>
      )}
      {graphql.fragments.length > 0 && (
        <>
          <h4>Fragments</h4>
          <ul className="list">
            {graphql.fragments.map((f) => (
              <li key={f.id}>
                <code title={f.document}>{f.name}</code>
                <span className="muted">on {f.on}</span>
                <span className="spacer" />
                {f.componentIds.map((id) => (
                  <a key={id} href={href({ name: 'component', componentId: id })}>
                    {index.components.get(id)?.name ?? id}
                  </a>
                ))}
                <SourceLink file={f.loc.file} line={f.loc.line} column={f.loc.column} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  )
}
