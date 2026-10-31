// Middleware (M14): `middleware.ts` (Next <= 15) or `proxy.ts` (Next 16) next to the app directory.
// Reads the exported function and `config.matcher`, and works out which routes it runs on. The
// request scanner walks the function itself (requests, redirects, rewrites).
import { posix } from 'node:path'
import {
  type MatcherCondition,
  type Middleware,
  type MiddlewareMatcher,
  type MiddlewareRoute,
  middlewareRunsOn,
  type Route,
  type SourceLoc,
} from '@flow-checker/shared'
import { type FileSystemHost, Node as N, type Node, type SourceFile, ts } from 'ts-morph'
import { importModuleOf, isPackage, unalias } from './components'
import { relativeTo } from './paths'

const NAMES = ['proxy', 'middleware'] as const
const EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs']

/** Matches a middleware file path relative to the root, for the watcher. */
export const MIDDLEWARE_FILE = /^(src\/)?(proxy|middleware)\.(ts|tsx|js|jsx|mts|mjs)$/

/**
 * The middleware file: at the same level as the app directory (`src/` for `src/app`), or in the
 * root. `proxy` wins over `middleware` (Next 16 refuses to start with both).
 */
export function findMiddleware(fs: FileSystemHost, root: string, appDir: string): string | undefined {
  const dirs = [...new Set([posix.dirname(appDir), root])]
  for (const name of NAMES) {
    for (const dir of dirs) {
      for (const ext of EXTENSIONS) {
        const file = `${dir}/${name}.${ext}`
        if (fs.fileExistsSync(file)) return file
      }
    }
  }
  return undefined
}

/** What the scan reads from the middleware file before the request walk. */
export interface MiddlewareFile {
  info: Omit<Middleware, 'routes' | 'rewrites'>
  /** Functions to walk for requests, redirects and rewrites. */
  functions: Node[]
}

export function readMiddleware(file: SourceFile, root: string): MiddlewareFile {
  const rel = relativeTo(root, file.getFilePath())
  const convention = posix.basename(rel).startsWith('proxy.') ? 'proxy' : 'middleware'
  const exported = file.getExportedDeclarations()
  const exportName = ['default', 'proxy', 'middleware'].find((name) => exported.has(name))
  let decl = exportName ? exported.get(exportName)?.[0] : undefined
  if (decl && N.isExportAssignment(decl)) decl = decl.getExpression()

  const functions: Node[] = []
  let factory: Middleware['factory']
  let factoryCall: Node | undefined
  const value = decl ? valueBehind(decl) : undefined
  if (value && isFunction(value)) functions.push(value)
  else if (value && N.isCallExpression(value)) {
    // `createMiddleware(routing)`, `auth((req) => ...)`: a package factory, maybe with a handler.
    factoryCall = value
    const callee = value.getExpression()
    const module = importModuleOf(callee)
    if (module && isPackage(module)) factory = { module, name: importedName(callee) }
    for (const arg of value.getArguments()) {
      const fn = valueBehind(arg)
      if (fn && isFunction(fn)) functions.push(fn)
    }
  }

  const config = exported.get('config')?.[0]
  const matcherNode = config ? propertyOf(valueBehind(config), 'matcher') : undefined
  const { matchers, matcherText } = readMatchers(matcherNode)

  const anchor = functions[0] ?? factoryCall ?? decl ?? file
  const i18n = factory && /^next-intl(\/|$)/.test(factory.module) ? readIntlRouting(factoryCall) : undefined
  return {
    info: {
      file: rel,
      convention,
      ...(exportName ? { exportName } : {}),
      loc: locOf(root, anchor),
      ...(factory ? { factory } : {}),
      matchers,
      ...(matcherText !== undefined ? { matcherText } : {}),
      ...(i18n ? { i18n } : {}),
    },
    functions,
  }
}

