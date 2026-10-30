// Request sites (docs/PLAN.md 6.4).
//
// Starting from every component, route handler and server action, the scanner walks the code
// and follows calls into project functions (wrappers like `getUsers()` or `http<T>()`) until it
// reaches a network call: `fetch`, axios, or a server action called from client code. Each path
// from an origin to a network call is one request site.
//
// Arguments are bound to parameters on the way down, so a URL built from a wrapper's parameters
// resolves at the call site (`getUser(id)` -> `/users/:id`). The trigger comes from where the
// call sits on the way up: a JSX event prop, `useEffect`, a query hook at render, a mutation's
// `.mutate()` call, or plain render.
import {
  type ApiClientConfig,
  type CallFrame,
  type Component,
  type Flag,
  HTTP_METHODS,
  type HttpMethod,
  makeId,
  type Navigation,
  type QueryKeyPart,
  type QueryLink,
  queryKeyHits,
  type RequestSite,
  type RequestUrl,
  type Route,
  type ServerActionRef,
  type SourceLoc,
  type Trigger,
  type TypeRef,
} from '@flow-checker/shared'
import {
  type ArrowFunction,
  type CallExpression,
  type FunctionDeclaration,
  type FunctionExpression,
  type JsxAttribute,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  type MethodDeclaration,
  Node as N,
  type Node,
  type ParameterDeclaration,
  type SourceFile,
  type Symbol as TsSymbol,
  type Type,
  type TypeNode,
  ts,
} from 'ts-morph'
import { siteHash } from './code-hash'
import { directives, importModuleOf, isConditional, unalias } from './components'
import { linkApi, type NavApi, type NavKind, navigationCall, outcomeOf } from './navigation'
import { compare, relativeTo } from './paths'
import type { TypeResolver } from './types'

/** How deep wrapper calls are followed from an origin. */
const MAX_DEPTH = 10

const EFFECT_HOOKS = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect'])
const CALLBACK_HOOKS = new Set(['useCallback', 'useMemo', 'useEffectEvent'])

interface HookDef {
  /** Canonical name, e.g. `useQuery`, `useSWR`, `prefetchQuery`. */
  name: string
  module: string
  kind: 'query' | 'mutation'
  /** React Query: the options property holding the function / key. */
  fnProp?: string
  keyProp?: string
  /** SWR: the argument index of the fetcher / key. */
  fnArg?: number
  keyArg?: number
  /** React Query: the key is parsed into segments, and v4's positional form is accepted. */
  rq?: boolean
  /** `useQueries` / `useSuspenseQueries`: one query per entry of `queries`. */
  multi?: boolean
  /** A `queryClient` method (`prefetchQuery`, ...), not a hook. */
  client?: boolean
}

const RQ = (name: string, kind: HookDef['kind'], module: string, extra: Partial<HookDef> = {}): HookDef => ({
  name,
  module,
  kind,
  fnProp: kind === 'query' ? 'queryFn' : 'mutationFn',
  keyProp: kind === 'query' ? 'queryKey' : 'mutationKey',
  rq: true,
  ...extra,
})
const SWR = (name: string, kind: HookDef['kind'], module: string): HookDef => ({
  name,
  module,
  kind,
  fnArg: 1,
  keyArg: 0,
})

/** Data-fetching hooks by `module#importedName` (`default` for default imports). */
const HOOKS = new Map<string, HookDef>()
for (const module of ['@tanstack/react-query', 'react-query']) {
  for (const name of [
    'useQuery',
    'useSuspenseQuery',
    'useInfiniteQuery',
    'useSuspenseInfiniteQuery',
    'usePrefetchQuery',
    'usePrefetchInfiniteQuery',
  ]) {
    HOOKS.set(`${module}#${name}`, RQ(name, 'query', module))
  }
  for (const name of ['useQueries', 'useSuspenseQueries']) {
    HOOKS.set(`${module}#${name}`, RQ(name, 'query', module, { multi: true }))
  }
  HOOKS.set(`${module}#useMutation`, RQ('useMutation', 'mutation', module))
}

/** `queryClient` methods that run a query function. */
const QUERY_CLIENT_FETCHES = new Set([
  'fetchQuery',
  'prefetchQuery',
  'ensureQueryData',
  'fetchInfiniteQuery',
  'prefetchInfiniteQuery',
  'ensureInfiniteQueryData',
])

/** `queryClient` methods that change cached queries, and the link kind they make. */
const QUERY_CACHE_OPS: Record<string, QueryLink['kind']> = {
  invalidateQueries: 'invalidate',
  refetchQueries: 'refetch',
  resetQueries: 'reset',
  removeQueries: 'remove',
  setQueryData: 'set-data',
  setQueriesData: 'set-data',
}

/** Calls whose first argument is query options: `queryOptions({...})`, and library helpers like it. */
const OPTIONS_HELPER = /Options$/

/** Components that hand server-prefetched queries to the client. */
const HYDRATION_COMPONENTS = new Set(['HydrationBoundary', 'Hydrate'])
HOOKS.set('swr#default', SWR('useSWR', 'query', 'swr'))
HOOKS.set('swr/immutable#default', SWR('useSWRImmutable', 'query', 'swr/immutable'))
HOOKS.set('swr/infinite#default', SWR('useSWRInfinite', 'query', 'swr/infinite'))
HOOKS.set('swr/mutation#default', SWR('useSWRMutation', 'mutation', 'swr/mutation'))

/** Hooks that bind a server action to a form: `useActionState(action, initial)`. */
const ACTION_STATE_HOOKS = new Set(['react#useActionState', 'react-dom#useFormState'])

/** Mutation result members that run the mutation. */
const MUTATE_MEMBERS = new Set(['mutate', 'mutateAsync', 'trigger'])

const AXIOS_METHODS: Record<string, { method?: HttpMethod; data: boolean; config?: boolean }> = {
  get: { method: 'GET', data: false },
  delete: { method: 'DELETE', data: false },
  head: { method: 'HEAD', data: false },
  options: { method: 'OPTIONS', data: false },
  post: { method: 'POST', data: true },
  put: { method: 'PUT', data: true },
  patch: { method: 'PATCH', data: true },
  postForm: { method: 'POST', data: true },
  putForm: { method: 'PUT', data: true },
  patchForm: { method: 'PATCH', data: true },
  request: { data: false, config: true },
}

// --- Symbolic values -------------------------------------------------------------------------

/** What a parameter is bound to in a call: the argument and the scope it is evaluated in. */
interface Binding {
  expr: Node | undefined
  env: Env
}
type Env = ReadonlyMap<Node, Binding>
const EMPTY_ENV: Env = new Map()

/** A string built from known text and runtime holes, e.g. `/users/` + `:id`. */
type Part = { text: string } | { hole: string }
interface Str {
  parts: Part[]
  /** Set when the value starts with `process.env.X` (or its fallback). */
  env?: string
}

/** Where an expression's value comes from, after following parameters and constants. */
interface Resolved {
  /** Undefined when the value is `undefined` (argument not passed). */
  node: Node | undefined
  env: Env
}

/** A property read from an object value: found, missing, or not knowable statically. */
type Prop = Resolved | 'absent' | 'unknown'

// --- Walk state ------------------------------------------------------------------------------

interface Origin {
  kind: RequestSite['origin']
  /** Identifies the origin in site ids. */
  key: string
  /** Code runs in the browser (client components): server action calls are network requests. */
  client: boolean
  componentId?: string
  routeId?: string
  handlerMethod?: HttpMethod
  serverAction?: ServerActionRef
}

interface Frame {
  /** The call (or JSX attribute) that enters the next function. */
  node: Node
  callee: string
  /** The function the call is written in. */
  scope: Node
  /** Set when this frame decides the trigger (mutation `.mutate()`, JSX attribute). */
  trigger?: Trigger
  /** Set for a data-fetching hook frame. */
  hook?: { def: HookDef; key?: string; typeArg?: TypeNode; parts?: QueryKeyPart[] }
  /** Set when entering a mutation's `onSuccess` / `onError` callback. */
  outcome?: 'success' | 'error'
  /** Set when entering a mutation's callback: the mutation hook call it runs after. */
  after?: Node
}

/** A query cache call found in the code, before its targets are resolved. */
interface LinkFound {
  link: Omit<QueryLink, 'fromSiteIds' | 'targetSiteIds'>
  /** Mutation hook calls whose callbacks run it. */
  after: Node[]
}

/** The values a React Query hook or `queryClient` method was called with. */
interface HookArgs {
  options?: Resolved
  fn?: Resolved
  key?: Resolved
}

interface NavFound {
  kind: NavKind
  api: NavApi
  href: RequestUrl
}

interface Walk {
  origin: Origin
  frames: Frame[]
  /** Functions on the current path, so recursion terminates. */
  active: Set<Node>
}

interface Found {
  transport: RequestSite['transport']
  method?: HttpMethod
  url?: RequestUrl
  bodyType?: TypeRef
  responseType?: TypeRef
  serverAction?: ServerActionRef
  client?: { module: string; name: string }
}

export interface RequestScannerOptions {
  /** Whether a file (absolute, forward slashes) is scanned. Calls into other files aren't followed. */
  scanned?: (file: string) => boolean
  /** Modules whose calls are requests (config `apiClients`). */
  apiClients?: readonly ApiClientConfig[]
  /** The project file a module specifier points to, for `apiClients` given as project paths. */
  resolveModule?: (specifier: string) => string | undefined
}

/** Where a call's callee comes from, when it is one of the configured API clients. */
interface ClientRef {
  client: ApiClientConfig
  /** The imported name (`default` for a default import, `*` for a namespace import). */
  imported: string
  /** Set when the callee is an instance created by the client (`const api = ky.create(...)`). */
  instance?: CallExpression
}

/** Option keys that mark an argument as an options object rather than the request body. */
const CLIENT_OPTION_KEYS = ['json', 'body', 'data', 'headers', 'method', 'searchParams', 'query', 'params']
const BODY_METHODS = new Set<HttpMethod>(['POST', 'PUT', 'PATCH'])

export class RequestScanner {
  readonly #root: string
  readonly #types: TypeResolver
  readonly #sites = new Map<string, RequestSite>()
  readonly #navs = new Map<string, Navigation>()
  readonly #reaches = new Map<Node, boolean>()
  readonly #actionsExplored = new Set<Node>()
  readonly #fileDirectives = new Map<SourceFile, string[]>()
  readonly #scanned: (file: string) => boolean
  readonly #clients: readonly ApiClientConfig[]
  readonly #resolveModule: (specifier: string) => string | undefined
  readonly #clientFiles = new Map<string, string | undefined>()
  readonly #links = new Map<string, LinkFound>()
  /** Hook call (or `useQueries` entry) -> ids of the sites it runs. */
  readonly #hookSites = new Map<Node, string[]>()
  /** Site id -> what its hook does, for React Query sites. */
  readonly #siteKinds = new Map<string, { kind: HookDef['kind']; client: boolean }>()
  /** Nesting of `#evaluate`, so values that refer to each other end. */
  #evalDepth = 0

  constructor(root: string, types: TypeResolver, options: RequestScannerOptions = {}) {
    this.#root = root
    this.#types = types
    this.#scanned = options.scanned ?? (() => true)
    this.#clients = options.apiClients ?? []
    this.#resolveModule = options.resolveModule ?? (() => undefined)
  }

