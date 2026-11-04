// Server/client leaks (M44): which imports only work on the server, and which props a server
// component can't hand to a client component.
//
// Checked with `next dev` (16.4.3, React 19.3), one page per case. In client code, `server-only`,
// `next/headers` and `revalidatePath` from `next/cache` fail to compile ("You're importing a module
// that depends on ..."), and so do Node modules Next has no browser version of (`fs`, `node:fs`,
// `child_process`: "Module not found"); `path`, `node:path` and `crypto` work. It fails the same
// through a plain project file the client file imports, but not through a `'use server'` file (the
// client only gets a reference) or a type-only import. Props: functions (also in objects, arrays and
// object methods), class instances, `Object.create(null)`, `Symbol()`, `RegExp` and `WeakMap` fail;
// `Date`, `Map`, `Set`, `URL`, `Error`, `Headers`, `FormData`, `Blob`, typed arrays, iterables,
// promises, objects and classes with `toJSON`, `Symbol.for()`, server actions (also `.bind()`) and
// functions exported from a `'use client'` file pass, as React's serializer reads them.
import { builtinModules } from 'node:module'
import type { PropLeak, ServerModuleKind } from '@flow-checker/shared'
import {
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  Node as N,
  type Node,
  type Symbol as TsSymbol,
  type Type,
  ts,
} from 'ts-morph'
import { directives, unalias } from './components'

/** Node modules Next replaces with a browser version (its webpack `fallback` list). */
const NODE_POLYFILLED = new Set([
  'assert',
  'buffer',
  'constants',
  'crypto',
  'domain',
  'events',
  'http',
  'https',
  'os',
  'path',
  'process',
  'punycode',
  'querystring',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tty',
  'url',
  'util',
  'vm',
  'zlib',
])

const NODE_BUILTINS = new Set(builtinModules.map((m) => m.split('/')[0] as string))

/** Database clients: in client code they fail, or ship a connection to the browser. */
const DATABASE = new Set([
  '@libsql/client',
  '@mikro-orm/core',
  '@neondatabase/serverless',
  '@planetscale/database',
  '@prisma/client',
  '@redis/client',
  '@vercel/kv',
  '@vercel/postgres',
  'better-sqlite3',
  'ioredis',
  'knex',
  'mariadb',
  'mongodb',
  'mongoose',
  'mysql',
  'mysql2',
  'pg',
  'pg-pool',
  'postgres',
  'redis',
  'sequelize',
  'sqlite3',
  'typeorm',
])

/** Drizzle's driver entry points (its schema builders, `drizzle-orm/pg-core`..., work anywhere). */
const DRIZZLE_DRIVER =
  /^drizzle-orm\/(node-postgres|postgres-js|mysql2|better-sqlite3|libsql|neon-http|neon-serverless|planetscale-serverless|vercel-postgres|bun-sqlite|d1|mysql-proxy|pg-proxy|sqlite-proxy)(\/|$)/

/** Packages that only run on Node.js (native addons, server SDKs). */
const NODE_PACKAGES = new Set([
  '@node-rs/argon2',
  '@node-rs/bcrypt',
  'argon2',
  'bcrypt',
  'firebase-admin',
  'nodemailer',
  'playwright',
  'playwright-core',
  'puppeteer',
  'puppeteer-core',
  'sharp',
])

/** Next modules client code can't import at all (Next's compiler rejects them). */
const NEXT_SERVER_MODULES = new Set(['next/headers', 'next/root-params'])

/** Exports of Next modules that client code can't import (from Next's compiler, 15 and 16). */
const NEXT_SERVER_NAMES: Record<string, ReadonlySet<string>> = {
  'next/cache': new Set([
    'revalidatePath',
    'revalidateTag',
    'cacheLife',
    'cacheTag',
    'unstable_cacheLife',
    'unstable_cacheTag',
    'unstable_expirePath',
    'unstable_expireTag',
  ]),
  'next/server': new Set(['after']),
}

export interface ServerModule {
  category: ServerModuleKind
  /** The server-only names imported, for modules where only some are. */
  names?: string[]
}

