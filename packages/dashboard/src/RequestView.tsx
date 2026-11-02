// One request site: method + URL, how and when it is sent, body and response types,
// the server hops it leads to, and the call stack from the component down to the network call.
import {
  explain,
  type Flag,
  formatQueryKey,
  hasCaptures,
  isInfoFlag,
  isUnknownKey,
  type QueryLink,
  queryLinkTarget,
  type RequestSite,
  type Trigger,
  urlText,
} from '@flow-checker/shared'
import { Children, type ReactNode, useState } from 'react'
import { useSiteCaptures, useVerification } from './api'
import { useData } from './context'
import { useShowDetails } from './details'
import { GraphqlFact } from './GraphqlView'
import { groupSame, hitsEveryQuery, siteOwner, warnings } from './lists'
import type { ModelIndex } from './model-index'
import { PostmanFact, PostmanTypeBadge } from './PostmanView'
import { href } from './router'
import { SocketMessages } from './SocketView'
import { StreamEvents } from './SseView'
import { TrpcFact } from './TrpcView'
import { SiteStatusBadge, SiteTypeCheckView, StaleBadge, TypeCheckBadge } from './TypeCheckView'
import { TypeShapeView } from './TypeShapeView'
import { Badge, CodeText, Empty, MoreButton, SourceLink, TermLink, useCapped } from './ui'

/** Where a site starts plus what it sends, e.g. `LoginForm · POST /auth/login`. */
export function siteLabel(site: RequestSite, index: ModelIndex): string {
  const target =
    site.transport === 'server-action'
      ? `action ${site.serverAction?.name ?? '?'}`
      : site.url
        ? urlText(site.url)
        : '?'
  return `${siteOwner(site, index)} · ${site.method ?? '?'} ${target}`
}

export { siteOwner }

/** Screen that shows the site: the request on its own, in the request list (M21). */
export function siteHref(site: RequestSite): string {
  return href({ name: 'requests', siteId: site.id, q: '' })
}

/** Screen that shows where a site runs: its component, or the route handler's page. */
export function ownerHref(site: RequestSite): string | undefined {
  if (site.componentId) return href({ name: 'component', componentId: site.componentId })
  if (site.routeId) return href({ name: 'page', routeId: site.routeId })
  return undefined
}

export function triggerLabel(trigger: Trigger): string {
  return trigger.kind === 'event' && trigger.event
    ? trigger.event
    : (explain('trigger', trigger.kind)?.label ?? trigger.kind)
}

/** What to do about a note, from the glossary, and a link to its entry (M34). */
function FlagHelp({ flag }: { flag: Flag }) {
  const todo = explain('flag', flag.kind)?.todo
  return (
    <span className="muted flag-help">
      {todo && <CodeText text={todo} />} <TermLink term={['flag', flag.kind]} />
    </span>
  )
}

/** Rows a request list shows before "+N more". */
const REQUEST_LIMIT = 20

export function RequestList({
  sites,
  empty,
  open,
  owners,
  limit = REQUEST_LIMIT,
}: {
  sites: RequestSite[]
  empty: string
  /** Rows shown before "+N more": lists of requests grow with the app. */
  limit?: number
  /** Expand the details. Default: when there are three or fewer. */
  open?: boolean
  /**
   * Lists from several components (a page): show where each request is sent from, and fold the
   * same request sent from several places into one row.
   */
  owners?: boolean
}) {
  const { index } = useData()
  const details = useShowDetails()
  const groups = owners ? groupSame(sites) : sites.map((s) => [s])
  const { shown, hidden, expand } = useCapped(groups, limit)
  if (sites.length === 0) return <Empty>{empty}</Empty>
  return (
    <ul className="requests">
      {shown.map((group) => {
        const first = group[0] as RequestSite
        if (group.length === 1)
          return (
            <li key={first.id}>
              <RequestItem site={first} open={open ?? sites.length <= 3} owner={owners} />
            </li>
          )
        const names = [...new Set(group.map((s) => siteOwner(s, index)))]
        return (
          <li key={first.id}>
            <LazyDetails className="request request-group">
              <summary>
                <RequestSummary site={first} />
                <span className="muted request-owner" title={names.join(', ')}>
                  from {names.length === 1 ? names[0] : `${names.length} places`}
                </span>
                <span className="spacer" />
                <Badge tone="neutral" term={['request', 'grouped']}>
                  ×{group.length}
                </Badge>
                {details && (
                  <Badge
                    tone={first.trigger.kind === 'unknown' ? 'warn' : 'neutral'}
                    term={['trigger', first.trigger.kind]}
                  >
                    {triggerLabel(first.trigger)}
                  </Badge>
                )}
              </summary>
              <ul className="requests">
                {group.map((site) => (
                  <li key={site.id}>
                    <RequestItem site={site} open={false} owner />
                  </li>
                ))}
              </ul>
            </LazyDetails>
          </li>
        )
      })}
      {hidden > 0 && (
        <li className="more-row">
          <MoreButton hidden={hidden} onClick={expand} />
        </li>
      )}
    </ul>
  )
}

