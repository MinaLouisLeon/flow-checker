import {
  type Capture,
  type CapturedBody,
  type CaptureSummary,
  type MatchSignal,
  type RequestSite,
  summarizeCapture,
} from '@flow-checker/shared'
import { useState } from 'react'
import {
  type LiveStatus,
  useAssignMatch,
  useCapture,
  useCaptures,
  useClearCaptures,
  useFlows,
  useRecording,
  useServerCapture,
} from '../api'
import { useData } from '../context'
import { GraphqlCaptureFact } from '../GraphqlView'
import { siteHref, siteLabel, siteOwner } from '../RequestView'
import { href, type MatchFilter, replaceScreen } from '../router'
import { MessageTimeline } from '../SseView'
import { TrpcCaptureFact } from '../TrpcView'
import { CaptureTypeCheck, StaleBadge, TypeCheckBadge } from '../TypeCheckView'
import { Badge, Empty, matches, SearchBox, Section } from '../ui'

const FILTERS: { value: MatchFilter | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'matched', label: 'Matched' },
  { value: 'ambiguous', label: 'Ambiguous' },
  { value: 'unmatched', label: 'Unmatched' },
  { value: 'mismatch', label: 'Type mismatch' },
]

const SIGNAL_LABEL: Record<MatchSignal, string> = {
  'server-action': 'server action',
  'stack-source': 'source line',
  'stack-name': 'stack name',
  url: 'URL',
  component: 'component',
  route: 'route',
  parent: 'parent request',
  trigger: 'trigger',
  'query-key': 'query key',
  middleware: 'middleware',
  'trpc-procedure': 'tRPC procedure',
  'graphql-operation': 'GraphQL operation',
  stream: 'event stream',
  socket: 'WebSocket',
  manual: 'manual',
}

function fitsFilter(c: CaptureSummary, filter: MatchFilter): boolean {
  if (filter === 'mismatch') return c.typeCheck === 'mismatch'
  // Third-party requests are not scanner gaps: they stay out of "Unmatched".
  if (c.match?.thirdParty) return false
  return (c.match?.status ?? 'unmatched') === filter
}

const STATUS_TEXT: Record<LiveStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  offline: 'Offline',
}

export function LiveScreen({
  captureId,
  q,
  filter,
}: {
  captureId?: string
  q: string
  filter?: MatchFilter
}) {
  const { meta, index, live } = useData()
  const enabled = Boolean(meta.capture)
  const exported = meta.exported
  const captures = useCaptures(enabled)
  const serverCapture = useServerCapture(enabled && !exported)
  const status = live ?? 'connecting'
  const clear = useClearCaptures()

  if (!enabled) {
    return (
      <div className="screen">
        <Empty>Live capture is off. Start the dashboard with "flow-checker" to capture requests.</Empty>
      </div>
    )
  }

  const all = captures.data ?? []
  const counts: Record<MatchFilter, number> = { matched: 0, ambiguous: 0, unmatched: 0, mismatch: 0 }
  for (const c of all) {
    if (!c.match?.thirdParty) counts[c.match?.status ?? 'unmatched']++
    if (c.typeCheck === 'mismatch') counts.mismatch++
  }
  const byId = new Map(all.map((c) => [c.id, c]))
  const list = all.filter((c) => {
    if (filter && !fitsFilter(c, filter)) return false
    const site = c.match?.siteId ? index.requests.get(c.match.siteId) : undefined
    return matches(
      q,
      c.method,
      c.url,
      c.component,
      c.pageUrl,
      String(c.status ?? ''),
      site && siteOwner(site, index),
    )
  })
  const appUrl = meta.appPort ? `http://localhost:${meta.appPort}` : undefined

  return (
    <div className="screen screen-split">
      <div className="split-main">
        <div className="toolbar">
          <SearchBox
            value={q}
            onChange={(next) => replaceScreen({ name: 'live', captureId, q: next, filter })}
            placeholder="Search method, URL, component"
          />
          <fieldset className="segmented match-filter" aria-label="Match status">
            {FILTERS.map((f) => (
              <button
                key={f.label}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => replaceScreen({ name: 'live', captureId, q, filter: f.value })}
              >
                {f.label}
                {f.value && <span className="count">{counts[f.value]}</span>}
              </button>
            ))}
          </fieldset>
          {!exported && (
            <span className={`live-status live-${status}`} title="Live feed from the capture runtime">
              <span className="dot" /> {STATUS_TEXT[status]}
            </span>
          )}
          <span className="muted">
            {list.length} of {all.length}
          </span>
          <span className="spacer" />
          {exported ? (
            exported.captureCounts.included < exported.captureCounts.total && (
              <span className="muted">
                The newest {exported.captureCounts.included} of {exported.captureCounts.total} captures are in
                this export.
              </span>
            )
          ) : (
            <>
              <RecordControl />
              <button
                type="button"
                className="button"
                disabled={all.length === 0 || clear.isPending}
                onClick={() => clear.mutate()}
              >
                Clear
              </button>
            </>
          )}
        </div>
        {captures.error && <div className="banner banner-error">{captures.error.message}</div>}
        {serverCapture.data?.state === 'missing' && (
          <div className="banner banner-warn" role="alert" data-testid="server-capture-banner">
            Server capture isn't running: run <code>flow-checker doctor</code>. Your app answered{' '}
            <code>{serverCapture.data.request ?? 'a route handler'}</code>, but no server-side request was
            captured.
          </div>
        )}
        {all.length === 0 ? (
          <Empty>
            No requests captured yet. Use your app
            {appUrl && (
              <>
                {' '}
                at{' '}
                <a href={appUrl} target="_blank" rel="noreferrer">
                  {appUrl}
                </a>
              </>
            )}{' '}
            and they show up here.
          </Empty>
        ) : list.length === 0 ? (
          <Empty>No captures match.</Empty>
        ) : (
          <ul className="list capture-list">
            {list.map((c) => (
              <CaptureRow
                key={c.id}
                capture={c}
                parent={c.parentCaptureId ? byId.get(c.parentCaptureId) : undefined}
                selected={c.id === captureId}
                q={q}
                filter={filter}
              />
            ))}
          </ul>
        )}
      </div>

      <aside className="split-side">
        {captureId ? (
          <CaptureDetailView captureId={captureId} q={q} />
        ) : (
          <Empty>Select a request to see it.</Empty>
        )}
      </aside>
    </div>
  )
}

