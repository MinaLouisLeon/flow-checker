// Server-sent events (M18): the events a request site listens to with their types, the route
// handlers that answer with an event stream (overview), and a capture's message timeline.
import type { Capture, CapturedMessage, RequestSite } from '@flow-checker/shared'
import type { ModelIndex } from './model-index'
import { siteHref, siteLabel } from './RequestView'
import { href } from './router'
import { DirectionBadge } from './SocketView'
import { TypeShapeView } from './TypeShapeView'
import { Badge, Empty, Section, SourceLink } from './ui'

const API_LABEL = { 'event-source': 'EventSource', fetch: 'streamed fetch' } as const

/** Request view: what the stream is and each event with its data type. */
export function StreamEvents({ site }: { site: RequestSite }) {
  const stream = site.stream
  if (!stream) return null
  return (
    <div className="request-type">
      <h4>
        Events <span className="muted">{API_LABEL[stream.api]}</span>
        {stream.withCredentials && <span className="muted"> · with credentials</span>}
      </h4>
      {stream.events.length === 0 ? (
        <Empty>No events were found in the code. Live capture shows what arrives.</Empty>
      ) : (
        <ul className="list stream-events">
          {stream.events.map((e) => (
            <li key={e.name}>
              <details>
                <summary>
                  <code>{e.name}</code>{' '}
                  {e.dataType ? (
                    <code className="muted">{e.dataType.text}</code>
                  ) : (
                    <span className="muted">no type</span>
                  )}
                  {e.typeFrom === 'handler' && <span className="muted"> · from the route handler</span>}
                  {!e.listened && (
                    <Badge tone="warn" title="The route handler sends it, but the code doesn't listen to it.">
                      not listened to
                    </Badge>
                  )}
                  <span className="spacer" />
                  {e.loc && <SourceLink file={e.loc.file} line={e.loc.line} column={e.loc.column} />}
                </summary>
                {e.dataType && <TypeShapeView shape={e.dataType.shape} />}
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Overview: route handlers that answer with `text/event-stream`. */
export function StreamsSection({ index }: { index: ModelIndex }) {
  const streams = index.model.streams ?? []
  if (streams.length === 0) return null
  return (
    <Section title="Event streams" aside={<span className="count">{streams.length}</span>}>
      <ul className="list">
        {streams.map((s) => {
          const route = index.routes.get(s.routeId)
          return (
            <li key={s.id}>
              <Badge tone="muted">{s.method}</Badge>
              {route ? (
                <a href={href({ name: 'page', routeId: route.id })}>
                  <code>{route.path}</code>
                </a>
              ) : (
                <code>{s.routeId}</code>
              )}
              <span className="muted">
                {s.events.length === 0
                  ? 'events not found'
                  : s.events.map((e) => (e.dataType ? `${e.name}: ${e.dataType.text}` : e.name)).join(', ')}
              </span>
              <span className="spacer" />
              {s.siteIds.length === 0 ? (
                <span className="muted">not opened</span>
              ) : (
                s.siteIds.map((id) => {
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
              <SourceLink file={s.loc.file} line={s.loc.line} column={s.loc.column} />
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

const STATE_TONE = { open: 'neutral', closed: 'muted', error: 'warn' } as const

/**
 * Capture view: the connection state and every message kept, in order. WebSocket messages (M19)
 * go both ways: each shows its direction, and the aside the close code.
 */
export function MessageTimeline({ capture }: { capture: Capture }) {
  const stream = capture.stream
  if (!stream) return null
  const messages = capture.messages ?? []
  const start = Date.parse(capture.timestamp)
  const socket = capture.transport === 'websocket'
  const sent = messages.filter((m) => m.direction === 'out').length
  return (
    <Section
      title="Messages"
      aside={
        <span className="muted">
          <Badge tone={STATE_TONE[stream.state]}>{stream.state}</Badge>{' '}
          {socket ? `${stream.count} messages (${sent} sent)` : `${stream.count} received`} · {stream.bytes}{' '}
          bytes
          {stream.socketIo ? ' · socket.io' : ''}
          {stream.protocol ? ` · protocol ${stream.protocol}` : ''}
          {stream.closeCode !== undefined
            ? ` · close ${stream.closeCode}${stream.closeReason ? ` (${stream.closeReason})` : ''}`
            : ''}
          {stream.reconnects ? ` · ${stream.reconnects} reconnect${stream.reconnects === 1 ? '' : 's'}` : ''}
        </span>
      }
    >
      {stream.truncated && (
        <p className="muted">
          Some messages were dropped (capture.maxMessages) or kept without their data
          (capture.maxMessageBytes).
        </p>
      )}
      {messages.length === 0 ? (
        <Empty>{socket ? 'No messages were sent or received.' : 'No messages arrived.'}</Empty>
      ) : (
        <ol className="message-timeline">
          {messages.map((m, i) => (
            // Messages have no id of their own, and the list only grows: the position is stable.
            <li key={`${i}:${m.at}`}>
              <span className="muted message-time">+{Math.max(0, Date.parse(m.at) - start)} ms</span>
              {socket && <DirectionBadge direction={m.direction} />}
              <code className="message-event">{m.event ?? 'message'}</code>
              {m.id && <span className="muted">id {m.id}</span>}
              <span className="muted">{m.size} B</span>
              <MessageData message={m} />
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}

function MessageData({ message }: { message: CapturedMessage }) {
  const body = message.body
  if (!body) return <span className="muted">data not kept</span>
  if (body.kind === 'json') return <code className="message-data">{JSON.stringify(body.value)}</code>
  if (body.kind === 'text') return <code className="message-data">{body.value}</code>
  if (body.kind === 'binary') return <span className="muted">binary data</span>
  return <span className="muted">no data</span>
}