/**
 * `<details>` whose content is only rendered once opened: a closed request still costs dozens of
 * DOM nodes (types, call path, cache links), and a page can list hundreds.
 */
function LazyDetails({
  className,
  open = false,
  children,
}: {
  className: string
  open?: boolean
  /** The `<summary>` first, then the body. */
  children: ReactNode
}) {
  const [opened, setOpened] = useState(open)
  const [summary, ...body] = Children.toArray(children)
  return (
    <details className={className} open={open} onToggle={(e) => e.currentTarget.open && setOpened(true)}>
      {summary}
      {opened && body}
    </details>
  )
}

export function RequestSummary({ site }: { site: RequestSite }) {
  return (
    <span className="request-summary">
      <span className={`method method-${(site.method ?? 'unknown').toLowerCase()}`}>
        {site.method ?? '?'}
      </span>
      {site.transport === 'server-action' ? (
        <code className="request-url">{site.serverAction?.name ?? '?'}</code>
      ) : (
        <code className="request-url" title={site.url?.text}>
          {site.url ? urlText(site.url) : '?'}
        </code>
      )}
    </span>
  )
}

/**
 * How it is sent, what starts it, its notes and its verification status. Without "Details" (M34)
 * only the main badge: the status once captured, else the number of notes.
 */
export function SiteBadges({ site }: { site: RequestSite }) {
  const details = useShowDetails()
  const notes = warnings(site)
  if (!details) {
    if (site.status !== 'inferred') return <SiteStatusBadge site={site} />
    return notes.length > 0 ? <NotesBadge notes={notes} /> : null
  }
  return (
    <>
      <Badge
        tone="muted"
        title={site.hook ? `${site.hook.name} from ${site.hook.module}` : undefined}
        term={['transport', site.transport]}
      >
        {site.transport === 'server-action'
          ? 'server action'
          : site.client
            ? `${site.client.module} · ${site.client.name}`
            : site.transport}
        {site.hook ? ` · ${site.hook.name}` : ''}
      </Badge>
      <Badge
        tone={site.trigger.kind === 'unknown' ? 'warn' : 'neutral'}
        term={['trigger', site.trigger.kind]}
      >
        {triggerLabel(site.trigger)}
      </Badge>
      {site.conditional && (
        <Badge tone="muted" term={['request', 'sometimes']}>
          sometimes
        </Badge>
      )}
      {notes.length > 0 && <NotesBadge notes={notes} />}
      <SiteStatusBadge site={site} />
    </>
  )
}

function NotesBadge({ notes }: { notes: Flag[] }) {
  return (
    <Badge tone="warn" title={notes.map((f) => f.message).join('\n')} term={['request', 'warnings']}>
      ⚠ {notes.length}
    </Badge>
  )
}

