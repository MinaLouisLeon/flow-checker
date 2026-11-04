// Request performance (M47): requests that wait for each other for no reason (waterfalls), requests
// sent once per item of a list (N+1) and the same request sent from more than one place on one page
// load (duplicates). Each site's call path says where its calls are; this pass finds those calls in
// the code and looks at the `await`s and loops around them. It works on compiler nodes: wrapping
// every node in ts-morph was the cost of M43's first version.
import {
  type Component,
  endpointKeyOf,
  makeId,
  type PerfFinding,
  type PerfLoop,
  type PerfMap,
  type PerfStep,
  type RequestSite,
  type Route,
  requestLabel,
  type SourceLoc,
} from '@flow-checker/shared'
import { type SourceFile, ts } from 'ts-morph'
import { componentsBelow } from './access'
import { compare } from './paths'
import { oneLine } from './requests'

export interface PerfInput {
  routes: Route[]
  components: Component[]
  sites: RequestSite[]
  /** The source file of a project-relative path, when it is scanned. */
  fileOf: (file: string) => SourceFile | undefined
}

/** Triggers that run on the server while a request is answered: waterfalls are looked for there. */
const SERVER_TRIGGERS = new Set<RequestSite['trigger']['kind']>([
  'server-render',
  'route-handler',
  'server-action',
  'middleware',
])
/** Triggers that run without a user doing something: N+1 requests are looked for there. */
const LOAD_TRIGGERS = new Set<RequestSite['trigger']['kind']>([
  'server-render',
  'page-load',
  'effect',
  'route-handler',
  'server-action',
  'middleware',
])
/** Triggers of a page load: duplicates are looked for there. */
const PAGE_LOAD_TRIGGERS = new Set<RequestSite['trigger']['kind']>(['server-render', 'page-load', 'effect'])

/** Array methods that call their callback once per item. */
const ITERATION_METHODS = new Set([
  'map',
  'forEach',
  'flatMap',
  'filter',
  'reduce',
  'reduceRight',
  'some',
  'every',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
])

/** Calls that end the render or the request: a statement with one decides whether later code runs. */
const EXIT_CALLS = new Set(['redirect', 'permanentRedirect', 'notFound', 'forbidden', 'unauthorized'])

/** React's `cache()` and Next's `unstable_cache()` dedupe calls of the function they wrap. */
const DEDUPE_WRAPPERS = /^(React\.)?cache$|^unstable_cache$/

/** Options that hand a query library the function it runs. */
const QUERY_FN_PROPS = new Set(['queryFn', 'fetcher'])

interface Located {
  file: string
  sf: ts.SourceFile
  node: ts.Node
}

export function buildPerf(input: PerfInput): PerfMap | undefined {
  const finder = new PerfFinder(input)
  const findings = [
    ...finder.waterfalls(),
    ...finder.loops(),
    ...finder.renderLoops(),
    ...finder.duplicates(),
  ]
  if (findings.length === 0) return undefined
  // One finding per id: a loop reached from two pages is still one loop.
  const byId = new Map<string, PerfFinding>()
  for (const f of findings) {
    const known = byId.get(f.id)
    if (!known) byId.set(f.id, f)
    else {
      known.siteIds = [...new Set([...known.siteIds, ...f.siteIds])].sort(compare)
      known.routeIds = [...new Set([...known.routeIds, ...f.routeIds])].sort(compare)
    }
  }
  return {
    findings: [...byId.values()].sort(
      (a, b) =>
        compare(a.loc.file, b.loc.file) ||
        a.loc.line - b.loc.line ||
        a.loc.column - b.loc.column ||
        compare(a.kind, b.kind),
    ),
  }
}

class PerfFinder {
  readonly #input: PerfInput
  readonly #files = new Map<string, ts.SourceFile | undefined>()
  readonly #calls = new Map<string, ts.Node | undefined>()
  readonly #pagesOf: Map<string, string[]>
  readonly #below: (id: string) => string[]
  readonly #componentsById: Map<string, Component>
  /** File → call position → the sites whose call path goes through that call. */
  readonly #sitesAt = new Map<string, Map<number, RequestSite[]>>()

  constructor(input: PerfInput) {
    this.#input = input
    this.#below = componentsBelow(input.components)
    this.#componentsById = new Map(input.components.map((c) => [c.id, c]))
    this.#pagesOf = pagesByComponent(input.routes, this.#below)
    for (const site of input.sites) {
      for (const frame of site.callStack) {
        const at = this.#call(frame)
        if (!at) continue
        let byPos = this.#sitesAt.get(at.file)
        if (!byPos) {
          byPos = new Map()
          this.#sitesAt.set(at.file, byPos)
        }
        const list = byPos.get(at.node.pos)
        if (list) {
          if (!list.includes(site)) list.push(site)
        } else byPos.set(at.node.pos, [site])
      }
    }
  }

  // --- Waterfalls ----------------------------------------------------------------------------

