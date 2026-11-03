// Server cache map (M39): every tag with what sets and revalidates it, the cached data, the
// revalidation calls, and the flags for tags only one side has. Works in the static export.
import {
  CACHE_KIND_LABELS,
  cacheFlags,
  cacheOf,
  cacheTags,
  explain,
  invalidationText,
} from '@flow-checker/shared'
import { CacheEntryRow, InvalidationRow } from '../CacheView'
import { useData } from '../context'
import { Badge, CappedList, CodeText, Empty, Section, SourceLink } from '../ui'

export function CacheScreen() {
  const { index } = useData()
  const cache = cacheOf(index.model)
  const tags = cacheTags(cache)
  const flagged = cacheFlags(cache)
  const cacheComponents = index.model.project.cacheComponents

  return (
    <div className="screen screen-narrow">
      <h1>Server cache</h1>
      <p className="muted">
        What Next keeps on the server between requests (<code>fetch</code> cache options,{' '}
        <code>use cache</code>, <code>unstable_cache</code>), the tags on it, and the{' '}
        <code>revalidateTag</code> / <code>updateTag</code> / <code>revalidatePath</code> calls that refresh
        it.
        {cacheComponents ? ' Cache Components is on.' : ''} Read from the code; <code>next dev</code> doesn't
        cache like a build does. With <code>flow-checker dev</code> running, each entry also shows what Next's
        cache did while you used the app (hits, misses and skips).
      </p>
      {cache.entries.length === 0 && cache.invalidations.length === 0 ? (
        <Empty>The scan found no cached data and no revalidation calls.</Empty>
      ) : (
        <>
          <p>
            {cache.entries.length} cached · {cache.invalidations.length} revalidation call
            {cache.invalidations.length === 1 ? '' : 's'} · {tags.length} tag{tags.length === 1 ? '' : 's'}
            {flagged.length > 0 && <span className="warn"> · {flagged.length} to check</span>}
          </p>

          {flagged.length > 0 && (
            <Section title="To check">
              <ul className="list cache-list" data-section="to-check">
                {flagged.map(({ flag, entry, invalidation }) => {
                  const loc = (entry ?? invalidation)?.loc
                  return (
                    <li key={`${flag.kind}-${entry?.id ?? invalidation?.id}`} data-cache-flag={flag.kind}>
                      <div className="cache-row">
                        <Badge tone="warn" term={['cache', flag.kind]}>
                          {explain('cache', flag.kind)?.label ?? flag.kind}
                        </Badge>
                        <code>
                          {invalidation
                            ? invalidationText(invalidation)
                            : `${CACHE_KIND_LABELS[entry?.kind ?? 'fetch']} ${entry?.name}`}
                        </code>
                        <span className="spacer" />
                        {loc && <SourceLink file={loc.file} line={loc.line} column={loc.column} />}
                      </div>
                      <div className="muted">
                        <CodeText text={flag.message} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}

          {tags.length > 0 && (
            <Section title="Tags">
              <table className="table cache-tags">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Set by</th>
                    <th>Revalidated by</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((row) => (
                    <tr key={row.tag} data-tag={row.tag}>
                      <td>
                        <code>{row.tag}</code>
                      </td>
                      <td>
                        {row.entries.length === 0 ? (
                          <span className="warn">nothing</span>
                        ) : (
                          row.entries.map((e, i) => (
                            <span key={e.id}>
                              {i > 0 && ', '}
                              {CACHE_KIND_LABELS[e.kind]} <code>{e.name}</code>
                            </span>
                          ))
                        )}
                      </td>
                      <td>
                        {row.invalidations.length === 0 ? (
                          <span className="muted">nothing</span>
                        ) : (
                          row.invalidations.map((inv, i) => (
                            <span key={inv.id}>
                              {i > 0 && ', '}
                              <code>{inv.api}</code>
                              {inv.serverAction ? (
                                <span className="muted"> in {inv.serverAction.name}</span>
                              ) : (
                                <span className="muted"> in a route handler</span>
                              )}
                            </span>
                          ))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          <Section title="Cached data">
            {cache.entries.length === 0 ? (
              <Empty>Nothing is cached.</Empty>
            ) : (
              <CappedList
                items={cache.entries}
                className="list cache-list"
                render={(entry) => <CacheEntryRow key={entry.id} entry={entry} index={index} />}
              />
            )}
          </Section>

          <Section title="Revalidation calls">
            {cache.invalidations.length === 0 ? (
              <Empty>Nothing calls revalidateTag, updateTag or revalidatePath.</Empty>
            ) : (
              <CappedList
                items={cache.invalidations}
                className="list cache-list"
                render={(inv) => <InvalidationRow key={inv.id} inv={inv} index={index} />}
              />
            )}
          </Section>
        </>
      )}
    </div>
  )
}
