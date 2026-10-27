// Type resolution: TypeScript types -> TypeShape IR (docs/PLAN.md 6.5).
//
// Named project types are hoisted into a table and referenced by id, so each is resolved
// once and recursive types stay finite. Anonymous types are inlined up to a depth limit.
// Package and lib types are kept by name (`Date`, `Promise<T>`, `ReactNode`), except
// object types built from mapped/conditional types (`Pick`, `Partial`, `z.infer`, ...),
// which are expanded so the shape shows the real properties.
import {
  makeId,
  type NamedType,
  type PrimitiveType,
  type SourceLoc,
  type TupleElement,
  type TypeProperty,
  type TypeRef,
  type TypeShape,
} from '@flow-checker/shared'
import { Node as N, type Node, type Symbol as TsSymbol, type Type, type TypeNode, ts } from 'ts-morph'
import { compare, relativeTo } from './paths'

export interface TypeResolverOptions {
  /** Nesting depth of anonymous types before expansion stops. Default 6. */
  maxDepth?: number
  /** Properties kept per object. Default 100. */
  maxProperties?: number
  /** Members kept per union. Default 50. */
  maxUnionMembers?: number
}

interface NamedInfo {
  symbol: TsSymbol
  declaration: Node
  declarationKind: NamedType['declarationKind']
  name: string
}

const NAMED_FLAGS = ts.SymbolFlags.Interface | ts.SymbolFlags.Class | ts.SymbolFlags.Enum

const PRIMITIVE_FLAGS: [ts.TypeFlags, PrimitiveType][] = [
  [ts.TypeFlags.Any, 'any'],
  [ts.TypeFlags.Unknown, 'unknown'],
  [ts.TypeFlags.String, 'string'],
  [ts.TypeFlags.TemplateLiteral, 'string'],
  [ts.TypeFlags.Number, 'number'],
  [ts.TypeFlags.Boolean, 'boolean'],
  [ts.TypeFlags.BigInt, 'bigint'],
  [ts.TypeFlags.ESSymbolLike, 'symbol'],
  [ts.TypeFlags.Void, 'void'],
  [ts.TypeFlags.Undefined, 'undefined'],
  [ts.TypeFlags.Null, 'null'],
  [ts.TypeFlags.Never, 'never'],
  [ts.TypeFlags.NonPrimitive, 'object'],
]

export class TypeResolver {
  readonly #root: string
  readonly #maxDepth: number
  readonly #maxProperties: number
  readonly #maxUnionMembers: number
  /** Named types by id. Registered before their shape is computed, so cycles terminate. */
  readonly #named = new Map<string, NamedType>()

  constructor(root: string, options: TypeResolverOptions = {}) {
    this.#root = root
    this.#maxDepth = options.maxDepth ?? 6
    this.#maxProperties = options.maxProperties ?? 100
    this.#maxUnionMembers = options.maxUnionMembers ?? 50
  }

  /** Every named type referenced so far, sorted by file and line. */
  types(): NamedType[] {
    return [...this.#named.values()].sort(
      (a, b) =>
        compare(a.definedAt.file, b.definedAt.file) ||
        a.definedAt.line - b.definedAt.line ||
        compare(a.name, b.name),
    )
  }

