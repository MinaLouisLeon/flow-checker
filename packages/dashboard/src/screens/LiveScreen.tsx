import type { CapturedBody, CaptureSummary } from '@flow-checker/shared'
import { type LiveStatus, useCapture, useCaptures, useClearCaptures, useLiveFeed } from '../api'
import { useData } from '../context'
import { href, replaceScreen } from '../router'
import { Badge, Empty, matches, SearchBox, Section } from '../ui'

const STATUS_TEXT: Record<LiveStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  offline: 'Offline',
}

export function LiveScreen({ captureId, q }: { captureId?: string; q: string }) {
  const { meta } = useData()
  const enabled = Boolean(meta.capture)
  const captures = useCaptures(enabled)
  const status = useLiveFeed(enabled)
  const clear = useClearCaptures()

  if (!enabled) {
    return (
      <div className="screen">
        <Empty>Live capture is off. Start the dashboard with "flow-checker" to capture requests.</Empty>
      </div>
    )
  }

  const all = captures.data ?? []
  const list = all.filter((c) => matches(q, c.method, c.url, c.component, c.pageUrl, String(c.status ?? '')))
  const appUrl = meta.appPort ? `http://localhost:${meta.appPort}` : undefined

  return (
    <div className="screen screen-split">
      <div className="split-main">
        <div className="toolbar">
          <SearchBox
            value={q}
            onChange={(next) => replaceScreen({ name: 'live', captureId, q: next })}
            placeholder="Search method, URL, component"
          />
          <span className={`live-status live-${status}`} title="Live feed from the capture runtime">
            <span className="dot" /> {STATUS_TEXT[status]}
          </span>
          <span className="muted">
            {list.length} of {all.length}
          </span>
          <span className="spacer" />
          <button
            type="button"
            className="button"
            disabled={all.length === 0 || clear.isPending}
            onClick={() => clear.mutate()}
          >
            Clear
          </button>
        </div>
        {captures.error && <div className="banner banner-error">{captures.error.message}</div>}
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
              <CaptureRow key={c.id} capture={c} selected={c.id === captureId} q={q} />
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

function CaptureRow({ capture: c, selected, q }: { capture: CaptureSummary; selected: boolean; q: string }) {
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
      <a className="capture-link" href={href({ name: 'live', captureId: c.id, q })} title={c.url}>
        <code className="method">{c.serverActionId ? 'ACTION' : c.method}</code>{' '}
        <code>{shortUrl(c.url, meta.appPort)}</code>
      </a>
      <span className="spacer" />
      {c.component && <span className="muted capture-component">{c.component}</span>}
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

      {children.length > 0 && (
        <Section title="Server requests it caused">
          <ul className="list">
            {children.map((child) => (
              <CaptureRow key={child.id} capture={child} selected={false} q={q} />
            ))}
          </ul>
        </Section>
      )}

      <Section title="Request">
        <BodyView body={c.request.body} />
        <HeadersView headers={c.request.headers} />
      </Section>

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
