// Component trees: from each page/layout, follow JSX element references through
// imports (barrels and path aliases included) to build the component graph (docs/PLAN.md 6.3).
import { type Component, type ComponentRef, makeId, type SourceLoc } from '@flow-checker/shared'
import {
  type CallExpression,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  type JsxTagNameExpression,
  Node as N,
  type Node,
  type SourceFile,
  type Symbol as TsSymbol,
  ts,
} from 'ts-morph'
import { compare, relativeTo } from './paths'
import { TypeResolver } from './types'

/** A resolved component declaration: the node whose body holds its JSX. */
interface Declaration {
  name: string
  /** Node to search for JSX (function, arrow, class, ...). */
  body: Node
  /** Node used for the source location (usually the name). */
  anchor: Node
}

interface Target {
  resolution: ComponentRef['resolution']
  componentId?: string
  module?: string
  factory?: string
  dynamic?: boolean
}

export class ComponentGraph {
  readonly #root: string
  readonly #byNode = new Map<Node, string>()
  readonly #components = new Map<string, Component>()
  readonly #directiveCache = new Map<SourceFile, boolean>()
  readonly #types: TypeResolver

  readonly #scanned: (file: string) => boolean

  constructor(
    root: string,
    types: TypeResolver = new TypeResolver(root),
    scanned: (file: string) => boolean = () => true,
  ) {
    this.#root = root
    this.#types = types
    this.#scanned = scanned
  }

  /** Adds the default-export component of a page/layout file. Returns its id. */
  addFileDefault(file: SourceFile): string | undefined {
    const symbol = file.getDefaultExportSymbol()
    if (!symbol) return undefined
    const decl = declarationOf(unalias(symbol))
    return decl ? this.#visit(decl.body, decl) : undefined
  }

  /** Component id -> the node holding its body (function, arrow, class). */
  bodies(): Map<string, Node> {
    return new Map([...this.#byNode].map(([node, id]) => [id, node]))
  }

  /** Final component list, with `kind` computed from the given render roots. */
  components(roots: string[]): Component[] {
    this.#computeKinds(roots)
    return [...this.#components.values()].sort(
      (a, b) => compare(a.file, b.file) || a.loc.line - b.loc.line || compare(a.name, b.name),
    )
  }

  #visit(key: Node, decl: Declaration): string {
    const existing = this.#byNode.get(key)
    if (existing) return existing

    const file = decl.anchor.getSourceFile()
    const relFile = relativeTo(this.#root, file.getFilePath())
    let id = makeId('cmp', relFile, decl.name)
    if (this.#components.has(id)) id = makeId('cmp', relFile, decl.name, String(decl.anchor.getStart()))

    const component: Component = {
      id,
      name: decl.name,
      file: relFile,
      loc: this.#loc(decl.anchor),
      kind: 'server',
      clientBoundary: this.#isClientFile(file),
      children: [],
      usedTypes: [],
    }
    // Register before walking children so recursive components terminate.
    this.#byNode.set(key, id)
    this.#components.set(id, component)
    component.children = this.#children(decl.body)
    const props = propsOf(decl.body)
    if (props) component.propsType = this.#types.fromNode(props)
    component.usedTypes = this.#usedTypes(decl.body, props)
    return id
  }

  /** Named project types written in the component (annotations, generics, casts), in order. */
  #usedTypes(body: Node, props: Node | undefined): string[] {
    const ids = new Set<string>()
    for (const ref of body.getDescendantsOfKind(ts.SyntaxKind.TypeReference)) {
      if (props && ref.getPos() >= props.getPos() && ref.getEnd() <= props.getEnd()) continue
      // `createTRPCClient<AppRouter>()`: the router's type is plumbing, not data the component uses.
      const call = ref.getParent()
      if (call && N.isCallExpression(call) && importModuleOf(call.getExpression())?.startsWith('@trpc/'))
        continue
      const id = this.#types.namedTypeIdOf(ref)
      if (id) ids.add(id)
    }
    return [...ids]
  }

  #children(body: Node): ComponentRef[] {
    const refs = new Map<string, ComponentRef>()
    const elements = body
      .getDescendants()
      .filter(
        (n): n is JsxOpeningElement | JsxSelfClosingElement =>
          N.isJsxOpeningElement(n) || N.isJsxSelfClosingElement(n),
      )

    for (const element of elements) {
      const tag = element.getTagNameNode()
      if (isIntrinsic(tag)) continue

      const target = this.#resolveTag(tag)
      const key = target.componentId ?? `${target.module ?? ''}#${tag.getText()}`
      const conditional = isConditional(element, body)
      const existing = refs.get(key)
      if (existing) {
        // Conditional only if every occurrence is conditional.
        if (!conditional) delete existing.conditional
        continue
      }
      refs.set(key, {
        name: tag.getText(),
        resolution: target.resolution,
        ...(target.componentId ? { componentId: target.componentId } : {}),
        ...(target.module ? { module: target.module } : {}),
        ...(target.factory ? { factory: target.factory } : {}),
        ...(conditional ? { conditional: true } : {}),
        ...(target.dynamic ? { dynamic: true } : {}),
        loc: this.#loc(element),
      })
    }
    return [...refs.values()]
  }

  #resolveTag(tag: JsxTagNameExpression): Target {
    const module = importModuleOf(tag)
    const symbol = tag.getSymbol()
    if (!symbol) return { resolution: module && isPackage(module) ? 'external' : 'unresolved', module }
    return this.#resolveSymbol(symbol, module)
  }

