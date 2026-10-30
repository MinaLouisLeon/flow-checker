// tRPC (M16): the router's procedures on the overview, and the procedure a request site calls
// (or runs in, for requests a procedure's resolver sends).
import type { Capture, RequestSite } from '@flow-checker/shared'
import type { ModelIndex } from './model-index'
import { siteHref, siteLabel } from './RequestView'
import { href } from './router'
import { Badge, Empty, Section, SourceLink } from './ui'

/** The "tRPC" fact on a request site. */
export function TrpcFact({ site, index }: { site: RequestSite; index: ModelIndex }) {
  if (!site.procedure) return null
  const procedure = index.model.trpc?.procedures.find((p) => p.path === site.procedure?.path)
  return (
    <>
      <dt>{site.transport === 'trpc' ? 'tRPC' : 'In procedure'}</dt>
      <dd>
        <code>{site.procedure.path}</code> <span className="muted">{site.procedure.type}</span>
        {procedure ? (
          <>
            {' '}
            <SourceLink file={procedure.loc.file} line={procedure.loc.line} column={procedure.loc.column} />
          </>
        ) : (
          site.transport === 'trpc' && <span className="warn"> · not found in the router</span>
        )}
      </dd>
    </>
  )
}

/** The "tRPC" fact on a capture: the procedure and, for a split batch, where it came from. */
export function TrpcCaptureFact({ capture, q }: { capture: Capture; q: string }) {
  const procedure = capture.procedure
  if (!procedure) return null
  const batch = procedure.batch
  return (
    <>
      <dt>tRPC</dt>
      <dd>
        <code>{procedure.path}</code> <span className="muted">{procedure.type}</span>
        {batch && (
          <span className="muted">
            {' '}
            · call {batch.index + 1} of {batch.size} in one batched request
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

export function TrpcSection({ index }: { index: ModelIndex }) {
  const trpc = index.model.trpc
  if (!trpc) return null
  const route = trpc.routeId ? index.routes.get(trpc.routeId) : undefined
  const unused = trpc.procedures.filter((p) => p.siteIds.length === 0).length
  return (
    <Section title="tRPC" aside={<span className="count">{trpc.procedures.length}</span>}>
      <p className="middleware-file">
        <span>
          endpoint <code>{trpc.endpoint}</code>
        </span>
        {route && (
          <a className="muted" href={href({ name: 'page', routeId: route.id })}>
            {route.file}
          </a>
        )}
        <span className="spacer" />
        {trpc.router && (
          <span className="muted">
            router <code>{trpc.router.name}</code>{' '}
            <SourceLink
              file={trpc.router.loc.file}
              line={trpc.router.loc.line}
              column={trpc.router.loc.column}
            />
          </span>
        )}
      </p>
      {trpc.procedures.length === 0 ? (
        <Empty>The router was not found, so procedures have no types. Client calls are still listed.</Empty>
      ) : (
        <>
          <p className="muted">
            {trpc.procedures.length - unused} of {trpc.procedures.length} procedure
            {trpc.procedures.length === 1 ? '' : 's'} called by the code
          </p>
          <ul className="list">
            {trpc.procedures.map((p) => (
              <li key={p.id}>
                <Badge tone={p.type === 'mutation' ? 'neutral' : 'muted'}>{p.type}</Badge>
                <code>{p.path}</code>
                {p.inputType && (
                  <span className="muted">
                    input <code>{p.inputType.text}</code>
                  </span>
                )}
                {p.outputType && (
                  <span className="muted">
                    output <code>{p.outputType.text}</code>
                  </span>
                )}
                <span className="spacer" />
                {p.siteIds.length === 0 ? (
                  <span className="muted">not called</span>
                ) : (
                  p.siteIds.map((id) => {
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
                <SourceLink file={p.loc.file} line={p.loc.line} column={p.loc.column} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  )
}