  *waterfalls(): Generator<PerfFinding> {
    // Function → its awaited request calls.
    const byFn = new Map<ts.Node, { file: string; sf: ts.SourceFile; awaits: Map<ts.Node, RequestSite[]> }>()
    for (const site of this.#input.sites) {
      if (!SERVER_TRIGGERS.has(site.trigger.kind) || site.conditional || !isRead(site)) continue
      for (const frame of site.callStack) {
        const at = this.#call(frame)
        if (!at) continue
        const awaited = awaitOf(at.node)
        if (!awaited) continue
        const fn = enclosingFunction(awaited)
        if (!fn || loopBetween(awaited, fn)) continue
        let entry = byFn.get(fn)
        if (!entry) {
          entry = { file: at.file, sf: at.sf, awaits: new Map() }
          byFn.set(fn, entry)
        }
        const list = entry.awaits.get(awaited)
        if (list) {
          if (!list.includes(site)) list.push(site)
        } else entry.awaits.set(awaited, [site])
      }
    }
    for (const [fn, { file, sf, awaits }] of byFn) {
      if (awaits.size < 2) continue
      // A step whose call also sends a write isn't a read: leave the whole call out.
      const nodes = [...awaits.keys()]
        .filter((n) => !this.#sitesThrough(file, n).some((s) => !isRead(s)))
        .sort((a, b) => a.pos - b.pos)
      if (nodes.length < 2) continue
      const related = new Set<number>()
      const needs = nodes.map(() => new Set<number>())
      let late = -1
      for (let j = 1; j < nodes.length; j++) {
        for (let i = 0; i < j; i++) {
          const order = sequence(nodes[i] as ts.Node, nodes[j] as ts.Node)
          if (order === 'exclusive') continue
          related.add(i)
          related.add(j)
          if (order === 'depends') needs[j]?.add(i)
          else if (late < 0) late = j
        }
      }
      if (late < 0) continue
      const kept = [...related].sort((a, b) => a - b)
      const index = new Map(kept.map((k, n) => [k, n]))
      const steps: PerfStep[] = kept.map((k) => {
        const node = nodes[k] as ts.AwaitExpression
        return {
          text: callText(node.expression, sf),
          siteIds: (awaits.get(node) ?? []).map((s) => s.id).sort(compare),
          needs: [...(needs[k] ?? [])].flatMap((i) => (index.has(i) ? [index.get(i) as number] : [])),
          loc: locOf(file, sf, node.expression),
        }
      })
      const sites = [...awaits.values()].flat()
      const lateNode = nodes[late] as ts.AwaitExpression
      yield {
        id: makeId('pf', 'waterfall', file, String(fn.pos)),
        kind: 'waterfall',
        side: 'server',
        fn: functionName(fn),
        ...this.#owner(sites),
        siteIds: [...new Set(steps.flatMap((s) => s.siteIds))].sort(compare),
        steps,
        routeIds: this.#pages(sites),
        loc: locOf(file, sf, lateNode.expression),
      }
    }
  }

  // --- N+1 -----------------------------------------------------------------------------------

  *loops(): Generator<PerfFinding> {
    const byLoop = new Map<
      ts.Node,
      { file: string; sf: ts.SourceFile; loop: LoopFound; sites: RequestSite[]; sequential: boolean }
    >()
    for (const site of this.#input.sites) {
      if (!LOAD_TRIGGERS.has(site.trigger.kind)) continue
      if (site.transport === 'sse' || site.transport === 'websocket') continue
      for (const frame of site.callStack) {
        const at = this.#call(frame)
        if (!at) continue
        const loop = loopAround(at.node)
        if (!loop || overLiteral(loop, at.sf) || goesOnByAnswer(loop)) continue
        let entry = byLoop.get(loop.node)
        if (!entry) {
          entry = { file: at.file, sf: at.sf, loop, sites: [], sequential: false }
          byLoop.set(loop.node, entry)
        }
        if (!entry.sites.includes(site)) entry.sites.push(site)
        if (loop.kind !== 'callback' && awaitedIn(at.node, loop.node)) entry.sequential = true
      }
    }
    for (const [node, { file, sf, loop, sites, sequential }] of byLoop) {
      const fn = enclosingFunction(node)
      const list = loop.over ? this.#listSites(file, loop.over, fn) : []
      const listIds = list.filter((s) => !sites.includes(s)).map((s) => s.id)
      yield {
        id: makeId('pf', 'n-plus-one', file, String(node.pos)),
        kind: 'n-plus-one',
        side: sites.some((s) => SERVER_TRIGGERS.has(s.trigger.kind)) ? 'server' : 'client',
        ...(fn ? { fn: functionName(fn) } : {}),
        ...this.#owner(sites),
        siteIds: sites.map((s) => s.id).sort(compare),
        loop: loopInfo(file, sf, loop),
        ...(sequential ? { sequential: true as const } : {}),
        ...(listIds.length > 0 ? { listSiteIds: [...new Set(listIds)].sort(compare) } : {}),
        routeIds: this.#pages(sites),
        loc: locOf(file, sf, node),
      }
    }
  }

  /** A component rendered once per item that sends a request itself (`items.map((i) => <Row />)`). */
  *renderLoops(): Generator<PerfFinding> {
    const byComponent = new Map<string, RequestSite[]>()
    for (const site of this.#input.sites) {
      if (!site.componentId || !PAGE_LOAD_TRIGGERS.has(site.trigger.kind)) continue
      if (site.transport === 'server-action' || site.transport === 'sse' || site.transport === 'websocket')
        continue
      // The same URL for every item is one request (deduped) or a duplicate, not one per item.
      if (!hasParams(site)) continue
      const list = byComponent.get(site.componentId)
      if (list) list.push(site)
      else byComponent.set(site.componentId, [site])
    }
    if (byComponent.size === 0) return
    for (const parent of this.#input.components) {
      for (const ref of parent.children) {
        if (!ref.componentId) continue
        const sites = this.#below(ref.componentId).flatMap((id) => byComponent.get(id) ?? [])
        if (sites.length === 0) continue
        const at = this.#element(ref.loc)
        if (!at) continue
        const loop = loopAround(at.node)
        if (!loop || overLiteral(loop, at.sf) || goesOnByAnswer(loop)) continue
        const child = this.#componentsById.get(ref.componentId)
        yield {
          id: makeId('pf', 'n-plus-one', at.file, String(at.node.pos)),
          kind: 'n-plus-one',
          side: sites.some((s) => s.trigger.kind === 'server-render') ? 'server' : 'client',
          fn: parent.name,
          componentId: parent.id,
          siteIds: [...new Set(sites.map((s) => s.id))].sort(compare),
          loop: {
            kind: 'render',
            text: `<${child?.name ?? ref.name}>`,
            ...(loop.over ? { over: oneLine(loop.over.getText(at.sf)) } : {}),
            loc: locOf(at.file, at.sf, at.node),
          },
          routeIds: this.#pages(sites),
          loc: locOf(at.file, at.sf, at.node),
        }
      }
    }
  }

  // --- Duplicates ----------------------------------------------------------------------------

  *duplicates(): Generator<PerfFinding> {
    const byComponent = new Map<string, RequestSite[]>()
    for (const site of this.#input.sites) {
      if (!site.componentId || !PAGE_LOAD_TRIGGERS.has(site.trigger.kind) || site.conditional) continue
      if (!this.#mayRepeat(site) || this.#branchInHelper(site)) continue
      const list = byComponent.get(site.componentId)
      if (list) list.push(site)
      else byComponent.set(site.componentId, [site])
    }
    if (byComponent.size === 0) return
    // Sites sent twice → pages where both run on load.
    const groups = new Map<string, { sites: RequestSite[]; routeIds: Set<string> }>()
    for (const route of this.#input.routes) {
      if (route.kind !== 'page') continue
      const roots = [
        ...route.layoutChain.flatMap((l) => (l.componentId ? [l.componentId] : [])),
        ...(route.componentId ? [route.componentId] : []),
      ]
      const ids = new Set(roots.flatMap((r) => this.#below(r)))
      const byKey = new Map<string, RequestSite[]>()
      for (const id of ids) {
        for (const site of byComponent.get(id) ?? []) {
          const key = this.#repeatKey(site)
          if (!key) continue
          const list = byKey.get(key)
          if (list) {
            if (!list.includes(site)) list.push(site)
          } else byKey.set(key, [site])
        }
      }
      for (const list of byKey.values()) {
        if (list.length < 2) continue
        const sorted = [...list].sort((a, b) => compare(a.id, b.id))
        const groupKey = sorted.map((s) => s.id).join(' ')
        const group = groups.get(groupKey) ?? { sites: sorted, routeIds: new Set<string>() }
        group.routeIds.add(route.id)
        groups.set(groupKey, group)
      }
    }
    for (const { sites, routeIds } of groups.values()) {
      const ordered = [...sites].sort((a, b) => compareLoc(a.callStack[0], b.callStack[0]))
      const second = ordered[1] as RequestSite
      const loc = second.callStack[0] ?? second.trigger.loc
      if (!loc) continue
      const { callee: _, ...at } = loc as SourceLoc & { callee?: string }
      yield {
        id: makeId('pf', 'duplicate', ...ordered.map((s) => s.id)),
        kind: 'duplicate',
        side: second.trigger.kind === 'server-render' ? 'server' : 'client',
        ...this.#owner(ordered),
        siteIds: ordered.map((s) => s.id),
        request: requestLabel(second),
        routeIds: [...routeIds].sort(compare),
        loc: at,
      }
    }
  }

  /** Nothing dedupes it: Next dedupes a server component's `GET` `fetch`, query libraries their keys. */
  #mayRepeat(site: RequestSite): boolean {
    if (site.hook || site.queryKey) return false
    if (['server-action', 'sse', 'websocket', 'trpc', 'graphql'].includes(site.transport)) return false
    if (!site.url?.path) return false
    const server = site.trigger.kind === 'server-render'
    const method = site.method ?? 'GET'
    if (server && site.transport === 'fetch' && (method === 'GET' || method === 'HEAD')) return false
    // A function wrapped in React's `cache()` runs once per render.
    if (server && site.callStack.some((frame) => this.#dedupedCall(frame))) return false
    // Handed to a hook as `queryFn` (often through a project hook the scan doesn't read as a query):
    // the query library runs it, and dedupes by key.
    if (site.callStack.some((frame) => this.#inQueryFn(frame))) return false
    return true
  }

  #inQueryFn(frame: SourceLoc): boolean {
    const at = this.#call(frame)
    for (let fn = at && enclosingFunction(at.node); fn; fn = enclosingFunction(fn)) {
      let holder = fn.parent
      while (holder && ts.isParenthesizedExpression(holder)) holder = holder.parent
      if (
        holder &&
        ts.isPropertyAssignment(holder) &&
        (ts.isIdentifier(holder.name) || ts.isStringLiteral(holder.name)) &&
        QUERY_FN_PROPS.has(holder.name.text)
      )
        return true
    }
    return false
  }

  /**
   * The call path goes through a branch inside a function the component calls (`if (isUpload)
   * return upload(...)` in a shared `request()`): whether it runs depends on each caller's
   * arguments, so two callers aren't known to send it. A branch in the component's own code
   * (the first frame) still counts.
   */
  #branchInHelper(site: RequestSite): boolean {
    for (const frame of site.callStack.slice(1)) {
      const at = this.#call(frame)
      if (at && inBranch(at.node)) return true
    }
    return false
  }

  /**
   * Same method and URL. A URL with parts only known at runtime is the same request only when both
   * places call with the same arguments (`getUser(userId)` in a layout and its page).
   */
  #repeatKey(site: RequestSite): string | undefined {
    const side = site.trigger.kind === 'server-render' ? 'server' : 'client'
    const key = `${side} ${endpointKeyOf(site)}`
    if (!hasParams(site)) return key
    const first = site.callStack[0]
    const at = first && this.#call(first)
    return at ? `${key} ${at.node.getText(at.sf).replace(/\s+/g, '')}` : undefined
  }

  #dedupedCall(frame: SourceLoc): boolean {
    const at = this.#call(frame)
    if (!at || !ts.isCallExpression(at.node)) return false
    const file = this.#input.fileOf(at.file)
    if (!file) return false
    try {
      const callee = file.getDescendantAtPos(at.node.expression.getEnd() - 1)
      const symbol = callee?.getSymbol()
      const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol
      for (const decl of target?.getDeclarations() ?? []) {
        const init =
          decl.compilerNode && ts.isVariableDeclaration(decl.compilerNode)
            ? decl.compilerNode.initializer
            : undefined
        if (
          init &&
          ts.isCallExpression(init) &&
          DEDUPE_WRAPPERS.test(init.expression.getText(decl.getSourceFile().compilerNode))
        )
          return true
      }
    } catch {}
    return false
  }

  // --- Helpers -------------------------------------------------------------------------------

  /** The call (or `new`) a call-stack frame points at. */
  #call(loc: SourceLoc): Located | undefined {
    const key = `${loc.file}:${loc.line}:${loc.column}`
    if (this.#calls.has(key)) {
      const node = this.#calls.get(key)
      const sf = this.#sf(loc.file)
      return node && sf ? { file: loc.file, sf, node } : undefined
    }
    const sf = this.#sf(loc.file)
    const node = sf ? nodeAt(sf, loc, isCallLike) : undefined
    this.#calls.set(key, node)
    return node && sf ? { file: loc.file, sf, node } : undefined
  }

  /** The JSX element a component reference points at. */
  #element(loc: SourceLoc): Located | undefined {
    const sf = this.#sf(loc.file)
    const node = sf ? nodeAt(sf, loc, isJsx) : undefined
    return node && sf ? { file: loc.file, sf, node } : undefined
  }

  #sf(file: string): ts.SourceFile | undefined {
    if (!this.#files.has(file)) this.#files.set(file, this.#input.fileOf(file)?.compilerNode)
    return this.#files.get(file)
  }

  /** Sites whose call path goes through a call inside `node`. */
  #sitesThrough(file: string, node: ts.Node): RequestSite[] {
    const byPos = this.#sitesAt.get(file)
    if (!byPos) return []
    const out: RequestSite[] = []
    for (const [pos, sites] of byPos) if (pos >= node.pos && pos < node.end) out.push(...sites)
    return [...new Set(out)]
  }