function CaptureRow({
  capture: c,
  parent,
  selected,
  q,
  filter,
}: {
  capture: CaptureSummary
  /** The browser request a server hop was made for. */
  parent?: CaptureSummary
  selected: boolean
  q: string
  filter?: MatchFilter
}) {
  const { meta } = useData()
  return (
    <li className={selected ? 'selected' : undefined}>
      <span className="muted capture-time">{new Date(c.timestamp).toLocaleTimeString()}</span>
      <OriginBadge origin={c.origin} />
      {c.parentCaptureId && (
        <span className="muted" title="Sent by the server while handling a browser request">
          ↳
        </span>
      )}
      <a className="capture-link" href={href({ name: 'live', captureId: c.id, q, filter })} title={c.url}>
        <code className="method">{c.serverActionId ? 'ACTION' : c.method}</code>{' '}
        <code>{shortUrl(c.url, meta.appPort)}</code>
      </a>
      <span className="spacer" />
      {c.component && <span className="muted capture-component">{c.component}</span>}
      <MatchBadge match={c.match} parent={parent} />
      <TypeCheckBadge status={c.typeCheck} quiet />
      <StaleBadge stale={c.stale} />
      <StatusBadge status={c.status} error={c.error} />
      <span className="muted capture-duration">{c.durationMs} ms</span>
    </li>
  )
}

