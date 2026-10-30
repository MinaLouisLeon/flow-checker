// Middleware on a page or route handler (M14): whether `middleware.ts` / `proxy.ts` runs on it,
// the redirects that can send its requests elsewhere, rewrites that make it answer other paths,
// and the requests the middleware sends.
import { type MatcherCondition, type Middleware, type MiddlewareMatcher, urlText } from '@flow-checker/shared'
import type { ModelIndex } from './model-index'
import { RequestList } from './RequestView'
import { href } from './router'
import { Badge, Section, SourceLink } from './ui'

export function MiddlewareSection({ index, routeId }: { index: ModelIndex; routeId: string }) {
  const mw = index.model.middleware
  if (!mw) return null
  const runs = index.middlewareRoutes.get(routeId)
  const redirects = index.middlewareRedirects.get(routeId) ?? []
  const rewrites = index.rewritesTo.get(routeId) ?? []
  if (!runs && rewrites.length === 0) return null
  const path = (id: string | undefined) => (id ? (index.routes.get(id)?.path ?? '?') : undefined)

  return (
    <Section
      title="Middleware"
      aside={
        runs ? (
          <Badge tone={runs.conditional ? 'muted' : 'server'} title={conditionTitle(mw)}>
            {runs.conditional ? 'may run' : 'runs here'}
          </Badge>
        ) : undefined
      }
    >
      <p className="middleware-file">
        <code>{mw.file}</code>
        {mw.factory && (
          <span className="muted">
            {' '}
            from {mw.factory.module} {mw.factory.name}
          </span>
        )}
        <span className="spacer" />
        <SourceLink file={mw.loc.file} line={mw.loc.line} column={mw.loc.column} />
      </p>
      {runs && (
        <p className="muted">
          Matcher:{' '}
          {mw.matcherText !== undefined
            ? `could not be read (${mw.matcherText})`
            : mw.matchers.length === 0
              ? 'every request'
              : mw.matchers.map(matcherText).join(', ')}
        </p>
      )}

      {redirects.length > 0 && (
        <>
          <h3>Redirects</h3>
          <ul className="list">
            {redirects.map((nav) => (
              <li key={nav.id}>
                <Badge tone="warn">
                  {nav.kind === 'permanent-redirect' ? 'permanent redirect' : 'redirect'}
                </Badge>
                {nav.targetRouteId ? (
                  <a href={href({ name: 'page', routeId: nav.targetRouteId })}>
                    <code>{urlText(nav.href)}</code>
                  </a>
                ) : (
                  <code>{urlText(nav.href)}</code>
                )}
                {nav.condition && <span className="muted">if {nav.condition}</span>}
                <span className="spacer" />
                <SourceLink file={nav.loc.file} line={nav.loc.line} column={nav.loc.column} />
              </li>
            ))}
          </ul>
        </>
      )}

      {rewrites.length > 0 && (
        <>
          <h3>Rewrites to this route</h3>
          <ul className="list">
            {rewrites.map((rw) => (
              <li key={rw.id}>
                <code>
                  {rw.from ? `${rw.from.path}${rw.from.kind === 'prefix' ? '/*' : ''}` : '(where it runs)'}
                </code>
                <span className="muted">answered by {path(rw.targetRouteId)}</span>
                {rw.condition && <span className="muted">if {rw.condition}</span>}
                <span className="spacer" />
                <SourceLink file={rw.loc.file} line={rw.loc.line} column={rw.loc.column} />
              </li>
            ))}
          </ul>
        </>
      )}

      {runs && index.middlewareRequests.length > 0 && (
        <>
          <h3>Requests it sends</h3>
          <RequestList sites={index.middlewareRequests} empty="" open={false} />
        </>
      )}
    </Section>
  )
}

function conditionTitle(mw: Middleware): string {
  return mw.matcherText !== undefined
    ? 'The matcher could not be read'
    : 'Runs only for some requests: a matcher with has / missing, or one that fits some values of a dynamic segment'
}

export function matcherText(m: MiddlewareMatcher): string {
  const cond = (word: string, list: MatcherCondition[] | undefined) =>
    list?.map((c) => `${word} ${c.type} ${c.key}${c.value !== undefined ? `=${c.value}` : ''}`) ?? []
  const extra = [...cond('has', m.has), ...cond('missing', m.missing)]
  return extra.length > 0 ? `${m.source} (${extra.join(', ')})` : m.source
}