  /** Requests sent while a component renders or handles events. */
  addComponent(component: Component, body: Node) {
    const origin: Origin = {
      kind: 'component',
      key: component.id,
      client: component.kind !== 'server',
      componentId: component.id,
    }
    this.#walk(body, body, EMPTY_ENV, { origin, frames: [], active: new Set([body]) })
  }

  /** Requests a route handler sends to other services (the second hop of a BFF). */
  addRouteHandler(route: Route, file: SourceFile) {
    const exported = file.getExportedDeclarations()
    for (const method of route.methods ?? []) {
      const fn = functionOf(exported.get(method)?.[0])
      if (!fn) continue
      const origin: Origin = {
        kind: 'route-handler',
        key: `${route.file}#${method}`,
        client: false,
        routeId: route.id,
        handlerMethod: method,
      }
      this.#walk(fn, fn, EMPTY_ENV, { origin, frames: [], active: new Set([fn]) })
    }
  }

  /** Every site, sorted by where it starts, with route handler and server action chains linked. */
  sites(routes: Route[]): RequestSite[] {
    const sites = [...this.#sites.values()]
    const handlers = routes
      .filter((r) => r.kind === 'route-handler')
      .map((r) => ({ route: r, re: routeRegex(r.path) }))
    for (const site of sites) {
      if (site.transport === 'server-action' && site.serverAction) {
        const key = actionKey(site.serverAction)
        const chain = sites.filter(
          (s) => s.origin === 'server-action' && s.serverAction && actionKey(s.serverAction) === key,
        )
        if (chain.length > 0) site.chain = chain.map((s) => s.id)
        continue
      }
      const path = site.url?.path
      if (!path || site.url?.base) continue
      const sample = path.replace(/:[^/]+/g, 'x')
      const target = handlers.find((h) => h.re.test(sample))
      if (!target) continue
      site.targetRouteId = target.route.id
      const chain = sites.filter(
        (s) =>
          s.origin === 'route-handler' &&
          s.routeId === target.route.id &&
          (!site.method || s.handlerMethod === site.method),
      )
      if (chain.length > 0) site.chain = chain.map((s) => s.id)
    }
    return sites.sort(bySite)
  }

  /** Every navigation, sorted by where it is, with the page it goes to when that resolves. */
  navigations(routes: Route[]): Navigation[] {
    const pages = routes
      .filter((r) => r.kind === 'page' && !r.slot && !r.intercepting)
      .map((r) => ({ route: r, re: routeRegex(r.path), dynamic: (r.path.match(/\[/g) ?? []).length }))
      // Static segments win: `/products/new` before `/products/[id]`.
      .sort((a, b) => a.dynamic - b.dynamic)
    const navs = [...this.#navs.values()]
    for (const nav of navs) {
      const path = nav.href.path
      if (!path?.startsWith('/') || nav.href.base) continue
      const sample = path.replace(/:[^/]+/g, 'x')
      const direct = () => pages.find((p) => p.re.test(sample))
      // next-intl (and other locale-prefix setups) leave the `[locale]` segment out of hrefs.
      const prefixed = () =>
        pages.find((p) => {
          const first = p.route.segments.find((s) => s.kind !== 'group')
          if (first?.kind !== 'dynamic') return false
          if (nav.api !== 'next-intl' && !/^(locale|lang|lng)$/.test(first.name)) return false
          return p.re.test(`/x${sample === '/' ? '' : sample}`)
        })
      // With next-intl, `/login` is `/[locale]/login`, not the `[locale]` page itself.
      const target = nav.api === 'next-intl' ? (prefixed() ?? direct()) : (direct() ?? prefixed())
      if (target) nav.targetRouteId = target.route.id
    }
    return navs.sort((a, b) => compareLoc(a.loc, b.loc))
  }

  // --- Walking -------------------------------------------------------------------------------

  /** Visits every call in `node`, which is inside the function `scope`. */
  #walk(node: Node, scope: Node, env: Env, w: Walk) {
    node.forEachDescendant((d, traversal) => {
      if (N.isJsxOpeningElement(d) || N.isJsxSelfClosingElement(d)) this.#link(d, scope, env, w)
      if (N.isJsxAttribute(d)) {
        this.#jsxAttribute(d, scope, env, w)
        return
      }
      // An inline `'use server'` function runs on the server when called: its own origin.
      if (isFunctionLike(d) && hasOwnUseServer(d)) {
        traversal.skip()
        return
      }
      if (N.isCallExpression(d) && this.#call(d, scope, env, w)) traversal.skip()
    })
  }

  /** Handles one call. Returns true when its arguments were handled too and should be skipped. */
  #call(call: CallExpression, scope: Node, env: Env, w: Walk): boolean {
    const nav = navigationCall(call)
    if (nav) {
      const href = this.#href(call.getArguments()[0], env)
      this.#emitNav(w, this.#frame(call, scope), { ...nav, href }, call)
      return true
    }
    if (this.#isFetch(call)) {
      this.#emit(w, this.#frame(call, scope), this.#fetchSite(call, env))
      return true
    }
    const axios = this.#axiosSite(call, env)
    if (axios) {
      this.#emit(w, this.#frame(call, scope), axios)
      return true
    }
    const client = this.#clientSite(call, env)
    if (client) {
      this.#emit(w, this.#frame(call, scope), client)
      return true
    }
    const hook = hookOf(call)
    if (hook) {
      this.#hook(call, hook, scope, env, w)
      return true
    }
    const method = queryClientMethod(call)
    if (method) {
      const op = QUERY_CACHE_OPS[method.name]
      if (op) this.#emitLink(w, this.#frame(call, scope), op, method.name, call, env)
      else this.#hook(call, RQ(method.name, 'query', method.module, { client: true }), scope, env, w)
      return true
    }
    if (isActionStateHook(call)) {
      const fn = this.#functionValue(call.getArguments()[0], env)
      if (fn && this.#isServerAction(fn) && w.origin.client) {
        const trigger = this.#formActionTrigger(call, scope)
        this.#emit(w, { ...this.#frame(call, scope), trigger }, this.#actionSite(fn, true))
        return true
      }
      return false
    }

    const fn = calleeFunction(call)
    if (!fn || !isProject(fn) || w.active.has(fn) || !this.#isScanned(fn)) return false
    if (this.#isServerAction(fn) && w.origin.client) {
      this.#emit(w, this.#frame(call, scope), this.#actionSite(fn, false))
      return false
    }
    // Functions declared inside the scope are part of this walk already.
    if (isInside(fn, scope) || w.frames.length >= MAX_DEPTH || !this.#reachesNetwork(fn)) return false
    this.#enter(fn, bind(fn, call.getArguments(), env), this.#frame(call, scope), w)
    return false
  }

  /**
   * `onClick={handler}` with a function declared elsewhere, and `<form action={serverAction}>`.
   * A form action posts from the browser even when a server component renders the form.
   */
  #jsxAttribute(attr: JsxAttribute, scope: Node, env: Env, w: Walk) {
    const trigger = attributeTrigger(attr, this.#loc(attr))
    const init = attr.getInitializer()
    const expr = init && N.isJsxExpression(init) ? init.getExpression() : undefined
    if (!trigger || !expr) return
    const formAction = trigger.event === 'action' || trigger.event === 'formAction'
    const inline = isFunctionLike(expr)
    if (!inline && !N.isIdentifier(expr) && !N.isPropertyAccessExpression(expr)) return
    const fn = inline ? expr : this.#functionValue(expr, env)
    if (!fn || !isProject(fn) || w.active.has(fn)) return
    const frame: Frame = {
      node: attr,
      callee: inline ? 'inline server action' : expr.getText(),
      scope,
      trigger,
    }
    if (this.#isServerAction(fn) && (w.origin.client || formAction)) {
      this.#emit(w, frame, this.#actionSite(fn, false))
    } else if (!inline && !isInside(fn, scope) && w.frames.length < MAX_DEPTH && this.#reachesNetwork(fn)) {
      this.#enter(fn, EMPTY_ENV, frame, w)
    }
  }

  /** `<Link href={...}>`: a navigation the user starts by clicking. */
  #link(element: JsxOpeningElement | JsxSelfClosingElement, scope: Node, env: Env, w: Walk) {
    const api = linkApi(element.getTagNameNode())
    if (!api) return
    const attr = element.getAttribute('href')
    if (!attr || !N.isJsxAttribute(attr)) return
    const init = attr.getInitializer()
    const expr = init && N.isJsxExpression(init) ? init.getExpression() : init
    const loc = this.#loc(element)
    const frame: Frame = {
      node: element,
      callee: `<${element.getTagNameNode().getText()}>`,
      scope,
      trigger: { kind: 'event', event: 'onClick', loc },
    }
    const node = N.isJsxOpeningElement(element) ? (element.getParent() ?? element) : element
    this.#emitNav(
      w,
      frame,
      { kind: 'link', api, href: this.#href(expr, env) },
      node,
      isConditional(node, scope),
    )
  }

  /** A navigation target: a string, or next-intl's `{ href }` / `{ pathname }` objects. */
  #href(arg: Node | undefined, env: Env): RequestUrl {
    if (!arg) return { text: '', confidence: 'unknown' }
    const text = oneLine(arg.getText())
    const r = this.#resolve(arg, env)
    const node = r.node ? skipWrappers(r.node) : undefined
    if (node && N.isObjectLiteralExpression(node)) {
      for (const key of ['href', 'pathname']) {
        const prop = this.#prop(node, r.env, key)
        if (prop === 'absent' || prop === 'unknown' || !prop.node) continue
        const url = toUrl(this.#str(prop.node, prop.env), text)
        // `pathname: '/users/[id]'` with `params`: the same placeholders as other patterns.
        if (url.path) url.path = url.path.replace(/\[\[?(?:\.\.\.)?([^\]]+)\]\]?/g, ':$1')
        return url
      }
      return { text, confidence: 'unknown' }
    }
    return toUrl(this.#str(arg, env), text)
  }

  #enter(fn: Node, env: Env, frame: Frame, w: Walk) {
    w.frames.push(frame)
    w.active.add(fn)
    this.#walk(fn, fn, env, w)
    w.active.delete(fn)
    w.frames.pop()
  }

  /** React Query / SWR / `queryClient.prefetchQuery()`: walk the query or mutation function. */
  #hook(call: CallExpression, def: HookDef, scope: Node, env: Env, w: Walk) {
    const args = call.getArguments()
    if (def.multi) {
      // One query per entry: each is anchored at its entry, so they get their own site ids.
      for (const entry of this.#queriesList(args[0], env)) {
        if (entry.node) this.#runHook(call, entry.node, def, this.#rqArgs([entry], def), scope, w)
      }
      return
    }
    const hookArgs: HookArgs =
      def.fnArg !== undefined
        ? { fn: { node: args[def.fnArg], env }, key: { node: args[def.keyArg ?? 0], env } }
        : this.#rqArgs(
            args.map((node) => ({ node, env })),
            def,
          )
    this.#runHook(call, call, def, hookArgs, scope, w)
  }