  /** Resolves a written type annotation, e.g. the `ProfileCardProps` in `(props: ProfileCardProps)`. */
  fromTypeNode(node: TypeNode): TypeRef {
    return { text: oneLine(node.getText()), shape: this.#fromTypeNode(node, 0) }
  }

  /** Resolves the type the checker gives `node` (declaration, expression, ...). */
  fromNode(node: Node): TypeRef {
    if (N.isTypeNode(node)) return this.fromTypeNode(node)
    const typeNode = annotationOf(node)
    if (typeNode) return this.fromTypeNode(typeNode)
    return this.fromType(node.getType(), node)
  }

  /** Resolves a type, using `location` for property lookups. */
  fromType(type: Type, location: Node): TypeRef {
    return { text: typeText(type, location), shape: this.#shape(type, location, 0) }
  }

  /**
   * Resolves what a zod schema value parses to: `z.output` by default, `z.input` on request.
   * Works for zod 3 and zod 4 (classic and mini). Undefined when `node` is not a zod schema.
   */
  fromZodSchema(node: Node, which: 'output' | 'input' = 'output'): TypeRef | undefined {
    const type = zodType(node.getType(), node, which)
    if (!type) return undefined
    return { text: `z.${which}<typeof ${node.getText()}>`, shape: this.#shape(type, node, 0) }
  }

  /** Id of the named project type a reference points to, or undefined (external, anonymous, ...). */
  namedTypeIdOf(node: TypeNode): string | undefined {
    const shape = this.#fromTypeNode(node, 0)
    return shape.kind === 'ref' ? shape.typeId : undefined
  }

  #fromTypeNode(node: TypeNode, depth: number): TypeShape {
    const type = node.getType()
    // Syntax first: `type A = Pick<B, 'x'>` resolves to a type whose alias symbol is `Pick`,
    // so only the written name tells us the user meant `A`.
    if (N.isTypeReference(node)) {
      const named = this.#namedFromReference(node, type)
      if (named) return this.#ref(named, type, node)
    }
    return this.#shape(type, node, depth)
  }

  #namedFromReference(node: Node, type: Type): NamedInfo | undefined {
    if (!N.isTypeReference(node)) return undefined
    const symbol = unalias(node.getTypeName().getSymbol())
    const declaration = symbol?.getDeclarations()[0]
    if (!symbol || !declaration || !this.#isProject(declaration)) return undefined
    const declarationKind = declarationKindOf(declaration)
    if (!declarationKind) return undefined
    const args = node.getTypeArguments()
    const name =
      args.length > 0 ? `${symbol.getName()}<${args.map((a) => a.getText()).join(', ')}>` : symbol.getName()
    // A generic alias used without arguments is not a usable type; let the checker decide.
    if (type.isTypeParameter()) return undefined
    return { symbol, declaration, declarationKind, name }
  }

  /** Named project type behind a type, from its alias or its interface/class/enum symbol. */
  #namedFromType(type: Type, location: Node): NamedInfo | undefined {
    const alias = type.getAliasSymbol()
    const aliasDecl = alias?.getDeclarations()[0]
    if (alias && aliasDecl && this.#isProject(aliasDecl)) {
      const args = type.getAliasTypeArguments()
      const name =
        args.length > 0
          ? `${alias.getName()}<${args.map((a) => typeText(a, location)).join(', ')}>`
          : alias.getName()
      return { symbol: alias, declaration: aliasDecl, declarationKind: 'type-alias', name }
    }
    const symbol = type.getSymbol()
    const decl = symbol?.getDeclarations()[0]
    if (!symbol || !decl || !isNamedSymbol(symbol) || !this.#isProject(decl)) return undefined
    const declarationKind = declarationKindOf(decl)
    if (!declarationKind) return undefined
    const args = type.getTypeArguments()
    const name = args.length > 0 ? typeText(type, location) : symbol.getName()
    return { symbol, declaration: decl, declarationKind, name }
  }

  #ref(info: NamedInfo, type: Type, location: Node): TypeShape {
    const definedAt = this.#loc(nameNodeOf(info.declaration))
    const id = makeId('typ', definedAt.file, info.name)
    if (!this.#named.has(id)) {
      const entry: NamedType = {
        id,
        name: info.name,
        declarationKind: info.declarationKind,
        definedAt,
        shape: { kind: 'unresolved', text: info.name, reason: 'depth' },
      }
      this.#named.set(id, entry)
      // Expand the type itself (not a ref to itself), with a fresh depth budget.
      // `type When = Date` stays `Date`.
      entry.shape = this.#external(type, location, 0) ?? this.#structure(type, location, 0)
    }
    return { kind: 'ref', typeId: id, name: info.name }
  }

  #shape(type: Type, location: Node, depth: number): TypeShape {
    if (type.isTypeParameter()) return { kind: 'type-parameter', name: typeText(type, location) }

    const named = this.#namedFromType(type, location)
    if (named) return this.#ref(named, type, location)

    const external = this.#external(type, location, depth)
    if (external) return external

    return this.#structure(type, location, depth)
  }