function readMatchers(node: Node | undefined): { matchers: MiddlewareMatcher[]; matcherText?: string } {
  if (!node) return { matchers: [] }
  const value = literal(node)
  const list = Array.isArray(value) ? value : [value]
  const matchers: MiddlewareMatcher[] = []
  for (const item of list) {
    if (typeof item === 'string') {
      matchers.push({ source: item })
      continue
    }
    if (!isRecord(item) || typeof item.source !== 'string')
      return { matchers: [], matcherText: oneLine(node) }
    const has = conditions(item.has)
    const missing = conditions(item.missing)
    matchers.push({
      source: item.source,
      ...(has ? { has } : {}),
      ...(missing ? { missing } : {}),
      ...(item.locale === false ? { locale: false as const } : {}),
    })
  }
  return { matchers }
}

function conditions(value: unknown): MatcherCondition[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const out: MatcherCondition[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.key !== 'string') continue
    const type = item.type
    if (type !== 'header' && type !== 'query' && type !== 'cookie' && type !== 'host') continue
    out.push({ type, key: item.key, ...(typeof item.value === 'string' ? { value: item.value } : {}) })
  }
  return out.length > 0 ? out : undefined
}

/** next-intl `createMiddleware(routing)` where `routing = defineRouting({ locales, ... })`. */
function readIntlRouting(call: Node | undefined): Middleware['i18n'] {
  if (!call || !N.isCallExpression(call)) return undefined
  const arg = call.getArguments()[0]
  let routing = arg ? valueBehind(arg) : undefined
  if (routing && N.isCallExpression(routing)) routing = routing.getArguments()[0]
  const value = routing ? literal(routing) : undefined
  if (!isRecord(value) || !Array.isArray(value.locales)) return undefined
  const locales = value.locales.filter((l): l is string => typeof l === 'string')
  if (locales.length === 0) return undefined
  const prefix = value.localePrefix
  const localePrefix = typeof prefix === 'string' ? prefix : isRecord(prefix) ? prefix.mode : undefined
  return {
    locales,
    ...(typeof value.defaultLocale === 'string' ? { defaultLocale: value.defaultLocale } : {}),
    ...(typeof localePrefix === 'string' ? { localePrefix } : {}),
  }
}

// --- Routes ---------------------------------------------------------------------------------

/** The routes the middleware runs on: tried with sample paths for each route pattern. */
export function middlewareRoutes(info: MiddlewareFile['info'], routes: Route[]): MiddlewareRoute[] {
  const mw: Middleware = { ...info, routes: [], rewrites: [] }
  // Values to try in dynamic segments: plain `x`, then words from the matchers and the locales.
  const words = new Set<string>(info.i18n?.locales ?? [])
  for (const m of info.matchers) for (const w of m.source.match(/[A-Za-z0-9_-]+/g) ?? []) words.add(w)
  const out: MiddlewareRoute[] = []
  for (const route of routes) {
    const plain = middlewareRunsOn(mw, samplePath(route.path, 'x'))
    if (plain === 'yes') {
      out.push({ routeId: route.id })
      continue
    }
    if (plain === 'conditional') {
      out.push({ routeId: route.id, conditional: true })
      continue
    }
    if (!route.path.includes('[')) continue
    const some = [...words].some((w) => middlewareRunsOn(mw, samplePath(route.path, w)) !== 'no')
    if (some) out.push({ routeId: route.id, conditional: true })
  }
  return out
}

/** `/[locale]/users/[id]` -> `/x/users/x`. Optional catch-alls are left out. */
export function samplePath(path: string, value: string): string {
  const out = path
    .replace(/\/\[\[\.\.\.[^\]]+\]\]/g, '')
    .replace(/\[\.\.\.[^\]]+\]/g, value)
    .replace(/\[[^\]]+\]/g, value)
  return out === '' ? '/' : out
}

/** Pages a path check covers: `prefix` `/dashboard` covers `/dashboard` and `/dashboard/x`. */
export function routesUnder(
  from: { kind: 'prefix' | 'exact'; path: string },
  routes: Route[],
  candidates: readonly string[],
): string[] {
  const trim = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p)
  const base = trim(from.path)
  return routes
    .filter((r) => candidates.includes(r.id))
    .filter((r) => {
      const sample = trim(samplePath(r.path, 'x'))
      if (from.kind === 'exact') return sample === base
      return base === '/' || sample === base || sample.startsWith(`${base}/`)
    })
    .map((r) => r.id)
}

