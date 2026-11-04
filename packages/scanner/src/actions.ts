// Server action safety (M46): every server action, with the auth check and the input check in front of
// what it changes. A server action is a public `POST` endpoint: once a page uses it, anyone can call it
// with any arguments (checked with `next build` + `next start`, see the model). Auth checks reuse the
// guard rules of M31: an exit (`stops()`) under a condition, here one that reads the session or user.
import {
  type ActionAuth,
  type ActionAuthCheck,
  type ActionChange,
  type ActionInput,
  type ActionInputCheck,
  type Component,
  makeId,
  type RequestSite,
  type Route,
  type ServerAction,
  type SourceLoc,
} from '@flow-checker/shared'
import {
  type CallExpression,
  Node as N,
  type Node,
  type SourceFile,
  type Symbol as TsSymbol,
  ts,
} from 'ts-morph'
import { componentsBelow } from './access'
import { directives, importModuleOf, isPackage, unalias } from './components'
import { navigationCall, renderExitCall } from './navigation'
import { compare, relativeTo } from './paths'
import {
  actionFunction,
  type FunctionLike,
  functionOf,
  hasOwnUseServer,
  isFunctionLike,
  isProject,
  isWrappedAction,
  oneLine,
  skipWrappers,
  stops,
} from './requests'

export interface ActionsInput {
  root: string
  /** Project files the app reaches (the import graph's files). */
  files: SourceFile[]
  routes: Route[]
  components: Component[]
  sites: RequestSite[]
  /** False for files the config excludes. */
  scanned: (path: string) => boolean
}

/** How deep project helpers are followed from an action. */
const MAX_DEPTH = 5

/**
 * Calls whose result is the signed-in user or session: `auth()`, `getServerSession()`,
 * `currentUser()`, `supabase.auth.getUser()`, `verifySession()`. Matched on the function's name.
 */
const AUTH_NAME =
  /^(auth|getAuth|currentUser|getCurrentUser|getUser|getMe|me|whoami|getViewer|validateRequest|getClaims|getToken|getJwt|verifyToken|verifyJwt|decodeToken|getPrincipal|getIdentity)$|session|auth(?!or)|claims|principal/i

/** Package calls that stop on their own when nobody is signed in: `requireAuth()`, `auth.protect()`. */
const GUARD_NAME =
  /^(require|ensure|assert|protect|verify|check|guard)\w*(auth|user|session|admin|role|permission|login|signedin|authenticated|access)/i

/** Cookie and header names that carry a session. */
const TOKEN_KEY = /sess|token|auth|jwt|sid|user/i

/** Validation libraries and the names of their parse calls. */
const SCHEMA_PACKAGES =
  /\/node_modules\/(zod|valibot|yup|joi|superstruct|arktype|@sinclair\/typebox|effect|io-ts|runtypes|@vinejs\/vine)\//
const SCHEMA_CALLS = new Set([
  'parse',
  'safeParse',
  'parseAsync',
  'safeParseAsync',
  'spa',
  'decode',
  'safeDecode',
  'validate',
  'validateSync',
  'validateAsync',
  'cast',
  'assert',
  'create',
  'is',
  'Check',
  'Parse',
  'Decode',
  'decodeUnknown',
  'decodeUnknownSync',
])

/** Write calls on database clients and project data objects. */
const DB_WRITES = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
  'insert',
  'insertInto',
  'insertOne',
  'insertMany',
  'updateOne',
  'updateTable',
  'deleteOne',
  'deleteFrom',
  'replaceOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'findByIdAndUpdate',
  'findByIdAndDelete',
  'findByIdAndRemove',
  'bulkWrite',
  'bulkCreate',
  'destroy',
  'save',
  'remove',
  'increment',
  'decrement',
  'truncate',
  'set',
  'put',
  'del',
  'hset',
  'hdel',
  'incr',
  'decr',
  'incrby',
  'lpush',
  'rpush',
  'sadd',
  'srem',
  'zadd',
  'zrem',
  '$executeRaw',
  '$executeRawUnsafe',
])

/** Methods of HTTP clients that send something: `api.post()`, `axios.put()`. */
const HTTP_WRITES = new Set(['post', 'put', 'patch'])
const HTTP_PACKAGES = new Set(['axios', 'ky', 'ofetch', 'got', 'superagent', 'redaxios', 'wretch'])

const FS_WRITES = new Set([
  'writeFile',
  'writeFileSync',
  'appendFile',
  'appendFileSync',
  'unlink',
  'unlinkSync',
  'rm',
  'rmSync',
  'rmdir',
  'rmdirSync',
  'mkdir',
  'mkdirSync',
  'rename',
  'renameSync',
  'copyFile',
  'copyFileSync',
  'cp',
  'cpSync',
  'truncate',
  'truncateSync',
  'createWriteStream',
])

/** `fs`, `node:fs`, `fs/promises`, `fs-extra`. */
const FS_MODULES = /^(node:)?fs(\/promises)?$|^fs-extra$/

const CACHE_CALLS = new Set([
  'revalidatePath',
  'revalidateTag',
  'updateTag',
  'refresh',
  'expirePath',
  'expireTag',
  'unstable_expirePath',
  'unstable_expireTag',
])

