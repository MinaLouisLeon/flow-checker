// Environment variables (M45): every `process.env` name the code reads, where and on which side,
// which `.env*` files define it, and three flags: a private name read in client code, a
// `NEXT_PUBLIC_` name read in a way Next doesn't inline, and a name nothing defines.
//
// Values are never read into the model: `.env` files are parsed for names with Next's own line
// rule and the rest of each line is dropped.
//
// Checked with `next build` (16.4.3, Turbopack and webpack) on the env fixture: a name without
// `NEXT_PUBLIC_` read in client code is not in the browser bundle; `process.env.X`,
// `process.env['X']` and `env.X` after `const env = process.env` (at module level or in a function)
// are inlined, which Next's docs say isn't the case for the last one; `const { X } = process.env` is
// not inlined. `process.env[KEY]` with a constant `KEY` is inlined by Turbopack, not by webpack.
import { posix } from 'node:path'
import type {
  EnvAccess,
  EnvFile,
  EnvFlag,
  EnvMap,
  EnvRead,
  EnvSide,
  EnvUnknownRead,
  EnvVar,
  Route,
  SourceLoc,
} from '@flow-checker/shared'
import { PUBLIC_PREFIX } from '@flow-checker/shared'
import { type SourceFile, ts } from 'ts-morph'
import { typeOnly } from './client'
import { directives } from './components'
import { compare, relativeTo } from './paths'

export interface EnvInput {
  root: string
  /** Absolute. */
  appDir: string
  routes: Route[]
  /** Scanned project files in the app directory. */
  appFiles: SourceFile[]
  /** The middleware / proxy file (absolute) and the routes it runs on. */
  middleware?: { file: string; routeIds: string[] }
  /** The project file at an absolute path, when it is in the scan. */
  fileAt: (path: string) => SourceFile | undefined
  resolveModule: (specifier: string, from: string) => ts.ResolvedModuleFull | undefined
  /** Names of the entries in a directory (absolute), or none. */
  listDir: (dir: string) => string[]
  readFile: (path: string) => string | undefined
  /** Absolute path of `next.config.*`, read on its own (never added to the project). */
  nextConfig?: string
}

/** Next's line rule for `.env` files (dotenv's, as bundled in `@next/env` 16.4). */
const ENV_LINE =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm

/** The names a `.env` file defines, in file order. Values are matched but never kept. */
export function envFileNames(text: string): string[] {
  const names: string[] = []
  const source = text.replace(/\r\n?/g, '\n')
  ENV_LINE.lastIndex = 0
  for (let m = ENV_LINE.exec(source); m; m = ENV_LINE.exec(source)) {
    const name = m[1] as string
    if (!names.includes(name)) names.push(name)
  }
  return names
}

const MODES = ['development', 'production', 'test'] as const
type Mode = (typeof MODES)[number]

const ENV_FILE = /^\.env(\..+)?$/

/** The `NODE_ENV`s Next loads a file for (`@next/env`: `.env.<mode>.local`, `.env.local` but not in test, `.env.<mode>`, `.env`). */
export function envFileLoads(name: string): Mode[] {
  if (name === '.env') return [...MODES]
  if (name === '.env.local') return ['development', 'production']
  const m = /^\.env\.(development|production|test)(\.local)?$/.exec(name)
  return m ? [m[1] as Mode] : []
}

/** Next's own files first (`.env`, `.env.local`, then per mode), then the others by name. */
function fileOrder(name: string): number {
  const known = ['.env', '.env.local', ...MODES.flatMap((m) => [`.env.${m}`, `.env.${m}.local`])]
  const i = known.indexOf(name)
  return i === -1 ? known.length : i
}

/** Names Next sets itself; the ones it also inlines in client code (`define-env.js`). */
const NEXT_SET = new Set(['NODE_ENV', 'NEXT_RUNTIME', 'NEXT_DEPLOYMENT_ID', 'NEXT_PHASE', 'TURBOPACK'])
const NEXT_CLIENT = new Set(['NODE_ENV', 'NEXT_RUNTIME', 'NEXT_DEPLOYMENT_ID', 'TURBOPACK'])