  #runHook(call: CallExpression, anchor: Node, def: HookDef, args: HookArgs, scope: Node, w: Walk) {
    const fn = args.fn ? this.#functionValue(args.fn.node, args.fn.env) : undefined
    if (!fn || w.active.has(fn) || w.frames.length >= MAX_DEPTH) return

    const keyNode = args.key?.node
    const parts = def.rq && args.key ? this.#queryKey(args.key.node, args.key.env) : undefined
    const typeArg = call.getTypeArguments()[0]
    const frame: Frame = {
      node: anchor,
      callee: anchor === call ? oneLine(call.getExpression().getText()) : def.name,
      scope,
      hook: {
        def,
        ...(keyNode ? { key: oneLine(keyNode.getText()) } : {}),
        ...(typeArg && !def.multi ? { typeArg } : {}),
        ...(parts ? { parts } : {}),
      },
      ...(def.kind === 'mutation' ? { trigger: this.#mutationTrigger(call, scope) } : {}),
    }
    // SWR passes the key to the fetcher. An inline function written in a factory
    // (`(id) => queryOptions({ queryFn: () => getItem(id) })`) sees the factory's arguments.
    const fnEnv =
      def.fnArg !== undefined && keyNode && isFunctionLike(fn)
        ? bindParams(fn, [{ expr: keyNode, env: args.key?.env ?? EMPTY_ENV }])
        : (args.fn?.env ?? EMPTY_ENV)
    this.#enter(fn, fnEnv, frame, w)

    // What runs after the mutation: navigation, cache updates (and requests) in its callbacks.
    const options = args.options
    if (def.kind === 'mutation' && options) {
      const { hook: _, ...plain } = frame
      for (const name of ['onSuccess', 'onError', 'onSettled']) {
        const prop = this.#propOf(options, name)
        const callback = prop ? this.#functionValue(prop.node, prop.env) : undefined
        if (!callback || w.active.has(callback)) continue
        const outcome = name === 'onSuccess' ? 'success' : name === 'onError' ? 'error' : undefined
        this.#enter(
          callback,
          prop?.env ?? EMPTY_ENV,
          { ...plain, ...(outcome ? { outcome } : {}), after: anchor },
          w,
        )
      }
    }
  }