/**
 * Whether client code may not import `specifier`. `names` are the imported names (undefined for a
 * side-effect, default or namespace import).
 */
export function serverModuleOf(
  specifier: string,
  names: readonly string[] | undefined,
): ServerModule | undefined {
  if (specifier === 'server-only') return { category: 'server-only' }
  if (NEXT_SERVER_MODULES.has(specifier)) return { category: 'next-server' }
  const limited = NEXT_SERVER_NAMES[specifier]
  if (limited) {
    const found = (names ?? []).filter((n) => limited.has(n))
    return found.length > 0 ? { category: 'next-server', names: found } : undefined
  }
  const bare = specifier.startsWith('node:') ? specifier.slice(5) : specifier
  const base = bare.split('/')[0] as string
  if ((specifier.startsWith('node:') || NODE_BUILTINS.has(base)) && !specifier.startsWith('@')) {
    // `fs/promises` is `fs`; Next has browser versions of a few modules only.
    if (NODE_BUILTINS.has(base) || specifier.startsWith('node:'))
      return NODE_POLYFILLED.has(base) ? undefined : { category: 'node' }
  }
  const pkg = packageName(specifier)
  if (DRIZZLE_DRIVER.test(specifier)) return { category: 'database' }
  if (DATABASE.has(pkg)) {
    // libSQL's web client works in the browser over HTTP.
    if (pkg === '@libsql/client' && specifier !== pkg && !specifier.endsWith('/node')) return undefined
    return { category: 'database' }
  }
  if (NODE_PACKAGES.has(pkg)) return { category: 'node-package' }
  return undefined
}

/** Names an import declaration or re-export brings, as exported (`a as b` gives `a`). */
export function importedNames(literal: Node): string[] | undefined {
  const parent = literal.getParent()
  if (N.isImportDeclaration(parent)) {
    const clause = parent.getImportClause()
    if (!clause) return undefined
    return clause.getNamedImports().flatMap((n) => (n.isTypeOnly() ? [] : [n.getName()]))
  }
  if (N.isExportDeclaration(parent)) {
    const named = parent.getNamedExports()
    return named.length > 0 ? named.flatMap((n) => (n.isTypeOnly() ? [] : [n.getName()])) : undefined
  }
  return undefined
}

/** `@scope/pkg/sub` -> `@scope/pkg`, `pkg/sub` -> `pkg`. */
export function packageName(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] as string)
}

// --- Props ---

/** A prop that can't cross, before it is placed in the model. */
export type FoundProp = Pick<PropLeak, 'value' | 'prop' | 'type'> & { node: Node }

/** How deep to look inside objects and arrays. */
const MAX_DEPTH = 4

/** Built-ins React sends to the browser; the generic ones are checked by what they hold. */
const SERIALIZABLE_BUILTINS = new Set([
  'Date',
  'Map',
  'ReadonlyMap',
  'Set',
  'ReadonlySet',
  'Array',
  'ReadonlyArray',
  'Promise',
  'PromiseLike',
  'FormData',
  'ArrayBuffer',
  'SharedArrayBuffer',
  'DataView',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'Blob',
  'File',
  'ReadableStream',
  'String',
  'Number',
  'Boolean',
  'BigInt',
])

/** Built-ins whose type arguments are what crosses. */
const CONTAINERS = new Set([
  'Map',
  'ReadonlyMap',
  'Set',
  'ReadonlySet',
  'Array',
  'ReadonlyArray',
  'Promise',
  'PromiseLike',
])

/**
 * Props of the JSX elements in `body` whose tag is `tag` (a client component) that can't cross
 * from the server: each attribute, spread attributes by property, and `children` expressions.
 */