/** Calls whose result is their argument in another form. */
const CONVERSIONS = new Set([
  'String',
  'Number',
  'Boolean',
  'BigInt',
  'parseInt',
  'parseFloat',
  'Number.parseInt',
  'Number.parseFloat',
  'Object.fromEntries',
  'Object.entries',
  'Object.keys',
  'Object.values',
  'Array.from',
  'JSON.parse',
  'decodeURIComponent',
])

/** SQL that writes. */
const SQL_WRITE = /^\s*(insert|update|delete|merge|upsert|replace|drop|truncate|alter|create)\b/i

interface FoundAction {
  /** The function, or the `const` for a wrapped action. */
  node: Node
  /** The function that gets the caller's arguments. */
  fn: FunctionLike | undefined
  name: string
  anchor: Node
  defined: ServerAction['defined']
}

interface Wrapper {
  call: CallExpression
  /** The wrapper function, when it is project code. */
  fn?: FunctionLike
  /** `x.use(a).schema(s).action(fn)`: the calls of a method chain, outermost first. */
  chain: CallExpression[]
  ref: NonNullable<ServerAction['wrappedIn']>
}

interface At<T> {
  item: T
  /** Position in the action's own function, to order checks against changes. */
  at: number
  /** For a check that only covers what is inside it (`if (session) { ... }`): where that ends. */
  end?: number
}

/** Every server action the app's files hold, by file and line. */
export function buildActions(input: ActionsInput): ServerAction[] {
  const reader = new ActionReader(input)
  const routesOf = pagesByComponent(input.routes, input.components)
  const out: ServerAction[] = []
  for (const file of input.files) {
    if (!file.getFullText().includes('use server')) continue
    for (const found of actionsIn(file)) out.push(reader.action(found, routesOf))
  }
  return out.sort((a, b) => compare(a.loc.file, b.loc.file) || a.loc.line - b.loc.line)
}

/** Exported functions of a `'use server'` file, and functions with their own `'use server'`. */
function actionsIn(file: SourceFile): FoundAction[] {
  const out: FoundAction[] = []
  const seen = new Set<Node>()
  const add = (found: FoundAction) => {
    if (seen.has(found.node)) return
    seen.add(found.node)
    out.push(found)
  }
  if (directives(file).includes('use server')) {
    for (const [name, decls] of file.getExportedDeclarations()) {
      const decl: Node | undefined = decls[0]
      if (!decl || decl.getSourceFile() !== file) continue
      if (isWrappedAction(decl)) {
        add({ node: decl, fn: actionFunction(decl), name, anchor: decl.getNameNode(), defined: 'file' })
        continue
      }
      const fn = functionOf(decl)
      if (!fn || !isFunctionLike(fn)) continue
      const variable = decl.getParent()
      const anchor: Node =
        N.isVariableDeclaration(decl) || N.isFunctionDeclaration(decl)
          ? (decl.getNameNode() ?? nameNode(fn))
          : variable && N.isVariableDeclaration(variable)
            ? variable.getNameNode()
            : nameNode(fn)
      add({ node: fn, fn, name: name === 'default' ? functionLabel(fn) : name, anchor, defined: 'file' })
    }
  }
  file.forEachDescendant((d) => {
    if (!isFunctionLike(d) || !hasOwnUseServer(d)) return
    add({ node: d, fn: d, name: functionLabel(d), anchor: nameNode(d), defined: 'inline' })
  })
  return out
}

function nameNode(fn: FunctionLike): Node {
  if (N.isFunctionDeclaration(fn) || N.isMethodDeclaration(fn) || N.isFunctionExpression(fn)) {
    const name = fn.getNameNode()
    if (name) return name
  }
  const parent = fn.getParent()
  if (parent && (N.isVariableDeclaration(parent) || N.isPropertyAssignment(parent)))
    return parent.getNameNode()
  return fn
}

function functionLabel(fn: Node): string {
  if (N.isFunctionDeclaration(fn) || N.isFunctionExpression(fn) || N.isMethodDeclaration(fn)) {
    const name = fn.getName()
    if (name) return name
  }
  const parent = fn.getParent()
  if (parent && (N.isVariableDeclaration(parent) || N.isPropertyAssignment(parent))) return parent.getName()
  return 'anonymous'
}

/** Component id -> the pages that render it (through their layouts and page). */
function pagesByComponent(routes: Route[], components: Component[]): Map<string, string[]> {
  const below = componentsBelow(components)
  const out = new Map<string, string[]>()
  for (const route of routes) {
    if (route.kind !== 'page') continue
    const roots = [
      ...route.layoutChain.flatMap((l) => (l.componentId ? [l.componentId] : [])),
      ...(route.componentId ? [route.componentId] : []),
    ]
    const ids = new Set(roots.flatMap((r) => below(r)))
    for (const id of ids) {
      const list = out.get(id)
      if (list) list.push(route.id)
      else out.set(id, [route.id])
    }
  }
  return out
}

class ActionReader {
  readonly #input: ActionsInput
  /** Helpers that check auth anywhere in them (followed with no arguments known). */
  readonly #helperAuth = new Map<Node, boolean>()
  readonly #returnsAuth = new Map<Node, boolean>()

  constructor(input: ActionsInput) {
    this.#input = input
  }