export function RequestItem({ site, open, owner }: { site: RequestSite; open: boolean; owner?: boolean }) {
  const { index } = useData()
  const target = site.targetRouteId ? index.routes.get(site.targetRouteId) : undefined
  const chain = (site.chain ?? []).map((id) => index.requests.get(id)).filter((s): s is RequestSite => !!s)

  return (
    <LazyDetails className="request" open={open}>
      <summary>
        <RequestSummary site={site} />
        {owner && <span className="muted request-owner">from {siteOwner(site, index)}</span>}
        <span className="spacer" />
        <SiteBadges site={site} />
      </summary>

      <div className="request-body">
        {site.flags.length > 0 && (
          <ul className="notes">
            {site.flags.map((f) => (
              <li key={f.kind} className={isInfoFlag(f) ? 'muted' : undefined}>
                {isInfoFlag(f) ? 'ℹ' : '⚠'} {f.message} <FlagHelp flag={f} />
              </li>
            ))}
          </ul>
        )}
        <dl className="request-facts">
          {site.url?.baseEnv && (
            <>
              <dt>Base URL</dt>
              <dd>
                <code>process.env.{site.url.baseEnv}</code>
                {site.url.base && !site.url.base.startsWith('{') && (
                  <span className="muted">
                    {' '}
                    falls back to <code>{site.url.base}</code>
                  </span>
                )}
              </dd>
            </>
          )}
          {site.url && site.url.confidence !== 'exact' && (
            <>
              <dt>URL as written</dt>
              <dd>
                <code>{site.url.text}</code>
                {site.url.confidence === 'postman' && (
                  <span className="muted"> · path from the Postman collection</span>
                )}
              </dd>
            </>
          )}
          <PostmanFact site={site} index={index} />
          <TrpcFact site={site} index={index} />
          <GraphqlFact site={site} index={index} />
          {(site.queryKey || site.hook?.key) && (
            <>
              <dt>Key</dt>
              <dd>
                <code>{site.queryKey ? formatQueryKey(site.queryKey) : site.hook?.key}</code>
                {site.queryKey && site.hook?.key && (
                  <span className="muted">
                    {' '}
                    from <code>{site.hook.key}</code>
                  </span>
                )}
              </dd>
            </>
          )}
          {site.serverAction && (
            <>
              <dt>{site.transport === 'server-action' ? 'Action' : 'Runs in action'}</dt>
              <dd>
                <code>{site.serverAction.name}</code>{' '}
                <SourceLink
                  file={site.serverAction.loc.file}
                  line={site.serverAction.loc.line}
                  column={site.serverAction.loc.column}
                />
              </dd>
            </>
          )}
          {site.trigger.loc && (
            <>
              <dt>Trigger</dt>
              <dd>
                {triggerLabel(site.trigger)}{' '}
                <SourceLink
                  file={site.trigger.loc.file}
                  line={site.trigger.loc.line}
                  column={site.trigger.loc.column}
                />
              </dd>
            </>
          )}
          {target && (
            <>
              <dt>Handled by</dt>
              <dd>
                <a href={href({ name: 'page', routeId: target.id })}>
                  <code>{target.path}</code>
                </a>{' '}
                <span className="muted">route handler</span>
              </dd>
            </>
          )}
          {site.upstream && (
            <>
              <dt>Forwarded to</dt>
              <dd>
                <code>{urlText(site.upstream)}</code>{' '}
                <span className="muted">by the catch-all route handler</span>
              </dd>
            </>
          )}
        </dl>

        <TypeBlock
          title="Request body"
          text={site.bodyType?.text}
          shape={site.bodyType?.shape}
          source={site.bodyType?.source}
        />
        {site.stream ? (
          <StreamEvents site={site} />
        ) : site.socket ? (
          <SocketMessages site={site} />
        ) : (
          <TypeBlock
            title="Response"
            text={site.responseType?.text}
            shape={site.responseType?.shape}
            source={site.responseType?.source}
            empty="Not found in the code. Live capture will fill it in."
          />
        )}

        {chain.some((hop) => !hop.conditional) && (
          <div className="request-chain">
            <h4>Then on the server</h4>
            <ul>
              {chain
                .filter((hop) => !hop.conditional)
                .map((hop) => (
                  <li key={hop.id}>
                    <RequestSummary site={hop} />
                    {hop.responseType && <span className="muted"> → {hop.responseType.text}</span>}
                  </li>
                ))}
            </ul>
          </div>
        )}
        {chain.some((hop) => hop.conditional) && (
          <div className="request-chain">
            <h4>Sometimes also on the server</h4>
            <ul>
              {chain
                .filter((hop) => hop.conditional)
                .map((hop) => (
                  <li key={hop.id}>
                    <RequestSummary site={hop} />
                  </li>
                ))}
            </ul>
          </div>
        )}

        {(index.linksFrom.get(site.id) ?? []).length > 0 && (
          <div className="request-links">
            <h4>Then in the query cache</h4>
            <QueryLinkList links={index.linksFrom.get(site.id) ?? []} />
          </div>
        )}
        {(index.linksTo.get(site.id) ?? []).length > 0 && (
          <div className="request-links">
            <h4>Refreshed by</h4>
            <QueryLinkList links={index.linksTo.get(site.id) ?? []} showTargets={false} />
          </div>
        )}

        {site.status === 'mismatch' && <SiteMismatches site={site} />}
        {hasCaptures(site) && <SiteCaptures site={site} />}

        <div className="request-stack">
          <h4>Call path</h4>
          <ol>
            {site.callStack.map((frame) => (
              <li key={`${frame.file}:${frame.line}:${frame.column}`}>
                <code>{frame.callee}</code>
                <span className="spacer" />
                <SourceLink file={frame.file} line={frame.line} column={frame.column} />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </LazyDetails>
  )
}

const LINK_LABEL: Record<QueryLink['kind'], string> = {
  invalidate: 'invalidates',
  refetch: 'refetches',
  reset: 'resets',
  remove: 'removes',
  'set-data': 'sets data of',
  hydrate: 'hydrates',
}

/** React Query cache calls: what they do, the key they target, and the queries they hit (M13). */
export function QueryLinkList({ links, showTargets = true }: { links: QueryLink[]; showTargets?: boolean }) {
  const { index } = useData()
  const { shown, hidden, expand } = useCapped(links)
  return (
    <ul className="list query-links">
      {shown.map((link) => {
        const owner = link.componentId ? index.components.get(link.componentId) : undefined
        return (
          <li key={link.id}>
            <span>
              <Badge tone="muted" title={link.method}>
                {LINK_LABEL[link.kind]}
              </Badge>{' '}
              <code>{queryLinkTarget(link)}</code>
              {link.exact && <span className="muted"> exact</span>}
              {link.outcome && <span className="muted"> on {link.outcome}</span>}
              {owner && (
                <span className="muted">
                  {' '}
                  in <a href={href({ name: 'component', componentId: owner.id })}>{owner.name}</a>
                </span>
              )}
              {showTargets && <QueryTargets link={link} />}
            </span>
            <span className="spacer" />
            <SourceLink file={link.loc.file} line={link.loc.line} column={link.loc.column} />
          </li>
        )
      })}
      {hidden > 0 && (
        <li className="more-row">
          <MoreButton hidden={hidden} onClick={expand} />
        </li>
      )}
    </ul>
  )
}

/**
 * The queries a cache call hits: a few, then "+N more". A call with no key hits every query; one
 * whose key starts with a value the scanner can't read hits none it can name (M24).
 */
function QueryTargets({ link }: { link: QueryLink }) {
  const { index } = useData()
  const targets = link.targetSiteIds.map((id) => index.requests.get(id)).filter((s): s is RequestSite => !!s)
  const { shown, hidden, expand } = useCapped(targets)
  return (
    <span className="muted">
      {' → '}
      {hitsEveryQuery(link)
        ? 'every query'
        : targets.length === 0
          ? isUnknownKey(link.key)
            ? 'key not known'
            : 'no scanned query'
          : shown.map((t, i) => (
              <span key={t.id}>
                {i > 0 && ', '}
                <code>{siteLabel(t, index)}</code>
              </span>
            ))}
      {!hitsEveryQuery(link) && hidden > 0 && (
        <>
          {' '}
          <MoreButton hidden={hidden} onClick={expand} />
        </>
      )}
    </span>
  )
}

/** What didn't match the types, across the site's captures. */
function SiteMismatches({ site }: { site: RequestSite }) {
  const { meta } = useData()
  const check = useVerification(Boolean(meta.capture)).data?.sites[site.id]?.typeCheck
  if (!check) return null
  return (
    <div className="request-type-check">
      <h4>
        Type check{' '}
        <span className="muted">
          {check.mismatched} of {check.checked} capture{check.checked === 1 ? '' : 's'} didn't match
        </span>
      </h4>
      <SiteTypeCheckView mismatches={check.mismatches} checked={check.checked} />
    </div>
  )
}

/** The newest captures matched to the site. */
function SiteCaptures({ site }: { site: RequestSite }) {
  const { meta } = useData()
  const captures = useSiteCaptures(site.id, Boolean(meta.capture))
  const list = captures.data ?? []
  if (!meta.capture || list.length === 0) return null
  return (
    <div className="request-captures">
      <h4>
        Captured <span className="count">{list.length}</span>
      </h4>
      <ul>
        {list.slice(0, 5).map((c) => (
          <li key={c.id}>
            <a href={href({ name: 'live', captureId: c.id, q: '' })}>
              <code>
                {c.method} {c.url}
              </code>
            </a>
            <span className="spacer" />
            <TypeCheckBadge status={c.typeCheck} quiet /> <StaleBadge stale={c.stale} />{' '}
            <span className={c.status !== undefined && c.status < 400 ? 'muted' : 'warn'}>
              {c.status ?? 'failed'}
            </span>
            <span className="muted"> · {new Date(c.timestamp).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TypeBlock({
  title,
  text,
  shape,
  source,
  empty,
}: {
  title: string
  text?: string
  source?: 'postman'
  shape?: Parameters<typeof TypeShapeView>[0]['shape']
  empty?: string
}) {
  if (!shape) {
    return empty ? (
      <div className="request-type">
        <h4>{title}</h4>
        <Empty>{empty}</Empty>
      </div>
    ) : null
  }
  return (
    <div className="request-type">
      <h4>
        {title} <code className="muted">{text}</code> <PostmanTypeBadge source={source} />
      </h4>
      <TypeShapeView shape={shape} />
    </div>
  )
}
