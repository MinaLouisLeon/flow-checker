// WebSockets (M19): reads socket.io traffic from its WebSocket frames, so socket.io-client needs
// no patching of its own. A text frame is an engine.io packet; engine.io `message` packets carry
// socket.io packets such as `42["chat",{"text":"hi"}]`. Only events are recorded: pings, the
// connect handshake and acks are protocol traffic.

/** A socket.io event read from a frame. */
export interface SocketIoEvent {
  name: string
  /** The event's arguments: the value when there is one, else the list. */
  value: unknown
  /** Namespace, when it isn't `/`. */
  namespace?: string
  /** Binary attachments that follow in their own frames. */
  attachments?: number
}

const ENGINE_MESSAGE = '4'
const SOCKET_EVENT = '2'
const SOCKET_BINARY_EVENT = '5'

/**
 * Decodes one text frame. `undefined` for anything that isn't a socket.io event (pings, the
 * handshake, connect / disconnect, acks) or that doesn't parse.
 */
export function parseSocketIoFrame(frame: string): SocketIoEvent | undefined {
  if (frame[0] !== ENGINE_MESSAGE) return undefined
  const type = frame[1]
  if (type !== SOCKET_EVENT && type !== SOCKET_BINARY_EVENT) return undefined
  let i = 2
  let attachments: number | undefined
  if (type === SOCKET_BINARY_EVENT) {
    const dash = frame.indexOf('-', i)
    if (dash < 0) return undefined
    attachments = Number(frame.slice(i, dash))
    i = dash + 1
  }
  let namespace: string | undefined
  if (frame[i] === '/') {
    const comma = frame.indexOf(',', i)
    if (comma < 0) return undefined
    namespace = frame.slice(i, comma)
    i = comma + 1
  }
  // Ack id: the sender wants an answer. Not kept.
  while (i < frame.length && frame.charCodeAt(i) >= 48 && frame.charCodeAt(i) <= 57) i++
  let payload: unknown
  try {
    payload = JSON.parse(frame.slice(i))
  } catch {
    return undefined
  }
  if (!Array.isArray(payload) || typeof payload[0] !== 'string') return undefined
  const args = payload.slice(1)
  return {
    name: payload[0],
    value: args.length === 1 ? args[0] : args,
    ...(namespace && namespace !== '/' ? { namespace } : {}),
    ...(attachments ? { attachments } : {}),
  }
}

/** socket.io's WebSocket URL: engine.io always adds its protocol version (`EIO=4`). */
export function isSocketIoUrl(url: URL): boolean {
  return url.searchParams.has('EIO')
}