export function propLeaksIn(body: Node, tag: string, forwarded?: Forwarded): FoundProp[] {
  const out: FoundProp[] = []
  const checker = () => new Checker(forwarded)
  for (const node of jsxElements(body, tag)) {
    for (const attr of node.getAttributes()) {
      if (N.isJsxSpreadAttribute(attr)) {
        const found = checker().spread(attr.getExpression())
        if (found) out.push({ ...found, node: attr })
        continue
      }
      const name = attr.getNameNode().getText()
      if (name === 'key' || name === 'ref') continue
      const init = attr.getInitializer()
      const value = init && N.isJsxExpression(init) ? init.getExpression() : undefined
      if (!value) continue
      const found = checker().value(value, name, 0)
      if (found) out.push({ ...found, node: attr })
    }
    const parent = node.getParent()
    if (N.isJsxOpeningElement(node) && N.isJsxElement(parent)) {
      for (const child of parent.getJsxChildren()) {
        if (!N.isJsxExpression(child)) continue
        const value = child.getExpression()
        if (!value) continue
        const found = checker().value(value, 'children', 0)
        if (found) out.push({ ...found, node: child })
      }
    }
  }
  return out
}

/**
 * The values a component's callers pass for one of its props (`fn` is the component's function), or
 * undefined when that can't be told (no caller in the scan, a spread).
 */
export type Forwarded = (fn: Node, prop: string) => Node[] | undefined

/** The JSX elements in `body` whose tag is written `tag` (`Widget`, `UI.Button`). */
export function jsxElements(body: Node, tag: string): (JsxOpeningElement | JsxSelfClosingElement)[] {
  const sf = body.getSourceFile()
  const found: ts.Node[] = []
  const visit = (n: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) &&
      n.tagName.getText(sf.compilerNode) === tag
    )
      found.push(n)
    ts.forEachChild(n, visit)
  }
  visit(body.compilerNode)
  return found.flatMap((n) => {
    const node = wrap(body, n)
    return node && (N.isJsxOpeningElement(node) || N.isJsxSelfClosingElement(node)) ? [node] : []
  })
}

/** What an element passes for `prop`: its value, or undefined when a spread may hold it. */
export function passedFor(
  element: JsxOpeningElement | JsxSelfClosingElement,
  prop: string,
): Node[] | undefined {
  const out: Node[] = []
  for (const attr of element.getAttributes()) {
    if (N.isJsxSpreadAttribute(attr)) return undefined
    if (attr.getNameNode().getText() !== prop) continue
    const init = attr.getInitializer()
    const value = init && N.isJsxExpression(init) ? init.getExpression() : init
    if (value) out.push(value)
  }
  return out
}

type Found = Omit<FoundProp, 'node'>

/** Walks one prop's value: by its syntax where that is clear, by its type otherwise. */
class Checker {
  readonly #seen = new Set<Type>()
  readonly #forwarded: Forwarded | undefined

  constructor(forwarded?: Forwarded) {
    this.#forwarded = forwarded
  }