  #resolveSymbol(symbol: TsSymbol, module: string | undefined, dynamic = false, depth = 0): Target {
    const target = unalias(symbol)
    const node = target.getDeclarations()[0]
    if (!node) {
      // Import that the compiler could not resolve (e.g. package without types).
      return { resolution: module && isPackage(module) ? 'external' : 'unresolved', module }
    }
    const file = node.getSourceFile()
    if (file.isInNodeModules() || file.isDeclarationFile()) {
      return { resolution: 'external', module: module ?? packageFromPath(file.getFilePath()) }
    }
    if (!this.#scanned(file.getFilePath())) return { resolution: 'excluded', module }

    // `const X = dynamic(() => import('./X'))` / `lazy(...)`
    const loader = N.isVariableDeclaration(node) ? node.getInitializer() : undefined
    if (loader && N.isCallExpression(loader) && isLazyLoader(loader)) {
      const loaded = this.#resolveLazy(loader)
      return loaded ? { ...loaded, dynamic: true } : { resolution: 'unresolved', module, dynamic: true }
    }

    const decl = declarationOf(target)
    if (!decl) {
      const factory = packageFactoryOf(node)
      if (factory) return { resolution: 'external', module, factory }
      // `({ as: Tag = 'h1' }) => <Tag />`: the parent picks the component.
      if (isPropBinding(node)) return { resolution: 'prop' }
      // `const Form = FormProvider`, `const Dialog = DialogPrimitive.Root`: an alias of a library component.
      const aliased = aliasedExpression(node)
      const aliasedSymbol = aliased?.getSymbol()
      if (aliasedSymbol && aliasedSymbol !== symbol && depth < 5) {
        const inner = this.#resolveSymbol(aliasedSymbol, module, dynamic, depth + 1)
        if (inner.resolution !== 'unresolved') return { ...inner, module }
      }
      return { resolution: 'unresolved', module }
    }
    return { resolution: 'project', componentId: this.#visit(decl.body, decl), module, dynamic }
  }

  /** Resolves `dynamic(() => import('./X'))` or `.then((m) => m.Named)` to the loaded component. */
  #resolveLazy(call: CallExpression): Target | undefined {
    const importCall = call
      .getDescendantsOfKind(ts.SyntaxKind.CallExpression)
      .find((c) => c.getExpression().getKind() === ts.SyntaxKind.ImportKeyword)
    const specifier = importCall?.getArguments()[0]
    if (!importCall || !specifier || !N.isStringLiteral(specifier)) return undefined
    const module = specifier.getLiteralValue()

    const moduleFile = specifier.getSymbol()?.getDeclarations()[0]?.getSourceFile()
    if (!moduleFile) return { resolution: isPackage(module) ? 'external' : 'unresolved', module }
    if (moduleFile.isInNodeModules() || moduleFile.isDeclarationFile())
      return { resolution: 'external', module }

    // `.then((m) => m.Named)` picks a named export; otherwise the default export.
    const then = importCall.getParentIfKind(ts.SyntaxKind.PropertyAccessExpression)
    const picked =
      then?.getName() === 'then'
        ? then
            .getParentIfKind(ts.SyntaxKind.CallExpression)
            ?.getDescendantsOfKind(ts.SyntaxKind.PropertyAccessExpression)
            .at(-1)
            ?.getName()
        : undefined
    const exportSymbol = picked
      ? moduleFile.getExportSymbols().find((s) => s.getName() === picked)
      : moduleFile.getDefaultExportSymbol()
    if (!exportSymbol) return { resolution: 'unresolved', module }
    return this.#resolveSymbol(exportSymbol, module)
  }