  /**
   * React Query's arguments: an options object (`useQuery({ queryKey, queryFn })`, through
   * `queryOptions()` and factories that return options), or v4's positional forms
   * `useQuery(key, fn, options?)`, `useQuery(key, options)`, `useMutation(fn, options?)` and
   * `useMutation(key, fn?, options?)`.
   */
  #rqArgs(values: Resolved[], def: HookDef): HookArgs {
    const [first, second, third] = values
    if (!first) return {}
    const options = this.#evaluate(first.node, first.env)
    if (options.node && N.isObjectLiteralExpression(skipWrappers(options.node))) {
      return this.#fromOptions(options, def)
    }
    const isFn = (v: Resolved | undefined) => !!v && !!this.#functionValue(v.node, v.env)
    if (def.kind === 'mutation' && isFn(first)) {
      const rest = second ? this.#fromOptions(this.#evaluate(second.node, second.env), def) : {}
      return { ...rest, fn: first }
    }
    // The key comes first.
    if (isFn(second)) {
      const rest = third ? this.#fromOptions(this.#evaluate(third.node, third.env), def) : {}
      return { ...rest, key: first, fn: second as Resolved }
    }
    const rest = second ? this.#fromOptions(this.#evaluate(second.node, second.env), def) : {}
    return { ...rest, key: first }
  }

  #fromOptions(options: Resolved, def: HookDef): HookArgs {
    const fn = this.#propOf(options, def.fnProp ?? '')
    const key = this.#propOf(options, def.keyProp ?? '')
    return { options, ...(fn ? { fn } : {}), ...(key ? { key } : {}) }
  }

  /** `useQueries({ queries: [a, b] })`, `useQueries([a, b])` (v3) or `{ queries: ids.map((id) => ...) }`. */
  #queriesList(arg: Node | undefined, env: Env): Resolved[] {
    let list = this.#evaluate(arg, env)
    if (list.node && N.isObjectLiteralExpression(skipWrappers(list.node))) {
      const queries = this.#propOf(list, 'queries')
      if (!queries) return []
      list = this.#evaluate(queries.node, queries.env)
    }
    const node = list.node ? skipWrappers(list.node) : undefined
    if (!node) return []
    if (N.isArrayLiteralExpression(node)) {
      return node
        .getElements()
        .filter((e) => !N.isSpreadElement(e))
        .map((e) => ({ node: e, env: list.env }))
    }
    // `ids.map((id) => todoQuery(id))`: the callback's result stands for every entry.
    if (N.isCallExpression(node) && calleeName(node) === 'map') {
      const callback = this.#functionValue(node.getArguments()[0], list.env)
      const returned = callback && isFunctionLike(callback) ? returnedExpr(callback) : undefined
      if (returned) return [{ node: returned, env: list.env }]
    }
    return []
  }

  /** A property of an object value, or undefined when it is missing or not knowable. */
  #propOf(obj: Resolved, name: string): Resolved | undefined {
    const prop = this.#prop(obj.node, obj.env, name)
    return prop === 'absent' || prop === 'unknown' ? undefined : prop
  }

  // --- Query keys and cache links ------------------------------------------------------------

  /** A query key: an array literal, through constants, key factories and spreads. */
  #queryKey(expr: Node | undefined, env: Env, depth = 0): QueryKeyPart[] | undefined {
    if (!expr || depth > 8) return undefined
    const r = this.#evaluate(expr, env)
    const node = r.node ? skipWrappers(r.node) : undefined
    if (!node || !N.isArrayLiteralExpression(node)) return undefined
    const parts: QueryKeyPart[] = []
    for (const element of node.getElements()) {
      if (N.isSpreadElement(element)) {
        const inner = this.#queryKey(element.getExpression(), r.env, depth + 1)
        parts.push(...(inner ?? [{ kind: 'rest', text: oneLine(element.getExpression().getText()) }]))
      } else {
        parts.push(this.#keyPart(element, r.env, depth))
      }
    }
    return parts
  }

  #keyPart(expr: Node, env: Env, depth: number): QueryKeyPart {
    const r = this.#evaluate(expr, env)
    if (!r.node) return { kind: 'static', value: null }
    const node = skipWrappers(r.node)
    if (N.isStringLiteral(node) || N.isNoSubstitutionTemplateLiteral(node)) {
      return { kind: 'static', value: node.getLiteralValue() }
    }
    if (N.isNumericLiteral(node)) return { kind: 'static', value: node.getLiteralValue() }
    if (
      N.isPrefixUnaryExpression(node) &&
      node.getOperatorToken() === ts.SyntaxKind.MinusToken &&
      N.isNumericLiteral(node.getOperand())
    ) {
      return { kind: 'static', value: -Number(node.getOperand().getText()) }
    }
    if (N.isTrueLiteral(node) || N.isFalseLiteral(node))
      return { kind: 'static', value: N.isTrueLiteral(node) }
    if (N.isNullLiteral(node)) return { kind: 'static', value: null }
    if (N.isTemplateExpression(node)) {
      const str = this.#str(node, r.env)
      if (str?.parts.every((p) => 'text' in p)) {
        return { kind: 'static', value: str.parts.map((p) => ('text' in p ? p.text : '')).join('') }
      }
      const name = str?.parts.map((p) => ('text' in p ? p.text : `:${p.hole}`)).join('')
      return { kind: 'param', name: name?.replace(/^:/, '') || holeName(expr) }
    }
    if (N.isObjectLiteralExpression(node) && depth < 8) {
      const entries: { key: string; value: QueryKeyPart }[] = []
      for (const p of node.getProperties()) {
        if (N.isPropertyAssignment(p)) {
          const init = p.getInitializer()
          if (init)
            entries.push({ key: propertyName(p.getNameNode()), value: this.#keyPart(init, r.env, depth + 1) })
        } else if (N.isShorthandPropertyAssignment(p)) {
          entries.push({ key: p.getName(), value: this.#keyPart(p.getNameNode(), r.env, depth + 1) })
        }
      }
      return { kind: 'object', entries }
    }
    // Only known at runtime: named after the value as written where it is passed in.
    return {
      kind: 'param',
      name: holeName(N.isIdentifier(node) || N.isPropertyAccessExpression(node) ? node : expr),
    }
  }

  /**
   * `queryClient.invalidateQueries({ queryKey, exact })` (v5), `invalidateQueries(key, filters)`
   * (v4), `setQueryData(key, updater)`, ...: a link to the queries the key hits.
   */
  #emitLink(w: Walk, last: Frame, kind: QueryLink['kind'], method: string, call: CallExpression, env: Env) {
    if (w.origin.kind === 'route-handler') return
    const args = call.getArguments()
    let key: QueryKeyPart[] | undefined
    let exact = method === 'setQueryData'
    const unknownKey = (node: Node): QueryKeyPart[] => [{ kind: 'rest', text: oneLine(node.getText()) }]
    const isExact = (filters: Resolved) => {
      const value = this.#propOf(filters, 'exact')?.node
      return !!value && N.isTrueLiteral(skipWrappers(value))
    }
    const first = args[0]
    if (first) {
      const r = this.#evaluate(first, env)
      if (r.node && N.isObjectLiteralExpression(skipWrappers(r.node)) && method !== 'setQueryData') {
        const k = this.#propOf(r, 'queryKey')
        if (k?.node) key = this.#queryKey(k.node, k.env) ?? unknownKey(k.node)
        if (isExact(r)) exact = true
      } else {
        key = this.#queryKey(first, env) ?? unknownKey(first)
        const filters = args[1]
        if (filters && method !== 'setQueryData' && isExact({ node: filters, env })) exact = true
      }
    }

    const frames = [...w.frames, last]
    const callStack: CallFrame[] = frames.map((f) => ({ ...this.#loc(f.node), callee: f.callee }))
    const id = makeId('qlk', w.origin.key, ...callStack.map((f) => `${f.file}:${f.line}:${f.column}`))
    if (this.#links.has(id)) return
    const outcome = navOutcome(frames)
    this.#links.set(id, {
      link: {
        id,
        kind,
        method,
        origin: w.origin.kind === 'server-action' ? 'server-action' : 'component',
        ...(w.origin.componentId ? { componentId: w.origin.componentId } : {}),
        ...(key ? { key } : {}),
        ...(exact ? { exact } : {}),
        trigger: this.#trigger(frames, w.origin),
        ...(outcome ? { outcome } : {}),
        loc: this.#loc(call),
        callStack,
      },
      after: frames.flatMap((f) => (f.after ? [f.after] : [])),
    })
  }

  /**
   * Every query cache link with the sites it runs after and the query sites it hits, plus
   * `hydrate` links from server prefetches to the client queries a `HydrationBoundary` hands
   * them to.
   */
  queryLinks(sites: RequestSite[], components: Component[]): QueryLink[] {
    const isQuery = (s: RequestSite) => this.#siteKinds.get(s.id)?.kind === 'query' && !!s.queryKey
    // A client-side cache call only reaches queries cached in the browser.
    const browserQueries = sites.filter((s) => isQuery(s) && s.trigger.kind !== 'server-render')
    const links: QueryLink[] = []
    for (const { link, after } of this.#links.values()) {
      const fromSiteIds = [...new Set(after.flatMap((node) => this.#hookSites.get(node) ?? []))]
      const targetSiteIds = browserQueries
        .filter((s) => !link.key || queryKeyHits(link.key, s.queryKey ?? [], link.exact))
        .map((s) => s.id)
      links.push({ ...link, fromSiteIds, targetSiteIds })
    }

    const byId = new Map(components.map((c) => [c.id, c]))
    for (const site of sites) {
      const kind = this.#siteKinds.get(site.id)
      if (!kind?.client || kind.kind !== 'query' || site.trigger.kind !== 'server-render') continue
      if (!site.queryKey || !site.componentId) continue
      const below = subtree(site.componentId, byId)
      const hydrates = [...below].some((id) =>
        byId.get(id)?.children.some((c) => c.resolution === 'external' && HYDRATION_COMPONENTS.has(c.name)),
      )
      if (!hydrates) continue
      const key = site.queryKey
      const targets = browserQueries.filter(
        (s) =>
          s.componentId &&
          s.componentId !== site.componentId &&
          below.has(s.componentId) &&
          (queryKeyHits(key, s.queryKey ?? [], true) || queryKeyHits(s.queryKey ?? [], key, true)),
      )
      if (targets.length === 0) continue
      const frame = site.callStack[0] as CallFrame
      links.push({
        id: makeId('qlk', 'hydrate', site.id),
        kind: 'hydrate',
        method: site.hook?.name ?? 'prefetchQuery',
        origin: 'component',
        componentId: site.componentId,
        key,
        exact: true,
        fromSiteIds: [site.id],
        targetSiteIds: targets.map((s) => s.id),
        trigger: site.trigger,
        loc: { file: frame.file, line: frame.line, column: frame.column },
        callStack: site.callStack,
      })
    }
    return links.sort((a, b) => compareLoc(a.loc, b.loc) || compare(a.id, b.id))
  }

  /**
   * Follows a value to where it is written: parameters, constants, object properties
   * (`todoKeys.all`), project functions to what they return (`todoKeys.detail(id)`,
   * `todoQuery(id)`) and `queryOptions({...})` to its argument.
   */
  #evaluate(expr: Node | undefined, env: Env): Resolved {
    if (this.#evalDepth > 30) return { node: expr, env }
    this.#evalDepth++
    try {
      let r = this.#resolve(expr, env)
      for (let i = 0; i < 10 && r.node; i++) {
        const node: Node = r.node
        if (N.isPropertyAccessExpression(node)) {
          const prop = this.#prop(node.getExpression(), r.env, node.getName())
          if (prop === 'absent' || prop === 'unknown' || !prop.node) break
          r = this.#resolve(prop.node, prop.env)
          continue
        }
        // `keys.all[0]`, `config['key']`
        if (N.isElementAccessExpression(node)) {
          const arg = node.getArgumentExpression()
          const index = arg ? skipWrappers(arg) : undefined
          if (index && N.isNumericLiteral(index)) {
            const array = this.#evaluate(node.getExpression(), r.env)
            const list = array.node ? skipWrappers(array.node) : undefined
            if (!list || !N.isArrayLiteralExpression(list)) break
            const element = list.getElements()[index.getLiteralValue()]
            if (!element || list.getElements().some((e) => N.isSpreadElement(e))) break
            r = this.#resolve(element, array.env)
            continue
          }
          if (index && (N.isStringLiteral(index) || N.isNoSubstitutionTemplateLiteral(index))) {
            const prop = this.#prop(node.getExpression(), r.env, index.getLiteralValue())
            if (prop === 'absent' || prop === 'unknown' || !prop.node) break
            r = this.#resolve(prop.node, prop.env)
            continue
          }
          break
        }
        if (N.isCallExpression(node)) {
          const fn = calleeFunction(node)
          if (fn && isFunctionLike(fn) && isProject(fn) && this.#isScanned(fn)) {
            const returned = returnedExpr(fn)
            if (!returned) break
            r = this.#resolve(returned, bind(fn, node.getArguments(), r.env))
            continue
          }
          if (OPTIONS_HELPER.test(calleeName(node) ?? '') && node.getArguments()[0]) {
            r = this.#resolve(node.getArguments()[0], r.env)
            continue
          }
        }
        break
      }
      return r
    } finally {
      this.#evalDepth--
    }
  }

  // --- Network calls -------------------------------------------------------------------------

  #isFetch(call: CallExpression): boolean {
    const expr = call.getExpression()
    let name: string | undefined
    if (N.isIdentifier(expr)) name = expr.getText()
    else if (
      N.isPropertyAccessExpression(expr) &&
      /^(globalThis|window|self)$/.test(expr.getExpression().getText())
    ) {
      name = expr.getName()
    }
    if (name !== 'fetch') return false
    const symbol = expr.getSymbol()
    const decls = symbol ? unalias(symbol).getDeclarations() : []
    return decls.every((d) => !isProject(d))
  }

  #fetchSite(call: CallExpression, env: Env): Found {
    const [input, init] = call.getArguments()
    const methodProp = this.#prop(init, env, 'method')
    const method = methodProp === 'absent' ? 'GET' : this.#method(methodProp)
    const body = this.#bodyOf(propValue(this.#prop(init, env, 'body')), env)
    return {
      transport: 'fetch',
      ...(method ? { method } : {}),
      url: toUrl(this.#str(input, env), input ? oneLine(input.getText()) : ''),
      ...(body ? { bodyType: body } : {}),
    }
  }

  /** `axios.get(url)`, `api.post(url, data)`, `axios(config)`, `api.request(config)`. */
  #axiosSite(call: CallExpression, env: Env): Found | undefined {
    const expr = call.getExpression()
    const args = call.getArguments()
    let receiver: Node
    let urlArg: Node | undefined
    let dataArg: Node | undefined
    let config: Node | undefined
    let method: HttpMethod | undefined

    if (N.isPropertyAccessExpression(expr) && isAxiosNode(expr.getNameNode())) {
      const spec = AXIOS_METHODS[expr.getName()]
      if (!spec) return undefined
      receiver = expr.getExpression()
      if (spec.config) {
        config = args[0]
      } else {
        urlArg = args[0]
        if (spec.data) dataArg = args[1]
        config = args[spec.data ? 2 : 1]
      }
      method = spec.method
    } else if (isAxiosCallable(expr)) {
      receiver = expr
      const first = this.#resolve(args[0], env).node
      if (first && N.isObjectLiteralExpression(first)) config = args[0]
      else {
        urlArg = args[0]
        config = args[1]
      }
    } else {
      return undefined
    }

    if (!urlArg) urlArg = propValue(this.#prop(config, env, 'url'))
    if (!dataArg) dataArg = propValue(this.#prop(config, env, 'data'))
    if (!method) {
      const prop = this.#prop(config, env, 'method')
      method = prop === 'absent' ? 'GET' : this.#method(prop)
    }

    // baseURL from `axios.create({ baseURL })` or the call's own config.
    let base = this.#str(propValue(this.#prop(config, env, 'baseURL')), env)
    if (!base) {
      const instance = this.#resolve(receiver, env)
      if (instance.node && N.isCallExpression(instance.node) && calleeName(instance.node) === 'create') {
        base = this.#str(
          propValue(this.#prop(instance.node.getArguments()[0], instance.env, 'baseURL')),
          instance.env,
        )
      }
    }
    const path = this.#str(urlArg, env)
    const body = this.#bodyOf(dataArg, env)
    return {
      transport: 'axios',
      ...(method ? { method } : {}),
      url: toUrl(base && path ? joinUrl(base, path) : path, urlArg ? oneLine(urlArg.getText()) : ''),
      ...(body ? { bodyType: body } : {}),
    }
  }

  /**
   * A call to a configured API client (config `apiClients`): `get(url)`, `api.post(url, body)`,
   * `ky.post(url, { json })`, `ofetch(url, { method })`, or a method of an instance it created.
   */
  #clientSite(call: CallExpression, env: Env): Found | undefined {
    if (this.#clients.length === 0) return undefined
    const expr = call.getExpression()
    let ref: ClientRef | undefined
    let name: string
    if (N.isIdentifier(expr)) {
      ref = this.#clientOf(expr)
      if (!ref) return undefined
      // Calling an import or an instance directly: `get(url)`, `ofetch(url)`, `api(url)`.
      name = ref.instance || ref.imported === '*' ? 'default' : ref.imported
    } else if (N.isPropertyAccessExpression(expr) && N.isIdentifier(expr.getExpression())) {
      ref = this.#clientOf(expr.getExpression())
      if (!ref) return undefined
      name = expr.getName()
    } else {
      return undefined
    }
    if (!ref.client.methods.includes(name)) return undefined

    const args = call.getArguments()
    let urlArg = args[0]
    let options = args[1]
    const first = this.#resolve(args[0], env).node
    if (first && N.isObjectLiteralExpression(first)) {
      options = args[0]
      urlArg = propValue(this.#prop(options, env, 'url'))
    }
    const isOptions = (arg: Node | undefined) =>
      !!arg && CLIENT_OPTION_KEYS.some((key) => this.#prop(arg, env, key) !== 'absent')

    // The method from the name (`post`), else from the options, else GET.
    const verb = HTTP_METHODS.find((m) => m === name.toUpperCase())
    let method = verb
    if (!method) {
      const prop = this.#prop(isOptions(options) ? options : undefined, env, 'method')
      method = prop === 'absent' ? 'GET' : this.#method(prop)
    }

    // The body: `{ json | body | data }` in the options, or the second argument itself for
    // POST/PUT/PATCH helpers like `api.post(url, data)`.
    let bodyNode: Node | undefined
    if (isOptions(options)) {
      for (const key of ['json', 'body', 'data']) {
        bodyNode = propValue(this.#prop(options, env, key))
        if (bodyNode) break
      }
    } else if (verb && BODY_METHODS.has(verb)) {
      bodyNode = options
    }

    // A base URL from the instance's options: `ky.create({ prefixUrl })`, `{ baseURL }`.
    let base: Str | undefined
    if (ref.instance) {
      const config = ref.instance.getArguments()[0]
      for (const key of ['prefixUrl', 'baseURL', 'baseUrl']) {
        base = this.#str(propValue(this.#prop(config, EMPTY_ENV, key)), EMPTY_ENV)
        if (base) break
      }
    }
    const path = this.#str(urlArg, env)
    const body = this.#bodyOf(bodyNode, env)
    const typeArg = call.getTypeArguments()[0]
    const responseType =
      typeArg && !typeArg.getType().isTypeParameter() ? this.#types.fromTypeNode(typeArg) : undefined
    return {
      transport: 'api-client',
      client: { module: ref.client.module, name },
      ...(method ? { method } : {}),
      url: toUrl(base && path ? joinUrl(base, path) : path, urlArg ? oneLine(urlArg.getText()) : ''),
      ...(body ? { bodyType: body } : {}),
      ...(responseType ? { responseType } : {}),
    }
  }

  /** The configured client an identifier comes from: imported from it, or created by it. */
  #clientOf(identifier: Node, depth = 0): ClientRef | undefined {
    const symbol = identifier.getSymbol()
    if (!symbol) return undefined
    // The import itself, then what it points to (an instance created in another file).
    const target = unalias(symbol)
    const decls = [...symbol.getDeclarations(), ...(target !== symbol ? target.getDeclarations() : [])]
    for (const decl of decls) {
      const importDecl = decl.getFirstAncestorByKind(ts.SyntaxKind.ImportDeclaration)
      if (importDecl) {
        const client = this.#clients.find((c) => this.#importMatches(importDecl, c, symbol))
        if (!client) continue
        const imported = N.isImportSpecifier(decl)
          ? decl.getName()
          : N.isImportClause(decl)
            ? 'default'
            : N.isNamespaceImport(decl)
              ? '*'
              : identifier.getText()
        return { client, imported }
      }
      // `const api = ky.create({ ... })` or `const api = createClient()`.
      if (depth === 0 && N.isVariableDeclaration(decl)) {
        const init = skipParens(decl.getInitializer())
        if (!init || !N.isCallExpression(init)) continue
        let callee: Node = init.getExpression()
        while (N.isPropertyAccessExpression(callee)) callee = callee.getExpression()
        const ref = N.isIdentifier(callee) ? this.#clientOf(callee, depth + 1) : undefined
        if (ref) return { ...ref, instance: init }
      }
    }
    return undefined
  }

  /** The import names the client's module as written, or resolves to the same project file. */
  #importMatches(importDecl: Node, client: ApiClientConfig, symbol: TsSymbol): boolean {
    if (!N.isImportDeclaration(importDecl)) return false
    if (importDecl.getModuleSpecifierValue() === client.module) return true
    if (!this.#clientFiles.has(client.module)) {
      this.#clientFiles.set(client.module, this.#resolveModule(client.module))
    }
    const target = this.#clientFiles.get(client.module)
    if (!target) return false
    if (importDecl.getModuleSpecifierSourceFile()?.getFilePath() === target) return true
    // Imported through a barrel that re-exports it.
    return unalias(symbol)
      .getDeclarations()
      .some((d) => d.getSourceFile().getFilePath() === target)
  }

  #isScanned(node: Node): boolean {
    return this.#scanned(node.getSourceFile().getFilePath())
  }

  /** A call to a server action. With `useActionState`, the first parameter is the previous state. */
  #actionSite(fn: Node, formState: boolean): Found {
    this.#exploreAction(fn)
    const params = isFunctionLike(fn) ? fn.getParameters() : []
    const param = params[formState ? 1 : 0]
    const body = param ? this.#declaredType(param) : undefined
    const response = isFunctionLike(fn) ? this.#returnType(fn) : undefined
    return {
      transport: 'server-action',
      method: 'POST',
      serverAction: this.#actionRef(fn),
      ...(body ? { bodyType: body } : {}),
      ...(response ? { responseType: response } : {}),
    }
  }

  /** Walks a server action as its own origin: the requests it sends on the server. */
  #exploreAction(fn: Node) {
    if (this.#actionsExplored.has(fn)) return
    this.#actionsExplored.add(fn)
    const ref = this.#actionRef(fn)
    const origin: Origin = {
      kind: 'server-action',
      key: `action:${actionKey(ref)}`,
      client: false,
      serverAction: ref,
    }
    this.#walk(fn, fn, EMPTY_ENV, { origin, frames: [], active: new Set([fn]) })
  }

  #actionRef(fn: Node): ServerActionRef {
    return { name: functionName(fn), loc: this.#loc(functionAnchor(fn)) }
  }

  /** A top-level function in a `'use server'` file, or a function with its own `'use server'`. */
  #isServerAction(fn: Node): boolean {
    if (!isFunctionLike(fn)) return false
    if (hasOwnUseServer(fn)) return true
    if (fn.getFirstAncestor((a) => isFunctionLike(a))) return false
    const file = fn.getSourceFile()
    let fileDirectives = this.#fileDirectives.get(file)
    if (!fileDirectives) {
      fileDirectives = directives(file)
      this.#fileDirectives.set(file, fileDirectives)
    }
    return fileDirectives.includes('use server')
  }

  /** True when the function (or anything it calls in the project) sends a request or navigates. */
  #reachesNetwork(fn: Node): boolean {
    const known = this.#reaches.get(fn)
    if (known !== undefined) return known
    this.#reaches.set(fn, false)
    let found = false
    fn.forEachDescendant((d, traversal) => {
      if (found) {
        traversal.stop()
        return
      }
      if (!N.isCallExpression(d)) return
      if (
        this.#isFetch(d) ||
        this.#axiosSite(d, EMPTY_ENV) ||
        this.#clientSite(d, EMPTY_ENV) ||
        hookOf(d) ||
        queryClientMethod(d) ||
        isActionStateHook(d) ||
        navigationCall(d)
      ) {
        found = true
        return
      }
      const callee = calleeFunction(d)
      if (callee && isProject(callee) && callee !== fn && this.#isScanned(callee)) {
        found = this.#isServerAction(callee) || this.#reachesNetwork(callee)
      }
    })
    this.#reaches.set(fn, found)
    return found
  }

  // --- Emitting ------------------------------------------------------------------------------

  #frame(node: Node, scope: Node): Frame {
    const callee = N.isCallExpression(node) ? node.getExpression().getText() : node.getText()
    return { node, callee: oneLine(callee), scope }
  }

  #emit(w: Walk, last: Frame, found: Found) {
    const frames = [...w.frames, last]
    const callStack: CallFrame[] = frames.map((f) => ({ ...this.#loc(f.node), callee: f.callee }))
    const id = makeId('req', w.origin.key, ...callStack.map((f) => `${f.file}:${f.line}:${f.column}`))
    for (const f of frames) {
      if (!f.hook) continue
      const ids = this.#hookSites.get(f.node) ?? []
      if (!ids.includes(id)) ids.push(id)
      this.#hookSites.set(f.node, ids)
    }
    if (this.#sites.has(id)) return

    const trigger = this.#trigger(frames, w.origin)
    const hookFrame = frames.findLast((f) => f.hook)
    const responseType = found.responseType ?? this.#response(frames)
    const site: RequestSite = {
      id,
      origin: w.origin.kind,
      ...(w.origin.componentId ? { componentId: w.origin.componentId } : {}),
      ...(w.origin.routeId ? { routeId: w.origin.routeId } : {}),
      ...(w.origin.handlerMethod ? { handlerMethod: w.origin.handlerMethod } : {}),
      ...(found.serverAction
        ? { serverAction: found.serverAction }
        : w.origin.serverAction
          ? { serverAction: w.origin.serverAction }
          : {}),
      transport: found.transport,
      ...(found.client ? { client: found.client } : {}),
      ...(hookFrame?.hook
        ? {
            hook: {
              name: hookFrame.hook.def.name,
              module: hookFrame.hook.def.module,
              ...(hookFrame.hook.key ? { key: hookFrame.hook.key } : {}),
            },
          }
        : {}),
      ...(hookFrame?.hook?.parts ? { queryKey: hookFrame.hook.parts } : {}),
      ...(found.method ? { method: found.method } : {}),
      ...(found.url ? { url: found.url } : {}),
      trigger,
      ...(found.bodyType ? { bodyType: found.bodyType } : {}),
      ...(responseType ? { responseType } : {}),
      callStack,
      status: 'inferred',
      flags: [],
    }
    site.flags = flagsOf(site)
    site.hash = siteHash(frames, site, (node) => this.#loc(node).file)
    this.#sites.set(id, site)
    if (hookFrame?.hook?.def.rq) {
      this.#siteKinds.set(id, { kind: hookFrame.hook.def.kind, client: !!hookFrame.hook.def.client })
    }
  }

  #emitNav(w: Walk, last: Frame, found: NavFound, node: Node, conditional = false) {
    // Route handlers answer with NextResponse.redirect(); not a page navigation.
    if (w.origin.kind === 'route-handler') return
    const frames = [...w.frames, last]
    const callStack: CallFrame[] = frames.map((f) => ({ ...this.#loc(f.node), callee: f.callee }))
    const id = makeId('nav', w.origin.key, ...callStack.map((f) => `${f.file}:${f.line}:${f.column}`))
    if (this.#navs.has(id)) return
    const outcome = found.kind === 'link' ? undefined : navOutcome(frames)
    this.#navs.set(id, {
      id,
      origin: w.origin.kind === 'server-action' ? 'server-action' : 'component',
      ...(w.origin.componentId ? { componentId: w.origin.componentId } : {}),
      ...(w.origin.serverAction ? { serverAction: w.origin.serverAction } : {}),
      kind: found.kind,
      api: found.api,
      href: found.href,
      trigger: this.#trigger(frames, w.origin),
      ...(outcome ? { outcome } : {}),
      ...(conditional ? { conditional } : {}),
      loc: this.#loc(node),
      callStack,
    })
  }

  // --- Triggers ------------------------------------------------------------------------------

  /** The innermost frame that knows what starts the request decides; otherwise the origin. */
  #trigger(frames: Frame[], origin: Origin): Trigger {
    for (let i = frames.length - 1; i >= 0; i--) {
      const frame = frames[i] as Frame
      if (frame.trigger) return frame.trigger
      const found = this.#classify(frame.node, frame.scope, 0)
      if (found) return found
    }
    if (origin.kind === 'route-handler') return { kind: 'route-handler' }
    if (origin.kind === 'server-action') return { kind: 'server-action' }
    return { kind: origin.client ? 'page-load' : 'server-render' }
  }

  /** Looks for an enclosing event handler or effect between `node` and `scope`. */
  #classify(node: Node, scope: Node, depth: number): Trigger | undefined {
    let current: Node = node
    while (current !== scope) {
      const parent = current.getParent()
      if (!parent) break
      if (isFunctionLike(current)) {
        const found = this.#classifyFunction(current, scope, depth)
        if (found) return found
      }
      current = parent
    }
    return undefined
  }

  #classifyFunction(fn: Node, scope: Node, depth: number): Trigger | undefined {
    const parent = skipParens(fn.getParent())
    if (parent && N.isCallExpression(parent) && parent.getArguments()[0] === outerParens(fn)) {
      const name = calleeName(parent)
      if (name && EFFECT_HOOKS.has(name)) return { kind: 'effect', loc: this.#loc(parent) }
      if (name && CALLBACK_HOOKS.has(name)) {
        const variable = parent.getParentIfKind(ts.SyntaxKind.VariableDeclaration)
        return variable ? this.#classifyReferences(variable.getNameNode(), scope, depth) : undefined
      }
    }
    if (parent && N.isJsxExpression(parent)) {
      const attr = parent.getParentIfKind(ts.SyntaxKind.JsxAttribute)
      if (attr) return attributeTrigger(attr, this.#loc(attr))
    }
    if (N.isFunctionDeclaration(fn)) {
      const name = fn.getNameNode()
      return name ? this.#classifyReferences(name, scope, depth) : undefined
    }
    if (parent && N.isVariableDeclaration(parent))
      return this.#classifyReferences(parent.getNameNode(), scope, depth)
    return undefined
  }

  /** A named handler: where it is passed to an event prop, or called from another handler. */
  #classifyReferences(name: Node, scope: Node, depth: number): Trigger | undefined {
    if (depth > 4 || !N.isIdentifier(name)) return undefined
    const symbol = name.getSymbol()
    if (!symbol) return undefined
    for (const ref of scope.getDescendantsOfKind(ts.SyntaxKind.Identifier)) {
      if (ref === name || ref.getSymbol() !== symbol) continue
      const parent = ref.getParent()
      const attr =
        parent && N.isJsxExpression(parent) ? parent.getParentIfKind(ts.SyntaxKind.JsxAttribute) : undefined
      const found = attr ? attributeTrigger(attr, this.#loc(attr)) : this.#classify(ref, scope, depth + 1)
      if (found) return found
    }
    return undefined
  }

  /** Where `mutation.mutate(...)` / `const { trigger } = useSWRMutation(...)` is called. */
  #mutationTrigger(hook: CallExpression, scope: Node): Trigger {
    const variable = hook.getParentIfKind(ts.SyntaxKind.VariableDeclaration)
    const name = variable?.getNameNode()
    const calls: Node[] = []
    if (name && N.isIdentifier(name)) {
      const symbol = name.getSymbol()
      for (const access of scope.getDescendantsOfKind(ts.SyntaxKind.PropertyAccessExpression)) {
        if (!MUTATE_MEMBERS.has(access.getName()) || access.getExpression().getSymbol() !== symbol) continue
        const call = access.getParentIfKind(ts.SyntaxKind.CallExpression)
        if (call) calls.push(call)
      }
    } else if (name && N.isObjectBindingPattern(name)) {
      for (const element of name.getElements()) {
        const member = element.getPropertyNameNode()?.getText() ?? element.getName()
        if (!MUTATE_MEMBERS.has(member)) continue
        const symbol = element.getNameNode().getSymbol()
        for (const ref of scope.getDescendantsOfKind(ts.SyntaxKind.Identifier)) {
          if (ref === element.getNameNode() || ref.getSymbol() !== symbol) continue
          const call = ref.getParentIfKind(ts.SyntaxKind.CallExpression)
          if (call && call.getExpression() === ref) calls.push(call)
          else calls.push(ref)
        }
      }
    }
    for (const call of calls) {
      const found = this.#classify(call, scope, 0)
      if (found) return found
    }
    return calls.length > 0 ? { kind: 'page-load', loc: this.#loc(calls[0] as Node) } : { kind: 'unknown' }
  }

  /** `const [state, formAction] = useActionState(...)`: where `formAction` is used. */
  #formActionTrigger(hook: CallExpression, scope: Node): Trigger {
    const pattern = hook.getParentIfKind(ts.SyntaxKind.VariableDeclaration)?.getNameNode()
    const element = pattern && N.isArrayBindingPattern(pattern) ? pattern.getElements()[1] : undefined
    const name = element && N.isBindingElement(element) ? element.getNameNode() : undefined
    if (name && N.isIdentifier(name)) {
      const found = this.#classifyReferences(name, scope, 0)
      if (found) return found
    }
    return { kind: 'event', event: 'action', loc: this.#loc(hook) }
  }

  // --- Types ---------------------------------------------------------------------------------

  /** The response type: how the network call's result is used, then the wrappers' return types. */
  #response(frames: Frame[]): TypeRef | undefined {
    for (let i = frames.length - 1; i >= 0; i--) {
      const frame = frames[i] as Frame
      if (frame.hook) {
        return frame.hook.typeArg && !frame.hook.typeArg.getType().isTypeParameter()
          ? this.#types.fromTypeNode(frame.hook.typeArg)
          : undefined
      }
      if (!N.isCallExpression(frame.node)) return undefined
      const found = this.#responseAt(frame.node)
      if (found) return found
    }
    return undefined
  }

  #responseAt(call: CallExpression): TypeRef | undefined {
    const type = unwrapPromise(call.getType())
    if (isLibType(type, 'Response')) return this.#jsonUsage(call)
    if (isAxiosType(type, 'AxiosResponse')) {
      const data = type.getProperty('data')?.getTypeAtLocation(call)
      return data && isMeaningful(data) ? this.#types.fromType(data, call) : undefined
    }
    return isMeaningful(type) ? this.#types.fromType(type, call) : undefined
  }

  /** A typed use of `res.json()`: `as T`, `const x: T = await res.json()`, `Schema.parse(...)`. */
  #jsonUsage(call: CallExpression): TypeRef | undefined {
    const jsonCalls: Node[] = []
    const holder = climb(call)
    const parent = holder.getParent()
    if (parent && N.isVariableDeclaration(parent)) {
      const name = parent.getNameNode()
      const symbol = name.getSymbol()
      const fn = parent.getFirstAncestor((a) => isFunctionLike(a)) ?? parent.getSourceFile()
      for (const access of fn.getDescendantsOfKind(ts.SyntaxKind.PropertyAccessExpression)) {
        if (access.getName() === 'json' && access.getExpression().getSymbol() === symbol) {
          const jsonCall = access.getParentIfKind(ts.SyntaxKind.CallExpression)
          if (jsonCall) jsonCalls.push(jsonCall)
        }
      }
    } else if (parent && N.isPropertyAccessExpression(parent) && parent.getName() === 'then') {
      const thenCall = parent.getParentIfKind(ts.SyntaxKind.CallExpression)
      // `const x: T = await fetch(url).then((r) => r.json())`
      const whole = thenCall ? this.#typedUse(thenCall) : undefined
      if (whole) return whole
      const callback = thenCall?.getArguments()[0]
      const param = callback && isFunctionLike(callback) ? callback.getParameters()[0] : undefined
      const symbol = param?.getNameNode().getSymbol()
      if (callback && symbol) {
        for (const access of callback.getDescendantsOfKind(ts.SyntaxKind.PropertyAccessExpression)) {
          if (access.getName() === 'json' && access.getExpression().getSymbol() === symbol) {
            const jsonCall = access.getParentIfKind(ts.SyntaxKind.CallExpression)
            if (jsonCall) jsonCalls.push(jsonCall)
          }
        }
      }
    }
    for (const jsonCall of jsonCalls) {
      const found = this.#typedUse(jsonCall)
      if (found) return found
    }
    return undefined
  }

  #typedUse(expr: Node): TypeRef | undefined {
    let current = expr
    for (let parent = current.getParent(); parent; current = parent, parent = parent.getParent()) {
      if (N.isAsExpression(parent)) {
        const node = unwrapPromiseNode(parent.getTypeNodeOrThrow())
        return node.getType().isTypeParameter() || node.getType().isAny()
          ? undefined
          : this.#types.fromTypeNode(node)
      }
      if (N.isAwaitExpression(parent) || N.isParenthesizedExpression(parent)) continue
      if (N.isConditionalExpression(parent) && current !== parent.getCondition()) continue
      if (N.isVariableDeclaration(parent)) {
        const node = parent.getTypeNode()
        return node ? this.#types.fromTypeNode(node) : undefined
      }
      if (N.isCallExpression(parent) && parent.getArguments().includes(current)) {
        const callee = parent.getExpression()
        if (N.isPropertyAccessExpression(callee) && /^(safeParse|parse)(Async)?$/.test(callee.getName())) {
          return this.#types.fromZodSchema(callee.getExpression())
        }
      }
      return undefined
    }
    return undefined
  }

  /** The type of a request body: `JSON.stringify(x)` looks at `x`, following parameters to their arguments. */
  #bodyOf(expr: Node | undefined, env: Env): TypeRef | undefined {
    if (!expr) return undefined
    let node = skipParens(expr) ?? expr
    if (N.isCallExpression(node) && node.getExpression().getText() === 'JSON.stringify') {
      const arg = node.getArguments()[0]
      if (!arg) return undefined
      node = arg
    }
    return this.#valueType(node, env, 0)
  }

  #valueType(expr: Node, env: Env, depth: number): TypeRef | undefined {
    const node = skipParens(expr) ?? expr
    if (depth > MAX_DEPTH) return undefined
    if (N.isAsExpression(node) || N.isSatisfiesExpression(node)) {
      const typeNode = node.getTypeNode()
      if (typeNode) return this.#types.fromTypeNode(typeNode)
    }
    if (N.isIdentifier(node)) {
      const decl = declarationOf(node)
      if (decl && N.isParameterDeclaration(decl)) {
        const typeNode = decl.getTypeNode()
        if (typeNode && !typeNode.getType().isTypeParameter()) return this.#types.fromTypeNode(typeNode)
        const binding = env.get(decl)
        if (binding?.expr) return this.#valueType(binding.expr, binding.env, depth + 1)
        return undefined
      }
      if (decl && N.isVariableDeclaration(decl)) {
        const typeNode = decl.getTypeNode()
        if (typeNode) return this.#types.fromTypeNode(typeNode)
      }
    }
    const type = node.getType()
    return isMeaningful(type) ? this.#types.fromType(type, node) : undefined
  }

  /** A parameter's declared type (or the checker's, when it is not annotated). */
  #declaredType(param: ParameterDeclaration): TypeRef | undefined {
    const typeNode = param.getTypeNode()
    if (typeNode) return this.#types.fromTypeNode(typeNode)
    const type = param.getType()
    return isMeaningful(type) ? this.#types.fromType(type, param) : undefined
  }

  /** A function's resolved return type, without `Promise<>`. */
  #returnType(fn: Node): TypeRef | undefined {
    if (!isFunctionLike(fn)) return undefined
    const typeNode = fn.getReturnTypeNode()
    if (typeNode) return this.#types.fromTypeNode(unwrapPromiseNode(typeNode))
    const type = unwrapPromise(fn.getReturnType())
    return isMeaningful(type) ? this.#types.fromType(type, fn) : undefined
  }

  // --- Values --------------------------------------------------------------------------------

  /** Follows parameters (to their arguments) and constants (to their initializers). */
  #resolve(expr: Node | undefined, env: Env): Resolved {
    let node = expr
    let scope = env
    for (let i = 0; node && i < 20; i++) {
      const inner = skipWrappers(node)
      if (inner !== node) {
        node = inner
        continue
      }
      if (!N.isIdentifier(node)) break
      if (node.getText() === 'undefined') return { node: undefined, env: scope }
      const decl = declarationOf(node)
      if (decl && N.isParameterDeclaration(decl)) {
        const binding = scope.get(decl)
        if (!binding) break
        if (!binding.expr) {
          const initializer = decl.getInitializer()
          if (!initializer) return { node: undefined, env: scope }
          node = initializer
          continue
        }
        node = binding.expr
        scope = binding.env
        continue
      }
      if (decl && N.isVariableDeclaration(decl) && isConst(decl) && N.isIdentifier(decl.getNameNode())) {
        const initializer = decl.getInitializer()
        if (!initializer) break
        node = initializer
        continue
      }
      break
    }
    return { node, env: scope }
  }

  /** A property of an object value, through spreads (`{ ...init, method }`) and parameters. */
  #prop(obj: Node | undefined, env: Env, name: string, depth = 0): Prop {
    if (!obj) return 'absent'
    if (depth > MAX_DEPTH) return 'unknown'
    const r = this.#evaluate(obj, env)
    if (!r.node) return 'absent'
    if (!N.isObjectLiteralExpression(r.node)) return 'unknown'
    const properties = r.node.getProperties()
    for (let i = properties.length - 1; i >= 0; i--) {
      const p = properties[i] as Node
      if (N.isPropertyAssignment(p) && propertyName(p.getNameNode()) === name) {
        const initializer = p.getInitializer()
        return initializer ? { node: initializer, env: r.env } : 'unknown'
      }
      if (N.isShorthandPropertyAssignment(p) && p.getName() === name)
        return { node: p.getNameNode(), env: r.env }
      if (N.isSpreadAssignment(p)) {
        const inner = this.#prop(p.getExpression(), r.env, name, depth + 1)
        if (inner !== 'absent') return inner
      }
    }
    return 'absent'
  }

  #method(prop: Prop): HttpMethod | undefined {
    if (prop === 'absent' || prop === 'unknown') return undefined
    const value = this.#str(prop.node, prop.env)
    const part = value?.parts.length === 1 ? value.parts[0] : undefined
    const text = part && 'text' in part ? part.text.toUpperCase() : undefined
    return HTTP_METHODS.find((m) => m === text)
  }

  /** The function a value refers to: an inline arrow, a local or imported function. */
  #functionValue(expr: Node | undefined, env: Env): Node | undefined {
    const r = this.#resolve(expr, env)
    const node = r.node
    if (!node) return undefined
    if (isFunctionLike(node)) return node
    if (N.isIdentifier(node) || N.isPropertyAccessExpression(node)) {
      const symbol = node.getSymbol()
      return symbol ? functionOf(unalias(symbol).getDeclarations()[0]) : undefined
    }
    return undefined
  }

  /** Evaluates a string expression into text and `:param` holes. */
  #str(expr: Node | undefined, env: Env, depth = 0): Str | undefined {
    if (!expr || depth > 30) return undefined
    const node = skipWrappers(expr)
    const next = (n: Node | undefined, e: Env = env) => this.#str(n, e, depth + 1)
    const orHole = (n: Node, e: Env = env): Str => next(n, e) ?? { parts: [{ hole: holeName(n) }] }

    if (N.isStringLiteral(node) || N.isNoSubstitutionTemplateLiteral(node)) {
      return { parts: [{ text: node.getLiteralValue() }] }
    }
    if (N.isNumericLiteral(node)) return { parts: [{ text: String(node.getLiteralValue()) }] }
    if (N.isTemplateExpression(node)) {
      let out: Str = { parts: [{ text: node.getHead().getLiteralText() }] }
      for (const span of node.getTemplateSpans()) {
        out = concat(out, orHole(span.getExpression()))
        out = concat(out, { parts: [{ text: span.getLiteral().getLiteralText() }] })
      }
      return out
    }
    if (N.isBinaryExpression(node)) {
      const op = node.getOperatorToken().getKind()
      if (op === ts.SyntaxKind.PlusToken) return concat(orHole(node.getLeft()), orHole(node.getRight()))
      if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken) {
        const envName = envVarOf(node.getLeft())
        if (envName) {
          const fallback = next(node.getRight())
          return fallback ? { ...fallback, env: envName } : { parts: [{ hole: envName }], env: envName }
        }
        return next(node.getLeft()) ?? next(node.getRight())
      }
      return undefined
    }
    const envName = envVarOf(node)
    if (envName) return { parts: [{ hole: envName }], env: envName }
    if (N.isIdentifier(node)) {
      const r = this.#resolve(node, env)
      if (!r.node || r.node === node) return undefined
      return next(r.node, r.env)
    }
    if (N.isPropertyAccessExpression(node)) {
      const prop = this.#prop(node.getExpression(), env, node.getName())
      return prop === 'absent' || prop === 'unknown' ? undefined : next(prop.node, prop.env)
    }
    if (N.isCallExpression(node)) {
      const callee = node.getExpression()
      // `String(x)`, `encodeURIComponent(x)`, `x.toString()`: the value of x.
      if (/^(String|encodeURIComponent|encodeURI)$/.test(callee.getText())) {
        const arg = node.getArguments()[0]
        return arg ? next(arg) : undefined
      }
      if (N.isPropertyAccessExpression(callee) && callee.getName() === 'toString')
        return next(callee.getExpression())
    }
    return undefined
  }

  #loc(node: Node): SourceLoc {
    const file = node.getSourceFile()
    const { line, column } = file.getLineAndColumnAtPos(node.getStart())
    return { file: relativeTo(this.#root, file.getFilePath()), line, column }
  }
}