  value(expr: Node, path: string, depth: number): Found | undefined {
    if (depth > MAX_DEPTH) return undefined
    const e = skipOuter(expr)
    if (N.isArrowFunction(e) || N.isFunctionExpression(e))
      return isServerActionFn(e) ? undefined : { value: 'function', prop: path }
    if (N.isObjectLiteralExpression(e)) {
      for (const prop of e.getProperties()) {
        if (N.isPropertyAssignment(prop)) {
          const init = prop.getInitializer()
          const found = init && this.value(init, join(path, propName(prop.getNameNode())), depth + 1)
          if (found) return found
        } else if (N.isShorthandPropertyAssignment(prop)) {
          const found = this.value(prop.getNameNode(), join(path, prop.getName()), depth + 1)
          if (found) return found
        } else if (N.isMethodDeclaration(prop)) {
          return { value: 'function', prop: join(path, propName(prop.getNameNode())) }
        } else if (N.isSpreadAssignment(prop)) {
          const inner = prop.getExpression()
          const found = this.type(inner.getType(), inner, path, depth + 1, true)
          if (found) return found
        }
        // Getters and setters: the value is read when it is sent.
      }
      return undefined
    }
    if (N.isArrayLiteralExpression(e)) {
      for (const element of e.getElements()) {
        const inner = N.isSpreadElement(element) ? element.getExpression() : element
        const found = N.isSpreadElement(element)
          ? this.type(inner.getType(), inner, `${path}[]`, depth + 1, false)
          : this.value(inner, `${path}[]`, depth + 1)
        if (found) return found
      }
      return undefined
    }
    if (N.isConditionalExpression(e))
      return this.value(e.getWhenTrue(), path, depth) ?? this.value(e.getWhenFalse(), path, depth)
    if (N.isCallExpression(e)) {
      const callee = e.getExpression()
      // `Symbol('x')` makes a local symbol; only `Symbol.for('x')` crosses.
      if (N.isIdentifier(callee) && callee.getText() === 'Symbol' && isGlobal(callee))
        return { value: 'symbol', prop: path }
      if (isNullPrototype(e)) return { value: 'null-prototype', prop: path }
      // `action.bind(null, id)` is still a server action.
      if (
        N.isPropertyAccessExpression(callee) &&
        callee.getName() === 'bind' &&
        isReference(callee.getExpression())
      )
        return undefined
    }
    if ((N.isIdentifier(e) || N.isPropertyAccessExpression(e)) && isReference(e)) return undefined
    // A prop the server component got from its caller: check what the callers pass (a server action
    // handed on through a server wrapper stays fine).
    const passed = this.#passedOn(e)
    if (passed) {
      for (const value of passed) {
        const found = this.value(value, path, depth + 1)
        if (found) return found
      }
      return undefined
    }
    // A name bound to a value written here: check that value (an object holding a server action).
    if (N.isIdentifier(e)) {
      const decl = declarationOf(e)
      if (decl && N.isVariableDeclaration(decl) && decl.getSourceFile() === e.getSourceFile()) {
        const init = decl.getInitializer()
        if (init && !N.isAwaitExpression(skipOuter(init)) && !N.isCallExpression(skipOuter(init)))
          return this.value(init, path, depth)
      }
    }
    return this.type(e.getType(), e, path, depth, false)
  }

  /**
   * A spread attribute. The server component's own props (`{...props}`, or the rest of them,
   * `({ variant, ...props })`) are checked by what its callers pass for each one: their type often
   * lists every handler of the element they end up on (`ComponentProps<typeof Link>`). When the
   * callers can't be read, only the props they must pass are judged by type.
   */
  spread(expr: Node): Found | undefined {
    const fn = this.#ownProps(expr)
    if (!fn || !this.#forwarded) return this.type(expr.getType(), expr, '', 0, true)
    for (const prop of expr.getType().getProperties()) {
      const name = prop.getName()
      const passed = this.#forwarded(fn, name)
      if (passed) {
        for (const value of passed) {
          const found = this.value(value, name, 1)
          if (found) return found
        }
      } else if (!prop.isOptional()) {
        const found = this.property(prop, expr, name, 0)
        if (found) return found
      }
    }
    return undefined
  }

  /** The component whose props parameter `expr` is, or the rest of whose destructured props it is. */
  #ownProps(expr: Node): Node | undefined {
    const e = skipOuter(expr)
    if (!N.isIdentifier(e)) return undefined
    const decl = declarationOf(e)
    let param: Node | undefined
    if (decl && N.isParameterDeclaration(decl)) param = decl
    else if (decl && N.isBindingElement(decl) && decl.getDotDotDotToken()) {
      const pattern = decl.getParent()
      if (N.isObjectBindingPattern(pattern)) param = pattern.getParent()
    }
    if (!param || !N.isParameterDeclaration(param)) return undefined
    const fn = param.getParent()
    return N.isFunctionLikeDeclaration(fn) && fn.getParameters()[0] === param ? fn : undefined
  }

  /** `onSave` from `({ onSave })` or `props.onSave`: the values the component's callers pass. */
  #passedOn(e: Node): Node[] | undefined {
    if (!this.#forwarded) return undefined
    let prop: string | undefined
    let param: Node | undefined
    if (N.isIdentifier(e)) {
      const decl = declarationOf(e)
      const pattern = decl?.getParent()
      if (
        decl &&
        N.isBindingElement(decl) &&
        N.isObjectBindingPattern(pattern) &&
        N.isParameterDeclaration(pattern.getParent())
      ) {
        prop = decl.getPropertyNameNode()?.getText() ?? decl.getName()
        param = pattern.getParent()
      }
    } else if (N.isPropertyAccessExpression(e)) {
      const decl = declarationOf(e.getExpression())
      if (decl && N.isParameterDeclaration(decl)) {
        prop = e.getName()
        param = decl
      }
    }
    if (!prop || !param || !N.isParameterDeclaration(param)) return undefined
    const fn = param.getParent()
    // Only the first parameter of a component holds its props.
    if (!N.isFunctionLikeDeclaration(fn) || fn.getParameters()[0] !== param) return undefined
    return this.#forwarded(fn, prop)
  }