  #isClientFile(file: SourceFile): boolean {
    let cached = this.#directiveCache.get(file)
    if (cached === undefined) {
      cached = directives(file).includes('use client')
      this.#directiveCache.set(file, cached)
    }
    return cached
  }

  #loc(node: Node): SourceLoc {
    const file = node.getSourceFile()
    const { line, column } = file.getLineAndColumnAtPos(node.getStart())
    return { file: relativeTo(this.#root, file.getFilePath()), line, column }
  }

  /**
   * A component is `client` when it is a `'use client'` boundary or only rendered
   * below one, `server` when only rendered from server components, else `shared`.
   */
  #computeKinds(roots: string[]) {
    const seen = new Map<string, Set<'server' | 'client'>>()
    const queue: [string, 'server' | 'client'][] = roots.map((id) => [id, 'server'])
    while (queue.length > 0) {
      const [id, parentSide] = queue.shift() as [string, 'server' | 'client']
      const component = this.#components.get(id)
      if (!component) continue
      const side = component.clientBoundary ? 'client' : parentSide
      const sides = seen.get(id) ?? new Set()
      if (sides.has(side)) continue
      sides.add(side)
      seen.set(id, sides)
      for (const child of component.children) if (child.componentId) queue.push([child.componentId, side])
    }
    for (const [id, component] of this.#components) {
      const sides = seen.get(id)
      component.kind =
        sides?.has('client') && sides.has('server') ? 'shared' : sides?.has('client') ? 'client' : 'server'
    }
  }
}

/** Leading string directives of a file, e.g. `['use client']`. */
export function directives(file: SourceFile): string[] {
  const out: string[] = []
  for (const statement of file.compilerNode.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break
    out.push(statement.expression.text)
  }
  return out
}

export function unalias(symbol: TsSymbol): TsSymbol {
  return symbol.isAlias() ? (symbol.getAliasedSymbol() ?? symbol) : symbol
}

