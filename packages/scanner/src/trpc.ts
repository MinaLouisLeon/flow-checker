// tRPC (M16): client proxies, routers and the endpoint that serves them.
//
// Client calls are property chains on a proxy: `trpc.todo.byId.useQuery(input)`. The proxy is
// found by following the root identifier to the factory that made it (`createTRPCReact()`,
// `createTRPCClient()`, `useTRPC()` from `createTRPCContext()`, `trpc.useUtils()`).
//
// The router is read as written: `router({ todo: todoRouter })`, `t.router`, merged routers
// (`mergeRouters(a, b)`), and plain nested objects (v11). Each procedure is a chain like
// `publicProcedure.input(schema).output(schema).query(resolver)`; the base procedure is
// followed through constants (`userProcedure = publicProcedure.use(mw)`).
import type { QueryLink, TrpcProcedureType } from '@flow-checker/shared'
import { type CallExpression, Node as N, type Node, type SourceFile, ts } from 'ts-morph'
import { unalias } from './components'

/**
 * What a proxy is. `react`: `createTRPCReact()` hooks. `vanilla`: the plain client.
 * `options`: v11 `useTRPC()` / `createTRPCOptionsProxy({ client })`. `utils`: `trpc.useUtils()`.
 * `server`: a proxy that calls the router directly (`createTRPCOptionsProxy({ router })`), no HTTP.
 */
export type ProxyKind = 'react' | 'vanilla' | 'options' | 'utils' | 'server'

export const REACT_METHODS: Record<string, TrpcProcedureType> = {
  useQuery: 'query',
  useSuspenseQuery: 'query',
  useInfiniteQuery: 'query',
  useSuspenseInfiniteQuery: 'query',
  usePrefetchQuery: 'query',
  usePrefetchInfiniteQuery: 'query',
  useMutation: 'mutation',
  useSubscription: 'subscription',
}
export const VANILLA_METHODS: Record<string, TrpcProcedureType> = {
  query: 'query',
  mutate: 'mutation',
  subscribe: 'subscription',
}
/** v11 options proxy: React Query options for the procedure. */
export const OPTIONS_METHODS: Record<string, TrpcProcedureType> = {
  queryOptions: 'query',
  infiniteQueryOptions: 'query',
  mutationOptions: 'mutation',
  subscriptionOptions: 'subscription',
}
/** v11 options proxy: keys and filters for `queryClient` cache calls. */
export const KEY_METHODS = new Set([
  'queryKey',
  'pathKey',
  'pathFilter',
  'queryFilter',
  'infiniteQueryKey',
  'infiniteQueryFilter',
])
/** `utils.todo.byId.fetch()` and friends run the query. */
export const UTILS_FETCHES = new Set(['fetch', 'prefetch', 'ensureData', 'fetchInfinite', 'prefetchInfinite'])
/** `utils.todo.list.invalidate()` and friends change cached queries. */
export const UTILS_OPS: Record<string, QueryLink['kind']> = {
  invalidate: 'invalidate',
  refetch: 'refetch',
  reset: 'reset',
  setData: 'set-data',
  setInfiniteData: 'set-data',
}

const METHODS_BY_PROXY: Record<Exclude<ProxyKind, 'server'>, Set<string>> = {
  react: new Set(Object.keys(REACT_METHODS)),
  vanilla: new Set(Object.keys(VANILLA_METHODS)),
  options: new Set([...Object.keys(OPTIONS_METHODS), ...KEY_METHODS]),
  utils: new Set([...UTILS_FETCHES, ...Object.keys(UTILS_OPS)]),
}
const ANY_METHOD = new Set(Object.values(METHODS_BY_PROXY).flatMap((s) => [...s]))

/** Factories by exported name. */
const FACTORIES: Record<string, ProxyKind> = {
  createTRPCReact: 'react',
  createTRPCNext: 'react',
  createTRPCProxyClient: 'vanilla',
  createTRPCClient: 'vanilla',
  createTRPCOptionsProxy: 'options',
}
/** Hooks returned by v11 `createTRPCContext()`. */
const CONTEXT_HOOKS: Record<string, ProxyKind> = { useTRPC: 'options', useTRPCClient: 'vanilla' }
const UTILS_HOOKS = new Set(['useUtils', 'useContext'])

