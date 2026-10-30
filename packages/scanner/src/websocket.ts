// WebSockets (M19): `new WebSocket(url)` and socket.io's `io(url)`, and what the code does with
// the socket: the messages it listens to and the ones it sends. Only syntax here; `requests.ts`
// resolves values and types.
import { type CallExpression, Node as N, type Node, type SourceFile } from 'ts-morph'
import { importModuleOf } from './components'
import { holderText } from './sse'

export const SOCKET_IO_MODULE = 'socket.io-client'

/** socket.io events the client library itself emits (connection state), not app messages. */
const RESERVED_EVENTS = new Set(['connect', 'disconnect', 'connect_error'])

/** Files that import socket.io-client. Checked first so other calls skip symbol lookups. */
const importsSocketIo = new WeakMap<SourceFile, boolean>()

/** `io(url, options)` / `connect(url)` from socket.io-client (named or default import). */
export function isSocketIoCall(call: CallExpression): boolean {
  const callee = call.getExpression()
  if (!N.isIdentifier(callee) && !N.isPropertyAccessExpression(callee)) return false
  const file = call.getSourceFile()
  let imports = importsSocketIo.get(file)
  if (imports === undefined) {
    imports = file.getImportDeclarations().some((d) => d.getModuleSpecifierValue() === SOCKET_IO_MODULE)
    importsSocketIo.set(file, imports)
  }
  if (!imports) return false
  if (importModuleOf(callee) !== SOCKET_IO_MODULE) return false
  const name = N.isPropertyAccessExpression(callee) ? callee.getName() : undefined
  // `io(...)`, `connect(...)`, `lookup(...)`, or `ns.io(...)` / `ns.connect(...)` on a namespace import.
  return !name || name === 'io' || name === 'connect' || name === 'default'
}

/** `new WebSocket(url)` with the platform's WebSocket (not a project class with that name). */
export function isWebSocketNew(node: Node): boolean {
  if (!N.isNewExpression(node)) return false
  const callee = node.getExpression()
  const name = N.isPropertyAccessExpression(callee) ? callee.getName() : callee.getText()
  if (name !== 'WebSocket') return false
  const decls = callee.getSymbol()?.getDeclarations() ?? []
  return decls.every((d) => d.getSourceFile().isInNodeModules() || d.getSourceFile().isDeclarationFile())
}

/** One use of the socket: a listener (`in`) or a send (`out`). */
export interface SocketUse {
  direction: 'in' | 'out'
  name: string
  /** `in`: the listener. */
  handler?: Node
  /** `out`: the data sent (native: the `send()` argument; socket.io: the event's arguments, ack callback left out). */
  args?: Node[]
  /** Where it is listened to or sent. */
  at: Node
}

/**
 * What the code does with the socket created by `expr`, found by the name it is stored in
 * (`const ws = new WebSocket()`, `ref.current = io()`), anywhere in `scope`. Native sockets:
 * `onmessage = fn`, `addEventListener('message', fn)`, `send(x)`. socket.io: `on(name, fn)`,
 * `once(name, fn)`, `emit(name, ...args)`.
 */
export function socketUses(
  expr: Node,
  scope: Node,
  api: 'websocket' | 'socket.io',
  eventName: (arg: Node) => string | undefined,
): SocketUse[] {
  const holder = holderText(expr)
  if (!holder) return []
  const out: SocketUse[] = []
  for (const access of scope.getDescendants()) {
    if (!N.isPropertyAccessExpression(access) || access.getExpression().getText() !== holder) continue
    const parent = access.getParent()
    const name = access.getName()
    if (api === 'websocket') {
      if (name === 'onmessage' && parent && N.isBinaryExpression(parent) && parent.getLeft() === access) {
        if (parent.getOperatorToken().getText() === '=')
          out.push({ direction: 'in', name: 'message', handler: parent.getRight(), at: parent })
        continue
      }
      if (!parent || !N.isCallExpression(parent) || parent.getExpression() !== access) continue
      const args = parent.getArguments()
      if (name === 'addEventListener') {
        const [type, handler] = args
        if (type && handler && eventName(type) === 'message')
          out.push({ direction: 'in', name: 'message', handler, at: parent })
      } else if (name === 'send' && args[0]) {
        out.push({ direction: 'out', name: 'message', args: [args[0]], at: parent })
      }
      continue
    }
    if (!parent || !N.isCallExpression(parent) || parent.getExpression() !== access) continue
    const [first, ...rest] = parent.getArguments()
    const event = first ? eventName(first) : undefined
    if (!event || RESERVED_EVENTS.has(event)) continue
    if ((name === 'on' || name === 'once') && rest[0]) {
      out.push({ direction: 'in', name: event, handler: rest[0], at: parent })
    } else if (name === 'emit' || name === 'emitWithAck') {
      // A function last is the ack callback, not data.
      const last = rest[rest.length - 1]
      const data =
        last && (N.isArrowFunction(last) || N.isFunctionExpression(last)) ? rest.slice(0, -1) : rest
      out.push({ direction: 'out', name: event, args: data, at: parent })
    }
  }
  return out
}

/** The text values of `new WebSocket(url, 'v1')` / `(url, ['v1', 'v2'])`. */
export function protocolList(arg: Node | undefined): string[] | undefined {
  if (!arg) return undefined
  if (N.isStringLiteral(arg) || N.isNoSubstitutionTemplateLiteral(arg)) return [arg.getLiteralText()]
  if (!N.isArrayLiteralExpression(arg)) return undefined
  const out: string[] = []
  for (const element of arg.getElements()) {
    if (!N.isStringLiteral(element) && !N.isNoSubstitutionTemplateLiteral(element)) return undefined
    out.push(element.getLiteralText())
  }
  return out.length > 0 ? out : undefined
}
