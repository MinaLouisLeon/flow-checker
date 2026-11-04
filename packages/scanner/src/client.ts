// Client boundaries (M43): for each page, where its browser part starts (a server component
// rendering a `'use client'` component), what each boundary brings to the browser (components,
// project modules, packages, a source size), the client-only code each client component uses, and
// boundaries whose file needs no browser at all, so the directive could move down.
//
// Checked with `next build` (16.4.3) on the client-boundaries fixture: the client reference manifest
// lists exactly the `'use client'` files server components render (a barrel's target, not the
// barrel); a component only rendered on the server isn't in the client chunks; moving a directive
// from a file with no client code down to the child that has some builds, and the child becomes the
// boundary; dropping the directive from a file that hands a function to a client component fails
// ("Event handlers cannot be passed to Client Component props"). A server module that imports
// `useState`, `useRef`, `useContext`, `createContext` or `useTransition` fails to compile; `use`,
// `useMemo`, `useCallback`, `useId` and `useDebugValue` build.
import { Buffer } from 'node:buffer'
import type {
  ClientBoundary,
  ClientLower,
  ClientUse,
  Component,
  PageClientBoundary,
  Route,
  SourceLoc,
} from '@flow-checker/shared'
import { type CallExpression, Node as N, type Node, type SourceFile, ts } from 'ts-morph'
import { directives, importModuleOf, isPackage, unalias } from './components'
import { compare, relativeTo } from './paths'

export interface ClientInput {
  root: string
  /** Pages get `client`. */
  routes: Route[]
  /** Components that run in the browser get `clientUses`. */
  components: Component[]
  /** Component id -> the node holding its body. */
  bodies: Map<string, Node>
  /** The project file at a project-relative path. */
  fileOf: (file: string) => SourceFile | undefined
  /** The project file at an absolute path, when it is in the scan. */
  fileAt: (path: string) => SourceFile | undefined
  /** Resolves an import as the compiler does. */
  resolveModule: (specifier: string, from: string) => ts.ResolvedModuleFull | undefined
  /** Reads a file outside the project (a package's code), or undefined. */
  readFile: (path: string) => string | undefined
}

/** React APIs a server component can use (the react-server build exports them). */
const SERVER_REACT = new Set(['use', 'useMemo', 'useCallback', 'useId', 'useDebugValue'])

/** Package hooks documented to work in server components, by package. */
const SERVER_HOOKS: Record<string, ReadonlySet<string>> = {
  // next-intl: non-async server components can use these.
  'next-intl': new Set([
    'useTranslations',
    'useLocale',
    'useNow',
    'useTimeZone',
    'useMessages',
    'useFormatter',
  ]),
}

/** Browser globals: reading one while rendering on the server throws. */
const BROWSER_GLOBALS = new Set([
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
  'history',
  'matchMedia',
  'requestAnimationFrame',
  'IntersectionObserver',
  'ResizeObserver',
  'MutationObserver',
])

/** Packages every Next app ships anyway: not listed as what a boundary brings. */
const FRAMEWORK = new Set(['react', 'react-dom', 'next'])

/** Kinds that break a server module that merely imports the file (Next checks the imports). */
const IMPORT_BREAKING = new Set<ClientUse['kind']>(['hook', 'context', 'class-component'])

/** Uses kept per boundary and per component. */
const USES_LIMIT = 8

interface FileFacts {
  path: string
  rel: string
  /** Starts with `'use client'`. */
  client: boolean
  bytes: number
  /** Project files it imports (values only), absolute. */
  imports: string[]
  /** Imports of files the scan leaves out: what they do is unknown. */
  unscanned: boolean
  packages: string[]
}

/** Sets `client` on pages and `clientUses` on client components; returns the boundaries. */
export function addClientBoundaries(input: ClientInput): ClientBoundary[] {
  return new ClientPass(input).run()
}