export interface ProcedureCall {
  /** Dotted procedure path; empty for proxy-wide calls such as `utils.invalidate()`. */
  path: string
  /** The last member called, e.g. `useQuery`, `mutate`, `queryOptions`. */
  method: string
  proxy: ProxyKind
}

const proxyCache = new WeakMap<Node, ProxyKind | null>()

/** A call on a tRPC proxy, e.g. `trpc.todo.byId.useQuery(...)`. */
export function procedureCall(call: CallExpression): ProcedureCall | undefined {
  const callee = call.getExpression()
  if (!N.isPropertyAccessExpression(callee)) return undefined
  const method = callee.getName()
  if (!ANY_METHOD.has(method)) return undefined
  const names: string[] = []
  let current: Node = callee.getExpression()
  while (N.isPropertyAccessExpression(current)) {
    names.unshift(current.getName())
    current = current.getExpression()
  }
  const proxy = proxyKind(current, 0)
  if (!proxy) return undefined
  if (proxy !== 'server' && !METHODS_BY_PROXY[proxy].has(method)) return undefined
  // Only utils and key helpers make sense without a procedure path.
  if (names.length === 0 && proxy !== 'utils' && !KEY_METHODS.has(method)) return undefined
  return { path: names.join('.'), method, proxy }
}

function proxyKind(node: Node, depth: number): ProxyKind | undefined {
  if (depth > 6) return undefined
  const inner = skip(node)
  if (N.isCallExpression(inner)) return proxyFromCall(inner, depth)
  if (!N.isIdentifier(inner)) return undefined
  const symbol = inner.getSymbol()
  const decl = symbol ? unalias(symbol).getDeclarations()[0] : undefined
  if (!decl || !N.isVariableDeclaration(decl)) return undefined
  const cached = proxyCache.get(decl)
  if (cached !== undefined) return cached ?? undefined
  proxyCache.set(decl, null)
  const init = decl.getInitializer()
  const kind = init ? proxyKind(init, depth + 1) : undefined
  proxyCache.set(decl, kind ?? null)
  return kind
}

function proxyFromCall(call: CallExpression, depth: number): ProxyKind | undefined {
  const callee = skip(call.getExpression())
  if (N.isPropertyAccessExpression(callee)) {
    // `trpc.useUtils()` on a React proxy.
    if (UTILS_HOOKS.has(callee.getName()) && proxyKind(callee.getExpression(), depth + 1) === 'react')
      return 'utils'
    return undefined
  }
  if (!N.isIdentifier(callee)) return undefined
  const factory = trpcImport(callee)
  if (factory) {
    const kind = FACTORIES[factory]
    if (kind === 'options' && hasProp(call.getArguments()[0], 'router')) return 'server'
    return kind
  }
  // `useTRPC()` destructured from `createTRPCContext<AppRouter>()`.
  const symbol = callee.getSymbol()
  const decl = symbol ? unalias(symbol).getDeclarations()[0] : undefined
  if (decl && N.isBindingElement(decl)) {
    const name = decl.getPropertyNameNode()?.getText() ?? decl.getName()
    const init = decl.getFirstAncestorByKind(ts.SyntaxKind.VariableDeclaration)?.getInitializer()
    const fn = init && N.isCallExpression(init) ? skip(init.getExpression()) : undefined
    if (fn && N.isIdentifier(fn) && trpcImport(fn) === 'createTRPCContext') return CONTEXT_HOOKS[name]
  }
  return undefined
}

/** The exported name, when the identifier is imported from a `@trpc/*` package. */
function trpcImport(identifier: Node): string | undefined {
  for (const decl of identifier.getSymbol()?.getDeclarations() ?? []) {
    if (!N.isImportSpecifier(decl)) continue
    const module = decl.getImportDeclaration().getModuleSpecifierValue()
    if (module.startsWith('@trpc/')) return decl.getName()
  }
  return undefined
}

function hasProp(arg: Node | undefined, name: string): boolean {
  const obj = arg ? skip(arg) : undefined
  return (
    !!obj &&
    N.isObjectLiteralExpression(obj) &&
    obj
      .getProperties()
      .some((p) => (N.isPropertyAssignment(p) || N.isShorthandPropertyAssignment(p)) && p.getName() === name)
  )
}