/** Finds the component declaration behind a symbol, unwrapping `memo`, `forwardRef` and aliases. */
function declarationOf(symbol: TsSymbol, depth = 0): Declaration | undefined {
  if (depth > 5) return undefined
  const node = symbol.getDeclarations()[0]
  if (!node) return undefined
  const name = symbol.getName() === 'default' ? nameOfDefault(node) : symbol.getName()

  if (N.isFunctionDeclaration(node) || N.isClassDeclaration(node)) {
    return { name, body: node, anchor: node.getNameNode() ?? node }
  }
  if (N.isVariableDeclaration(node)) {
    const init = node.getInitializer()
    return init ? fromExpression(init, name, node.getNameNode(), depth) : undefined
  }
  if (N.isExportAssignment(node)) {
    return fromExpression(node.getExpression(), name, node, depth)
  }
  // Compound components: `Card.Header = CardHeader`, or `const Card = { Header: CardHeader }`.
  const parent = node.getParent()
  if (
    N.isPropertyAccessExpression(node) &&
    parent &&
    N.isBinaryExpression(parent) &&
    parent.getLeft() === node &&
    parent.getOperatorToken().getKind() === ts.SyntaxKind.EqualsToken
  ) {
    return fromExpression(parent.getRight(), name, node, depth)
  }
  if (N.isPropertyAssignment(node)) {
    const init = node.getInitializer()
    return init ? fromExpression(init, name, node.getNameNode(), depth) : undefined
  }
  if (N.isShorthandPropertyAssignment(node)) {
    const value = node.getValueSymbol()
    return value ? declarationOf(unalias(value), depth + 1) : undefined
  }
  return undefined
}

/** A name bound from a component's parameters: `({ as: Tag })`, `({ icon: Icon = Star })`. */
function isPropBinding(node: Node): boolean {
  if (N.isParameterDeclaration(node)) return true
  if (!N.isBindingElement(node)) return false
  const param = node.getFirstAncestor(
    (a) => !N.isBindingElement(a) && !N.isObjectBindingPattern(a) && !N.isArrayBindingPattern(a),
  )
  return !!param && N.isParameterDeclaration(param)
}

/** The value a constant is set to when it is just another name: `const Form = FormProvider`. */
function aliasedExpression(node: Node): Node | undefined {
  if (!N.isVariableDeclaration(node)) return undefined
  let init = node.getInitializer()
  while (
    init &&
    (N.isAsExpression(init) || N.isParenthesizedExpression(init) || N.isSatisfiesExpression(init))
  )
    init = init.getExpression()
  return init && (N.isIdentifier(init) || N.isPropertyAccessExpression(init)) ? init : undefined
}

function fromExpression(expr: Node, name: string, anchor: Node, depth: number): Declaration | undefined {
  if (N.isArrowFunction(expr) || N.isFunctionExpression(expr) || N.isClassExpression(expr)) {
    return { name, body: expr, anchor }
  }
  if (N.isIdentifier(expr)) {
    const symbol = expr.getSymbol()
    return symbol ? declarationOf(unalias(symbol), depth + 1) : undefined
  }
  if (N.isCallExpression(expr) && isWrapper(expr)) {
    const inner = expr.getArguments()[0]
    return inner ? fromExpression(inner, name, anchor, depth) : undefined
  }
  if (N.isAsExpression(expr) || N.isParenthesizedExpression(expr) || N.isSatisfiesExpression(expr)) {
    return fromExpression(expr.getExpression(), name, anchor, depth)
  }
  return undefined
}

/**
 * The node whose type is the component's props: the first parameter of a function
 * component, or `P` in `class X extends Component<P>`.
 */
function propsOf(body: Node): Node | undefined {
  if (N.isFunctionLikeDeclaration(body)) return body.getParameters()[0]
  if (N.isClassDeclaration(body) || N.isClassExpression(body)) {
    return body.getExtends()?.getTypeArguments()[0]
  }
  return undefined
}

function nameOfDefault(node: Node): string {
  if ((N.isFunctionDeclaration(node) || N.isClassDeclaration(node)) && node.getName()) {
    return node.getName() as string
  }
  if (N.isExportAssignment(node)) {
    const expr = node.getExpression()
    if (N.isIdentifier(expr)) return expr.getText()
    const fn = expr.getFirstDescendant((d) => N.isFunctionExpression(d) && !!d.getName())
    if (fn && N.isFunctionExpression(fn)) return fn.getName() as string
  }
  return 'default'
}

/** `memo(...)`, `React.memo(...)`, `forwardRef(...)`. */
function isWrapper(call: CallExpression): boolean {
  const callee = calleeName(call)
  return callee === 'memo' || callee === 'forwardRef'
}