class ClientPass {
  readonly #in: ClientInput
  readonly #components: Map<string, Component>
  readonly #facts = new Map<string, FileFacts | null>()
  /** The same facts by project-relative path. */
  readonly #byRel = new Map<string, FileFacts>()
  readonly #fileUses = new Map<string, ClientUse[]>()
  readonly #rawUses = new Map<string, FoundUse[]>()
  readonly #breaks = new Map<string, boolean>()
  readonly #hooks = new Map<Node, boolean>()
  readonly #packageClient = new Map<string, boolean>()
  readonly #canServe = new Map<string, boolean>()

  constructor(input: ClientInput) {
    this.#in = input
    this.#components = new Map(input.components.map((c) => [c.id, c]))
  }

  run(): ClientBoundary[] {
    for (const component of this.#in.components) {
      if (component.kind === 'server') continue
      const body = this.#in.bodies.get(component.id)
      if (!body) continue
      const path = body.getSourceFile().getFilePath()
      const start = body.getStart()
      const end = body.getEnd()
      const inBody = this.#rawUsesOfFile(path).filter((u) => u.pos >= start && u.pos < end)
      const uses = dedupe(inBody.map((u) => u.use)).slice(0, USES_LIMIT)
      if (uses.length > 0) component.clientUses = uses
    }

    const boundaries = new Map<string, ClientBoundary>()
    const boundaryOf = (id: string) => {
      let boundary = boundaries.get(id)
      if (!boundary) {
        boundary = this.#boundary(id)
        boundaries.set(id, boundary)
      }
      return boundary
    }
    for (const page of this.#in.routes) {
      if (page.kind !== 'page') continue
      const edges = this.#edges(page)
      const componentIds = new Set<string>()
      const modules = new Set<string>()
      const packages = new Set<string>()
      for (const edge of edges) {
        const boundary = boundaryOf(edge.componentId)
        for (const id of boundary.componentIds) componentIds.add(id)
        for (const file of boundary.modules) modules.add(file)
        for (const name of boundary.packages) packages.add(name)
      }
      let bytes = 0
      for (const file of modules) bytes += this.#factsOf(file)?.bytes ?? 0
      page.client = {
        boundaries: edges,
        components: componentIds.size,
        modules: modules.size,
        bytes,
        packages: [...packages].sort(compare),
      }
    }
    return [...boundaries.values()].sort((a, b) => {
      const ca = this.#components.get(a.componentId)
      const cb = this.#components.get(b.componentId)
      return compare(a.file, b.file) || (ca?.loc.line ?? 0) - (cb?.loc.line ?? 0)
    })
  }

  // --- Where boundaries start ---