// --- Routers ---------------------------------------------------------------------------------

export interface ProcedureDef {
  path: string
  type: TrpcProcedureType
  /** The `.query()` / `.mutation()` / `.subscription()` call. */
  call: CallExpression
  /** The resolver passed to it, when it is a function in the project. */
  resolver?: Node
  /** `.input(...)` arguments, in the order written. */
  inputs: Node[]
  /** The `.output(...)` argument. */
  output?: Node
}

const PROCEDURE_TYPES: Record<string, TrpcProcedureType> = {
  query: 'query',
  mutation: 'mutation',
  subscription: 'subscription',
}

/** Every procedure of a router value, with its full path. */
export function readRouter(expr: Node): ProcedureDef[] {
  const out: ProcedureDef[] = []
  collect(expr, [], out, 0, new Set())
  return out
}

function collect(expr: Node, prefix: string[], out: ProcedureDef[], depth: number, seen: Set<Node>) {
  const node = valueAt(expr)
  if (!node || depth > 12 || seen.has(node)) return
  seen.add(node)
  try {
    if (N.isObjectLiteralExpression(node)) {
      for (const prop of node.getProperties()) {
        if (N.isPropertyAssignment(prop)) {
          const init = prop.getInitializer()
          if (init) collect(init, [...prefix, propName(prop.getNameNode())], out, depth + 1, seen)
        } else if (N.isShorthandPropertyAssignment(prop)) {
          collect(prop.getNameNode(), [...prefix, prop.getName()], out, depth + 1, seen)
        } else if (N.isSpreadAssignment(prop)) {
          collect(prop.getExpression(), prefix, out, depth + 1, seen)
        }
      }
      return
    }
    if (!N.isCallExpression(node)) return
    const procedure = procedureDef(node, prefix)
    if (procedure) {
      out.push(procedure)
      return
    }
    const kind = routerCallKind(node)
    if (kind === 'merge') for (const arg of node.getArguments()) collect(arg, prefix, out, depth + 1, seen)
    else if (kind === 'router') {
      const arg = node.getArguments()[0]
      if (arg) collect(arg, prefix, out, depth + 1, seen)
    }
  } finally {
    seen.delete(node)
  }
}

function procedureDef(call: CallExpression, prefix: string[]): ProcedureDef | undefined {
  const callee = call.getExpression()
  if (!N.isPropertyAccessExpression(callee)) return undefined
  const type = PROCEDURE_TYPES[callee.getName()]
  if (!type || prefix.length === 0) return undefined
  const inputs: Node[] = []
  let output: Node | undefined
  let current: Node = callee.getExpression()
  for (let i = 0; i < 30; i++) {
    const inner = skip(current)
    if (N.isCallExpression(inner)) {
      const fn = inner.getExpression()
      if (!N.isPropertyAccessExpression(fn)) break
      const arg = inner.getArguments()[0]
      if (fn.getName() === 'input' && arg) inputs.unshift(arg)
      if (fn.getName() === 'output' && arg && !output) output = arg
      current = fn.getExpression()
      continue
    }
    // The base procedure: `publicProcedure`, `t.procedure`.
    if (N.isIdentifier(inner)) {
      const symbol = inner.getSymbol()
      const decl = symbol ? unalias(symbol).getDeclarations()[0] : undefined
      const init = decl && N.isVariableDeclaration(decl) ? decl.getInitializer() : undefined
      if (!init) break
      current = init
      continue
    }
    break
  }
  const resolver = functionValue(call.getArguments()[0])
  return {
    path: prefix.join('.'),
    type,
    call,
    ...(resolver ? { resolver } : {}),
    inputs,
    ...(output ? { output } : {}),
  }
}

/** `router({...})`, `t.router(...)`, `createTRPCRouter(...)`, `mergeRouters(a, b)`. */
function routerCallKind(call: CallExpression): 'router' | 'merge' | undefined {
  const names = calleeNames(call.getExpression())
  if (names.some((n) => /mergeRouters$/.test(n))) return 'merge'
  if (names.some((n) => /router$/i.test(n))) return 'router'
  return undefined
}

