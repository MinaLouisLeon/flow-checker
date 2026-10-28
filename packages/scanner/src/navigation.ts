// Navigation calls and links (docs/PLAN.md 6.6): `<Link href>`, `router.push/replace()`,
// `redirect()` and `permanentRedirect()`, from Next itself or from next-intl's
// `createNavigation()` wrappers (which add the locale prefix).
// The request scanner finds them on its walk, so they get the same origin, trigger and
// string resolution as requests. These are the AST helpers it uses.
import type { Navigation } from '@flow-checker/shared'
import { type CallExpression, type JsxTagNameExpression, Node as N, type Node, ts } from 'ts-morph'
import { importModuleOf, packageFactoryOf, unalias } from './components'

export type NavApi = Navigation['api']
export type NavKind = Navigation['kind']

const NEXT_MODULES = new Set(['next/navigation', 'next/link'])
const INTL_MODULE = /^next-intl(\/|$)/

/** Which navigation API an identifier comes from: Next's own, a next-intl wrapper, or neither. */
export function navigationApi(identifier: Node): NavApi | undefined {
  const module = importModuleOf(identifier)
  if (module && NEXT_MODULES.has(module)) return 'next'
  if (module && INTL_MODULE.test(module)) return 'next-intl'
  // `export const { Link, useRouter } = createNavigation(routing)` in project code.
  const symbol = identifier.getSymbol()
  const decl = symbol ? unalias(symbol).getDeclarations()[0] : undefined
  const factory = decl ? packageFactoryOf(decl) : undefined
  return factory && INTL_MODULE.test(factory) ? 'next-intl' : undefined
}

/** `<Link>` from next/link or a next-intl navigation wrapper. */
export function linkApi(tag: JsxTagNameExpression): NavApi | undefined {
  if (!N.isIdentifier(tag)) return undefined
  const api = navigationApi(tag)
  if (!api) return undefined
  if (importModuleOf(tag) === 'next/link') return 'next'
  // A next-intl wrapper exports `Link` by that name.
  return unaliasedName(tag) === 'Link' ? api : undefined
}

/**
 * `router.push(x)` where `router = useRouter()`, `useRouter().replace(x)`, `redirect(x)`.
 * Returns the kind and API, or undefined for anything else.
 */
export function navigationCall(call: CallExpression): { kind: NavKind; api: NavApi } | undefined {
  const expr = call.getExpression()
  if (N.isPropertyAccessExpression(expr)) {
    const name = expr.getName()
    if (name !== 'push' && name !== 'replace') return undefined
    const api = routerApi(expr.getExpression())
    return api ? { kind: name, api } : undefined
  }
  if (N.isIdentifier(expr)) {
    const name = unaliasedName(expr)
    if (name !== 'redirect' && name !== 'permanentRedirect') return undefined
    const api = navigationApi(expr)
    return api ? { kind: name === 'redirect' ? 'redirect' : 'permanent-redirect', api } : undefined
  }
  return undefined
}

/** The API of `useRouter()` behind a router value: the call itself, or a variable set from it. */
function routerApi(target: Node): NavApi | undefined {
  const inner = skip(target)
  if (N.isCallExpression(inner)) return useRouterApi(inner)
  if (!N.isIdentifier(inner)) return undefined
  const decl = inner.getSymbol()?.getDeclarations()[0]
  if (!decl || !N.isVariableDeclaration(decl)) return undefined
  const init = decl.getInitializer()
  return init && N.isCallExpression(skip(init)) ? useRouterApi(skip(init) as CallExpression) : undefined
}

function useRouterApi(call: CallExpression): NavApi | undefined {
  const callee = call.getExpression()
  if (!N.isIdentifier(callee) || unaliasedName(callee) !== 'useRouter') return undefined
  return navigationApi(callee)
}

/** The original name: through imports, and `{ Link: IntlLink } = createNavigation()` renames. */
function unaliasedName(identifier: Node): string {
  const symbol = identifier.getSymbol()
  if (!symbol) return identifier.getText()
  const target = unalias(symbol)
  const decl = target.getDeclarations()[0]
  if (decl && N.isBindingElement(decl)) return decl.getPropertyNameNode()?.getText() ?? decl.getName()
  return target.getName()
}

function skip(node: Node): Node {
  let current = node
  while (
    N.isParenthesizedExpression(current) ||
    N.isAsExpression(current) ||
    N.isNonNullExpression(current)
  ) {
    current = current.getExpression()
  }
  return current
}

/** Condition text that looks like it checks a response: `res.ok`, `status === 201`, `error`. */
const RESPONSE_CHECK = /\bok\b|status|error|success|\bres\b|response|data/i

/**
 * Whether code at `node` only runs when a request succeeded or failed, judged from what
 * encloses it up to `scope`: `try` / `catch`, `.then` / `.catch` callbacks, `onSuccess` /
 * `onError` options, and an `if` that checks a response.
 */
export function outcomeOf(node: Node, scope: Node): Navigation['outcome'] {
  let child: Node = node
  for (let current = node.getParent(); current && child !== scope; current = current.getParent()) {
    if (N.isCatchClause(current)) return 'error'
    if (N.isTryStatement(current) && child === current.getTryBlock()) return 'success'
    if (N.isPropertyAssignment(current) || N.isMethodDeclaration(current)) {
      const name = current.getName()
      if (name === 'onError') return 'error'
      if (name === 'onSuccess') return 'success'
    }
    if (N.isCallExpression(current) && current.getArguments().includes(child as never)) {
      const callee = current.getExpression()
      if (N.isPropertyAccessExpression(callee)) {
        const name = callee.getName()
        if (name === 'catch') return 'error'
        if (name === 'then') return current.getArguments()[1] === child ? 'error' : 'success'
      }
    }
    if (N.isIfStatement(current) && child !== current.getExpression()) {
      const condition = current.getExpression()
      if (RESPONSE_CHECK.test(condition.getText())) {
        const negated = isNegated(condition)
        const inThen = child === current.getThenStatement()
        return inThen !== negated ? 'success' : 'error'
      }
    }
    child = current
  }
  return undefined
}

/** True when the condition holds on failure: `!res.ok`, `status !== 201`, `status >= 400`, `error`. */
function isNegated(condition: Node): boolean {
  let negated = false
  let inner = skip(condition)
  if (N.isPrefixUnaryExpression(inner) && inner.getOperatorToken() === ts.SyntaxKind.ExclamationToken) {
    negated = true
    inner = skip(inner.getOperand())
  }
  if (N.isBinaryExpression(inner)) {
    const op = inner.getOperatorToken().getKind()
    if (op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken) {
      negated = !negated
    } else if (
      (op === ts.SyntaxKind.GreaterThanEqualsToken || op === ts.SyntaxKind.GreaterThanToken) &&
      /status/.test(inner.getLeft().getText()) &&
      /^[3-5]\d\d$/.test(inner.getRight().getText())
    ) {
      negated = !negated
    }
    return negated
  }
  // A plain `error` / `err` / `failed` value is truthy on failure.
  if (/\b(err|error|errors|failed|failure)\b/i.test(inner.getText())) negated = !negated
  return negated
}