  /** Server -> client edges of a page: its layouts (outermost first), then the page. */
  #edges(page: Route): PageClientBoundary[] {
    const out: PageClientBoundary[] = []
    const seen = new Set<string>()
    const roots = [
      ...page.layoutChain.flatMap((l) =>
        l.componentId ? [{ id: l.componentId, in: 'layout' as const }] : [],
      ),
      ...(page.componentId ? [{ id: page.componentId, in: 'page' as const }] : []),
    ]
    const edgeKeys = new Set<string>()
    const add = (edge: PageClientBoundary) => {
      const key = `${edge.componentId}<${edge.parentId ?? ''}`
      if (edgeKeys.has(key)) return
      edgeKeys.add(key)
      out.push(edge)
    }
    const visit = (id: string, place: PageClientBoundary['in']) => {
      if (seen.has(id)) return
      seen.add(id)
      const parent = this.#components.get(id)
      if (!parent) return
      for (const ref of parent.children) {
        const child = ref.componentId ? this.#components.get(ref.componentId) : undefined
        if (!child) continue
        if (child.clientBoundary) {
          const via = ref.module ? this.#via(parent.file, ref.module, child.file) : undefined
          add({
            componentId: child.id,
            parentId: parent.id,
            in: place,
            ...(via ? { via } : {}),
            ...(ref.dynamic ? { dynamic: true as const } : {}),
            loc: ref.loc,
          })
        } else visit(child.id, 'component')
      }
    }
    for (const root of roots) {
      const component = this.#components.get(root.id)
      if (!component) continue
      if (component.clientBoundary) add({ componentId: root.id, in: root.in, loc: component.loc })
      else visit(root.id, root.in)
    }
    return out
  }

  /** The re-exporting file an import went through, when it isn't the component's own file. */
  #via(fromFile: string, specifier: string, targetFile: string): string | undefined {
    const from = this.#in.fileOf(fromFile)
    if (!from) return undefined
    const resolved = this.#in.resolveModule(specifier, from.getFilePath())
    if (!resolved || resolved.isExternalLibraryImport) return undefined
    const rel = relativeTo(this.#in.root, resolved.resolvedFileName.replaceAll('\\', '/'))
    return rel === targetFile ? undefined : rel
  }

  // --- What a boundary brings ---

  #boundary(id: string): ClientBoundary {
    const component = this.#components.get(id) as Component
    const componentIds = this.#below(id)
    const own = this.#factsOf(component.file)
    const modules = new Set<string>()
    const packages = new Set<string>()
    const files: FileFacts[] = []
    const queue = own ? [own] : []
    const seen = new Set(queue.map((f) => f.path))
    for (let i = 0; i < queue.length; i++) {
      const facts = queue[i] as FileFacts
      modules.add(facts.rel)
      files.push(facts)
      for (const name of facts.packages) packages.add(name)
      for (const path of facts.imports) {
        if (seen.has(path)) continue
        seen.add(path)
        const next = this.#facts.get(path) ?? this.#readFacts(path)
        if (next) queue.push(next)
      }
    }
    let bytes = 0
    for (const facts of files) bytes += facts.bytes
    const [first, ...rest] = [...modules]
    const uses = this.#boundaryUses(files)
    const lower = this.#lower(component)
    return {
      componentId: id,
      file: component.file,
      componentIds,
      modules: first ? [first, ...rest.sort(compare)] : [],
      packages: [...packages].sort(compare),
      bytes,
      uses,
      ...(lower ? { lower } : {}),
    }
  }

  /** The component and every component below it, in tree order. */
  #below(id: string): string[] {
    const seen = new Set([id])
    const queue = [id]
    for (let i = 0; i < queue.length; i++) {
      for (const ref of this.#components.get(queue[i] as string)?.children ?? []) {
        if (ref.componentId && !seen.has(ref.componentId) && this.#components.has(ref.componentId)) {
          seen.add(ref.componentId)
          queue.push(ref.componentId)
        }
      }
    }
    return queue
  }

  /** Client-only code in the boundary's own file, then what its imports bring (hooks, contexts, classes). */
  #boundaryUses(files: FileFacts[]): ClientUse[] {
    const [own, ...imported] = files
    const out = own ? [...this.#usesOfFile(own.path)] : []
    for (const facts of imported) {
      if (facts.client) continue
      out.push(...this.#usesOfFile(facts.path).filter((u) => IMPORT_BREAKING.has(u.kind)))
    }
    return dedupe(out).slice(0, USES_LIMIT)
  }

  // --- Could it move lower? ---

  /**
   * The boundary's file has no client-only code and imports none: it could render on the server,
   * with the directive on the components below that need the browser.
   */
  #lower(boundary: Component): ClientLower | undefined {
    if (!this.#serves(boundary, true)) return undefined
    const into: string[] = []
    const server = [boundary.id]
    const seen = new Set([boundary.id])
    const visit = (component: Component) => {
      for (const ref of component.children) {
        const child = ref.componentId ? this.#components.get(ref.componentId) : undefined
        if (!child || seen.has(child.id)) continue
        seen.add(child.id)
        if (this.#serves(child, false)) {
          server.push(child.id)
          visit(child)
        } else into.push(child.id)
      }
    }
    visit(boundary)
    return { into, server }
  }

  /**
   * Whether a component could render on the server: no `'use client'` of its own (unless it is the
   * boundary being moved), no client-only code in its file or what it imports, and every package
   * component it renders is one a server component may render.
   */
  #serves(component: Component, boundary: boolean): boolean {
    const key = `${component.id}|${boundary}`
    const known = this.#canServe.get(key)
    if (known !== undefined) return known
    let ok = boundary || !component.clientBoundary
    const facts = this.#factsOf(component.file)
    if (ok) ok = !!facts && !facts.unscanned && this.#usesOfFile(facts.path).length === 0
    if (ok && facts) {
      // The files of the components it renders are judged as those components: one that needs the
      // browser gets the directive, which makes importing its file fine.
      const rendered = new Set<string>(
        component.children.flatMap((ref) => {
          const child = ref.componentId ? this.#components.get(ref.componentId) : undefined
          const sf = child ? this.#in.fileOf(child.file) : undefined
          return sf ? [sf.getFilePath()] : []
        }),
      )
      ok = facts.imports.every((path) => rendered.has(path) || !this.#breaksImport(path))
    }
    if (ok) {
      ok = component.children.every((ref) => {
        if (ref.componentId) return true
        if (ref.resolution !== 'external' || !ref.module) return false
        return ref.module === 'next' || ref.module.startsWith('next/') || this.#marksClient(ref.module, facts)
      })
    }
    this.#canServe.set(key, ok)
    return ok
  }

  /** Importing the file from a server module fails: it (or a file it imports) uses a client-only API. */
  #breaksImport(path: string): boolean {
    const known = this.#breaks.get(path)
    if (known !== undefined) return known
    const facts = this.#facts.get(path) ?? this.#readFacts(path)
    // A `'use client'` file is a client reference from the server: fine to import.
    if (facts?.client) {
      this.#breaks.set(path, false)
      return false
    }
    // While in progress (an import cycle), count it as fine; the files in the cycle decide.
    this.#breaks.set(path, false)
    const breaks =
      !facts ||
      facts.unscanned ||
      this.#usesOfFile(path).some((u) => IMPORT_BREAKING.has(u.kind)) ||
      facts.imports.some((p) => this.#breaksImport(p))
    this.#breaks.set(path, breaks)
    return breaks
  }

  /** The package's code starts with `'use client'`, so a server component may render what it exports. */
  #marksClient(module: string, from: FileFacts | undefined): boolean {
    if (!from) return false
    const key = `${module}|${from.path.slice(0, from.path.lastIndexOf('/'))}`
    const known = this.#packageClient.get(key)
    if (known !== undefined) return known
    let marked = false
    const resolved = this.#in.resolveModule(module, from.path)?.resolvedFileName.replaceAll('\\', '/')
    if (resolved) {
      for (const candidate of codeFiles(resolved)) {
        const text = this.#in.readFile(candidate)
        if (text === undefined) continue
        marked = USE_CLIENT_TEXT.test(text.slice(0, 2000))
        break
      }
    }
    this.#packageClient.set(key, marked)
    return marked
  }

  // --- Files ---

  #factsOf(rel: string): FileFacts | undefined {
    const known = this.#byRel.get(rel)
    if (known) return known
    const sf = this.#in.fileOf(rel)
    return sf
      ? (this.#facts.get(sf.getFilePath()) ?? this.#readFacts(sf.getFilePath())) || undefined
      : undefined
  }

  #readFacts(path: string): FileFacts | undefined {
    if (this.#facts.has(path)) return this.#facts.get(path) ?? undefined
    const sf = this.#in.fileAt(path)
    if (!sf) {
      this.#facts.set(path, null)
      return undefined
    }
    const imports = new Set<string>()
    const packages = new Set<string>()
    let unscanned = false
    for (const literal of sf.getImportStringLiterals()) {
      if (typeOnly(literal)) continue
      const specifier = literal.getLiteralValue()
      const resolved = this.#in.resolveModule(specifier, path)
      if (resolved && !resolved.isExternalLibraryImport) {
        const target = resolved.resolvedFileName.replaceAll('\\', '/')
        if (target === path || target.endsWith('.d.ts')) continue
        if (this.#in.fileAt(target)) imports.add(target)
        else unscanned = true
      } else if (isPackage(specifier) && !specifier.startsWith('node:')) {
        const name = packageName(specifier)
        if (!FRAMEWORK.has(name)) packages.add(name)
      }
    }
    const facts: FileFacts = {
      path,
      rel: relativeTo(this.#in.root, path),
      client: directives(sf).includes('use client'),
      bytes: Buffer.byteLength(sf.getFullText(), 'utf8'),
      imports: [...imports],
      unscanned,
      packages: [...packages],
    }
    this.#facts.set(path, facts)
    this.#byRel.set(facts.rel, facts)
    return facts
  }

  #usesOfFile(path: string): ClientUse[] {
    let uses = this.#fileUses.get(path)
    if (!uses) {
      uses = dedupe(this.#rawUsesOfFile(path).map((u) => u.use))
      this.#fileUses.set(path, uses)
    }
    return uses
  }

  /** Every client-only use in a file, with where it starts. */
  #rawUsesOfFile(path: string): FoundUse[] {
    let found = this.#rawUses.get(path)
    if (!found) {
      const sf = this.#in.fileAt(path) ?? this.#in.fileOf(relativeTo(this.#in.root, path))
      found = sf ? this.#usesIn(sf) : []
      this.#rawUses.set(path, found)
    }
    return found
  }

  // --- Client-only code ---

  /**
   * Client-only code inside `root`, in source order. The walk runs over compiler nodes and wraps only
   * the few that may matter: wrapping every node is most of the cost on big apps.
   */
  #usesIn(root: Node): FoundUse[] {
    const sf = root.getSourceFile()
    const out: FoundUse[] = []
    const add = (kind: ClientUse['kind'], name: string, node: Node) =>
      out.push({ use: { kind, name, loc: this.#loc(node) }, pos: node.getStart() })
    const candidates: ts.Node[] = []
    const visit = (n: ts.Node) => {
      if (isCandidate(n)) candidates.push(n)
      ts.forEachChild(n, visit)
    }
    visit(root.compilerNode)
    for (const candidate of candidates) {
      const node = wrap(sf, candidate)
      if (!node) continue
      if (N.isCallExpression(node)) {
        const kind = this.#callKind(node)
        if (kind) add(kind, calleeName(node) ?? node.getExpression().getText(), node)
      } else if (N.isJsxAttribute(node)) {
        const name = node.getNameNode().getText()
        const value = attributeValue(node)
        const tag = node.getFirstAncestorByKind(ts.SyntaxKind.JsxAttributes)?.getParent()
        if (!value || !tag || (!N.isJsxOpeningElement(tag) && !N.isJsxSelfClosingElement(tag))) continue
        if (isHtmlTag(tag.getTagNameNode())) {
          if (/^on[A-Z]/.test(name) && !N.isStringLiteral(value)) add('event', name, node)
        } else if (this.#isFunction(value)) add('function-prop', name, node)
      } else if (N.isJsxExpression(node)) {
        // `<List>{(item) => ...}</List>`: a render function handed to a component as `children`.
        const parent = node.getParent()
        if (N.isJsxElement(parent) && !isHtmlTag(parent.getOpeningElement().getTagNameNode()))
          add('function-prop', 'children', node)
      } else if (N.isIdentifier(node)) {
        if (isBrowserGlobal(node)) add('browser-api', node.getText(), node)
      } else if ((N.isClassDeclaration(node) || N.isClassExpression(node)) && isClassComponent(node)) {
        add('class-component', node.getName() ?? 'class', node.getNameNode() ?? node)
      }
    }
    return out
  }

  /** `hook` for a hook a server component can't call, `context` for `createContext()`. */
  #callKind(call: CallExpression): ClientUse['kind'] | undefined {
    const name = calleeName(call)
    if (!name) return undefined
    if (name !== 'use' && name !== 'createContext' && !/^use[A-Z0-9]/.test(name)) return undefined
    const module = importModuleOf(call.getExpression())
    if (module === 'react') {
      if (name === 'createContext') return 'context'
      return SERVER_REACT.has(name) ? undefined : 'hook'
    }
    if (name === 'createContext') return undefined
    if (module && isPackage(module)) return SERVER_HOOKS[packageName(module)]?.has(name) ? undefined : 'hook'
    // A project hook needs the browser when its body does.
    const body = hookBody(call)
    if (!body) return 'hook'
    return this.#hookNeedsClient(body) ? 'hook' : undefined
  }

  #hookNeedsClient(body: Node): boolean {
    const known = this.#hooks.get(body)
    if (known !== undefined) return known
    // A hook that calls itself: decided by the rest of its body.
    this.#hooks.set(body, false)
    const needs = this.#usesIn(body).some((u) => u.use.kind !== 'event' && u.use.kind !== 'function-prop')
    this.#hooks.set(body, needs)
    return needs
  }

  /** A function value: an inline function, or a name whose type can be called (not a server action). */
  #isFunction(value: Node): boolean {
    if (N.isArrowFunction(value) || N.isFunctionExpression(value)) return !isServerAction(value)
    if (!N.isIdentifier(value) && !N.isPropertyAccessExpression(value)) return false
    if (value.getType().getCallSignatures().length === 0) return false
    const symbol = value.getSymbol()
    const decl = symbol ? unalias(symbol).getDeclarations()[0] : undefined
    if (!decl) return true
    if (directives(decl.getSourceFile()).includes('use server')) return false
    const fn = N.isVariableDeclaration(decl) ? decl.getInitializer() : decl
    return !(fn && isServerAction(fn))
  }

  #loc(node: Node): SourceLoc {
    const file = node.getSourceFile()
    const { line, column } = file.getLineAndColumnAtPos(node.getStart())
    return { file: relativeTo(this.#in.root, file.getFilePath()), line, column }
  }
}

/** A use and where it starts in its file. */
interface FoundUse {
  use: ClientUse
  pos: number
}

/** Compiler nodes worth a closer look: hook-like calls, JSX props with values, classes, browser names. */
function isCandidate(n: ts.Node): boolean {
  if (ts.isCallExpression(n)) {
    const callee = n.expression
    const name = ts.isIdentifier(callee)
      ? callee.text
      : ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : undefined
    return !!name && (name === 'use' || name === 'createContext' || /^use[A-Z0-9]/.test(name))
  }
  if (ts.isJsxAttribute(n))
    return !!n.initializer && ts.isJsxExpression(n.initializer) && !!n.initializer.expression
  if (ts.isJsxExpression(n))
    return (
      !!n.expression &&
      ts.isJsxElement(n.parent) &&
      (ts.isArrowFunction(n.expression) || ts.isFunctionExpression(n.expression))
    )
  if (ts.isIdentifier(n)) return BROWSER_GLOBALS.has(n.text)
  if (ts.isClassDeclaration(n) || ts.isClassExpression(n)) return !!n.heritageClauses
  return false
}

/** The ts-morph node for a compiler node: from the token at its start, up to it. */
function wrap(sf: SourceFile, n: ts.Node): Node | undefined {
  let node: Node | undefined = sf.getDescendantAtPos(n.getStart(sf.compilerNode))
  while (node && node.compilerNode !== n) node = node.getParent()
  return node
}

const USE_CLIENT_TEXT = /^\s*(?:(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*['"]use client['"]/

/** The package's code files to look at for a resolved `.d.ts` (or code) file. */
function codeFiles(resolved: string): string[] {
  const m = /^(.*)\.d\.([mc]?)ts$/.exec(resolved)
  if (!m) return [resolved]
  const base = m[1] as string
  const ext = m[2] as string
  return ext ? [`${base}.${ext}js`] : [`${base}.mjs`, `${base}.js`, `${base}.cjs`]
}

/** `@scope/pkg/sub` -> `@scope/pkg`, `pkg/sub` -> `pkg`. */
function packageName(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] as string)
}

/** An import that only brings types, so nothing of it reaches the browser. */
function typeOnly(literal: Node): boolean {
  const parent = literal.getParent()
  if (!parent) return false
  if (N.isImportDeclaration(parent)) {
    if (parent.isTypeOnly()) return true
    const clause = parent.getImportClause()
    if (!clause || clause.getDefaultImport() || clause.getNamespaceImport()) return false
    const named = clause.getNamedImports()
    return named.length > 0 && named.every((n) => n.isTypeOnly())
  }
  if (N.isExportDeclaration(parent)) {
    if (parent.isTypeOnly()) return true
    const named = parent.getNamedExports()
    return named.length > 0 && named.every((n) => n.isTypeOnly())
  }
  // `import('x').Type` in a type position.
  return N.isLiteralTypeNode(parent) || N.isImportTypeNode(parent)
}

function attributeValue(attr: Node): Node | undefined {
  if (!N.isJsxAttribute(attr)) return undefined
  const init = attr.getInitializer()
  if (!init) return undefined
  if (N.isJsxExpression(init)) return init.getExpression()
  return init
}

function isHtmlTag(tag: Node): boolean {
  return N.isIdentifier(tag) && /^[a-z]/.test(tag.getText())
}

function calleeName(call: CallExpression): string | undefined {
  const expr = call.getExpression()
  if (N.isIdentifier(expr)) return expr.getText()
  if (N.isPropertyAccessExpression(expr)) return expr.getName()
  return undefined
}

/** The body of the project function a hook call goes to. */
function hookBody(call: CallExpression): Node | undefined {
  const expr = call.getExpression()
  const symbol = expr.getSymbol()
  const decl = symbol ? unalias(symbol).getDeclarations()[0] : undefined
  if (!decl) return undefined
  const sf = decl.getSourceFile()
  if (sf.isInNodeModules() || sf.isDeclarationFile()) return undefined
  if (N.isFunctionDeclaration(decl)) return decl
  if (N.isVariableDeclaration(decl)) {
    const init = decl.getInitializer()
    if (init && (N.isArrowFunction(init) || N.isFunctionExpression(init))) return init
  }
  return undefined
}

/** A function whose body starts with `'use server'`. */
function isServerAction(fn: Node): boolean {
  if (!N.isArrowFunction(fn) && !N.isFunctionExpression(fn) && !N.isFunctionDeclaration(fn)) return false
  const body = fn.getBody()
  if (!body || !N.isBlock(body)) return false
  const first = body.getStatements()[0]
  return (
    !!first &&
    N.isExpressionStatement(first) &&
    N.isStringLiteral(first.getExpression()) &&
    (first.getExpression() as Node).getText().slice(1, -1) === 'use server'
  )
}

/** A read of the browser's own `window`, `document`...: not a property name, a local, or `typeof x`. */
function isBrowserGlobal(node: Node): boolean {
  const parent = node.getParent()
  if (!parent) return false
  if (N.isPropertyAccessExpression(parent) && parent.getNameNode() === node) return false
  if (N.isPropertyAssignment(parent) && parent.getNameNode() === node) return false
  // `<Map location={...} />`: a prop name.
  if (N.isJsxAttribute(parent)) return false
  if (N.isTypeOfExpression(parent)) return false
  if (N.isTypeReference(parent) || N.isQualifiedName(parent)) return false
  const decls = node.getSymbol()?.getDeclarations() ?? []
  return decls.length > 0 && decls.every((d) => d.getSourceFile().isDeclarationFile())
}

/** `class X extends Component` / `PureComponent` / `React.Component`. */
function isClassComponent(node: Node): boolean {
  if (!N.isClassDeclaration(node) && !N.isClassExpression(node)) return false
  const base = node.getExtends()?.getExpression()
  if (!base) return false
  const name = N.isPropertyAccessExpression(base) ? base.getName() : base.getText()
  return (name === 'Component' || name === 'PureComponent') && importModuleOf(base) === 'react'
}

/** One use per kind and name, the first one found. */
function dedupe(uses: ClientUse[]): ClientUse[] {
  const seen = new Set<string>()
  return uses.filter((u) => {
    const key = `${u.kind}|${u.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