/** The callee's name, and the name it is an alias of (`const router = t.router`). */
function calleeNames(expr: Node): string[] {
  const inner = skip(expr)
  if (N.isPropertyAccessExpression(inner)) return [inner.getName()]
  if (!N.isIdentifier(inner)) return []
  const names = [inner.getText()]
  const symbol = inner.getSymbol()
  const target = symbol ? unalias(symbol) : undefined
  if (target) names.push(target.getName())
  const decl = target?.getDeclarations()[0]
  const init = decl && N.isVariableDeclaration(decl) ? decl.getInitializer() : undefined
  if (init) {
    const value = skip(init)
    if (N.isPropertyAccessExpression(value)) names.push(value.getName())
    else if (N.isIdentifier(value)) names.push(value.getText())
  }
  return names
}

/** Follows constants, imports and object properties to the expression a value is written as. */
function valueAt(expr: Node, depth = 0): Node | undefined {
  if (depth > 10) return undefined
  const node = skip(expr)
  if (N.isIdentifier(node)) {
    // Shorthand `{ todo }`: the name is the property; the value is the variable it names.
    const parent = node.getParent()
    const symbol =
      parent && N.isShorthandPropertyAssignment(parent) ? parent.getValueSymbol() : node.getSymbol()
    if (!symbol) return undefined
    const decl = unalias(symbol).getValueDeclaration() ?? unalias(symbol).getDeclarations()[0]
    if (decl && N.isVariableDeclaration(decl)) {
      const init = decl.getInitializer()
      return init ? valueAt(init, depth + 1) : undefined
    }
    return undefined
  }
  if (N.isPropertyAccessExpression(node)) {
    const obj = valueAt(node.getExpression(), depth + 1)
    if (!obj || !N.isObjectLiteralExpression(obj)) return node
    const prop = obj.getProperty(node.getName())
    if (prop && N.isPropertyAssignment(prop)) {
      const init = prop.getInitializer()
      return init ? valueAt(init, depth + 1) : undefined
    }
    if (prop && N.isShorthandPropertyAssignment(prop)) return valueAt(prop.getNameNode(), depth + 1)
    return undefined
  }
  return node
}

function functionValue(arg: Node | undefined): Node | undefined {
  if (!arg) return undefined
  const node = skip(arg)
  if (N.isArrowFunction(node) || N.isFunctionExpression(node)) return node
  if (N.isIdentifier(node)) {
    const symbol = node.getSymbol()
    const decl = symbol ? unalias(symbol).getDeclarations()[0] : undefined
    if (decl && N.isFunctionDeclaration(decl)) return decl
    const init = decl && N.isVariableDeclaration(decl) ? decl.getInitializer() : undefined
    const value = init ? skip(init) : undefined
    if (value && (N.isArrowFunction(value) || N.isFunctionExpression(value))) return value
  }
  return undefined
}

// --- Endpoint and root router ----------------------------------------------------------------

/** `fetchRequestHandler({ endpoint, router })` in a route handler file. */
export interface TrpcHandler {
  endpoint?: string
  router?: Node
}

const HANDLERS = new Set(['fetchRequestHandler'])

export function findHandler(file: SourceFile): TrpcHandler | undefined {
  for (const call of file.getDescendantsOfKind(ts.SyntaxKind.CallExpression)) {
    const callee = call.getExpression()
    if (!N.isIdentifier(callee)) continue
    const name = trpcImport(callee)
    if (!name || !HANDLERS.has(name)) continue
    const options = call.getArguments()[0]
    const obj = options ? valueAt(options) : undefined
    if (!obj || !N.isObjectLiteralExpression(obj)) return {}
    const endpoint = literal(propValue(obj, 'endpoint'))
    const router = propValue(obj, 'router')
    return { ...(endpoint !== undefined ? { endpoint } : {}), ...(router ? { router } : {}) }
  }
  return undefined
}

const LINKS = new Set([
  'httpBatchLink',
  'httpLink',
  'httpBatchStreamLink',
  'unstable_httpBatchStreamLink',
  'httpSubscriptionLink',
  'unstable_httpSubscriptionLink',
])