  /** The requests a list comes from: `posts` declared from an awaited request in the same function. */
  #listSites(file: string, over: ts.Expression, fn: ts.Node | undefined): RequestSite[] {
    const name = rootName(over)
    if (!name) return []
    const scope = fn && 'body' in fn ? (fn as ts.FunctionLikeDeclaration).body : undefined
    if (!scope) return []
    const out: RequestSite[] = []
    const visit = (node: ts.Node) => {
      if (isFunctionNode(node)) return
      if (ts.isVariableDeclaration(node) && node.initializer && bindingNames(node.name).includes(name)) {
        out.push(...this.#sitesThrough(file, node.initializer))
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(scope, visit)
    return out
  }

  #owner(sites: RequestSite[]): { componentId?: string; routeId?: string } {
    const first = sites[0]
    if (!first) return {}
    if (first.componentId) return { componentId: first.componentId }
    if (first.origin === 'route-handler' && first.routeId) return { routeId: first.routeId }
    return {}
  }

  /** Pages a site slows down: pages that render its component, call its route handler or its action. */
  #pages(sites: RequestSite[]): string[] {
    const out = new Set<string>()
    for (const site of sites) {
      if (site.componentId) for (const id of this.#pagesOf.get(site.componentId) ?? []) out.add(id)
      if (site.origin === 'route-handler' && site.routeId) {
        for (const caller of this.#input.sites) {
          if (caller.targetRouteId !== site.routeId || !caller.componentId) continue
          if (site.handlerMethod && caller.method && caller.method !== site.handlerMethod) continue
          for (const id of this.#pagesOf.get(caller.componentId) ?? []) out.add(id)
        }
      }
      if (site.origin === 'server-action' && site.serverAction) {
        const { file, line } = site.serverAction.loc
        for (const caller of this.#input.sites) {
          const ref = caller.serverAction
          if (caller.transport !== 'server-action' || !caller.componentId || !ref) continue
          if (ref.loc.file !== file || ref.loc.line !== line) continue
          for (const id of this.#pagesOf.get(caller.componentId) ?? []) out.add(id)
        }
      }
    }
    return [...out].sort(compare)
  }
}

// --- Order and dependencies ------------------------------------------------------------------

/**
 * How two awaits in one function run: `exclusive` (other branches, or the second only runs when the
 * first gives a certain value), `depends` (the second uses the first's result, or runs only after a
 * check of it) or `sequential` (the second waits for the first for nothing).
 */
function sequence(first: ts.Node, second: ts.Node): 'exclusive' | 'depends' | 'sequential' {
  if (second.pos >= first.pos && second.end <= first.end) return 'depends'
  const common = commonAncestor(first, second)
  if (!common) return 'exclusive'
  if (isStatementList(common)) {
    const statements = statementsOf(common)
    const a = statements.findIndex((s) => contains(s, first))
    const b = statements.findIndex((s) => contains(s, second))
    if (a < 0 || b < 0 || a >= b) return 'exclusive'
    const tainted = new Set(bindings(statements[a] as ts.Node))
    if (tainted.size === 0) return 'sequential'
    for (let i = a + 1; i < b; i++) {
      const s = statements[i] as ts.Node
      if (!references(s, tainted)) continue
      if (canExit(s)) return 'depends'
      for (const name of bindings(s)) tainted.add(name)
    }
    return references(statements[b] as ts.Node, tainted) ? 'depends' : 'sequential'
  }
  // In one statement: branches and short-circuits decide whether the second runs.
  for (let n: ts.Node | undefined = common; n && !isStatementList(n); n = n.parent) {
    if (
      ts.isConditionalExpression(n) ||
      ts.isIfStatement(n) ||
      ts.isTryStatement(n) ||
      ts.isSwitchStatement(n) ||
      (ts.isBinaryExpression(n) &&
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(n.operatorToken.kind))
    )
      return 'exclusive'
    if (ts.isVariableStatement(n) || ts.isExpressionStatement(n) || ts.isReturnStatement(n)) break
  }
  // `const a = await x(), b = await y(a)`.
  const decl = ancestor(first, ts.isVariableDeclaration)
  if (decl && !contains(decl, second) && references(second, new Set(bindingNames(decl.name))))
    return 'depends'
  return 'sequential'
}

/** The `await` right around a call: `await f()`, `await (await f()).json()`, `await f().then(...)`. */
function awaitOf(call: ts.Node): ts.AwaitExpression | undefined {
  let current = call
  for (;;) {
    const parent = current.parent
    if (!parent) return undefined
    if (
      ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isNonNullExpression(parent) ||
      ts.isSatisfiesExpression(parent) ||
      ts.isTypeAssertionExpression(parent)
    ) {
      current = parent
      continue
    }
    if (
      ts.isPropertyAccessExpression(parent) &&
      parent.expression === current &&
      parent.parent &&
      ts.isCallExpression(parent.parent) &&
      parent.parent.expression === parent
    ) {
      current = parent.parent
      continue
    }
    // `await Promise.all([a(), b()])`: the calls run together, and the await waits for all of them.
    if (
      ts.isArrayLiteralExpression(parent) &&
      parent.parent &&
      ts.isCallExpression(parent.parent) &&
      parent.parent.arguments[0] === parent &&
      isPromiseCombinator(parent.parent.expression)
    ) {
      current = parent.parent
      continue
    }
    return ts.isAwaitExpression(parent) ? parent : undefined
  }
}

/** `Promise.all`, `Promise.allSettled`, `Promise.race`, `Promise.any`. */
function isPromiseCombinator(callee: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === 'Promise' &&
    ['all', 'allSettled', 'race', 'any'].includes(callee.name.text)
  )
}

/** The call is awaited inside the loop's body, without a function in between. */
function awaitedIn(call: ts.Node, loop: ts.Node): boolean {
  if (ts.isForOfStatement(loop) && loop.awaitModifier) return true
  for (let n: ts.Node | undefined = call; n && n !== loop; n = n.parent) {
    if (isFunctionNode(n)) return false
    if (ts.isAwaitExpression(n)) return true
  }
  return false
}

interface LoopFound {
  kind: PerfLoop['kind']
  /** The loop statement, or the call that takes the callback (`posts.map(...)`). */
  node: ts.Node
  /** What it goes through, when it has one. */
  over?: ts.Expression
}

/**
 * The innermost loop around a node within its function: a loop statement whose body holds it, or an
 * array method callback (climbing on to the function that calls the method).
 */
function loopAround(start: ts.Node): LoopFound | undefined {
  let child = start
  for (let n = start.parent; n; child = n, n = n.parent) {
    if (ts.isForOfStatement(n) || ts.isForInStatement(n)) {
      if (n.statement === child) return { kind: 'for', node: n, over: n.expression }
    } else if (ts.isForStatement(n)) {
      if (n.statement === child) return { kind: 'for', node: n }
    } else if (ts.isWhileStatement(n) || ts.isDoStatement(n)) {
      if (n.statement === child) return { kind: 'while', node: n }
    } else if (isFunctionNode(n)) {
      const call = n.parent
      if (!call || !ts.isCallExpression(call) || !call.arguments.includes(n as ts.Expression))
        return undefined
      const callee = call.expression
      if (ts.isPropertyAccessExpression(callee) && ITERATION_METHODS.has(callee.name.text)) {
        return { kind: 'callback', node: call, over: callee.expression }
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 'from' &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'Array' &&
        call.arguments[1] === n
      ) {
        return { kind: 'callback', node: call, ...(call.arguments[0] ? { over: call.arguments[0] } : {}) }
      }
      return undefined
    }
  }
  return undefined
}

/**
 * A `for` / `while` / `do` loop that goes on by what its own requests answered, not over items: no
 * condition or `while (true)` (a retry or polling that `break`s), or a condition that reads a name the
 * body sets from a value it got in the loop (`cursor = page.next`: the pages of one list).
 */
function goesOnByAnswer(loop: LoopFound): boolean {
  const node = loop.node
  let condition: ts.Expression | undefined
  if (ts.isForStatement(node)) {
    if (!node.condition) return true
    condition = node.condition
  } else if (ts.isWhileStatement(node) || ts.isDoStatement(node)) condition = node.expression
  else return false
  if (condition.kind === ts.SyntaxKind.TrueKeyword) return true
  const read = new Set<string>()
  const collect = (n: ts.Node) => {
    if (ts.isIdentifier(n) && isReference(n)) read.add(n.text)
    ts.forEachChild(n, collect)
  }
  collect(condition)
  const body = (node as ts.IterationStatement).statement
  const declared = new Set<string>()
  const assigned: ts.BinaryExpression[] = []
  const visit = (n: ts.Node) => {
    if (isFunctionNode(n)) return
    if (ts.isVariableDeclaration(n)) for (const name of bindingNames(n.name)) declared.add(name)
    if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(n.left) &&
      read.has(n.left.text)
    )
      assigned.push(n)
    ts.forEachChild(n, visit)
  }
  visit(body)
  return assigned.some((a) => references(a.right, declared))
}

/** A loop over a list written in the code (`['a', 'b'].map(...)`): a fixed number of requests. */
function overLiteral(loop: LoopFound, sf: ts.SourceFile): boolean {
  const over = loop.over && skipParens(loop.over)
  if (!over) return false
  if (ts.isArrayLiteralExpression(over) || ts.isObjectLiteralExpression(over)) return true
  if (!ts.isIdentifier(over)) return false
  // A name bound to a literal list in the function or the file.
  let found = false
  const visit = (node: ts.Node) => {
    if (found) return
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === over.text &&
      node.initializer
    ) {
      const init = skipParens(node.initializer)
      if (ts.isArrayLiteralExpression(init) || ts.isObjectLiteralExpression(init)) found = true
    }
    ts.forEachChild(node, visit)
  }
  const fn = enclosingFunction(loop.node)
  ts.forEachChild(fn ?? sf, visit)
  if (!found && fn) for (const s of sf.statements) if (ts.isVariableStatement(s)) visit(s)
  return found
}

