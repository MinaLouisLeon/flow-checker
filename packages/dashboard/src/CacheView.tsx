// Server cache map (M39): rows for cached data and revalidation calls, shared by the Cache screen
// and the page view. With live capture, each entry also shows what Next's cache did (M40).
import {
  CACHE_KIND_LABELS,
  type CacheEntry,
  type CacheFlag,
  type CacheInvalidation,
  type CacheRuntime,
  cacheKeyText,
  cacheLifeText,
  cacheRuntimeText,
  explain,
  invalidationText,
  invalidationWhere,
  type ModelIndex,
} from '@flow-checker/shared'
import { useShowDetails } from './details'
import { href } from './router'
import { Badge, CodeText, SourceLink } from './ui'

/** Links to the pages and route handlers in a list of route ids. */
function RouteLinks({ ids, index }: { ids: readonly string[]; index: ModelIndex }) {
  return (
    <>
      {ids.map((id, i) => {
        const route = index.routes.get(id)
        return (
          <span key={id}>
            {i > 0 && ', '}
            <a href={href({ name: 'page', routeId: id })}>
              <code>{route?.path ?? id}</code>
            </a>
          </span>
        )
      })}
    </>
  )
}

export function CacheFlags({ flags }: { flags: readonly CacheFlag[] }) {
  if (flags.length === 0) return null
  return (
    <ul className="cache-flags">
      {flags.map((f) => (
        <li key={f.kind} data-cache-flag={f.kind}>
          <Badge tone="warn" term={['cache', f.kind]}>
            {explain('cache', f.kind)?.label ?? f.kind}
          </Badge>{' '}
          <CodeText text={f.message} />
        </li>
      ))}
    </ul>
  )
}

/**
 * What Next's cache did with an entry while the app ran. Flagged verdicts only get the counts: the
 * flag below the row says the rest.
 */
function CacheRuntimeLine({ runtime }: { runtime: CacheRuntime }) {
  const flagged = runtime.verdict === 'always-missed' || runtime.verdict === 'never-cached'
  return (
    <div className="muted" data-cache-runtime={runtime.verdict}>
      at runtime:{' '}
      {!flagged && (
        <Badge tone={runtime.verdict === 'cached' ? 'ok' : 'muted'} term={['cache', runtime.verdict]}>
          {explain('cache', runtime.verdict)?.label ?? runtime.verdict}
        </Badge>
      )}{' '}
      {cacheRuntimeText(runtime)}
      {runtime.keys > 1 ? ` · ${runtime.keys} different values` : ''}
    </div>
  )
}

/** One cached entry: its kind, name, tags, how long it is kept, and (with `pages`) where it is used. */
export function CacheEntryRow({
  entry,
  index,
  pages = true,
}: {
  entry: CacheEntry
  index: ModelIndex
  pages?: boolean
}) {
  const details = useShowDetails()
  const used = [...entry.pageIds, ...entry.handlerIds]
  return (
    <li data-cache-entry={entry.kind}>
      <div className="cache-row">
        <Badge tone="shared" term={['cache', entry.kind]}>
          {CACHE_KIND_LABELS[entry.kind]}
        </Badge>
        {details && entry.directive && entry.directive !== 'use cache' && (
          <Badge tone="muted">{entry.directive}</Badge>
        )}
        <code>{entry.name}</code>
        <span className="muted">
          {' '}
          · kept {cacheLifeText(entry)}
          {entry.inFile ? ' · whole file' : ''}
        </span>
        <span className="spacer" />
        <SourceLink file={entry.loc.file} line={entry.loc.line} column={entry.loc.column} />
      </div>
      {entry.tags.length > 0 && (
        <div className="muted">
          tags:{' '}
          {entry.tags.map((t, i) => (
            <span key={`${t.text}-${i}`}>
              {i > 0 && ', '}
              <code title={t.confidence === 'unknown' ? "Can't be read" : t.text}>{cacheKeyText(t)}</code>
            </span>
          ))}
        </div>
      )}
      {pages && used.length > 0 && (
        <div className="muted">
          used by <RouteLinks ids={used} index={index} />
        </div>
      )}
      {entry.runtime && <CacheRuntimeLine runtime={entry.runtime} />}
      <CacheFlags flags={entry.flags} />
    </li>
  )
}

/** One `revalidateTag` / `updateTag` / `revalidatePath` call: where it runs, and what it refreshes. */
export function InvalidationRow({ inv, index }: { inv: CacheInvalidation; index: ModelIndex }) {
  const entries = inv.entryIds.flatMap((id) => {
    const entry = index.model.cache?.entries.find((e) => e.id === id)
    return entry ? [entry] : []
  })
  const refreshed = [...inv.pageIds, ...inv.handlerIds]
  const where = invalidationWhere(inv, index.model.routes)
  return (
    <li data-invalidation={inv.api}>
      <div className="cache-row">
        <code>{invalidationText(inv)}</code>
        <span className="muted">
          {' '}
          in{' '}
          {inv.routeId ? (
            <a href={href({ name: 'page', routeId: inv.routeId })}>
              <CodeText text={where} />
            </a>
          ) : (
            <CodeText text={where} />
          )}
        </span>
        <span className="spacer" />
        <SourceLink file={inv.loc.file} line={inv.loc.line} column={inv.loc.column} />
      </div>
      {entries.length > 0 && (
        <div className="muted">
          refreshes{' '}
          {entries.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ', '}
              {CACHE_KIND_LABELS[e.kind]} <code>{e.name}</code>
            </span>
          ))}
        </div>
      )}
      {refreshed.length > 0 && (
        <div className="muted">
          pages: <RouteLinks ids={refreshed} index={index} />
        </div>
      )}
      <CacheFlags flags={inv.flags} />
    </li>
  )
}