/** `dynamic(...)` from next/dynamic, or `lazy(...)` / `React.lazy(...)`. */
function isLazyLoader(call: CallExpression): boolean {
  const callee = calleeName(call)
  if (callee === 'lazy') return true
  if (callee !== 'dynamic') return false
  const expr = call.getExpression()
  return N.isIdentifier(expr) && importModuleOf(expr) === 'next/dynamic'
}

function calleeName(call: CallExpression): string | undefined {
  const expr = call.getExpression()
  if (N.isIdentifier(expr)) return expr.getText()
  if (N.isPropertyAccessExpression(expr)) return expr.getName()
  return undefined
}

function isIntrinsic(tag: JsxTagNameExpression): boolean {
  if (N.isIdentifier(tag)) return /^[a-z]/.test(tag.getText())
  // `this.props.x`, `svg:rect`, ...
  return !N.isPropertyAccessExpression(tag)
}

/** Module specifier of the import that brought the leftmost identifier of `node` into scope. */
export function importModuleOf(node: Node): string | undefined {
  let left: Node = node
  while (N.isPropertyAccessExpression(left)) left = left.getExpression()
  if (!N.isIdentifier(left)) return undefined
  for (const decl of left.getSymbol()?.getDeclarations() ?? []) {
    const importDecl = decl.getFirstAncestorByKind(ts.SyntaxKind.ImportDeclaration)
    if (importDecl) return importDecl.getModuleSpecifierValue()
  }
  return undefined
}

/**
 * For `const X = pkgFactory(...)` or `const { X } = pkgFactory(...)`, the package that
 * `pkgFactory` was imported from. These are package components created in project code.
 */
export function packageFactoryOf(node: Node): string | undefined {
  const variable = N.isVariableDeclaration(node)
    ? node
    : node.getFirstAncestorByKind(ts.SyntaxKind.VariableDeclaration)
  const init = variable?.getInitializer()
  if (!init || !N.isCallExpression(init)) return undefined
  const module = importModuleOf(init.getExpression())
  return module && isPackage(module) ? module : undefined
}

/** Bare package specifiers (`next/link`, `@scope/pkg/x`), not relative paths or `@/` aliases. */
export function isPackage(specifier: string): boolean {
  return /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(\/.*)?$/i.test(specifier)
}

function packageFromPath(path: string): string | undefined {
  const match = /\/node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(path)
  return match?.[1]?.replace(/^@types\//, '')
}

/**
 * True when `element` is only rendered on some paths inside `root`: the branch of a
 * ternary, the right side of `&&`/`||`/`??`, inside an `if`/`switch`, or after an early return.
 */
export function isConditional(element: Node, root: Node): boolean {
  let child: Node = element
  for (let node = element.getParent(); node && node !== root; node = node.getParent()) {
    if (N.isConditionalExpression(node) && child !== node.getCondition()) return true
    if (N.isBinaryExpression(node) && child === node.getRight()) {
      const op = node.getOperatorToken().getKind()
      if (
        op === ts.SyntaxKind.AmpersandAmpersandToken ||
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken
      ) {
        return true
      }
    }
    if (N.isIfStatement(node) && child !== node.getExpression()) return true
    if (N.isCaseClause(node) || N.isDefaultClause(node)) return true
    if (N.isBlock(node) && hasEarlyReturnBefore(node, child)) return true
    child = node
  }
  return false
}

/** An `if (...) return` earlier in the same block (and same function) as `statement`. */
function hasEarlyReturnBefore(block: Node, statement: Node): boolean {
  if (!N.isBlock(block)) return false
  const fn = block.getFirstAncestor((a) => N.isFunctionLikeDeclaration(a))
  for (const previous of block.getStatements()) {
    if (previous === statement) break
    if (!N.isIfStatement(previous)) continue
    const returns = previous
      .getDescendantsOfKind(ts.SyntaxKind.ReturnStatement)
      .some((r) => r.getFirstAncestor((a) => N.isFunctionLikeDeclaration(a)) === fn)
    if (returns) return true
  }
  return false
}