function loopInfo(file: string, sf: ts.SourceFile, loop: LoopFound): PerfLoop {
  const node = loop.node
  let text: string
  if (ts.isCallExpression(node)) text = `${oneLine(node.expression.getText(sf))}()`
  else {
    const body = (node as ts.IterationStatement).statement
    text = oneLine(sf.text.slice(node.getStart(sf), body.getStart(sf)).trim())
    if (ts.isDoStatement(node)) text = `do ... while (${oneLine(node.expression.getText(sf))})`
  }
  return {
    kind: loop.kind,
    text,
    ...(loop.over ? { over: oneLine(loop.over.getText(sf)) } : {}),
    loc: locOf(file, sf, node),
  }
}

/** A loop between a node and the function it is in. */
function loopBetween(node: ts.Node, fn: ts.Node): boolean {
  let child = node
  for (let n = node.parent; n && n !== fn; child = n, n = n.parent) {
    if (
      (ts.isForOfStatement(n) ||
        ts.isForInStatement(n) ||
        ts.isForStatement(n) ||
        ts.isWhileStatement(n) ||
        ts.isDoStatement(n)) &&
      n.statement === child
    )
      return true
  }
  return false
}

/** Names a statement declares or assigns (not inside functions it defines). */
function bindings(statement: ts.Node): string[] {
  const out: string[] = []
  const visit = (node: ts.Node) => {
    if (isFunctionNode(node) || ts.isClassLike(node)) return
    if (ts.isVariableDeclaration(node)) out.push(...bindingNames(node.name))
    else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      out.push(...assignedNames(node.left))
    }
    ts.forEachChild(node, visit)
  }
  visit(statement)
  return out
}

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text]
  const out: string[] = []
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue
    out.push(...bindingNames(element.name))
  }
  return out
}