function setBy(name: string): EnvVar['setBy'] {
  if (NEXT_SET.has(name) || name.startsWith('__NEXT_')) return 'next'
  if (/^(NEXT_PUBLIC_)?FLOW_CHECKER(_|$)/.test(name)) return 'flow-checker'
  if (/^(NEXT_PUBLIC_)?VERCEL(_|$)/.test(name)) return 'vercel'
  return undefined
}

/** A read as found in a file, before sides and pages are known. */
interface Found {
  name?: string
  key?: string
  access: EnvAccess
  optional: boolean
  loc: SourceLoc
}

interface FileInfo {
  path: string
  client: boolean
  server: boolean
  /** Project files it imports for their values, absolute. */
  imports: string[]
  reads: Found[]
}

export function buildEnvMap(input: EnvInput): EnvMap | undefined {
  const { root } = input
  const rel = (path: string) => relativeTo(root, path)

  // --- Files the app runs, and the imports between them (values only) ---
  const base = posix.dirname(input.appDir)
  const instrumentation = findFile(input, base, 'instrumentation')
  const instrumentationClient = findFile(input, base, 'instrumentation-client')
  const roots: SourceFile[] = [...input.appFiles]
  const middleware = input.middleware && input.fileAt(input.middleware.file)
  if (middleware) roots.push(middleware)
  if (instrumentation) roots.push(instrumentation)
  if (instrumentationClient) roots.push(instrumentationClient)

  const files = new Map<string, FileInfo>()
  const queue: SourceFile[] = []
  const add = (sf: SourceFile) => {
    const path = sf.getFilePath()
    if (files.has(path)) return
    const dirs = directives(sf)
    files.set(path, {
      path,
      client: dirs.includes('use client'),
      server: dirs.includes('use server'),
      imports: [],
      reads: [],
    })
    queue.push(sf)
  }
  for (const sf of roots) add(sf)
  for (let i = 0; i < queue.length; i++) {
    const sf = queue[i] as SourceFile
    const info = files.get(sf.getFilePath()) as FileInfo
    for (const literal of sf.getImportStringLiterals()) {
      if (typeOnly(literal)) continue
      const resolved = input.resolveModule(literal.getLiteralValue(), info.path)
      if (!resolved || resolved.isExternalLibraryImport) continue
      const target = input.fileAt(resolved.resolvedFileName.replaceAll('\\', '/'))
      if (!target || target === sf) continue
      info.imports.push(target.getFilePath())
      add(target)
    }
    if (sf.getFullText().includes('process.env')) info.reads = readsIn(sf.compilerNode, root, checkerOf(sf))
  }

  // --- Sides: server code doesn't run a `'use client'` file's code; client code gets references to a `'use server'` file ---
  const spread = (seeds: string[], enter: (f: FileInfo) => boolean): Set<string> => {
    const seen = new Set<string>()
    const stack = seeds.filter((s) => files.has(s))
    while (stack.length > 0) {
      const path = stack.pop() as string
      if (seen.has(path)) continue
      seen.add(path)
      for (const next of files.get(path)?.imports ?? []) {
        const target = files.get(next)
        if (target && !seen.has(next) && enter(target)) stack.push(next)
      }
    }
    return seen
  }
  const clientEntry = instrumentationClient?.getFilePath()
  const all = [...files.values()]
  const rootPaths = new Set(roots.map((r) => r.getFilePath() as string))
  const serverFiles = spread(
    all
      .filter((f) => (f.server || rootPaths.has(f.path)) && !f.client && f.path !== clientEntry)
      .map((f) => f.path),
    (f) => !f.client,
  )
  const clientFiles = spread(
    all.filter((f) => f.client || f.path === clientEntry).map((f) => f.path),
    (f) => !f.server,
  )
  const sideOf = (path: string): EnvSide | undefined => {
    const s = serverFiles.has(path)
    const c = clientFiles.has(path)
    return s && c ? 'both' : c ? 'client' : s ? 'server' : undefined
  }

  // --- Pages: the routes whose files import the file, directly or not ---
  const importers = new Map<string, string[]>()
  for (const f of all) {
    for (const target of f.imports) {
      const list = importers.get(target)
      if (list) list.push(f.path)
      else importers.set(target, [f.path])
    }
  }
  const routesOfFile = routeLookup(input)
  const order = new Map(input.routes.map((r, i) => [r.id, i]))
  const routeIdsOf = (path: string): string[] => {
    const ids = new Set<string>()
    const seen = new Set([path])
    const stack = [path]
    while (stack.length > 0) {
      const file = stack.pop() as string
      for (const id of routesOfFile(file)) ids.add(id)
      for (const from of importers.get(file) ?? []) {
        if (!seen.has(from)) {
          seen.add(from)
          stack.push(from)
        }
      }
    }
    return [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
  }
  // The pages whose client code reaches a file: up through client files to the `'use client'` files
  // (or `instrumentation-client`) that bring it, then the pages those are on.
  const clientRouteIdsOf = (path: string): string[] => {
    const ids = new Set<string>()
    const seen = new Set([path])
    const stack = [path]
    while (stack.length > 0) {
      const file = stack.pop() as string
      if (files.get(file)?.client || file === clientEntry) {
        for (const id of routeIdsOf(file)) ids.add(id)
        continue
      }
      for (const from of importers.get(file) ?? []) {
        if (clientFiles.has(from) && !seen.has(from)) {
          seen.add(from)
          stack.push(from)
        }
      }
    }
    return [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
  }

  // --- Reads by name ---
  const vars = new Map<string, EnvVar>()
  const varOf = (name: string): EnvVar => {
    let v = vars.get(name)
    if (!v) {
      v = { name, definedIn: [], reads: [] }
      vars.set(name, v)
    }
    return v
  }
  const unknown: EnvUnknownRead[] = []
  const place = (found: Found, side: EnvSide, routeIds: string[], clientRouteIds?: string[]) => {
    const read: EnvRead = {
      loc: found.loc,
      side,
      access: found.access,
      ...(found.optional ? { optional: true as const } : {}),
      routeIds,
      ...(clientRouteIds ? { clientRouteIds } : {}),
    }
    if (found.name !== undefined) varOf(found.name).reads.push(read)
    else {
      const { access: _, ...rest } = read
      unknown.push({ ...rest, key: found.key ?? '?' })
    }
  }
  for (const f of all) {
    if (f.reads.length === 0) continue
    const side = sideOf(f.path)
    if (!side) continue
    const routeIds = routeIdsOf(f.path)
    const clientRouteIds = side === 'both' ? clientRouteIdsOf(f.path) : undefined
    for (const found of f.reads) place(found, side, routeIds, clientRouteIds)
  }

  // --- next.config: its reads and its `env` names ---
  const configEnv = new Set<string>()
  const configText = input.nextConfig ? input.readFile(input.nextConfig) : undefined
  const configRel = input.nextConfig ? rel(input.nextConfig) : undefined
  if (configText !== undefined && input.nextConfig && configRel) {
    const sf = ts.createSourceFile(input.nextConfig, configText, ts.ScriptTarget.Latest, true)
    for (const name of configEnvNames(sf)) configEnv.add(name)
    if (configText.includes('process.env'))
      for (const found of readsIn(sf, root, undefined, configRel)) place(found, 'config', [])
  }

  // --- `.env*` files in the root: names only ---
  const envFiles: EnvFile[] = []
  const named = input
    .listDir(root)
    .filter((n) => ENV_FILE.test(n))
    .sort((a, b) => fileOrder(a) - fileOrder(b) || compare(a, b))
  for (const name of named) {
    const text = input.readFile(`${root}/${name}`)
    if (text === undefined) continue
    const names = envFileNames(text)
    const loads = envFileLoads(name)
    envFiles.push({ file: name, loads, names: names.length })
    for (const n of names) {
      const v = varOf(n)
      if (loads.length > 0) v.definedIn.push(name)
      else v.listedIn = [...(v.listedIn ?? []), name]
    }
  }
  if (configRel) for (const n of configEnv) varOf(n).definedIn.push(configRel)

  if (vars.size === 0 && unknown.length === 0 && envFiles.length === 0) return undefined

  // --- Flags ---
  const byLoc = (a: { loc: SourceLoc }, b: { loc: SourceLoc }) =>
    compare(a.loc.file, b.loc.file) || a.loc.line - b.loc.line || a.loc.column - b.loc.column
  const sorted = [...vars.values()].sort((a, b) => compare(a.name, b.name))
  for (const v of sorted) {
    v.reads.sort(byLoc)
    const by = setBy(v.name)
    if (by) v.setBy = by
    const inClient = v.reads.filter((r) => r.side === 'client' || r.side === 'both')
    const inlined = v.name.startsWith(PUBLIC_PREFIX) || NEXT_CLIENT.has(v.name) || configEnv.has(v.name)
    const flags: EnvFlag[] = []
    if (inClient.length > 0 && !inlined && !v.name.startsWith('__NEXT_')) {
      flags.push({ kind: 'private-in-client', loc: (inClient[0] as EnvRead).loc })
    }
    const destructured = inClient.find((r) => r.access === 'destructured')
    if (destructured && inlined) flags.push({ kind: 'not-inlined', loc: destructured.loc })
    const required = v.reads.find((r) => !r.optional)
    if (required && v.definedIn.length === 0 && !v.listedIn && !v.setBy) {
      flags.push({ kind: 'not-defined', loc: required.loc })
    }
    if (flags.length > 0) v.flags = flags
  }
  unknown.sort(byLoc)
  return { files: envFiles, vars: sorted, unknown }
}

/** `instrumentation.ts` (or `.js`...) next to the app directory. */
function findFile(input: EnvInput, dir: string, name: string): SourceFile | undefined {
  for (const ext of ['ts', 'tsx', 'js', 'jsx', 'mjs', 'mts']) {
    const file = input.fileAt(`${dir}/${name}.${ext}`)
    if (file) return file
  }
  return undefined
}

/** Which routes a file in the app directory (or the middleware) belongs to. */
function routeLookup(input: EnvInput): (path: string) => string[] {
  const byFile = new Map<string, string[]>()
  const push = (file: string, id: string) => {
    const list = byFile.get(file)
    if (list) {
      if (!list.includes(id)) list.push(id)
    } else byFile.set(file, [id])
  }
  for (const route of input.routes) {
    push(route.file, route.id)
    for (const layout of route.layoutChain) push(layout.file, route.id)
  }
  if (input.middleware)
    for (const id of input.middleware.routeIds) push(relativeTo(input.root, input.middleware.file), id)
  const appRel = relativeTo(input.root, input.appDir)
  const pages = input.routes.filter((r) => r.kind === 'page')
  return (path) => {
    const file = relativeTo(input.root, path)
    const known = byFile.get(file)
    if (known) return known
    // `loading`, `error`, `not-found`, `template`... cover the pages in their folder.
    if (!file.startsWith(`${appRel}/`) || !SPECIAL_FILE.test(file)) return []
    const dir = `${posix.dirname(file)}/`
    return pages.filter((p) => p.file.startsWith(dir)).map((p) => p.id)
  }
}

const SPECIAL_FILE =
  /\/(loading|error|not-found|template|default|global-error|forbidden|unauthorized)\.(tsx?|jsx?|mjs)$/

function checkerOf(sf: SourceFile): ts.TypeChecker {
  return sf.getProject().getTypeChecker().compilerObject
}

// --- Reading `process.env` ---

function isProcessEnv(node: ts.Node): node is ts.PropertyAccessExpression {
  return (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === 'env' &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'process'
  )
}

/**
 * Every read in a file. Without a checker (next.config), aliases are matched by name and constant
 * keys are left unknown.
 */
export function readsIn(
  sf: ts.SourceFile,
  root: string,
  checker: ts.TypeChecker | undefined,
  file = relativeTo(root, sf.fileName.replaceAll('\\', '/')),
): Found[] {
  const loc = (node: ts.Node): SourceLoc => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    return { file, line: line + 1, column: character + 1 }
  }
  const envNodes: ts.PropertyAccessExpression[] = []
  const holders: ts.Node[] = []
  const visit = (n: ts.Node) => {
    if (isProcessEnv(n)) envNodes.push(n)
    else if (
      (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) &&
      ts.isIdentifier(n.expression)
    )
      holders.push(n)
    else if (
      ts.isVariableDeclaration(n) &&
      ts.isObjectBindingPattern(n.name) &&
      n.initializer &&
      ts.isIdentifier(n.initializer)
    )
      holders.push(n)
    ts.forEachChild(n, visit)
  }
  visit(sf)

  const out: Found[] = []
  const aliases: ts.VariableDeclaration[] = []
  // `x.NAME`, `x['NAME']`, `x[KEY]` on `process.env` or an alias of it.
  const member = (node: ts.PropertyAccessExpression | ts.ElementAccessExpression, access: EnvAccess) => {
    if (isWrite(node)) return
    const optional = isOptional(node)
    if (ts.isPropertyAccessExpression(node)) {
      out.push({ name: node.name.text, access, optional, loc: loc(node) })
      return
    }
    const arg = node.argumentExpression
    if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
      out.push({ name: arg.text, access: access === 'alias' ? 'alias' : 'literal', optional, loc: loc(node) })
      return
    }
    const constant = checker ? constantString(arg, checker) : undefined
    if (constant !== undefined) out.push({ name: constant, access: 'constant', optional, loc: loc(node) })
    else out.push({ key: arg.getText(sf), access, optional, loc: loc(node) })
  }
  // `const { A, B: b, C = 'x' } = <process.env or an alias>`.
  const destructure = (pattern: ts.ObjectBindingPattern) => {
    for (const element of pattern.elements) {
      if (element.dotDotDotToken) continue
      const prop = element.propertyName ?? element.name
      const name = ts.isIdentifier(prop) || ts.isStringLiteral(prop) ? prop.text : undefined
      if (name === undefined) continue
      out.push({
        name,
        access: 'destructured',
        optional: element.initializer !== undefined,
        loc: loc(element),
      })
    }
  }

  for (const node of envNodes) {
    let parent = node.parent
    while (parent && ts.isParenthesizedExpression(parent)) parent = parent.parent
    if (!parent) continue
    if (
      (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
      skipParens(parent.expression) === node
    ) {
      member(parent, 'direct')
    } else if (
      ts.isVariableDeclaration(parent) &&
      parent.initializer &&
      skipParens(parent.initializer) === node
    ) {
      if (ts.isObjectBindingPattern(parent.name)) destructure(parent.name)
      else if (ts.isIdentifier(parent.name)) aliases.push(parent)
    }
    // Anything else hands the whole object on (`parse(process.env)`): which names it reads is unknown.
  }

  if (aliases.length > 0) {
    const names = new Set(aliases.map((a) => (a.name as ts.Identifier).text))
    const symbols = checker
      ? new Set(aliases.map((a) => checker.getSymbolAtLocation(a.name)).filter((s) => s !== undefined))
      : undefined
    const isAlias = (id: ts.Identifier) => {
      if (!names.has(id.text)) return false
      if (!checker || !symbols) return true
      const symbol = checker.getSymbolAtLocation(id)
      return symbol !== undefined && symbols.has(symbol)
    }
    for (const holder of holders) {
      if (ts.isVariableDeclaration(holder)) {
        if (isAlias(holder.initializer as ts.Identifier)) destructure(holder.name as ts.ObjectBindingPattern)
      } else if (
        isAlias(
          (holder as ts.PropertyAccessExpression | ts.ElementAccessExpression).expression as ts.Identifier,
        )
      ) {
        member(holder as ts.PropertyAccessExpression | ts.ElementAccessExpression, 'alias')
      }
    }
  }
  out.sort((a, b) => a.loc.line - b.loc.line || a.loc.column - b.loc.column)
  return out
}

function skipParens(node: ts.Node): ts.Node {
  let n = node
  while (ts.isParenthesizedExpression(n)) n = n.expression
  return n
}

/** `process.env.X = ...` and `delete process.env.X` set the variable; they don't read it. */
function isWrite(node: ts.Node): boolean {
  const parent = node.parent
  if (!parent) return false
  if (ts.isBinaryExpression(parent) && parent.left === node) {
    const op = parent.operatorToken.kind
    return op === ts.SyntaxKind.EqualsToken
  }
  return ts.isDeleteExpression(parent)
}

const CHECKS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
])