  action(found: FoundAction, routesOf: Map<string, string[]>): ServerAction {
    const loc = this.#loc(found.anchor)
    const sites = this.#input.sites.filter(
      (s) =>
        s.transport === 'server-action' &&
        s.serverAction &&
        s.serverAction.loc.file === loc.file &&
        s.serverAction.loc.line === loc.line &&
        s.serverAction.name === found.name,
    )
    const routeIds = new Set<string>()
    for (const site of sites) for (const id of routesOf.get(site.componentId ?? '') ?? []) routeIds.add(id)
    // Used other than through a call the walk placed (`<List onArchive={archive} />` in a server page).
    const uses = sites.length === 0 ? this.#uses(found) : undefined
    for (const ref of uses ?? []) {
      const owner = this.#componentOf(ref)
      for (const id of (owner && routesOf.get(owner)) ?? []) routeIds.add(id)
    }
    const componentId = found.defined === 'inline' ? this.#componentOf(found.node) : undefined
    const wrapper = this.#wrapperOf(found.node)

    const changes = found.fn ? this.#changes(found.fn, 0, [], new Set()) : []
    const firstChange = changes.find((c) => c.item.kind !== 'cache')?.at ?? Number.POSITIVE_INFINITY
    const auth = this.#auth(found, wrapper, firstChange)
    const input = this.#inputOf(found, wrapper)
    const unused = sites.length === 0 && uses !== undefined && uses.length === 0
    const writes = changes.some((c) => c.item.kind !== 'cache')
    const open =
      writes && !unused && auth.status === 'none' && (input.status === 'none' || input.status === 'no-input')
    return {
      id: makeId('sa', loc.file, found.name, String(loc.line)),
      name: found.name,
      loc,
      defined: found.defined,
      ...(wrapper ? { wrappedIn: wrapper.ref } : {}),
      ...(componentId ? { componentId } : {}),
      siteIds: sites.map((s) => s.id),
      routeIds: [...routeIds].sort(compare),
      ...(unused ? { unused: true as const } : {}),
      auth,
      input,
      changes: changes.map((c) => c.item),
      ...(open ? { flags: [{ kind: 'unprotected' as const, loc }] } : {}),
    }
  }

  // --- Where it is -----------------------------------------------------------------------------

  /** The component whose body holds the node: the outermost function around it. */
  #componentOf(node: Node): string | undefined {
    const outer = node
      .getAncestors()
      .filter((a) => isFunctionLike(a) && a !== node)
      .at(-1)
    if (!outer) return undefined
    const name = functionLabel(outer)
    const file = relativeTo(this.#input.root, node.getSourceFile().getFilePath())
    return this.#input.components.find((c) => c.file === file && c.name === name)?.id
  }

  /**
   * Where other code uses it as a value (imports, re-exports and `typeof x` left out). Undefined
   * when that can't be told, which counts as used.
   */
  #uses(found: FoundAction): Node[] | undefined {
    if (!N.isIdentifier(found.anchor)) return undefined
    try {
      return found.anchor
        .findReferencesAsNodes()
        .filter(
          (ref) =>
            ref !== found.anchor &&
            !ref.getFirstAncestorByKind(ts.SyntaxKind.ImportDeclaration) &&
            !ref.getFirstAncestorByKind(ts.SyntaxKind.ExportDeclaration) &&
            !ref.getFirstAncestorByKind(ts.SyntaxKind.TypeQuery),
        )
    } catch {
      return undefined
    }
  }

  /** `withAdmin(async () => ...)`: the wrapper call, its function when the project has it, and its chain. */
  #wrapperOf(node: Node): Wrapper | undefined {
    if (!N.isVariableDeclaration(node)) return undefined
    const init = node.getInitializer()
    const call = init ? skipWrappers(init) : undefined
    if (!call || !N.isCallExpression(call)) return undefined
    const callee = call.getExpression()
    const fn = this.#callee(call)
    const name = N.isPropertyAccessExpression(callee) ? callee.getName() : oneLine(callee.getText())
    const module = importModuleOf(callee)
    const chain = chainOf(call)
    const root = chain.at(-1)
    const rootModule = root ? importModuleOf(root.getExpression()) : module
    const pkg = [module, rootModule].find((m): m is string => !!m && isPackage(m))
    return { call, ...(fn ? { fn } : {}), chain, ref: { name, ...(pkg ? { module: pkg } : {}) } }
  }

  // --- What it changes -------------------------------------------------------------------------

  #changes(fn: Node, depth: number, via: string[], seen: Set<Node>): At<ActionChange>[] {
    if (seen.has(fn)) return []
    seen.add(fn)
    const out: At<ActionChange>[] = []
    fn.forEachDescendant((d, traversal) => {
      if (d !== fn && isFunctionLike(d) && hasOwnUseServer(d)) {
        traversal.skip()
        return
      }
      if (N.isTaggedTemplateExpression(d)) {
        const tag = oneLine(d.getTag().getText())
        if (SQL_WRITE.test(templateHead(d.getTemplate()))) out.push(this.#change('database', tag, d, via))
        return
      }
      if (!N.isCallExpression(d)) return
      const found = this.#classify(d)
      if (found) {
        out.push(this.#change(found.kind, found.text, d, via))
        return
      }
      const callee = this.#callee(d)
      if (!callee || depth >= MAX_DEPTH || !this.#follows(callee)) return
      // Changes in a helper are ordered by the call in this function.
      for (const inner of this.#changes(callee, depth + 1, [...via, calleeText(d)], seen))
        out.push({ ...inner, at: d.getStart() })
    })
    return dedupe(out)
  }

  #change(kind: ActionChange['kind'], text: string, node: Node, via: string[]): At<ActionChange> {
    return {
      item: { kind, text, ...(via.length > 0 ? { via } : {}), loc: this.#loc(node) },
      at: node.getStart(),
    }
  }

  /** A call that changes something, by what it is. */
  #classify(call: CallExpression): { kind: ActionChange['kind']; text: string } | undefined {
    const expr = call.getExpression()
    const name = N.isPropertyAccessExpression(expr)
      ? expr.getName()
      : N.isIdentifier(expr)
        ? expr.getText()
        : undefined
    if (!name) return undefined
    if (CACHE_CALLS.has(name) && importModuleOf(expr) === 'next/cache') return { kind: 'cache', text: name }
    if (name === 'fetch' && N.isIdentifier(expr) && !this.#projectDeclared(expr)) {
      const method = methodOf(call.getArguments()[1])
      return method && method !== 'GET' && method !== 'HEAD'
        ? { kind: 'request', text: `fetch ${method}` }
        : undefined
    }
    if (FS_WRITES.has(name) && FS_MODULES.test(importModuleOf(expr) ?? ''))
      return { kind: 'file', text: name }
    const sql = call.getArguments().some((a) => SQL_WRITE.test(literalHead(a)))
    if (N.isPropertyAccessExpression(expr)) {
      if (builtinReceiver(expr.getExpression())) return undefined
      const text = oneLine(expr.getText())
      const root = rootOf(expr)
      const module = root ? importModuleOf(root) : undefined
      const http = module ? HTTP_PACKAGES.has(module.split('/')[0] as string) : false
      if (HTTP_WRITES.has(name) || (http && name === 'delete')) return { kind: 'request', text }
      if (DB_WRITES.has(name) || sql) return { kind: 'database', text }
      return undefined
    }
    return sql ? { kind: 'database', text: name } : undefined
  }

  #projectDeclared(id: Node): boolean {
    const decl = id.getSymbol()?.getDeclarations()[0]
    return !!decl && isProject(decl)
  }

  // --- Auth ------------------------------------------------------------------------------------

  #auth(found: FoundAction, wrapper: Wrapper | undefined, firstChange: number): ActionAuth {
    const checks: At<ActionAuthCheck>[] = []
    const unclear: string[] = []
    if (wrapper) {
      const wrapperFns = wrapper.fn
        ? [wrapper.fn]
        : wrapper.chain.flatMap((c) =>
            calleeName(c) === 'use' ? c.getArguments().flatMap((a) => this.#functionsOf(a)) : [],
          )
      if (wrapperFns.some((fn) => this.#authChecks(fn, 0, new Set(), true, false).checks.length > 0)) {
        checks.push({
          item: { kind: 'wrapper', text: wrapper.ref.name, loc: this.#loc(wrapper.call) },
          at: -1,
        })
      } else if (!wrapper.fn) {
        unclear.push(
          `it is wrapped in \`${wrapper.ref.name}\`${wrapper.ref.module ? ` from \`${wrapper.ref.module}\`` : ''}, which the scan can't read`,
        )
      }
    }
    if (found.fn) {
      const own = this.#authChecks(found.fn, 0, new Set(), false, false)
      checks.push(...own.checks)
      unclear.push(...own.unclear)
    }
    // An action that only reads has nothing for a check to come before.
    const reads = firstChange === Number.POSITIVE_INFINITY
    const covers = (c: At<ActionAuthCheck>) =>
      reads || (c.end !== undefined ? c.at <= firstChange && firstChange <= c.end : c.at < firstChange)
    const before = checks.filter(covers)
    const late = checks.filter((c) => !covers(c) && c.end === undefined)
    const status: ActionAuth['status'] =
      before.length > 0 ? 'checked' : unclear.length > 0 ? 'unclear' : 'none'
    return {
      status,
      checks: before.map((c) => c.item),
      ...(late.length > 0 && status !== 'checked' ? { late: late.map((c) => c.item) } : {}),
      ...(status === 'unclear' ? { reason: unclear[0] as string } : {}),
    }
  }

  /**
   * Auth checks in a function: an exit under a condition that reads the session, a guarded block,
   * `assert(session)`, a helper that checks, or a package guard. `deep` also looks inside nested
   * functions (a wrapper's returned function). `strict` (helpers): only exits that also stop the
   * caller count (`throw`, `redirect()`, `notFound()`...), not a `return`.
   */
  #authChecks(
    fn: Node,
    depth: number,
    seeds: Set<ts.Symbol>,
    deep: boolean,
    strict: boolean,
  ): { checks: At<ActionAuthCheck>[]; unclear: string[] } {
    const exits = strict ? throwsOut : stops
    const checks: At<ActionAuthCheck>[] = []
    const unclear: string[] = []
    const values = new Set(seeds)
    const reads = (node: Node) => this.#readsAuth(node, values, depth)
    fn.forEachDescendant((d, traversal) => {
      if (d !== fn && isFunctionLike(d) && !deep) {
        traversal.skip()
        return
      }
      if (N.isVariableDeclaration(d)) {
        const init = d.getInitializer()
        if (init && reads(init)) for (const s of boundSymbols(d.getNameNode())) values.add(s)
        return
      }
      if (N.isIfStatement(d)) {
        const cond = d.getExpression()
        if (!reads(cond)) return
        const then = d.getThenStatement()
        const otherwise = d.getElseStatement()
        const item: ActionAuthCheck = {
          kind: 'condition',
          text: oneLine(cond.getText()),
          loc: this.#loc(cond),
        }
        if (exits(then) || (otherwise && exits(otherwise))) checks.push({ item, at: d.getStart() })
        else if (!strict) checks.push({ item, at: then.getStart(), end: then.getEnd() })
        return
      }
      if (!N.isCallExpression(d)) return
      const name = calleeName(d)
      if (
        (name === 'assert' || name === 'invariant') &&
        d.getArguments()[0] &&
        reads(d.getArguments()[0] as Node)
      ) {
        checks.push({
          item: { kind: 'condition', text: oneLine(d.getText()), loc: this.#loc(d) },
          at: d.getStart(),
        })
        return
      }
      const callee = this.#callee(d)
      if (callee && this.#follows(callee)) {
        if (depth >= MAX_DEPTH) return
        // A helper that stops the caller (`requireUser()`) is a check, even when it also returns the session.
        const argSeeds = this.#seedsFor(callee, d, values, depth)
        if (this.#helperChecks(callee, depth + 1, argSeeds)) {
          checks.push({
            item: { kind: 'helper', text: `${calleeText(d)}()`, loc: this.#loc(d) },
            at: d.getStart(),
          })
        }
        return
      }
      if (callee && isProject(callee) && !this.#follows(callee)) {
        unclear.push(`it calls \`${calleeText(d)}\` from a file the config excludes`)
        return
      }
      if (!callee && unresolvedImport(d)) {
        unclear.push(`it calls \`${calleeText(d)}\`, whose import doesn't resolve`)
        return
      }
      const expr = d.getExpression()
      const guard =
        (name && GUARD_NAME.test(name)) ||
        (name === 'protect' &&
          N.isPropertyAccessExpression(expr) &&
          /auth/i.test(expr.getExpression().getText()))
      if (guard) {
        checks.push({
          item: { kind: 'package', text: `${calleeText(d)}()`, loc: this.#loc(d) },
          at: d.getStart(),
        })
      }
    })
    return { checks, unclear }
  }

  #helperChecks(fn: Node, depth: number, seeds: Set<ts.Symbol>): boolean {
    const cacheable = seeds.size === 0
    if (cacheable && this.#helperAuth.has(fn)) return this.#helperAuth.get(fn) as boolean
    if (cacheable) this.#helperAuth.set(fn, false)
    const found = this.#authChecks(fn, depth, seeds, false, true).checks.length > 0
    if (cacheable) this.#helperAuth.set(fn, found)
    return found
  }

  /** The helper's parameters that get an auth value at this call. */
  #seedsFor(fn: Node, call: CallExpression, values: Set<ts.Symbol>, depth: number): Set<ts.Symbol> {
    const out = new Set<ts.Symbol>()
    if (!isFunctionLike(fn)) return out
    const params = fn.getParameters()
    call.getArguments().forEach((arg, i) => {
      const param = params[i]
      if (param && this.#readsAuth(arg, values, depth))
        for (const s of boundSymbols(param.getNameNode())) out.add(s)
    })
    return out
  }

  /** The node reads the session: a variable holding it, or a call that returns it. */
  #readsAuth(node: Node, values: Set<ts.Symbol>, depth: number): boolean {
    const check = (n: Node): boolean => {
      if (N.isIdentifier(n)) {
        const s = valueSymbol(n)
        if (s && values.has(s)) return true
      }
      if (N.isCallExpression(n) && this.#isAuthSource(n, depth)) return true
      return false
    }
    if (check(node)) return true
    let found = false
    node.forEachDescendant((d, traversal) => {
      if (found || isFunctionLike(d)) {
        traversal.skip()
        return
      }
      if (check(d)) {
        found = true
        traversal.stop()
      }
    })
    return found
  }

  /** `auth()`, `getServerSession()`, `cookies().get('session')`, or a project function returning the session. */
  #isAuthSource(call: CallExpression, depth: number): boolean {
    const expr = call.getExpression()
    const name = calleeName(call)
    if (!name) return false
    if (name === 'get' && N.isPropertyAccessExpression(expr)) {
      const target = expr.getExpression().getText()
      const key = literalHead(call.getArguments()[0])
      if (/cookies\(\)/.test(target)) return TOKEN_KEY.test(key)
      if (/headers\(\)/.test(target)) return /^(authorization|cookie)$/i.test(key)
    }
    if (AUTH_NAME.test(name)) return true
    const callee = this.#callee(call)
    return !!callee && depth < MAX_DEPTH && this.#follows(callee) && this.#returnsSession(callee, depth + 1)
  }

  #returnsSession(fn: Node, depth: number): boolean {
    const known = this.#returnsAuth.get(fn)
    if (known !== undefined) return known
    this.#returnsAuth.set(fn, false)
    const values = new Set<ts.Symbol>()
    let found = false
    fn.forEachDescendant((d, traversal) => {
      if (found || (d !== fn && isFunctionLike(d))) {
        traversal.skip()
        return
      }
      if (N.isVariableDeclaration(d)) {
        const init = d.getInitializer()
        if (init && this.#readsAuth(init, values, depth))
          for (const s of boundSymbols(d.getNameNode())) values.add(s)
      } else if (N.isReturnStatement(d)) {
        const value = d.getExpression()
        if (value && this.#readsAuth(value, values, depth)) found = true
      }
    })
    if (!found && isFunctionLike(fn) && N.isArrowFunction(fn)) {
      const body = fn.getBody()
      if (!N.isBlock(body)) found = this.#readsAuth(body, values, depth)
    }
    this.#returnsAuth.set(fn, found)
    return found
  }

  // --- Input -----------------------------------------------------------------------------------

  #inputOf(found: FoundAction, wrapper: Wrapper | undefined): ActionInput {
    const fn = found.fn
    const params = fn ? readParams(fn) : []
    const checks: ActionInputCheck[] = []
    let wrapped: ActionInputCheck | undefined
    let unclear: string | undefined
    if (wrapper) {
      const schema = wrapper.chain.find((c) =>
        /^(schema|inputSchema|input|validator)$/.test(calleeName(c) ?? ''),
      )
      if (schema) {
        wrapped = {
          kind: 'wrapper',
          ...(wrapper.ref.module ? { library: wrapper.ref.module } : {}),
          text: `${calleeName(schema)}(${oneLine(schema.getArguments()[0]?.getText() ?? '')})`,
          params: params.map((p) => p.name),
          loc: this.#loc(schema),
        }
      } else if (wrapper.fn) {
        const inner = innerFunctions(wrapper.fn)
        if (inner.some((f) => this.#inputChecks(f, readParams(f), 0).length > 0)) {
          wrapped = {
            kind: 'wrapper',
            text: wrapper.ref.name,
            params: params.map((p) => p.name),
            loc: this.#loc(wrapper.call),
          }
        }
      } else {
        unclear = `it is wrapped in \`${wrapper.ref.name}\`${wrapper.ref.module ? ` from \`${wrapper.ref.module}\`` : ''}, which hands it the input`
      }
    }
    if (wrapped) checks.push(wrapped)
    if (fn) checks.push(...this.#inputChecks(fn, params, 0))
    const covered = new Set(checks.flatMap((c) => c.params))
    const list = params.map((p) => ({ name: p.name, checked: covered.has(p.name) }))
    const n = list.filter((p) => p.checked).length
    const status: ActionInput['status'] =
      list.length === 0
        ? 'no-input'
        : n === list.length
          ? 'checked'
          : unclear && n === 0
            ? 'unclear'
            : n > 0
              ? 'partial'
              : 'none'
    return { status, params: list, checks, ...(status === 'unclear' && unclear ? { reason: unclear } : {}) }
  }

  /** Checks of the given parameters in a function: schema parses, exits under conditions, helpers. */
  #inputChecks(fn: Node, params: Param[], depth: number): ActionInputCheck[] {
    if (params.length === 0) return []
    // Symbol -> the parameters its value comes from.
    const taint = new Map<ts.Symbol, Set<string>>()
    for (const p of params) taint.set(p.symbol, new Set([p.name]))
    const from = (node: Node): Set<string> => {
      const out = new Set<string>()
      // A value comes from the input through itself, its receiver (`formData.get()`) and plain
      // conversions (`String(x)`), not through other calls: `fetch(url, { body })` returns a response.
      const visit = (n: Node) => {
        if (isFunctionLike(n)) return
        if (N.isIdentifier(n)) {
          const s = valueSymbol(n)
          for (const name of (s && taint.get(s)) ?? []) out.add(name)
          return
        }
        if (N.isCallExpression(n) || N.isNewExpression(n)) {
          const callee = n.getExpression()
          if (N.isPropertyAccessExpression(callee)) visit(callee.getExpression())
          if (CONVERSIONS.has(oneLine(callee.getText()))) for (const a of n.getArguments()) visit(a)
          return
        }
        n.forEachChild(visit)
      }
      visit(node)
      return out
    }
    const mark = (symbols: ts.Symbol[], names: Set<string>) => {
      if (names.size === 0) return
      for (const s of symbols) taint.set(s, new Set([...(taint.get(s) ?? []), ...names]))
    }
    const checks: ActionInputCheck[] = []
    fn.forEachDescendant((d) => {
      if (N.isVariableDeclaration(d)) {
        const init = d.getInitializer()
        if (init) mark(boundSymbols(d.getNameNode()), from(init))
        return
      }
      if (N.isBinaryExpression(d) && d.getOperatorToken().getKind() === ts.SyntaxKind.EqualsToken) {
        const target = rootOf(d.getLeft())
        const s = target ? valueSymbol(target) : undefined
        if (s) mark([s], from(d.getRight()))
        return
      }
      if (N.isIfStatement(d)) {
        const cond = d.getExpression()
        const names = from(cond)
        if (names.size === 0) return
        const then = d.getThenStatement()
        const otherwise = d.getElseStatement()
        if (stops(then) || (otherwise && stops(otherwise))) {
          checks.push({
            kind: 'manual',
            text: oneLine(cond.getText()),
            params: [...names],
            loc: this.#loc(cond),
          })
        } else {
          // `if (!name) errors.name = '...'`: the error object now depends on the input.
          for (const s of writtenIn(then)) mark([s], names)
        }
        return
      }
      if (!N.isCallExpression(d)) return
      const args = d.getArguments()
      const names = new Set(args.flatMap((a) => [...from(a)]))
      if (names.size === 0) return
      const library = schemaLibrary(d)
      if (library) {
        checks.push({ kind: 'schema', library, text: calleeText(d), params: [...names], loc: this.#loc(d) })
        return
      }
      const name = calleeName(d)
      if (name === 'assert' || name === 'invariant') {
        checks.push({ kind: 'manual', text: oneLine(d.getText()), params: [...names], loc: this.#loc(d) })
        return
      }
      const callee = this.#callee(d)
      if (!callee || depth >= 3 || !this.#follows(callee) || !isFunctionLike(callee)) return
      const helperParams = callee.getParameters()
      const covered = new Set<string>()
      args.forEach((arg, i) => {
        const param = helperParams[i]
        if (!param) return
        const inner = paramsOf(param)
        if (inner.length > 0 && this.#inputChecks(callee, inner, depth + 1).length > 0)
          for (const n of from(arg)) covered.add(n)
      })
      if (covered.size > 0)
        checks.push({ kind: 'helper', text: `${calleeText(d)}()`, params: [...covered], loc: this.#loc(d) })
    })
    return checks
  }

  // --- Helpers ---------------------------------------------------------------------------------

  #callee(call: CallExpression): FunctionLike | undefined {
    const symbol = call.getExpression().getSymbol()
    const decl = symbol ? unalias(symbol).getDeclarations()[0] : undefined
    const fn = functionOf(decl)
    return fn && isFunctionLike(fn) ? fn : undefined
  }

  /** Project code the config scans. */
  #follows(fn: Node): boolean {
    return isProject(fn) && this.#input.scanned(fn.getSourceFile().getFilePath())
  }

  /** The functions a value is: an inline function or a reference to one. */
  #functionsOf(value: Node): FunctionLike[] {
    const inner = skipWrappers(value)
    if (isFunctionLike(inner)) return [inner]
    const symbol = inner.getSymbol()
    const fn = symbol ? functionOf(unalias(symbol).getDeclarations()[0]) : undefined
    return fn && isFunctionLike(fn) && isProject(fn) ? [fn] : []
  }

  #loc(node: Node): SourceLoc {
    const file = node.getSourceFile()
    const { line, column } = file.getLineAndColumnAtPos(node.getStart())
    return { file: relativeTo(this.#input.root, file.getFilePath()), line, column }
  }
}

interface Param {
  name: string
  symbol: ts.Symbol
}

/** The parameters a function reads (a destructured one by each name), in order. */
function readParams(fn: FunctionLike): Param[] {
  const all = fn.getParameters().flatMap(paramsOf)
  if (all.length === 0) return []
  const read = new Set<ts.Symbol>()
  const body = fn.getBody()
  body?.forEachDescendant((d) => {
    if (!N.isIdentifier(d)) return
    const s = valueSymbol(d)
    if (s) read.add(s)
  })
  return all.filter((p) => read.has(p.symbol))
}

function paramsOf(param: Node): Param[] {
  if (!N.isParameterDeclaration(param)) return []
  return bindingNames(param.getNameNode())
}

function bindingNames(name: Node): Param[] {
  if (N.isIdentifier(name)) {
    const s = name.getSymbol()?.compilerSymbol
    return s ? [{ name: name.getText(), symbol: s }] : []
  }
  if (N.isObjectBindingPattern(name) || N.isArrayBindingPattern(name)) {
    return name.getElements().flatMap((e) => (N.isBindingElement(e) ? bindingNames(e.getNameNode()) : []))
  }
  return []
}

function boundSymbols(name: Node): ts.Symbol[] {
  return bindingNames(name).map((p) => p.symbol)
}

/** The variable an identifier reads: for `{ id }` shorthand, the variable, not the property. */
function valueSymbol(id: Node): ts.Symbol | undefined {
  const parent = id.getParent()
  let symbol: TsSymbol | undefined
  if (parent && N.isShorthandPropertyAssignment(parent) && parent.getNameNode() === id)
    symbol = parent.getValueSymbol()
  else symbol = id.getSymbol()
  return symbol?.compilerSymbol
}

/** Variables written to inside a statement: `x = ...`, `x.y = ...`, `x.push(...)`. */
function writtenIn(statement: Node): ts.Symbol[] {
  const out: ts.Symbol[] = []
  const visit = (d: Node) => {
    let target: Node | undefined
    if (N.isBinaryExpression(d) && d.getOperatorToken().getKind() === ts.SyntaxKind.EqualsToken)
      target = d.getLeft()
    else if (N.isCallExpression(d)) {
      const callee = d.getExpression()
      if (N.isPropertyAccessExpression(callee)) target = callee.getExpression()
    }
    const root = target ? rootOf(target) : undefined
    const s = root ? valueSymbol(root) : undefined
    if (s) out.push(s)
  }
  visit(statement)
  statement.forEachDescendant(visit)
  return out
}

/** `a.b.c` / `a[0].b` -> `a`. */
function rootOf(node: Node): Node | undefined {
  let current = skipWrappers(node)
  while (
    N.isPropertyAccessExpression(current) ||
    N.isElementAccessExpression(current) ||
    N.isCallExpression(current)
  )
    current = skipWrappers(current.getExpression())
  return N.isIdentifier(current) ? current : undefined
}

/** The validation library behind a parse call: `PostSchema.safeParse()`, `v.parse()`. */
function schemaLibrary(call: CallExpression): string | undefined {
  const name = calleeName(call)
  if (!name || !SCHEMA_CALLS.has(name)) return undefined
  const expr = call.getExpression()
  const target = N.isPropertyAccessExpression(expr) ? expr.getNameNode() : expr
  for (const decl of target.getSymbol()?.getDeclarations() ?? []) {
    const m = SCHEMA_PACKAGES.exec(decl.getSourceFile().getFilePath())
    if (m) return m[1]
  }
  return undefined
}

/** The receiver is a built-in object (`Map`, `URLSearchParams`, `FormData`, Next's cookies). */
function builtinReceiver(receiver: Node): boolean {
  const type = receiver.getType()
  const symbol = type.getSymbol() ?? type.getAliasSymbol()
  const decl = symbol?.getDeclarations()[0]
  if (!decl) return type.isString() || type.isNumber() || type.isArray()
  const path = decl.getSourceFile().getFilePath()
  return /\/typescript\/lib\/|\/node_modules\/next\/|\/@types\/react\//.test(path)
}

/** The method of a `fetch` init: `'GET'` when it has none, undefined when it can't be read. */
function methodOf(init: Node | undefined): string | undefined {
  if (!init) return 'GET'
  let value = skipWrappers(init)
  if (N.isIdentifier(value)) {
    const decl = value.getSymbol()?.getDeclarations()[0]
    const written = decl && N.isVariableDeclaration(decl) ? decl.getInitializer() : undefined
    if (!written) return undefined
    value = skipWrappers(written)
  }
  if (!N.isObjectLiteralExpression(value)) return undefined
  const prop = value.getProperty('method')
  if (!prop) return value.getProperties().some((p) => N.isSpreadAssignment(p)) ? undefined : 'GET'
  if (!N.isPropertyAssignment(prop)) return undefined
  const written = prop.getInitializer()
  const text = written ? literalHead(written) : ''
  return text ? text.toUpperCase() : undefined
}

/** The text of a string literal, or the start of a template. */
function literalHead(node: Node | undefined): string {
  if (!node) return ''
  const n = skipWrappers(node)
  if (N.isStringLiteral(n) || N.isNoSubstitutionTemplateLiteral(n)) return n.getLiteralValue()
  if (N.isTemplateExpression(n)) return n.getHead().getLiteralText()
  return ''
}

function templateHead(template: Node): string {
  if (N.isNoSubstitutionTemplateLiteral(template)) return template.getLiteralValue()
  if (N.isTemplateExpression(template)) return template.getHead().getLiteralText()
  return ''
}

function calleeName(call: CallExpression): string | undefined {
  const expr = call.getExpression()
  if (N.isPropertyAccessExpression(expr)) return expr.getName()
  if (N.isIdentifier(expr)) return expr.getText()
  return undefined
}

function calleeText(call: CallExpression): string {
  return oneLine(call.getExpression().getText())
}

/** A call to an imported project name whose import doesn't resolve. */
function unresolvedImport(call: CallExpression): boolean {
  const expr = call.getExpression()
  const root = rootOf(expr)
  if (!root) return false
  const module = importModuleOf(root)
  if (!module || isPackage(module)) return false
  const symbol = root.getSymbol()
  return !!symbol && symbol.isAlias() && (symbol.getAliasedSymbol()?.getDeclarations().length ?? 0) === 0
}

/** `x.use(a).schema(s).action(fn)`: the calls from the outermost in, through a variable holding the start. */
function chainOf(call: CallExpression): CallExpression[] {
  const out: CallExpression[] = []
  let current: Node = call
  for (let i = 0; i < 20; i++) {
    current = skipWrappers(current)
    if (N.isCallExpression(current)) {
      out.push(current)
      const expr = current.getExpression()
      if (!N.isPropertyAccessExpression(expr)) break
      current = expr.getExpression()
      continue
    }
    if (N.isIdentifier(current)) {
      const decl = current.getSymbol()?.getDeclarations()[0]
      const init =
        decl && N.isVariableDeclaration(decl) && isProject(decl) ? decl.getInitializer() : undefined
      if (!init) break
      current = init
      continue
    }
    break
  }
  return out
}

/** Leaves the caller too: `throw`, `redirect()`, `notFound()`, `forbidden()`, `unauthorized()`, or a block ending in one. */
function throwsOut(statement: Node): boolean {
  if (N.isThrowStatement(statement)) return true
  if (N.isBlock(statement)) {
    const last = statement.getStatements().at(-1)
    return !!last && throwsOut(last)
  }
  const expr = N.isExpressionStatement(statement)
    ? statement.getExpression()
    : N.isReturnStatement(statement)
      ? statement.getExpression()
      : undefined
  const inner = expr ? skipWrappers(expr) : undefined
  if (!inner || !N.isCallExpression(inner)) return false
  const nav = navigationCall(inner)
  return !!renderExitCall(inner) || nav?.kind === 'redirect' || nav?.kind === 'permanent-redirect'
}

/** A function returned by another one (a wrapper's result). */
function isReturned(fn: Node): boolean {
  const parent = fn.getParent()
  return !!parent && (N.isReturnStatement(parent) || (N.isArrowFunction(parent) && parent.getBody() === fn))
}

/** The functions a wrapper returns, or the wrapper itself when it returns none. */
function innerFunctions(wrapper: FunctionLike): FunctionLike[] {
  const out: FunctionLike[] = []
  wrapper.forEachDescendant((d) => {
    if (isFunctionLike(d) && isReturned(d)) out.push(d)
  })
  return out.length > 0 ? out : [wrapper]
}

/** One change per kind, text and place. */
function dedupe(list: At<ActionChange>[]): At<ActionChange>[] {
  const seen = new Set<string>()
  return list.filter((c) => {
    const key = `${c.item.kind}|${c.item.text}|${c.item.loc.file}:${c.item.loc.line}:${c.item.loc.column}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