function assignedNames(target: ts.Expression): string[] {
  const node = skipParens(target)
  if (ts.isIdentifier(node)) return [node.text]
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const root = rootName(node)
    return root ? [root] : []
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap((e) => assignedNames(e))
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.flatMap((p) => {
      if (ts.isShorthandPropertyAssignment(p)) return [p.name.text]
      if (ts.isPropertyAssignment(p)) return assignedNames(p.initializer)
      if (ts.isSpreadAssignment(p)) return assignedNames(p.expression)
      return []
    })
  }
  if (ts.isSpreadElement(node)) return assignedNames(node.expression)
  return []
}

/** A name in the set is read somewhere in the node (closures too). */
function references(node: ts.Node, names: Set<string>): boolean {
  let found = false
  const visit = (n: ts.Node) => {
    if (found) return
    if (ts.isIdentifier(n) && names.has(n.text) && isReference(n)) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

function isReference(id: ts.Identifier): boolean {
  const parent = id.parent
  if (!parent) return true
  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false
  if (ts.isPropertyAssignment(parent) && parent.name === id) return false
  if (ts.isBindingElement(parent) && parent.propertyName === id) return false
  if ((ts.isVariableDeclaration(parent) || ts.isParameter(parent)) && parent.name === id) return false
  if (ts.isJsxAttribute(parent) && parent.name === id) return false
  if (ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) return parent.name !== id
  return true
}

/** The statement returns, throws or ends the render on some path (`if (!user) notFound()`). */
function canExit(statement: ts.Node): boolean {
  let found = false
  const visit = (n: ts.Node) => {
    if (found || isFunctionNode(n)) return
    if (ts.isReturnStatement(n) || ts.isThrowStatement(n)) found = true
    else if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && EXIT_CALLS.has(n.expression.text))
      found = true
    else ts.forEachChild(n, visit)
  }
  visit(statement)
  return found
}

// --- Node lookups ----------------------------------------------------------------------------

function isCallLike(node: ts.Node): boolean {
  return ts.isCallExpression(node) || ts.isNewExpression(node) || ts.isTaggedTemplateExpression(node)
}

function isJsx(node: ts.Node): boolean {
  return ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node) || ts.isJsxElement(node)
}