// --- URL helpers -----------------------------------------------------------------------------

function concat(a: Str, b: Str): Str {
  const parts: Part[] = []
  for (const part of [...a.parts, ...b.parts]) {
    if ('text' in part && part.text === '') continue
    const last = parts.at(-1)
    if (last && 'text' in last && 'text' in part) parts[parts.length - 1] = { text: last.text + part.text }
    else parts.push(part)
  }
  // The env base only counts when it starts the value (`${API_URL}/x`, not `/x/${API_URL}`).
  const aEmpty = a.parts.every((p) => 'text' in p && p.text === '')
  const env = aEmpty ? b.env : a.env
  return env ? { parts, env } : { parts }
}

function joinUrl(base: Str, path: Str): Str {
  const first = path.parts[0]
  if (first && 'text' in first && /^[a-z]+:\/\//i.test(first.text)) return path
  const last = base.parts.at(-1)
  const baseSlash = !!last && 'text' in last && last.text.endsWith('/')
  const pathSlash = !!first && 'text' in first && first.text.startsWith('/')
  if (baseSlash && pathSlash)
    return concat(base, {
      parts: [{ text: (first as { text: string }).text.slice(1) }, ...path.parts.slice(1)],
    })
  if (!baseSlash && !pathSlash) return concat(concat(base, { parts: [{ text: '/' }] }), path)
  return concat(base, path)
}

const HOLE = '\u0000'

/** Splits an evaluated URL into base, path pattern and query. */
function toUrl(value: Str | undefined, text: string): RequestUrl {
  if (!value || value.parts.length === 0) return { text, confidence: 'unknown' }
  let flat = ''
  for (const part of value.parts) flat += 'text' in part ? part.text : `${HOLE}${part.hole}${HOLE}`

  let base: string | undefined
  let rest = flat
  const origin = /^([a-z][a-z0-9+.-]*:)?\/\/[^/?#]*/i.exec(flat)
  if (origin) {
    base = origin[0]
    rest = flat.slice(base.length)
  } else if (flat.startsWith(HOLE)) {
    // Starts with an unknown value, e.g. `${baseUrl}/users`: treat it as the base.
    const end = flat.indexOf(HOLE, 1)
    base = flat.slice(0, end + 1)
    rest = flat.slice(end + 1)
  }
  const holes = (s: string) => s.replace(new RegExp(`${HOLE}([^${HOLE}]*)${HOLE}`, 'g'), ':$1')
  const baseText =
    base === undefined ? undefined : base.replace(new RegExp(`${HOLE}([^${HOLE}]*)${HOLE}`, 'g'), '{$1}')

  const [beforeHash = ''] = rest.split('#')
  const queryAt = beforeHash.indexOf('?')
  const rawPath = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash
  const rawQuery = queryAt >= 0 ? beforeHash.slice(queryAt + 1) : undefined

  const out: RequestUrl = { text, confidence: 'exact' }
  if (baseText !== undefined) out.base = baseText
  if (value.env) out.baseEnv = value.env
  if (!rawPath && rawQuery === undefined) {
    if (base === undefined || base.includes(HOLE)) return { ...out, confidence: 'unknown' }
    out.path = '/'
    return out
  }
  if (rawPath && !rawPath.startsWith('/') && base === undefined) {
    // A relative URL, or one that starts with a value only known at runtime.
    return { ...out, confidence: rawPath.startsWith(HOLE) ? 'unknown' : 'pattern', path: holes(rawPath) }
  }
  out.path = holes(rawPath || '/')
  if (rawQuery) out.query = holes(rawQuery)
  if (flat.includes(HOLE) && !(base?.includes(HOLE) && value.env && !rest.includes(HOLE))) {
    out.confidence = 'pattern'
  }
  return out
}

/** `process.env.X` -> `X`. */
function envVarOf(node: Node): string | undefined {
  const inner = skipWrappers(node)
  if (!N.isPropertyAccessExpression(inner)) return undefined
  return inner.getExpression().getText() === 'process.env' ? inner.getName() : undefined
}

function holeName(node: Node): string {
  const inner = skipWrappers(node)
  if (N.isIdentifier(inner)) return inner.getText()
  if (N.isPropertyAccessExpression(inner)) return inner.getName()
  if (N.isCallExpression(inner)) {
    const arg = inner.getArguments()[0]
    if (arg && /^(String|Number|encodeURIComponent|encodeURI)$/.test(inner.getExpression().getText())) {
      return holeName(arg)
    }
  }
  return 'param'
}

/** Regex for a route path in bracket form: `/api/products/[id]`. */
function routeRegex(path: string): RegExp {
  let source = ''
  for (const segment of path.split('/').filter(Boolean)) {
    if (/^\[\[\.\.\..+\]\]$/.test(segment)) source += '(?:/.*)?'
    else if (/^\[\.\.\..+\]$/.test(segment)) source += '/.+'
    else if (/^\[.+\]$/.test(segment)) source += '/[^/]+'
    else source += `/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  }
  return new RegExp(`^${source || '/'}/?$`)
}

function flagsOf(site: RequestSite): Flag[] {
  const flags: Flag[] = []
  if (site.url && site.url.confidence === 'unknown') {
    flags.push({
      kind: 'dynamic-url',
      message: `The URL could not be resolved: ${site.url.text || '(no argument)'}`,
    })
  }
  if (!site.method) flags.push({ kind: 'unknown-method', message: 'The HTTP method could not be resolved.' })
  if (!site.responseType) {
    flags.push({
      kind: 'unknown-response',
      message: 'No response type was found (annotation, generic or cast).',
    })
  }
  if (site.trigger.kind === 'unknown') {
    flags.push({ kind: 'unknown-trigger', message: 'Could not find what starts this request.' })
  }
  return flags
}

function actionKey(ref: ServerActionRef): string {
  return `${ref.loc.file}:${ref.loc.line}:${ref.loc.column}`
}

function bySite(a: RequestSite, b: RequestSite): number {
  const n = Math.max(a.callStack.length, b.callStack.length)
  for (let i = 0; i < n; i++) {
    const fa = a.callStack[i]
    const fb = b.callStack[i]
    if (!fa || !fb) return fa ? 1 : -1
    const c = compare(fa.file, fb.file) || fa.line - fb.line || fa.column - fb.column
    if (c !== 0) return c
  }
  return compare(a.id, b.id)
}

function compareLoc(a: SourceLoc, b: SourceLoc): number {
  return compare(a.file, b.file) || a.line - b.line || a.column - b.column
}

/** Success or error path, from the innermost frame that tells: a callback, `catch`, `if (res.ok)`. */
function navOutcome(frames: Frame[]): Navigation['outcome'] {
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i] as Frame
    const found = outcomeOf(frame.node, frame.scope) ?? frame.outcome
    if (found) return found
  }
  return undefined
}

// --- AST helpers -----------------------------------------------------------------------------

type FunctionLike = FunctionDeclaration | FunctionExpression | ArrowFunction | MethodDeclaration

function isFunctionLike(node: Node | undefined): node is FunctionLike {
  return (
    !!node &&
    (N.isFunctionDeclaration(node) ||
      N.isFunctionExpression(node) ||
      N.isArrowFunction(node) ||
      N.isMethodDeclaration(node))
  )
}

/** The function behind a declaration: `function f`, `const f = () => ...`, `{ f() {} }`, `useCallback(fn)`. */
function functionOf(decl: Node | undefined): Node | undefined {
  if (!decl) return undefined
  if (N.isFunctionDeclaration(decl)) return decl.getBody() ? decl : decl.getImplementation()
  if (isFunctionLike(decl)) return decl
  if (N.isVariableDeclaration(decl) || N.isPropertyAssignment(decl)) {
    const written = decl.getInitializer()
    let init: Node | undefined = written ? skipWrappers(written) : undefined
    if (init && N.isCallExpression(init) && CALLBACK_HOOKS.has(calleeName(init) ?? '')) {
      init = init.getArguments()[0]
    }
    return isFunctionLike(init) ? init : undefined
  }
  return undefined
}

function calleeFunction(call: CallExpression): Node | undefined {
  const symbol = call.getExpression().getSymbol()
  if (!symbol) return undefined
  return functionOf(unalias(symbol).getDeclarations()[0])
}

function functionName(fn: Node): string {
  if (N.isFunctionDeclaration(fn) || N.isFunctionExpression(fn) || N.isMethodDeclaration(fn)) {
    return fn.getName() ?? 'anonymous'
  }
  const parent = fn.getParent()
  if (parent && (N.isVariableDeclaration(parent) || N.isPropertyAssignment(parent))) return parent.getName()
  return 'anonymous'
}

function functionAnchor(fn: Node): Node {
  if (N.isFunctionDeclaration(fn) || N.isMethodDeclaration(fn)) return fn.getNameNode() ?? fn
  const parent = fn.getParent()
  if (parent && (N.isVariableDeclaration(parent) || N.isPropertyAssignment(parent)))
    return parent.getNameNode()
  return fn
}

/** Binds a function's parameters to call arguments. */
function bind(fn: Node, args: Node[], env: Env): Env {
  return isFunctionLike(fn)
    ? bindParams(
        fn,
        args.map((expr) => ({ expr, env })),
      )
    : EMPTY_ENV
}

function bindParams(fn: FunctionLike, values: Binding[]): Env {
  const out = new Map<Node, Binding>()
  fn.getParameters().forEach((param, i) => {
    if (param.isRestParameter() || !N.isIdentifier(param.getNameNode())) return
    out.set(param, values[i] ?? { expr: undefined, env: EMPTY_ENV })
  })
  return out
}

function declarationOf(identifier: Node): Node | undefined {
  const symbol = identifier.getSymbol()
  if (!symbol) return undefined
  // Shorthand `{ method }` resolves to the property; use the value it refers to.
  const value =
    identifier.getParent() && N.isShorthandPropertyAssignment(identifier.getParent() as Node)
      ? (identifier.getParent() as Node).getSymbol()?.getValueDeclaration()
      : undefined
  if (value && !N.isShorthandPropertyAssignment(value)) return value
  const resolved = unalias(symbol)
  return resolved.getValueDeclaration() ?? resolved.getDeclarations()[0]
}

function isConst(decl: Node): boolean {
  const list = decl.getParent()
  return !!list && N.isVariableDeclarationList(list) && (list.getFlags() & ts.NodeFlags.Const) !== 0
}

function propertyName(node: Node): string {
  if (N.isIdentifier(node) || N.isPrivateIdentifier(node)) return node.getText()
  if (N.isStringLiteral(node) || N.isNumericLiteral(node)) return String(node.getLiteralValue())
  return node.getText()
}

function propValue(prop: Prop): Node | undefined {
  return prop === 'absent' || prop === 'unknown' ? undefined : prop.node
}

function calleeName(call: CallExpression): string | undefined {
  const expr = call.getExpression()
  if (N.isIdentifier(expr)) return expr.getText()
  if (N.isPropertyAccessExpression(expr)) return expr.getName()
  return undefined
}

/**
 * A `queryClient` method React Query defines (fetch, prefetch, or cache update), with the
 * package it comes from. The receiver's type must be React Query's `QueryClient`.
 */
function queryClientMethod(call: CallExpression): { name: string; module: string } | undefined {
  const expr = call.getExpression()
  if (!N.isPropertyAccessExpression(expr)) return undefined
  const name = expr.getName()
  if (!QUERY_CLIENT_FETCHES.has(name) && !(name in QUERY_CACHE_OPS)) return undefined
  const type = expr.getExpression().getType()
  const symbol = type.getSymbol() ?? type.getAliasSymbol()
  if (symbol?.getName() !== 'QueryClient') return undefined
  for (const decl of symbol.getDeclarations()) {
    const m = /\/node_modules\/(@tanstack\/[a-z-]*query[a-z-]*|react-query)\//.exec(
      decl.getSourceFile().getFilePath(),
    )
    if (m?.[1]) return { name, module: m[1] }
  }
  return undefined
}

/** What a function returns: its expression body, or its only `return` statement's value. */
function returnedExpr(fn: FunctionLike): Node | undefined {
  const body = fn.getBody()
  if (!body) return undefined
  if (!N.isBlock(body)) return body
  const returns = body.getStatements().filter((s) => N.isReturnStatement(s))
  const only = returns.length === 1 ? returns[0] : undefined
  return only && N.isReturnStatement(only) ? only.getExpression() : undefined
}

/** A component and every component rendered below it. */
function subtree(id: string, components: Map<string, Component>, seen = new Set<string>()): Set<string> {
  if (seen.has(id)) return seen
  seen.add(id)
  for (const child of components.get(id)?.children ?? []) {
    if (child.componentId) subtree(child.componentId, components, seen)
  }
  return seen
}

function hookOf(call: CallExpression): HookDef | undefined {
  const imported = importedName(call.getExpression())
  return imported ? HOOKS.get(`${imported.module}#${imported.name}`) : undefined
}

function isActionStateHook(call: CallExpression): boolean {
  const imported = importedName(call.getExpression())
  return !!imported && ACTION_STATE_HOOKS.has(`${imported.module}#${imported.name}`)
}

/** For an imported identifier (or `React.useX`), the module and the exported name. */
function importedName(expr: Node): { module: string; name: string } | undefined {
  const module = importModuleOf(expr)
  if (!module) return undefined
  if (N.isPropertyAccessExpression(expr)) return { module, name: expr.getName() }
  if (!N.isIdentifier(expr)) return undefined
  for (const decl of expr.getSymbol()?.getDeclarations() ?? []) {
    if (N.isImportSpecifier(decl)) return { module, name: decl.getName() }
    if (N.isImportClause(decl)) return { module, name: 'default' }
  }
  return undefined
}

function isProject(node: Node): boolean {
  const file = node.getSourceFile()
  return (
    !file.isInNodeModules() && !file.isDeclarationFile() && !file.getFilePath().includes('/node_modules/')
  )
}

function isInside(node: Node, ancestor: Node): boolean {
  return (
    node !== ancestor &&
    node.getPos() >= ancestor.getPos() &&
    node.getEnd() <= ancestor.getEnd() &&
    node.getSourceFile() === ancestor.getSourceFile()
  )
}

function isAxiosNode(node: Node): boolean {
  const symbol = node.getSymbol()
  return (
    !!symbol &&
    unalias(symbol)
      .getDeclarations()
      .some((d) => /\/node_modules\/axios\//.test(d.getSourceFile().getFilePath()))
  )
}

/** `axios(...)` or an instance `api(...)`. */
function isAxiosCallable(expr: Node): boolean {
  const type = expr.getType()
  const symbol = type.getSymbol() ?? type.getAliasSymbol()
  const name = symbol?.getName()
  return (name === 'AxiosStatic' || name === 'AxiosInstance') && isAxiosNode(expr)
}

function isAxiosType(type: Type, name: string): boolean {
  const symbol = type.getSymbol() ?? type.getAliasSymbol()
  return (
    symbol?.getName() === name &&
    symbol.getDeclarations().some((d) => /\/node_modules\/axios\//.test(d.getSourceFile().getFilePath()))
  )
}

function isLibType(type: Type, name: string): boolean {
  const symbol = type.getSymbol()
  return (
    symbol?.getName() === name && symbol.getDeclarations().every((d) => d.getSourceFile().isDeclarationFile())
  )
}

function unwrapPromise(type: Type): Type {
  const symbol = type.getSymbol()
  if (symbol?.getName() === 'Promise' || symbol?.getName() === 'PromiseLike') {
    return type.getTypeArguments()[0] ?? type
  }
  return type
}

function unwrapPromiseNode(node: TypeNode): TypeNode {
  if (N.isTypeReference(node) && node.getTypeName().getText() === 'Promise') {
    return node.getTypeArguments()[0] ?? node
  }
  return node
}

/** A type worth reporting: not `any`/`unknown`/`never`, not a bare generic parameter. */
function isMeaningful(type: Type): boolean {
  const flags = type.getFlags()
  if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) return false
  if (type.isTypeParameter()) return false
  if (isLibType(type, 'Response')) return false
  return true
}

function skipParens(node: Node | undefined): Node | undefined {
  let current = node
  while (current && N.isParenthesizedExpression(current)) current = current.getParent()
  return current
}

/** The outermost parentheses around a node (so `useEffect((() => {}))` still matches). */
function outerParens(node: Node): Node {
  let current = node
  for (
    let parent = current.getParent();
    parent && N.isParenthesizedExpression(parent);
    parent = parent.getParent()
  ) {
    current = parent
  }
  return current
}

/** Unwraps `(x)`, `x as T`, `x!`, `x satisfies T`, `await x`. */
function skipWrappers(node: Node): Node {
  let current = node
  for (;;) {
    if (
      N.isParenthesizedExpression(current) ||
      N.isAsExpression(current) ||
      N.isNonNullExpression(current) ||
      N.isSatisfiesExpression(current) ||
      N.isAwaitExpression(current) ||
      N.isTypeAssertion(current)
    ) {
      current = current.getExpression()
      continue
    }
    return current
  }
}

/** Climbs out of `await` and parentheses around an expression. */
function climb(node: Node): Node {
  let current = node
  for (let parent = current.getParent(); parent; parent = parent.getParent()) {
    if (!N.isAwaitExpression(parent) && !N.isParenthesizedExpression(parent)) break
    current = parent
  }
  return current
}

/** The function body starts with `'use server'`. */
function hasOwnUseServer(fn: FunctionLike): boolean {
  const body = fn.getBody()
  const first = body && N.isBlock(body) ? body.getStatements()[0] : undefined
  if (!first || !N.isExpressionStatement(first)) return false
  const expr = first.getExpression()
  return (
    (N.isStringLiteral(expr) || N.isNoSubstitutionTemplateLiteral(expr)) &&
    expr.getLiteralValue() === 'use server'
  )
}

function attributeTrigger(attr: JsxAttribute, loc: SourceLoc): Trigger | undefined {
  const name = attr.getNameNode().getText()
  if (/^on[A-Z]/.test(name)) return { kind: 'event', event: name, loc }
  if (name === 'action' || name === 'formAction') return { kind: 'event', event: name, loc }
  return undefined
}

function oneLine(text: string): string {
  const flat = text.replace(/\s*\n\s*/g, ' ')
  return flat.length > 120 ? `${flat.slice(0, 117)}...` : flat
}
