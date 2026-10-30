// Server-sent events (M18): the `event:` / `data:` text a route handler writes, and the event
// names and data types a client listens to. Only syntax here; `requests.ts` resolves values.
import type { SiteStream, SseEvent } from '@flow-checker/shared'
import { type CallExpression, Node as N, type Node } from 'ts-morph'

/** What one piece of SSE text writes, e.g. `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`. */
export interface SseTemplate {
  /** A literal event name, or the expression in the `event:` hole. Absent: unnamed (`message`). */
  event?: string | Node
  /** The value in the `data:` hole (inside `JSON.stringify()`). Absent when the data is fixed text. */
  data?: Node
}

const DATA_LINE = /(?:^|\n)data:/
const DATA_HOLE = /(?:^|\n)data: ?$/
const EVENT_HOLE = /(?:^|\n)event: ?$/
const EVENT_TEXT = /(?:^|\n)event: ?([^\n]+)\n/

/** Reads a string or template literal that writes an SSE event. */
export function sseTemplate(node: Node): SseTemplate | undefined {
  if (N.isStringLiteral(node) || N.isNoSubstitutionTemplateLiteral(node)) {
    const text = node.getLiteralText()
    if (!DATA_LINE.test(text)) return undefined
    const name = EVENT_TEXT.exec(text)?.[1]?.trim()
    return name ? { event: name } : {}
  }
  if (!N.isTemplateExpression(node)) return undefined
  let text = node.getHead().getLiteralText()
  let literal = text
  const out: SseTemplate = {}
  for (const span of node.getTemplateSpans()) {
    const expr = span.getExpression()
    if (EVENT_HOLE.test(text)) out.event = expr
    else if (DATA_HOLE.test(text)) out.data = unwrapStringify(expr)
    text = span.getLiteral().getLiteralText()
    literal += `\u0000${text}`
  }
  if (!out.data && !DATA_LINE.test(literal)) return undefined
  if (out.event === undefined) {
    const name = EVENT_TEXT.exec(literal)?.[1]?.trim()
    if (name && !name.includes('\u0000')) out.event = name
  }
  return out
}

/** `JSON.stringify(x)` -> `x`. */
function unwrapStringify(expr: Node): Node {
  if (N.isCallExpression(expr) && expr.getExpression().getText() === 'JSON.stringify') {
    return expr.getArguments()[0] ?? expr
  }
  return expr
}

/** Whether the code answers with an event stream: the content type is written in it. */
export function mentionsEventStream(node: Node): boolean {
  return /text\/event-stream/i.test(node.getText())
}

/** The parameter index `expr` refers to, when it is one of `fn`'s parameters. */
export function parameterIndex(expr: Node, fn: Node): number | undefined {
  if (!N.isIdentifier(expr)) return undefined
  const params = (fn as Node & { getParameters?: () => Node[] }).getParameters?.() ?? []
  const decl = expr.getSymbol()?.getDeclarations()[0]
  const index = decl ? params.indexOf(decl) : -1
  return index >= 0 ? index : undefined
}

/** How a client reads an EventSource: `onmessage = fn`, `addEventListener('name', fn)`. */
export interface Listener {
  name: string
  handler: Node
}

/**
 * Listeners added to the EventSource created by `expr`, found by the name it is stored in
 * (`const source = new EventSource()`, `ref.current = new EventSource()`), in `scope`.
 */
export function eventSourceListeners(
  expr: Node,
  scope: Node,
  eventName: (arg: Node) => string | undefined,
): Listener[] {
  const holder = holderText(expr)
  if (!holder) return []
  const out: Listener[] = []
  for (const access of scope.getDescendants()) {
    if (!N.isPropertyAccessExpression(access) || access.getExpression().getText() !== holder) continue
    const parent = access.getParent()
    const name = access.getName()
    if (name === 'onmessage' && parent && N.isBinaryExpression(parent) && parent.getLeft() === access) {
      if (parent.getOperatorToken().getText() === '=')
        out.push({ name: 'message', handler: parent.getRight() })
    } else if (name === 'addEventListener' && parent && N.isCallExpression(parent)) {
      const [type, handler] = (parent as CallExpression).getArguments()
      const event = type ? eventName(type) : undefined
      if (event && handler && event !== 'open' && event !== 'error') out.push({ name: event, handler })
    }
  }
  return out
}

/** The name or property the new object is assigned to. */
function holderText(expr: Node): string | undefined {
  let current = expr
  let parent = current.getParent()
  while (parent && (N.isParenthesizedExpression(parent) || N.isAsExpression(parent))) {
    current = parent
    parent = parent.getParent()
  }
  if (!parent) return undefined
  if (N.isVariableDeclaration(parent) && parent.getInitializer() === current) {
    const name = parent.getNameNode()
    return N.isIdentifier(name) ? name.getText() : undefined
  }
  if (
    N.isBinaryExpression(parent) &&
    parent.getRight() === current &&
    parent.getOperatorToken().getText() === '='
  ) {
    return parent.getLeft().getText()
  }
  return undefined
}

/**
 * Adds the events a route handler sends to what the client listens to. EventSource events
 * without a type take the handler's; handler events nobody listens to are listed as such. A
 * fetch read by hand handles every event.
 */
export function mergeHandlerEvents(stream: SiteStream, sent: readonly SseEvent[]): SiteStream {
  const events = stream.events.map((e) => ({ ...e }))
  for (const event of sent) {
    const own = events.find((e) => e.name === event.name)
    if (own) {
      if (!own.dataType && event.dataType) {
        own.dataType = event.dataType
        own.typeFrom = 'handler'
      }
      continue
    }
    events.push({
      name: event.name,
      ...(event.dataType ? { dataType: event.dataType, typeFrom: 'handler' as const } : {}),
      ...(event.loc ? { loc: event.loc } : {}),
      listened: stream.api === 'fetch',
    })
  }
  return { ...stream, events }
}