/** The outermost node of a kind that starts at a line and column. */
function nodeAt(sf: ts.SourceFile, loc: SourceLoc, test: (node: ts.Node) => boolean): ts.Node | undefined {
  let pos: number
  try {
    pos = sf.getPositionOfLineAndCharacter(loc.line - 1, loc.column - 1)
  } catch {
    return undefined
  }
  let found: ts.Node | undefined
  const visit = (node: ts.Node): void => {
    if (found || pos < node.pos || pos >= node.end) return
    if (test(node) && node.getStart(sf) === pos) {
      found = node
      return
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(sf, visit)
  return found
}

function isFunctionNode(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  )
}

/**
 * Runs on some paths of its function only: inside an `if` / `switch`, a ternary branch or the right
 * side of `&&` / `||` / `??` (code after an early `return` doesn't count).
 */
function inBranch(node: ts.Node): boolean {
  let child = node
  for (let parent = node.parent; parent && !isFunctionNode(parent); parent = parent.parent) {
    if (ts.isConditionalExpression(parent) && child !== parent.condition) return true
    if (
      ts.isBinaryExpression(parent) &&
      child === parent.right &&
      (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        parent.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    )
      return true
    if (ts.isIfStatement(parent) && child !== parent.expression) return true
    if (ts.isCaseClause(parent) || ts.isDefaultClause(parent)) return true
    child = parent
  }
  return false
}

function enclosingFunction(node: ts.Node): ts.Node | undefined {
  for (let n = node.parent; n; n = n.parent) if (isFunctionNode(n)) return n
  return undefined
}

function functionName(fn: ts.Node): string {
  const named = fn as ts.FunctionLikeDeclaration
  if (named.name && ts.isIdentifier(named.name)) return named.name.text
  const parent = fn.parent
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text
  if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text
  // `const getUser = cache(async () => ...)`.
  const call = parent && ts.isCallExpression(parent) ? parent.parent : undefined
  if (call && ts.isVariableDeclaration(call) && ts.isIdentifier(call.name)) return call.name.text
  return 'anonymous'
}

function isStatementList(node: ts.Node): boolean {
  return ts.isBlock(node) || ts.isSourceFile(node) || ts.isCaseClause(node) || ts.isDefaultClause(node)
}

function statementsOf(node: ts.Node): readonly ts.Statement[] {
  if (ts.isBlock(node) || ts.isSourceFile(node) || ts.isCaseClause(node) || ts.isDefaultClause(node))
    return node.statements
  return []
}

function contains(outer: ts.Node, inner: ts.Node): boolean {
  return inner.pos >= outer.pos && inner.end <= outer.end
}

function commonAncestor(a: ts.Node, b: ts.Node): ts.Node | undefined {
  const seen = new Set<ts.Node>()
  for (let n: ts.Node | undefined = a; n; n = n.parent) seen.add(n)
  for (let n: ts.Node | undefined = b; n; n = n.parent) if (seen.has(n)) return n
  return undefined
}

function ancestor<T extends ts.Node>(node: ts.Node, test: (n: ts.Node) => n is T): T | undefined {
  for (let n = node.parent; n && !isFunctionNode(n); n = n.parent) if (test(n)) return n
  return undefined
}

function skipParens(node: ts.Expression): ts.Expression {
  let current = node
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isAwaitExpression(current)
  )
    current = current.expression
  return current
}

/** `posts`, `data.items` → `data`, `(await getPosts())` → none. */
function rootName(node: ts.Expression): string | undefined {
  let current = skipParens(node)
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current))
    current = skipParens(current.expression)
  if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression))
    return rootName(current.expression.expression)
  return ts.isIdentifier(current) ? current.text : undefined
}