// --- Static values --------------------------------------------------------------------------

/** Follows identifiers (also through imports) to the value they are set to. */
function valueBehind(node: Node | undefined, depth = 0): Node | undefined {
  let current = node
  for (let i = 0; current && i < 10 + depth; i++) {
    current = skipWrappers(current)
    if (N.isVariableDeclaration(current)) {
      current = current.getInitializer()
      continue
    }
    if (N.isExportAssignment(current)) {
      current = current.getExpression()
      continue
    }
    if (N.isIdentifier(current)) {
      const symbol = current.getSymbol()
      const decl = symbol ? unalias(symbol).getDeclarations()[0] : undefined
      if (!decl || decl === current) return current
      if (N.isFunctionDeclaration(decl)) return decl
      if (N.isVariableDeclaration(decl)) {
        current = decl.getInitializer()
        continue
      }
      return current
    }
    return current
  }
  return current
}

function skipWrappers(node: Node): Node {
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

const UNKNOWN = Symbol('unknown')

/** A JSON-like literal value, or `UNKNOWN` for anything not written out in the code. */
function literal(node: Node | undefined, depth = 0): unknown {
  if (!node || depth > 10) return UNKNOWN
  const value = valueBehind(node)
  if (!value) return UNKNOWN
  if (N.isStringLiteral(value) || N.isNoSubstitutionTemplateLiteral(value)) return value.getLiteralValue()
  if (N.isNumericLiteral(value)) return value.getLiteralValue()
  if (value.getKind() === ts.SyntaxKind.TrueKeyword) return true
  if (value.getKind() === ts.SyntaxKind.FalseKeyword) return false
  if (N.isArrayLiteralExpression(value)) {
    const out: unknown[] = []
    for (const element of value.getElements()) {
      if (N.isSpreadElement(element)) {
        const inner = literal(element.getExpression(), depth + 1)
        if (!Array.isArray(inner)) return UNKNOWN
        out.push(...inner)
      } else {
        const item = literal(element, depth + 1)
        if (item === UNKNOWN) return UNKNOWN
        out.push(item)
      }
    }
    return out
  }
  if (N.isObjectLiteralExpression(value)) {
    const out: Record<string, unknown> = {}
    for (const p of value.getProperties()) {
      if (N.isPropertyAssignment(p)) {
        const name = p.getNameNode()
        const key =
          N.isIdentifier(name) || N.isStringLiteral(name)
            ? name.getText().replace(/^['"]|['"]$/g, '')
            : undefined
        if (key === undefined) continue
        const v = literal(p.getInitializer(), depth + 1)
        if (v !== UNKNOWN) out[key] = v
      } else if (N.isShorthandPropertyAssignment(p)) {
        const v = literal(p.getNameNode(), depth + 1)
        if (v !== UNKNOWN) out[p.getName()] = v
      }
    }
    return out
  }
  return UNKNOWN
}

function propertyOf(obj: Node | undefined, name: string): Node | undefined {
  if (!obj || !N.isObjectLiteralExpression(obj)) return undefined
  const prop = obj.getProperty(name)
  if (prop && N.isPropertyAssignment(prop)) return prop.getInitializer()
  if (prop && N.isShorthandPropertyAssignment(prop)) return prop.getNameNode()
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFunction(node: Node): boolean {
  return N.isFunctionDeclaration(node) || N.isFunctionExpression(node) || N.isArrowFunction(node)
}

function importedName(callee: Node): string {
  if (!N.isIdentifier(callee)) return callee.getText()
  const symbol = callee.getSymbol()
  const decl = symbol?.getDeclarations()[0]
  if (decl && N.isImportClause(decl)) return callee.getText()
  if (decl && N.isImportSpecifier(decl)) return decl.getName()
  return callee.getText()
}

function oneLine(node: Node): string {
  return node.getText().replace(/\s+/g, ' ')
}

function locOf(root: string, node: Node): SourceLoc {
  const file = node.getSourceFile()
  const { line, column } = file.getLineAndColumnAtPos(node.getStart())
  return { file: relativeTo(root, file.getFilePath()), line, column }
}