  /** The type's own structure, without hoisting it as a named type. */
  #structure(type: Type, location: Node, depth: number): TypeShape {
    if (depth > this.#maxDepth) return { kind: 'unresolved', text: typeText(type, location), reason: 'depth' }

    const flags = type.getFlags()
    if (type.isLiteral() || type.isBooleanLiteral()) return literalShape(type)
    // Enums are unions of literals; a single-member enum is just the literal.
    if (type.isEnum() && !type.isUnion()) return literalShape(type)
    if (type.isUnion()) return this.#union(type, location, depth)
    for (const [flag, name] of PRIMITIVE_FLAGS) {
      if (flags & flag) return { kind: 'primitive', name }
    }
    if (type.isTuple()) return this.#tuple(type, location, depth)
    if (type.isArray() || type.isReadonlyArray()) {
      const element = type.getArrayElementType() ?? type.getTypeArguments()[0]
      return {
        kind: 'array',
        element: element ? this.#shape(element, location, depth + 1) : { kind: 'primitive', name: 'unknown' },
        ...(type.isReadonlyArray() ? { readonly: true } : {}),
      }
    }
    if (type.isIntersection()) {
      const parts = type.getIntersectionTypes()
      if (!parts.every((t) => t.isObject())) {
        return { kind: 'intersection', types: parts.map((t) => this.#shape(t, location, depth + 1)) }
      }
      return this.#object(type, location, depth)
    }
    if (type.isObject()) {
      const signatures = type.getCallSignatures()
      if (signatures.length > 0 && type.getProperties().length === 0) {
        return this.#function(signatures[0] as NonNullable<(typeof signatures)[0]>, location, depth)
      }
      return this.#object(type, location, depth)
    }
    return { kind: 'unresolved', text: typeText(type, location), reason: 'unsupported' }
  }

  /**
   * Package and lib types kept by name: interfaces and classes (`Date`, `Promise<T>`,
   * `FormEvent`), and aliases that are not plain objects (`ReactNode`). Arrays, tuples and
   * object types built by mapped/conditional types are expanded instead.
   */
  #external(type: Type, location: Node, depth: number): TypeShape | undefined {
    if (type.isArray() || type.isReadonlyArray() || type.isTuple()) return undefined

    const alias = type.getAliasSymbol()
    const aliasDecl = alias?.getDeclarations()[0]
    if (alias && aliasDecl && !this.#isProject(aliasDecl) && !isExpandable(type)) {
      return this.#externalShape(alias.getName(), aliasDecl, type.getAliasTypeArguments(), location, depth)
    }

    const symbol = type.getSymbol()
    const decl = symbol?.getDeclarations()[0]
    if (symbol && decl && isNamedSymbol(symbol) && !this.#isProject(decl)) {
      return this.#externalShape(symbol.getName(), decl, type.getTypeArguments(), location, depth)
    }
    return undefined
  }

  #externalShape(name: string, decl: Node, args: Type[], location: Node, depth: number): TypeShape {
    const module = packageOf(decl.getSourceFile().getFilePath())
    return {
      kind: 'external',
      name,
      ...(module ? { module } : {}),
      ...(args.length > 0 ? { typeArguments: args.map((a) => this.#shape(a, location, depth + 1)) } : {}),
    }
  }

  #union(type: Type, location: Node, depth: number): TypeShape {
    let members = type.getUnionTypes()
    // The checker splits `boolean` into `true | false`; put it back.
    const hasTrue = members.some((t) => t.isBooleanLiteral() && t.getText() === 'true')
    const hasFalse = members.some((t) => t.isBooleanLiteral() && t.getText() === 'false')
    const mergeBoolean = hasTrue && hasFalse && !type.isEnum()
    if (mergeBoolean) members = members.filter((t) => !t.isBooleanLiteral())

    // The checker orders members by internal id (`null | string`); list null/undefined last, as people write them.
    const isNullish = (t: Type) => t.isNull() || t.isUndefined()
    members = [
      ...members.filter((t) => !isNullish(t)),
      ...members.filter((t) => t.isNull()),
      ...members.filter((t) => t.isUndefined()),
    ]

    const truncated = members.length > this.#maxUnionMembers
    const types = members.slice(0, this.#maxUnionMembers).map((t) => this.#shape(t, location, depth + 1))
    if (mergeBoolean) {
      // Keep `boolean` where the first boolean literal was, after other primitives.
      const at = types.findIndex((t) => t.kind !== 'primitive' || t.name === 'null' || t.name === 'undefined')
      types.splice(at < 0 ? types.length : at, 0, { kind: 'primitive', name: 'boolean' })
    }
    if (types.length === 1 && !truncated) return types[0] as TypeShape
    return { kind: 'union', types, ...(truncated ? { truncated: true } : {}) }
  }

  #tuple(type: Type, location: Node, depth: number): TypeShape {
    const target = (type.compilerType as ts.TypeReference).target as ts.TupleType | undefined
    const flags = target?.elementFlags ?? []
    const labels = target?.labeledElementDeclarations ?? []
    const elements: TupleElement[] = type.getTupleElements().map((t, i) => {
      const flag = flags[i] ?? ts.ElementFlags.Required
      const label = labels[i]
      return {
        type: dropUndefined(this.#shape(t, location, depth + 1), !!(flag & ts.ElementFlags.Optional)),
        ...(label && ts.isIdentifier(label.name) ? { name: label.name.text } : {}),
        ...(flag & ts.ElementFlags.Optional ? { optional: true } : {}),
        ...(flag & ts.ElementFlags.Variable ? { rest: true } : {}),
      }
    })
    return { kind: 'tuple', elements, ...(target?.readonly ? { readonly: true } : {}) }
  }

  #function(
    signature: ReturnType<Type['getCallSignatures']>[number],
    location: Node,
    depth: number,
  ): TypeShape {
    const params = signature.getParameters().map((p) => {
      const decl = p.getValueDeclaration()
      const optional =
        p.isOptional() ||
        (decl && N.isParameterDeclaration(decl) && (decl.hasQuestionToken() || decl.hasInitializer()))
      const rest = decl && N.isParameterDeclaration(decl) && decl.isRestParameter()
      return {
        name: p.getName(),
        type: this.#propertyType(p, location, depth, !!optional),
        ...(optional ? { optional: true } : {}),
        ...(rest ? { rest: true } : {}),
      }
    })
    return { kind: 'function', params, returns: this.#shape(signature.getReturnType(), location, depth + 1) }
  }

  #object(type: Type, location: Node, depth: number): TypeShape {
    const all = type.getProperties()
    const truncated = all.length > this.#maxProperties
    const properties: TypeProperty[] = all.slice(0, this.#maxProperties).map((p) => {
      const optional = p.isOptional()
      return {
        name: p.getName(),
        type: this.#propertyType(p, location, depth, optional),
        ...(optional ? { optional: true } : {}),
        ...(isReadonly(p) ? { readonly: true } : {}),
      }
    })

    const indexSignatures: { key: 'string' | 'number'; type: TypeShape }[] = []
    const stringIndex = type.getStringIndexType()
    if (stringIndex)
      indexSignatures.push({ key: 'string', type: this.#shape(stringIndex, location, depth + 1) })
    const numberIndex = type.getNumberIndexType()
    if (numberIndex && numberIndex !== stringIndex) {
      indexSignatures.push({ key: 'number', type: this.#shape(numberIndex, location, depth + 1) })
    }

    return {
      kind: 'object',
      properties,
      ...(indexSignatures.length > 0 ? { indexSignatures } : {}),
      ...(truncated ? { truncated: true } : {}),
    }
  }

  /** Type of a property or parameter. Optional ones drop the `undefined` the checker adds. */
  #propertyType(symbol: TsSymbol, location: Node, depth: number, optional: boolean): TypeShape {
    const type = symbol.getTypeAtLocation(location)
    // Prefer the written annotation when it is the same type: it keeps alias names like
    // `UserSummary` that the checker reports as `Pick<User, ...>`.
    const typeNode = annotationOf(symbol.getDeclarations()[0])
    if (typeNode && sameType(typeNode.getType(), type, optional)) {
      return dropUndefined(this.#fromTypeNode(typeNode, depth + 1), optional)
    }
    return dropUndefined(this.#shape(type, location, depth + 1), optional)
  }

  #isProject(node: Node): boolean {
    const file = node.getSourceFile()
    return (
      !file.isInNodeModules() &&
      !file.isFromExternalLibrary() &&
      !file.getFilePath().includes('/node_modules/')
    )
  }

  #loc(node: Node): SourceLoc {
    const file = node.getSourceFile()
    const { line, column } = file.getLineAndColumnAtPos(node.getStart())
    return { file: relativeTo(this.#root, file.getFilePath()), line, column }
  }
}

function unalias(symbol: TsSymbol | undefined): TsSymbol | undefined {
  return symbol?.isAlias() ? (symbol.getAliasedSymbol() ?? symbol) : symbol
}

function declarationKindOf(node: Node): NamedType['declarationKind'] | undefined {
  if (N.isInterfaceDeclaration(node)) return 'interface'
  if (N.isTypeAliasDeclaration(node)) return 'type-alias'
  if (N.isEnumDeclaration(node)) return 'enum'
  if (N.isClassDeclaration(node)) return 'class'
  return undefined
}

function nameNodeOf(node: Node): Node {
  if (
    N.isInterfaceDeclaration(node) ||
    N.isTypeAliasDeclaration(node) ||
    N.isEnumDeclaration(node) ||
    N.isClassDeclaration(node)
  ) {
    return node.getNameNode() ?? node
  }
  return node
}

/** The written type annotation of a declaration, if any. */
function annotationOf(node: Node | undefined): TypeNode | undefined {
  if (!node) return undefined
  if (
    N.isPropertySignature(node) ||
    N.isPropertyDeclaration(node) ||
    N.isParameterDeclaration(node) ||
    N.isVariableDeclaration(node)
  ) {
    return node.getTypeNode()
  }
  return undefined
}

/** Same type, ignoring the `undefined` an optional property adds. */
function sameType(declared: Type, actual: Type, optional: boolean): boolean {
  if (declared.compilerType === actual.compilerType) return true
  if (!optional || !actual.isUnion()) return false
  const rest = actual.getUnionTypes().filter((t) => !t.isUndefined())
  if (rest.length === 1) return rest[0]?.compilerType === declared.compilerType
  return declared.isUnion() && sameMembers(declared.getUnionTypes(), rest)
}

function sameMembers(a: Type[], b: Type[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a.map((t) => t.compilerType))
  return b.every((t) => set.has(t.compilerType))
}

function dropUndefined(shape: TypeShape, optional: boolean): TypeShape {
  if (!optional || shape.kind !== 'union') return shape
  const types = shape.types.filter((t) => !(t.kind === 'primitive' && t.name === 'undefined'))
  if (types.length === shape.types.length) return shape
  return types.length === 1 && !shape.truncated ? (types[0] as TypeShape) : { ...shape, types }
}

/** Declared `readonly`. Properties made readonly by mapped types (`Readonly<T>`) are not detected. */
function isReadonly(symbol: TsSymbol): boolean {
  const decl = symbol.getDeclarations()[0]
  return !!decl && (N.isPropertySignature(decl) || N.isPropertyDeclaration(decl)) && decl.isReadonly()
}

/** Object types made by mapped/conditional types (`Pick<>`, `z.infer<>`): expand, don't name. */
function isExpandable(type: Type): boolean {
  if (type.isUnion()) return type.getUnionTypes().every((t) => t.isLiteral() || t.isBooleanLiteral())
  if (type.isIntersection()) return type.getIntersectionTypes().every((t) => t.isObject())
  if (!type.isObject()) return false
  const symbol = type.getSymbol()
  // Anonymous or mapped object types have no interface/class symbol.
  return !symbol || !isNamedSymbol(symbol)
}

function literalShape(type: Type): TypeShape {
  if (type.isBooleanLiteral()) return { kind: 'literal', value: type.getText() === 'true' }
  const value = type.getLiteralValue()
  if (typeof value === 'string' || typeof value === 'number') return { kind: 'literal', value }
  if (value && typeof value === 'object' && 'base10Value' in value) {
    return { kind: 'literal', value: `${value.negative ? '-' : ''}${value.base10Value}n`, bigint: true }
  }
  return { kind: 'unresolved', text: type.getText(), reason: 'unsupported' }
}

/** Collapses a multi-line annotation: `{\n  a: string\n}` -> `{ a: string }`. */
function oneLine(text: string): string {
  return text
    .replace(/\s*\n\s*/g, '\n')
    .replace(/([{;,])\n/g, '$1 ')
    .replace(/\n}/g, ' }')
    .replace(/\n/g, '; ')
}

function typeText(type: Type, location: Node): string {
  return type.getText(
    location,
    ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
  )
}

/** The parsed (`output`) or accepted (`input`) type of a zod schema, or undefined. */
function zodType(schema: Type, location: Node, which: 'output' | 'input'): Type | undefined {
  // zod 3 and zod 4 classic: `_output` / `_input`. zod 4 mini and core: `_zod.output` / `_zod.input`.
  const direct = schema.getProperty(`_${which}`)
  if (direct && isZod(schema)) return direct.getTypeAtLocation(location)
  const internals = schema.getProperty('_zod')
  const nested = internals?.getTypeAtLocation(location).getProperty(which)
  return nested ? nested.getTypeAtLocation(location) : undefined
}

function isZod(type: Type): boolean {
  const decl = type.getSymbol()?.getDeclarations()[0]
  return !!decl && /\/node_modules\/zod\//.test(decl.getSourceFile().getFilePath())
}

/** Package name for a file under node_modules (`@types/react` -> `react`). Undefined for TS lib files. */
function packageOf(path: string): string | undefined {
  const match = /.*\/node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(path)
  const name = match?.[1]
  if (!name || name === 'typescript') return undefined
  return name.startsWith('@types/') ? name.slice('@types/'.length).replace(/^(.+)__(.+)$/, '@$1/$2') : name
}

/** Interface, class or enum. (ts-morph's `hasFlags` needs every flag, so test the bits directly.) */
function isNamedSymbol(symbol: TsSymbol): boolean {
  return (symbol.getFlags() & NAMED_FLAGS) !== 0
}