function callText(node: ts.Expression, sf: ts.SourceFile): string {
  let current = skipParens(node)
  // `(await fetch(url)).json()` → `fetch(url)`.
  while (
    ts.isCallExpression(current) &&
    ts.isPropertyAccessExpression(current.expression) &&
    ['json', 'text', 'then', 'catch', 'finally', 'blob', 'arrayBuffer'].includes(current.expression.name.text)
  )
    current = skipParens(current.expression.expression)
  const text = oneLine(current.getText(sf))
  return text.length > 80 ? `${text.slice(0, 77)}...` : text
}

function locOf(file: string, sf: ts.SourceFile, node: ts.Node): SourceLoc {
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
  return { file, line: line + 1, column: character + 1 }
}

function compareLoc(a: SourceLoc | undefined, b: SourceLoc | undefined): number {
  if (!a || !b) return a ? -1 : b ? 1 : 0
  return compare(a.file, b.file) || a.line - b.line || a.column - b.column
}

/** A request that only reads: waterfalls of writes are usually on purpose. */
function isRead(site: RequestSite): boolean {
  if (site.transport === 'trpc') return site.procedure?.type === 'query'
  if (site.transport === 'graphql') return site.operation?.type === 'query'
  if (site.transport === 'server-action' || site.transport === 'websocket') return false
  return site.method === 'GET' || site.method === 'HEAD'
}

/** The URL has parts only known at runtime (`/posts/:id`). */
function hasParams(site: RequestSite): boolean {
  const url = site.url
  if (!url) return false
  if (url.confidence === 'unknown') return true
  return /:|\{/.test(`${url.path ?? ''}${url.query ?? ''}`)
}

/** Component id → the pages that render it (through their layouts and page). */
function pagesByComponent(routes: Route[], below: (id: string) => string[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const route of routes) {
    if (route.kind !== 'page') continue
    const roots = [
      ...route.layoutChain.flatMap((l) => (l.componentId ? [l.componentId] : [])),
      ...(route.componentId ? [route.componentId] : []),
    ]
    for (const id of new Set(roots.flatMap((r) => below(r)))) {
      const list = out.get(id)
      if (list) list.push(route.id)
      else out.set(id, [route.id])
    }
  }
  return out
}
