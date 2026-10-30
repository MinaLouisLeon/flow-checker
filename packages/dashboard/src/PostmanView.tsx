// Postman collection (M15): the imported collection on the overview, and the collection request
// a request site calls. The collection is the API contract, so the lists here are the places the
// code and the contract disagree.
import type { Flag, PostmanRequest, PostmanSource, RequestSite } from '@flow-checker/shared'
import type { ModelIndex, ScanNote } from './model-index'
import { requestLabel } from './model-index'
import { siteHref, siteLabel } from './RequestView'
import { Badge, Empty, Section, SourceLink } from './ui'

const POSTMAN_FLAGS: Flag['kind'][] = ['not-in-collection', 'contract-mismatch', 'unused-endpoint']

export function isPostmanFlag(flag: Flag): boolean {
  return POSTMAN_FLAGS.includes(flag.kind)
}

/**
 * Notes that come from Postman flags on request sites. buildIndex files them as plain request
 * notes; the overview shows them in the Postman section instead.
 */
export function isPostmanNote(note: ScanNote, index: ModelIndex): boolean {
  const site = note.requestId ? index.requests.get(note.requestId) : undefined
  if (!site) return false
  return site.flags.some((f) => isPostmanFlag(f) && note.message === `${requestLabel(site)}: ${f.message}`)
}

/** `/users/:id?x=:y`, the collection request's path without the base URL. */
export function postmanPath(req: PostmanRequest): string {
  return `${req.url.path ?? req.url.text}${req.url.query ? `?${req.url.query}` : ''}`
}

function sourceText(source: PostmanSource): string {
  if (source.kind === 'cloud') return `Postman cloud ${source.id ?? ''}`.trim()
  return source.path ?? source.kind
}

/** The "Postman" fact on a request site: the collection request it calls and how it was matched. */
export function PostmanFact({ site, index }: { site: RequestSite; index: ModelIndex }) {
  if (!site.contract) return null
  const req = index.model.postman?.requests.find((r) => r.id === site.contract?.requestId)
  return (
    <>
      <dt>Postman</dt>
      <dd>
        {req && (
          <>
            <code>
              {req.method} {postmanPath(req)}
            </code>{' '}
          </>
        )}
        {site.contract.name}
        {req && req.folder.length > 0 && <span className="muted"> in {req.folder.join(' / ')}</span>}
        <span className="muted">
          {' · '}
          {site.contract.by === 'url'
            ? 'matched by URL'
            : 'URL filled from the collection (the code did not say)'}
        </span>
        {req?.unresolved && req.unresolved.length > 0 && (
          <span className="warn"> · no value for {req.unresolved.map((v) => `{{${v}}}`).join(', ')}</span>
        )}
      </dd>
    </>
  )
}

/** Marks a type that comes from a saved Postman example rather than the code. */
export function PostmanTypeBadge({ source }: { source?: 'postman' }) {
  if (source !== 'postman') return null
  return (
    <Badge tone="muted" title="Not in the code: taken from the Postman collection's saved example">
      from Postman example
    </Badge>
  )
}

export function PostmanSection({ index }: { index: ModelIndex }) {
  const pm = index.model.postman
  if (!pm) return null
  const called = pm.requests.filter((r) => r.siteIds.length > 0).length
  const unused = pm.requests.filter((r) => r.flags.some((f) => f.kind === 'unused-endpoint'))
  const flagged = (kind: Flag['kind']) =>
    index.model.requests.flatMap((site) =>
      site.flags.filter((f) => f.kind === kind).map((flag) => ({ site, flag })),
    )
  const notInCollection = flagged('not-in-collection')
  const mismatches = flagged('contract-mismatch')
  const filled = index.model.requests.filter((s) => s.contract?.by === 'code').length

  return (
    <Section title="Postman collection" aside={<span className="count">{pm.requests.length}</span>}>
      <p className="middleware-file">
        <span>{pm.collection.name}</span>
        <code className="muted">{sourceText(pm.collection.source)}</code>
        {pm.environment && (
          <span className="muted">
            environment {pm.environment.name} (<code>{sourceText(pm.environment.source)}</code>)
          </span>
        )}
        <span className="spacer" />
        <span className="muted">imported {new Date(pm.importedAt).toLocaleString()}</span>
      </p>
      <p className="muted">
        {called} of {pm.requests.length} collection request{pm.requests.length === 1 ? '' : 's'} called by the
        code · {notInCollection.length} request{notInCollection.length === 1 ? '' : 's'} not in the collection
        · {mismatches.length} contract mismatch{mismatches.length === 1 ? '' : 'es'}
        {filled > 0 && ` · ${filled} URL${filled === 1 ? '' : 's'} filled from the collection`}
      </p>

      {notInCollection.length > 0 && (
        <SiteFlagList title="Requests not in the collection" items={notInCollection} index={index} />
      )}
      {mismatches.length > 0 && (
        <SiteFlagList title="Types that don't match the saved examples" items={mismatches} index={index} />
      )}

      <h3>
        Endpoints no request calls <span className="count">{unused.length}</span>
      </h3>
      {unused.length === 0 ? (
        <Empty>The code calls every request in the collection.</Empty>
      ) : (
        <ul className="list">
          {unused.map((req) => (
            <li key={req.id}>
              <span className={`method method-${req.method.toLowerCase()}`}>{req.method}</span>
              <code>{postmanPath(req)}</code>
              <span>{req.name}</span>
              {req.folder.length > 0 && <span className="muted">in {req.folder.join(' / ')}</span>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function SiteFlagList({
  title,
  items,
  index,
}: {
  title: string
  items: { site: RequestSite; flag: Flag }[]
  index: ModelIndex
}) {
  return (
    <>
      <h3>
        {title} <span className="count">{items.length}</span>
      </h3>
      <ul className="list">
        {items.map(({ site, flag }) => {
          const link = siteHref(site)
          const first = site.callStack[0]
          return (
            <li key={`${site.id}:${flag.kind}`}>
              <span className="warn-icon" aria-hidden>
                ⚠
              </span>
              <span title={flag.message}>
                {link ? <a href={link}>{siteLabel(site, index)}</a> : siteLabel(site, index)}
                <span className="muted"> {flag.message}</span>
              </span>
              <span className="spacer" />
              {first && <SourceLink file={first.file} line={first.line} column={first.column} />}
            </li>
          )
        })}
      </ul>
    </>
  )
}
