// WebSockets (M19): the messages a request site sends and listens to with their types, and the
// sockets the app opens (overview). A capture's messages use the timeline in SseView.
import type { RequestSite } from '@flow-checker/shared'
import type { ModelIndex } from './model-index'
import { siteHref, siteLabel } from './RequestView'
import { TypeShapeView } from './TypeShapeView'
import { Badge, Empty, Section, SourceLink } from './ui'

const API_LABEL = { websocket: 'WebSocket', 'socket.io': 'socket.io' } as const

/** Request view: the socket and each message with its data type. */
export function SocketMessages({ site }: { site: RequestSite }) {
  const socket = site.socket
  if (!socket) return null
  return (
    <div className="request-type">
      <h4>
        Messages <span className="muted">{API_LABEL[socket.api]}</span>
        {socket.namespace && <span className="muted"> · namespace {socket.namespace}</span>}
        {socket.protocols && <span className="muted"> · protocols {socket.protocols.join(', ')}</span>}
      </h4>
      {socket.messages.length === 0 ? (
        <Empty>No messages were found in the code. Live capture shows what goes through.</Empty>
      ) : (
        <ul className="list stream-events">
          {socket.messages.map((m) => (
            <li key={`${m.direction}:${m.name}`}>
              <details>
                <summary>
                  <DirectionBadge direction={m.direction} />
                  <code>{m.name}</code>{' '}
                  {m.dataType ? (
                    <code className="muted">{m.dataType.text}</code>
                  ) : (
                    <span className="muted">no type</span>
                  )}
                  <span className="spacer" />
                  {m.loc && <SourceLink file={m.loc.file} line={m.loc.line} column={m.loc.column} />}
                </summary>
                {m.dataType && <TypeShapeView shape={m.dataType.shape} />}
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function DirectionBadge({ direction }: { direction: 'in' | 'out' }) {
  return direction === 'out' ? (
    <Badge tone="neutral" title="Sent by the app">
      ↑ sends
    </Badge>
  ) : (
    <Badge tone="muted" title="Received by the app">
      ↓ receives
    </Badge>
  )
}

/** Overview: every WebSocket the app opens, with the messages it uses. */
export function SocketsSection({ index }: { index: ModelIndex }) {
  const sites = index.model.requests.filter((s) => s.socket)
  if (sites.length === 0) return null
  return (
    <Section title="WebSockets" aside={<span className="count">{sites.length}</span>}>
      <ul className="list">
        {sites.map((site) => {
          const socket = site.socket
          if (!socket) return null
          const link = siteHref(site)
          const label = siteLabel(site, index)
          // The last frame is the `new WebSocket()` / `io()` call.
          const at = site.callStack[site.callStack.length - 1]
          return (
            <li key={site.id}>
              <Badge tone="muted">{API_LABEL[socket.api]}</Badge>
              {link ? <a href={link}>{label}</a> : <span>{label}</span>}
              <span className="muted">
                {socket.messages.length === 0
                  ? 'messages not found'
                  : socket.messages.map((m) => `${m.direction === 'out' ? '↑' : '↓'} ${m.name}`).join(', ')}
              </span>
              <span className="spacer" />
              {at && <SourceLink file={at.file} line={at.line} column={at.column} />}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
