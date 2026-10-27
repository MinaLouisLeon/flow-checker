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
  type CallFrame,
  type Component,
  type Flag,
  HTTP_METHODS,
  type HttpMethod,
  makeId,
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
  type MethodDeclaration,
  Node as N,
  type Node,
  type ParameterDeclaration,
  type SourceFile,
  type Type,
  type TypeNode,
  ts,
} from 'ts-morph'
import { directives, importModuleOf, unalias } from './components'
import { compare, relativeTo } from './paths'
import type { TypeResolver } from './types'

/** How deep wrapper calls are followed from an origin. */
const MAX_DEPTH = 10

const EFFECT_HOOKS = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect'])
const CALLBACK_HOOKS = new Set(['useCallback', 'useMemo', 'useEffectEvent'])

interface HookDef {
  /** Canonical name, e.g. `useQuery`, `useSWR`. */
  name: string
  module: string
  kind: 'query' | 'mutation'
  /** React Query: the options property holding the function / key. */
  fnProp?: string
  keyProp?: string
  /** SWR: the argument index of the fetcher / key. */
  fnArg?: number
  keyArg?: number
}

const RQ = (name: string, kind: HookDef['kind'], module: string): HookDef => ({
  name,
  module,
  kind,
  fnProp: kind === 'query' ? 'queryFn' : 'mutationFn',
  keyProp: kind === 'query' ? 'queryKey' : 'mutationKey',
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
  for (const name of ['useQuery', 'useSuspenseQuery', 'useInfiniteQuery', 'useSuspenseInfiniteQuery']) {
    HOOKS.set(`${module}#${name}`, RQ(name, 'query', module))
  }
  HOOKS.set(`${module}#useMutation`, RQ('useMutation', 'mutation', module))
}
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
  hook?: { def: HookDef; key?: string; typeArg?: TypeNode }
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
}

export class RequestScanner {
  readonly #root: string
  readonly #types: TypeResolver
  readonly #sites = new Map<string, RequestSite>()
  readonly #reaches = new Map<Node, boolean>()
  readonly #actionsExplored = new Set<Node>()
  readonly #fileDirectives = new Map<SourceFile, string[]>()

  constructor(root: string, types: TypeResolver) {
    this.#root = root
    this.#types = types
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

  // --- Walking -------------------------------------------------------------------------------

  /** Visits every call in `node`, which is inside the function `scope`. */
  #walk(node: Node, scope: Node, env: Env, w: Walk) {
    node.forEachDescendant((d, traversal) => {
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
    if (this.#isFetch(call)) {
      this.#emit(w, this.#frame(call, scope), this.#fetchSite(call, env))
      return true
    }
    const axios = this.#axiosSite(call, env)
    if (axios) {
      this.#emit(w, this.#frame(call, scope), axios)
      return true
    }
    const hook = hookOf(call)
    if (hook) {
      this.#hook(call, hook, scope, env, w)
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
    if (!fn || !isProject(fn) || w.active.has(fn)) return false
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

  #enter(fn: Node, env: Env, frame: Frame, w: Walk) {
    w.frames.push(frame)
    w.active.add(fn)
    this.#walk(fn, fn, env, w)
    w.active.delete(fn)
    w.frames.pop()
  }

  /** React Query / SWR: walk the query or mutation function. */
  #hook(call: CallExpression, def: HookDef, scope: Node, env: Env, w: Walk) {
    let fnExpr: Node | undefined
    let keyExpr: Node | undefined
    if (def.fnProp) {
      const options = this.#queryOptions(call.getArguments()[0], env)
      fnExpr = propValue(this.#prop(options, env, def.fnProp))
      keyExpr = propValue(this.#prop(options, env, def.keyProp ?? ''))
    } else {
      fnExpr = call.getArguments()[def.fnArg ?? 1]
      keyExpr = call.getArguments()[def.keyArg ?? 0]
    }
    const fn = this.#functionValue(fnExpr, env)
    if (!fn || w.active.has(fn) || w.frames.length >= MAX_DEPTH) return

    const frame: Frame = {
      node: call,
      callee: call.getExpression().getText(),
      scope,
      hook: {
        def,
        ...(keyExpr ? { key: oneLine(keyExpr.getText()) } : {}),
        ...(call.getTypeArguments()[0] ? { typeArg: call.getTypeArguments()[0] } : {}),
      },
      ...(def.kind === 'mutation' ? { trigger: this.#mutationTrigger(call, scope) } : {}),
    }
    // SWR passes the key to the fetcher.
    const fnEnv =
      def.fnArg !== undefined && keyExpr && isFunctionLike(fn)
        ? bindParams(fn, [{ expr: keyExpr, env }])
        : EMPTY_ENV
    this.#enter(fn, fnEnv, frame, w)
  }

  /** `useQuery(options)`, `useQuery(todoQuery)` or `useQuery(queryOptions({...}))`. */
  #queryOptions(arg: Node | undefined, env: Env): Node | undefined {
    const r = this.#resolve(arg, env)
    let node = r.node
    if (node && N.isCallExpression(node) && /Options$/.test(calleeName(node) ?? '')) {
      node = node.getArguments()[0]
    }
    return node
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

  /** True when the function (or anything it calls in the project) sends a request. */
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
      if (this.#isFetch(d) || this.#axiosSite(d, EMPTY_ENV) || hookOf(d) || isActionStateHook(d)) {
        found = true
        return
      }
      const callee = calleeFunction(d)
      if (callee && isProject(callee) && callee !== fn) {
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
      ...(hookFrame?.hook
        ? {
            hook: {
              name: hookFrame.hook.def.name,
              module: hookFrame.hook.def.module,
              ...(hookFrame.hook.key ? { key: hookFrame.hook.key } : {}),
            },
          }
        : {}),
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
    this.#sites.set(id, site)
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
    const r = this.#resolve(obj, env)
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