  /** By type: `spread` reads the type's properties as props of their own. */
  type(type: Type, at: Node, path: string, depth: number, spread: boolean): Found | undefined {
    if (depth > MAX_DEPTH || this.#seen.has(type)) return undefined
    if (type.isAny() || type.isUnknown() || type.isNever() || type.isTypeParameter()) return undefined
    if (type.isUnion()) {
      for (const member of type.getUnionTypes()) {
        const found = this.type(member, at, path, depth, spread)
        if (found) return found
      }
      return undefined
    }
    if (!type.isObject() && !type.isIntersection()) return undefined
    this.#seen.add(type)
    try {
      // Components count too: a `forwardRef` or `memo` component is an object holding a function.
      if (type.getCallSignatures().length > 0) return { value: 'function', prop: path }
      if (fromReact(type)) return undefined
      if (type.isArray() || type.isReadonlyArray()) {
        const element = type.getArrayElementType() ?? type.getTypeArguments()[0]
        return element ? this.type(element, at, `${path}[]`, depth + 1, false) : undefined
      }
      if (type.isTuple()) {
        for (const element of type.getTupleElements()) {
          const found = this.type(element, at, `${path}[]`, depth + 1, false)
          if (found) return found
        }
        return undefined
      }
      const symbol = type.getSymbol() ?? type.getAliasSymbol()
      const name = symbol?.getName() ?? ''
      const lib = !!symbol && fromLib(symbol)
      if (lib && (SERIALIZABLE_BUILTINS.has(name) || /Error$/.test(name))) {
        if (!CONTAINERS.has(name)) return undefined
        for (const arg of type.getTypeArguments()) {
          const found = this.type(arg, at, `${path}[]`, depth + 1, false)
          if (found) return found
        }
        return undefined
      }
      // `toJSON` decides what is sent; an iterable is sent as its items.
      if (
        hasProperty(type, 'toJSON') ||
        hasProperty(type, '__@iterator') ||
        hasProperty(type, '__@asyncIterator')
      )
        return undefined
      if (lib) {
        // A built-in made with `new` (`RegExp`, `WeakMap`, `AbortSignal`) isn't a plain object.
        if (symbol?.getValueDeclaration()) return { value: 'class-instance', prop: path, type: name }
      } else if (type.isClass() || symbol?.getDeclarations().some((d) => N.isClassDeclaration(d))) {
        return { value: 'class-instance', prop: path, type: name }
      }
      // A plain object: what each property holds.
      for (const prop of type.getProperties()) {
        const found = this.property(prop, at, spread ? prop.getName() : join(path, prop.getName()), depth)
        if (found) return found
      }
      return undefined
    } finally {
      this.#seen.delete(type)
    }
  }

  property(prop: TsSymbol, at: Node, path: string, depth: number): Found | undefined {
    const decl = prop.getValueDeclaration() ?? prop.getDeclarations()[0]
    // Written in an object literal: check what was written (a server action stays fine).
    if (decl && N.isPropertyAssignment(decl)) {
      const init = decl.getInitializer()
      if (init) return this.value(init, path, depth + 1)
    }
    if (decl && N.isShorthandPropertyAssignment(decl)) return this.value(decl.getNameNode(), path, depth + 1)
    if (decl && (N.isMethodDeclaration(decl) || N.isMethodSignature(decl)))
      return { value: 'function', prop: path }
    if (decl && N.isGetAccessorDeclaration(decl))
      return this.type(decl.getReturnType(), at, path, depth + 1, false)
    return this.type(prop.getTypeAtLocation(at), at, path, depth + 1, false)
  }
}

/** A server action or a client reference: crosses as a reference, not as code. */
function isReference(expr: Node): boolean {
  const decl = declarationOf(expr)
  if (!decl) return false
  const sf = decl.getSourceFile()
  if (sf.isDeclarationFile() || sf.isInNodeModules()) return false
  const fileDirectives = directives(sf)
  if (fileDirectives.includes('use server') || fileDirectives.includes('use client')) return true
  const fn = N.isVariableDeclaration(decl) ? decl.getInitializer() : decl
  return !!fn && isServerActionFn(fn)
}

function declarationOf(expr: Node): Node | undefined {
  // In `{ save }` the name's own symbol is the property; the value is the variable it reads.
  const parent = expr.getParent()
  const symbol =
    parent && N.isShorthandPropertyAssignment(parent) && parent.getNameNode() === expr
      ? parent.getValueSymbol()
      : expr.getSymbol()
  return symbol ? unalias(symbol).getDeclarations()[0] : undefined
}

/** A function whose body starts with `'use server'`. */
function isServerActionFn(fn: Node): boolean {
  if (!N.isArrowFunction(fn) && !N.isFunctionExpression(fn) && !N.isFunctionDeclaration(fn)) return false
  const body = fn.getBody()
  if (!body || !N.isBlock(body)) return false
  const first = body.getStatements()[0]
  if (!first || !N.isExpressionStatement(first)) return false
  const expr = first.getExpression()
  return N.isStringLiteral(expr) && expr.getLiteralValue() === 'use server'
}

/** `Object.create(null)`. */
function isNullPrototype(call: Node): boolean {
  if (!N.isCallExpression(call)) return false
  const callee = call.getExpression()
  const [arg] = call.getArguments()
  return (
    N.isPropertyAccessExpression(callee) &&
    callee.getText() === 'Object.create' &&
    !!arg &&
    arg.getKind() === ts.SyntaxKind.NullKeyword
  )
}

/** The global (not a local or an import of the same name). */
function isGlobal(id: Node): boolean {
  const decls = id.getSymbol()?.getDeclarations() ?? []
  return decls.length === 0 || decls.every((d) => d.getSourceFile().isDeclarationFile())
}

/** Declared by TypeScript's own `lib.*.d.ts` or `@types/node`. */
function fromLib(symbol: TsSymbol): boolean {
  const decls = symbol.getDeclarations()
  return (
    decls.length > 0 &&
    decls.every((d) =>
      /([\\/]lib\.[\w.]*\.d\.ts$|[\\/]@types[\\/]node[\\/])/.test(d.getSourceFile().getFilePath()),
    )
  )
}

/** React's own types (elements, nodes): what JSX makes always crosses. */
function fromReact(type: Type): boolean {
  const symbol = type.getSymbol() ?? type.getAliasSymbol()
  return !!symbol
    ?.getDeclarations()
    .some((d) => /[\\/]@types[\\/]react[\\/]/.test(d.getSourceFile().getFilePath()))
}

/** `name`, or a symbol key such as `__@iterator` (TypeScript adds `@<id>` to those). */
function hasProperty(type: Type, name: string): boolean {
  return type.getProperties().some((p) => {
    const own = p.getName()
    return own === name || (name.startsWith('__@') && own.startsWith(`${name}@`))
  })
}

function skipOuter(expr: Node): Node {
  let e = expr
  while (
    N.isParenthesizedExpression(e) ||
    N.isAsExpression(e) ||
    N.isSatisfiesExpression(e) ||
    N.isNonNullExpression(e)
  )
    e = e.getExpression()
  return e
}

function propName(name: Node): string {
  return N.isStringLiteral(name) || N.isNumericLiteral(name) ? String(name.getLiteralValue()) : name.getText()
}

function join(path: string, name: string): string {
  return path ? `${path}.${name}` : name
}

/** The ts-morph node for a compiler node inside `root`. */
function wrap(root: Node, n: ts.Node): Node | undefined {
  const sf = root.getSourceFile()
  let node: Node | undefined = sf.getDescendantAtPos(n.getStart(sf.compilerNode))
  while (node && node.compilerNode !== n) node = node.getParent()
  return node
}