/** The path of the first `httpBatchLink({ url })` (or other HTTP link) in the files. */
export function findLinkPath(files: SourceFile[]): string | undefined {
  for (const file of files) {
    if (!file.getImportDeclarations().some((d) => d.getModuleSpecifierValue().startsWith('@trpc/'))) continue
    for (const call of file.getDescendantsOfKind(ts.SyntaxKind.CallExpression)) {
      const callee = call.getExpression()
      if (!N.isIdentifier(callee) || !LINKS.has(trpcImport(callee) ?? '')) continue
      const options = call.getArguments()[0]
      const obj = options ? valueAt(options) : undefined
      const url = obj && N.isObjectLiteralExpression(obj) ? propValue(obj, 'url') : undefined
      const path = url ? pathOfUrl(url) : undefined
      if (path) return path
    }
  }
  return undefined
}

/** `typeof appRouter` behind `createTRPCReact<AppRouter>()` and the other factories. */
export function findRouterFromClients(files: SourceFile[]): Node | undefined {
  for (const file of files) {
    if (!file.getImportDeclarations().some((d) => d.getModuleSpecifierValue().startsWith('@trpc/'))) continue
    for (const call of file.getDescendantsOfKind(ts.SyntaxKind.CallExpression)) {
      const callee = call.getExpression()
      if (!N.isIdentifier(callee)) continue
      const name = trpcImport(callee)
      if (!name || !(name in FACTORIES || name === 'createTRPCContext')) continue
      const typeArg = call.getTypeArguments()[0]
      const router = typeArg ? routerOfType(typeArg) : undefined
      if (router) return router
    }
  }
  return undefined
}

function routerOfType(typeNode: Node, depth = 0): Node | undefined {
  if (depth > 5) return undefined
  if (N.isTypeQuery(typeNode)) return typeNode.getExprName()
  if (!N.isTypeReference(typeNode)) return undefined
  const symbol = typeNode.getTypeName().getSymbol()
  const decl = symbol ? unalias(symbol).getDeclarations()[0] : undefined
  if (decl && N.isTypeAliasDeclaration(decl)) {
    const inner = decl.getTypeNode()
    return inner ? routerOfType(inner, depth + 1) : undefined
  }
  return undefined
}

function propValue(obj: Node, name: string): Node | undefined {
  if (!N.isObjectLiteralExpression(obj)) return undefined
  const prop = obj.getProperty(name)
  if (prop && N.isPropertyAssignment(prop)) return prop.getInitializer()
  if (prop && N.isShorthandPropertyAssignment(prop)) return prop.getNameNode()
  return undefined
}

function literal(expr: Node | undefined): string | undefined {
  const node = expr ? valueAt(expr) : undefined
  return node && (N.isStringLiteral(node) || N.isNoSubstitutionTemplateLiteral(node))
    ? node.getLiteralValue()
    : undefined
}

/** `'/api/trpc'`, `` `${getBaseUrl()}/api/trpc` ``, `'http://localhost:3000/api/trpc'` -> `/api/trpc`. */
function pathOfUrl(expr: Node): string | undefined {
  const node = valueAt(expr) ?? skip(expr)
  let text: string | undefined
  if (N.isStringLiteral(node) || N.isNoSubstitutionTemplateLiteral(node)) text = node.getLiteralValue()
  else if (N.isTemplateExpression(node)) text = node.getTemplateSpans().at(-1)?.getLiteral().getLiteralText()
  else if (N.isBinaryExpression(node)) return pathOfUrl(node.getRight())
  if (!text) return undefined
  const path = text.replace(/^[a-z][a-z\d+.-]*:\/\/[^/]*/i, '')
  return path.startsWith('/') ? path.replace(/\/$/, '') || '/' : undefined
}

function propName(node: Node): string {
  if (N.isStringLiteral(node) || N.isNumericLiteral(node)) return String(node.getLiteralValue())
  return node.getText()
}

function skip(node: Node): Node {
  let current = node
  while (
    N.isParenthesizedExpression(current) ||
    N.isAsExpression(current) ||
    N.isSatisfiesExpression(current) ||
    N.isNonNullExpression(current) ||
    N.isTypeAssertion(current)
  ) {
    current = current.getExpression()
  }
  return current
}