function CaptureDetailView({ captureId, q }: { captureId: string; q: string }) {
  const { data, error, isPending } = useCapture(captureId)
  if (isPending) return <Empty>Loading…</Empty>
  if (error || !data) return <Empty>This capture is no longer available.</Empty>
  const { capture: c, children } = data

  return (
    <div className="panel capture-detail">
      <div className="panel-head">
        <OriginBadge origin={c.origin} />
        <Badge tone="muted">{c.transport}</Badge>
        <StatusBadge status={c.response?.status} error={c.error} />
        <span className="muted">{c.durationMs} ms</span>
        <span className="spacer" />
        <span className="muted">{new Date(c.timestamp).toLocaleString()}</span>
      </div>
      <h2 className="capture-title">
        <code className="method">{c.request.method}</code> <code className="break">{c.request.url}</code>
      </h2>

      {c.redacted ? (
        c.redactedPaths.length > 0 && (
          <p className="muted redaction-note">
            <Badge tone="ok">redacted</Badge> Masked: {c.redactedPaths.join(', ')}
          </p>
        )
      ) : (
        <p className="notes">Saved without masking (capture.storeRaw is on).</p>
      )}

      <Section title="Context">
        <dl className="kv">
          {c.pageUrl && (
            <>
              <dt>Page</dt>
              <dd>
                <code className="break">{c.pageUrl}</code>
              </dd>
            </>
          )}
          {c.interaction && (
            <>
              <dt>Started by</dt>
              <dd>
                <code>{c.interaction.type}</code> on <code>{c.interaction.target}</code>
              </dd>
              {c.interaction.componentChain.length > 0 && (
                <>
                  <dt>Components</dt>
                  <dd>
                    <ul className="chips">
                      {c.interaction.componentChain.slice(0, 8).map((name, i) => (
                        <li key={`${name}-${i}`} className="chip">
                          {name}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </>
              )}
            </>
          )}
          {c.query && (
            <>
              <dt>React Query</dt>
              <dd>
                {c.query.kind}{' '}
                {c.query.key ? <code className="break">{JSON.stringify(c.query.key)}</code> : null}
              </dd>
            </>
          )}
          <TrpcCaptureFact capture={c} q={q} />
          <GraphqlCaptureFact capture={c} q={q} />
          {c.serverAction && (
            <>
              <dt>Server action</dt>
              <dd>
                <code>{c.serverAction.id}</code>
              </dd>
            </>
          )}
          {c.parent && (
            <>
              <dt>While handling</dt>
              <dd>
                {c.parent.captureId ? (
                  <a href={href({ name: 'live', captureId: c.parent.captureId, q })}>
                    <code>
                      {c.parent.method} {c.parent.url}
                    </code>
                  </a>
                ) : (
                  <code>
                    {c.parent.method} {c.parent.url}
                  </code>
                )}
              </dd>
            </>
          )}
          {c.error && (
            <>
              <dt>Error</dt>
              <dd className="warn">{c.error}</dd>
            </>
          )}
        </dl>
      </Section>

      <Section title="Request site">
        <MatchPanel capture={c} />
      </Section>

      {c.typeCheck && (
        <Section title="Type check">
          <CaptureTypeCheck check={c.typeCheck} />
        </Section>
      )}

      {children.length > 0 && (
        <Section title="Server requests it caused">
          <ul className="list">
            {children.map((child) => (
              <CaptureRow
                key={child.id}
                capture={child}
                parent={summarizeCapture(c)}
                selected={false}
                q={q}
              />
            ))}
          </ul>
        </Section>
      )}

      <Section title="Request">
        <BodyView body={c.request.body} />
        <HeadersView headers={c.request.headers} />
      </Section>

      <MessageTimeline capture={c} />

      <Section title="Response">
        {c.response ? (
          <>
            <BodyView body={c.response.body} />
            <HeadersView headers={c.response.headers} />
          </>
        ) : (
          <Empty>No response.</Empty>
        )}
      </Section>

      {c.stack.length > 0 && (
        <details className="stack">
          <summary>Stack ({c.stack.length} frames)</summary>
          <pre className="code">{c.stack.join('\n')}</pre>
        </details>
      )}
    </div>
  )
}

/** Start and stop recording a named flow: everything you do in between is saved as one flow. */
function RecordControl() {
  const flows = useFlows(true)
  const recording = useRecording()
  const [name, setName] = useState('')
  const current = flows.data?.recording
  if (current) {
    return (
      <span className="record-control">
        <span className="recording-dot" aria-hidden /> Recording <strong>{current.name}</strong>
        <button
          type="button"
          className="button"
          disabled={recording.isPending}
          onClick={() =>
            recording.mutate(undefined, {
              onSuccess: (saved) => {
                if (saved && 'id' in saved)
                  window.location.hash = href({ name: 'flows', flowId: saved.id, q: '' })
              },
            })
          }
        >
          Stop
        </button>
      </span>
    )
  }
  return (
    <form
      className="record-control"
      onSubmit={(event) => {
        event.preventDefault()
        // An empty name is filled in from the pages the recording goes through.
        recording.mutate(name, { onSuccess: () => setName('') })
      }}
    >
      <input
        aria-label="Name of the flow to record"
        placeholder="Flow name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button type="submit" className="button" disabled={recording.isPending}>
        ● Record
      </button>
    </form>
  )
}

function MatchBadge({ match, parent }: { match: CaptureSummary['match']; parent?: CaptureSummary }) {
  const { index } = useData()
  if (match?.status === 'matched' && match.siteId) {
    const site = index.requests.get(match.siteId)
    // A shared route handler (e.g. a catch-all proxy) says little: name the feature that called it.
    const parentSite = parent?.match?.siteId ? index.requests.get(parent.match.siteId) : undefined
    const via = site?.origin === 'route-handler' && parentSite ? parentSite : undefined
    const label = site ? siteLabel(site, index) : match.siteId
    // One request for a query several components mount (M24): it verifies each of them.
    const shared = (match.sharedWith ?? []).map((id) => index.requests.get(id)).filter((s) => !!s)
    const owners = shared.map((s) => siteOwner(s, index))
    const title = shared.length > 0 ? `${label}, shared with ${owners.join(', ')}` : label
    return (
      <Badge tone="ok" title={via ? `${title}, for ${siteLabel(via, index)}` : title}>
        ✓{' '}
        {via
          ? `${siteOwner(via, index)} › ${site ? siteOwner(site, index) : ''}`
          : site
            ? siteOwner(site, index)
            : 'matched'}
        {shared.length > 0 ? ` +${shared.length} shared` : ''}
        {match.by === 'manual' ? ' (you)' : ''}
      </Badge>
    )
  }
  if (match?.thirdParty) {
    return (
      <Badge tone="muted" title="Sent by another site's script (an SDK), not by your code">
        third-party
      </Badge>
    )
  }
  if (match?.status === 'ambiguous') {
    return (
      <Badge tone="warn" title="Several request sites fit. Pick one.">
        ? ambiguous
      </Badge>
    )
  }
  return (
    <Badge
      tone="warn"
      title={
        match?.by === 'manual'
          ? 'You marked this as not belonging to any request site'
          : 'No scanned request site fits: probably a scanner gap'
      }
    >
      ✗ unmatched
    </Badge>
  )
}

/** Which request site the capture is, why, and manual assignment. */
function MatchPanel({ capture }: { capture: Capture }) {
  const { index, meta } = useData()
  // An export can't change matches.
  const canAssign = !meta.exported
  const assign = useAssignMatch()
  const [picked, setPicked] = useState('')
  const match = capture.match
  const current = match?.siteId ? index.requests.get(match.siteId) : undefined
  const method = capture.request.method.toUpperCase()
  // Same method first, then everything else.
  const options = [...index.model.requests].sort(
    (a, b) =>
      Number(b.method === method) - Number(a.method === method) ||
      siteLabel(a, index).localeCompare(siteLabel(b, index)),
  )
  const set = (siteId: string | null | undefined) => assign.mutate({ captureId: capture.id, siteId })

  return (
    <div className="match-panel">
      {!match ? (
        <p className="muted">Not matched yet.</p>
      ) : match.status === 'matched' && current ? (
        <p>
          <Badge tone="ok">✓ matched</Badge> <SiteLink site={current} />{' '}
          <span className="muted">{match.by === 'manual' ? 'assigned by you' : `score ${match.score}`}</span>
        </p>
      ) : match.status === 'ambiguous' ? (
        <p>
          <Badge tone="warn">? ambiguous</Badge> Several request sites fit about equally well. Pick the right
          one below.
        </p>
      ) : match.thirdParty ? (
        <p>
          <Badge tone="muted">third-party</Badge> Sent by another site's script (an SDK) to its own servers.
          No project code is on its stack, so the scanner didn't miss anything.
        </p>
      ) : (
        <p>
          <Badge tone="warn">✗ unmatched</Badge>{' '}
          {match.by === 'manual'
            ? 'You marked requests like this as not belonging to any request site.'
            : 'No scanned request site fits. The scanner probably missed the code that sends it.'}
        </p>
      )}

      {match && match.candidates.length > 0 && (
        <ul className="list match-candidates">
          {match.candidates.map((candidate) => {
            const site = index.requests.get(candidate.siteId)
            if (!site) return null
            const chosen = match.status === 'matched' && match.siteId === site.id
            return (
              <li key={candidate.siteId} className={chosen ? 'selected' : undefined}>
                <div className="match-candidate-head">
                  <SiteLink site={site} />
                  <span className="spacer" />
                  <span className="muted">{candidate.score}</span>
                  {!chosen && canAssign && (
                    <button
                      type="button"
                      className="button"
                      disabled={assign.isPending}
                      onClick={() => set(site.id)}
                    >
                      This one
                    </button>
                  )}
                </div>
                <ul className="chips">
                  {candidate.evidence.map((e, i) => (
                    <li
                      key={`${e.signal}-${i}`}
                      className={`chip${e.points < 0 ? ' chip-warn' : ''}`}
                      title={e.detail}
                    >
                      {SIGNAL_LABEL[e.signal]} {e.points > 0 ? `+${e.points}` : e.points}
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      )}

      {canAssign && (
        <div className="match-assign">
          <select
            aria-label="Assign to a request site"
            value={picked}
            onChange={(event) => setPicked(event.target.value)}
          >
            <option value="">Assign to another request site…</option>
            {options.map((site) => (
              <option key={site.id} value={site.id}>
                {siteLabel(site, index)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="button"
            disabled={!picked || assign.isPending}
            onClick={() => {
              set(picked)
              setPicked('')
            }}
          >
            Assign
          </button>
          {!(match?.by === 'manual' && match.status === 'unmatched') && (
            <button type="button" className="button" disabled={assign.isPending} onClick={() => set(null)}>
              No site
            </button>
          )}
          {match?.by === 'manual' && (
            <button
              type="button"
              className="button"
              disabled={assign.isPending}
              onClick={() => set(undefined)}
            >
              Back to automatic
            </button>
          )}
        </div>
      )}
      {canAssign && (
        <p className="muted match-note">
          Your choice is saved in <code>.flow-checker/overrides.json</code> and applies to requests like this
          one.
        </p>
      )}
      {assign.error && <div className="banner banner-error">{assign.error.message}</div>}
    </div>
  )
}

function SiteLink({ site }: { site: RequestSite }) {
  const { index } = useData()
  const link = siteHref(site)
  const label = siteLabel(site, index)
  return link ? (
    <a href={link}>
      <code>{label}</code>
    </a>
  ) : (
    <code>{label}</code>
  )
}

function BodyView({ body }: { body: CapturedBody }) {
  switch (body.kind) {
    case 'none':
      return <p className="muted body-empty">No body.</p>
    case 'json':
      return <pre className="code body">{JSON.stringify(body.value, null, 2)}</pre>
    case 'form':
      return (
        <>
          <p className="muted body-kind">Form data</p>
          <pre className="code body">{JSON.stringify(body.value, null, 2)}</pre>
        </>
      )
    case 'text':
      return (
        <>
          {body.truncated && (
            <p className="muted body-kind">
              Cut to the first {formatBytes(body.value.length)} of {formatBytes(body.size)}.
            </p>
          )}
          <pre className="code body">{body.value}</pre>
        </>
      )
    case 'binary':
      return (
        <p className="muted body-empty">
          Binary content{body.contentType ? ` (${body.contentType})` : ''}
          {body.size !== undefined ? `, ${formatBytes(body.size)}` : ''}.
        </p>
      )
  }
}

function HeadersView({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers)
  if (entries.length === 0) return null
  return (
    <details className="headers">
      <summary>Headers ({entries.length})</summary>
      <dl className="kv">
        {entries.map(([name, value]) => (
          <div key={name} className="kv-row">
            <dt>{name}</dt>
            <dd>
              <code className="break">{value}</code>
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

function OriginBadge({ origin }: { origin: CaptureSummary['origin'] }) {
  return origin === 'browser' ? (
    <Badge tone="client" title="Sent from the browser">
      browser
    </Badge>
  ) : (
    <Badge tone="server" title="Sent from the Next.js server">
      server
    </Badge>
  )
}

function StatusBadge({ status, error }: { status?: number; error?: string }) {
  if (status === undefined) {
    return (
      <Badge tone="warn" title={error}>
        failed
      </Badge>
    )
  }
  return <Badge tone={status >= 400 ? 'warn' : 'ok'}>{status}</Badge>
}

/** Path only for requests to the app itself, host and path for everything else. */
function shortUrl(url: string, appPort?: number): string {
  try {
    const u = new URL(url)
    const isApp = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) && u.port === String(appPort)
    return isApp ? `${u.pathname}${u.search}` : `${u.host}${u.pathname}${u.search}`
  } catch {
    return url
  }
}

function formatBytes(n: number | undefined): string {
  if (n === undefined) return 'unknown size'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