const FALLBACKS = new Set([
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
])

/**
 * A fallback (`??`, `||`) or a check (`if`, `===`, `!`, `&&`) handles a missing value, also an optional
 * chain (`process.env.X?.trim()`) and one of those on the variable the value is stored in
 * (`const user = process.env.X; if (user) ...`) in the same function.
 */
function isOptional(node: ts.Node, stored = true): boolean {
  let cur: ts.Node = node
  let parent = cur.parent
  while (
    parent &&
    (ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isTypeAssertionExpression(parent) ||
      ts.isSatisfiesExpression(parent))
  ) {
    cur = parent
    parent = parent.parent
  }
  if (!parent) return false
  if (
    (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
    parent.expression === cur
  )
    return parent.questionDotToken !== undefined
  if (
    stored &&
    ts.isVariableDeclaration(parent) &&
    parent.initializer === cur &&
    ts.isIdentifier(parent.name)
  )
    return checkedLater(parent.name)
  if (ts.isBinaryExpression(parent)) {
    const op = parent.operatorToken.kind
    // `if (user && pass)`: the right side is checked when the whole is.
    if (
      parent.right === cur &&
      (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) &&
      isOptional(parent, false)
    )
      return true
    return (parent.left === cur && FALLBACKS.has(op)) || CHECKS.has(op)
  }
  if (ts.isPrefixUnaryExpression(parent)) return parent.operator === ts.SyntaxKind.ExclamationToken
  if (ts.isTypeOfExpression(parent)) return true
  if (ts.isIfStatement(parent) || ts.isWhileStatement(parent)) return parent.expression === cur
  if (ts.isConditionalExpression(parent)) return parent.condition === cur
  if (ts.isCallExpression(parent)) {
    return ts.isIdentifier(parent.expression) && parent.expression.text === 'Boolean'
  }
  return false
}

/** A use of the variable `name` declares, in the function (or file) around it, handles a missing value. */
function checkedLater(name: ts.Identifier): boolean {
  let scope: ts.Node = name
  while (scope.parent && !ts.isSourceFile(scope) && !ts.isFunctionLike(scope)) scope = scope.parent
  let found = false
  const visit = (n: ts.Node) => {
    if (found) return
    if (
      ts.isIdentifier(n) &&
      n !== name &&
      n.text === name.text &&
      !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) &&
      !(ts.isPropertyAssignment(n.parent) && n.parent.name === n) &&
      isOptional(n, false)
    )
      found = true
    else ts.forEachChild(n, visit)
  }
  visit(scope)
  return found
}

/** A name or property bound to a string constant: `const KEY = 'X'`, `KEYS.x` with `as const`. */
function constantString(node: ts.Expression, checker: ts.TypeChecker): string | undefined {
  const type = checker.getTypeAtLocation(node)
  return type.isStringLiteral() ? type.value : undefined
}

/** Names under `env: { ... }` in next.config. */
function configEnvNames(sf: ts.SourceFile): string[] {
  const out: string[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      node.name.text === 'env' &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const prop of node.initializer.properties) {
        if (
          (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) &&
          (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
        )
          out.push(prop.name.text)
      }
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}
