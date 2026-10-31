// GraphQL types from a schema (M17): the `data` an operation answers with and its variables,
// worked out by walking the operation's selections against the schema. Used when the code has
// no generated types (codegen, Relay) and no type arguments.
import type { TypeProperty, TypeShape } from '@flow-checker/shared'
import {
  buildClientSchema,
  buildSchema,
  type DirectiveNode,
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type GraphQLCompositeType,
  type GraphQLInputType,
  type GraphQLObjectType,
  type GraphQLOutputType,
  GraphQLSchema,
  type IntrospectionQuery,
  isAbstractType,
  isCompositeType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  Kind,
  type OperationDefinitionNode,
  type SelectionSetNode,
  typeFromAST,
  validate,
} from 'graphql'

const MAX_POSSIBLE_TYPES = 20
const MAX_INPUT_DEPTH = 8
const MAX_ERRORS = 10

const BUILT_IN_SCALARS = new Set(['ID', 'String', 'Int', 'Float', 'Boolean'])

/** Reads SDL (`type Query { ... }`) or an introspection result (`{ data: { __schema } }` or `{ __schema }`). */
export function readSchema(text: string): GraphQLSchema {
  const trimmed = text.trimStart()
  if (trimmed.startsWith('{')) return schemaFromIntrospection(JSON.parse(trimmed))
  return buildSchema(text, { assumeValidSDL: true })
}

export function schemaFromIntrospection(value: unknown): GraphQLSchema {
  const obj = value as { data?: IntrospectionQuery; __schema?: unknown }
  const result = (obj && '__schema' in obj ? obj : obj?.data) as IntrospectionQuery | undefined
  if (!result?.__schema) throw new Error('Not an introspection result (no __schema).')
  return buildClientSchema(result, { assumeValid: true })
}

/** Named types in the schema, without built-ins and introspection types. */
export function schemaTypeCount(schema: GraphQLSchema): number {
  return Object.keys(schema.getTypeMap()).filter((n) => !n.startsWith('__') && !BUILT_IN_SCALARS.has(n))
    .length
}

export interface OperationShapes {
  result: TypeShape
  variables: TypeShape
  /** Validation errors against the schema. */
  errors: string[]
}

/** The `data` and variables of an operation. `fragments` holds every fragment it may spread. */
export function operationShapes(
  schema: GraphQLSchema,
  op: OperationDefinitionNode,
  fragments: ReadonlyMap<string, FragmentDefinitionNode>,
): OperationShapes {
  const used = usedFragments(op.selectionSet, fragments)
  const doc: DocumentNode = { kind: Kind.DOCUMENT, definitions: [op, ...used] }
  const errors = validate(schema, doc)
    .slice(0, MAX_ERRORS)
    .map((e) => e.message)
  const root =
    op.operation === 'query'
      ? schema.getQueryType()
      : op.operation === 'mutation'
        ? schema.getMutationType()
        : schema.getSubscriptionType()
  const walker = new Walker(schema, fragments)
  const result: TypeShape = root
    ? walker.object(op.selectionSet, root, root)
    : { kind: 'unresolved', text: `the schema has no ${op.operation} type`, reason: 'unsupported' }
  const variables: TypeShape = {
    kind: 'object',
    properties: (op.variableDefinitions ?? []).map((def): TypeProperty => {
      const type = typeFromAST(schema, def.type) as GraphQLInputType | undefined
      const shape = type ? walker.input(type, 0) : unknown()
      const optional = !isNonNullType(type) || !!def.defaultValue
      return { name: def.variable.name.value, type: shape, ...(optional ? { optional } : {}) }
    }),
  }
  return { result, variables, errors }
}

/** Fragments a selection spreads, directly or through other fragments, in the order first seen. */
export function usedFragments(
  selectionSet: SelectionSetNode,
  fragments: ReadonlyMap<string, FragmentDefinitionNode>,
): FragmentDefinitionNode[] {
  const out = new Map<string, FragmentDefinitionNode>()
  const visit = (set: SelectionSetNode) => {
    for (const sel of set.selections) {
      if (sel.kind === Kind.FRAGMENT_SPREAD) {
        const name = sel.name.value
        const frag = fragments.get(name)
        if (frag && !out.has(name)) {
          out.set(name, frag)
          visit(frag.selectionSet)
        }
      } else if (sel.selectionSet) {
        visit(sel.selectionSet)
      }
    }
  }
  visit(selectionSet)
  return [...out.values()]
}

interface Collected {
  key: string
  /** `__typename`, or the schema field's type. */
  typename?: string
  type?: GraphQLOutputType
  nodes: FieldNode[]
  /** Under `@include` / `@skip`: may be missing. */
  optional: boolean
}

class Walker {
  constructor(
    readonly schema: GraphQLSchema,
    readonly fragments: ReadonlyMap<string, FragmentDefinitionNode>,
  ) {}

  /** The object a selection set gives on one concrete type. */
  object(set: SelectionSetNode, parent: GraphQLCompositeType, concrete: GraphQLObjectType): TypeShape {
    const fields = new Map<string, Collected>()
    this.#collect(set, parent, concrete, fields, false, new Set())
    const properties: TypeProperty[] = []
    for (const field of fields.values()) {
      let type: TypeShape
      if (field.typename !== undefined) type = { kind: 'literal', value: field.typename }
      else if (field.type) type = this.output(field.type, field.nodes)
      else continue
      properties.push({ name: field.key, type, ...(field.optional ? { optional: true } : {}) })
    }
    return { kind: 'object', properties }
  }

  output(type: GraphQLOutputType, nodes: FieldNode[]): TypeShape {
    if (isNonNullType(type)) return this.#nonNull(type.ofType, nodes)
    return orNull(this.#nonNull(type, nodes))
  }

  #nonNull(type: GraphQLOutputType, nodes: FieldNode[]): TypeShape {
    if (isNonNullType(type)) return this.#nonNull(type.ofType, nodes)
    if (isListType(type)) return { kind: 'array', element: this.output(type.ofType, nodes) }
    if (isScalarType(type)) return scalar(type.name)
    if (isEnumType(type)) return literals(type.getValues().map((v) => v.name))
    if (!isCompositeType(type)) return unknown()
    // Sub-selections of every node with this response key are merged.
    const set: SelectionSetNode = {
      kind: Kind.SELECTION_SET,
      selections: nodes.flatMap((n) => n.selectionSet?.selections ?? []),
    }
    if (isObjectType(type)) return this.object(set, type, type)
    const possible = this.schema.getPossibleTypes(type)
    const shapes: TypeShape[] = []
    const seen = new Set<string>()
    for (const concrete of possible.slice(0, MAX_POSSIBLE_TYPES)) {
      const shape = this.object(set, type, concrete)
      const key = JSON.stringify(shape)
      if (seen.has(key)) continue
      seen.add(key)
      shapes.push(shape)
    }
    if (shapes.length === 0) return unknown()
    if (shapes.length === 1) return shapes[0] as TypeShape
    return {
      kind: 'union',
      types: shapes,
      ...(possible.length > MAX_POSSIBLE_TYPES ? { truncated: true } : {}),
    }
  }

  input(type: GraphQLInputType, depth: number): TypeShape {
    if (isNonNullType(type)) return this.#inputNonNull(type.ofType, depth)
    return orNull(this.#inputNonNull(type, depth))
  }

  #inputNonNull(type: GraphQLInputType, depth: number): TypeShape {
    if (isNonNullType(type)) return this.#inputNonNull(type.ofType, depth)
    if (isListType(type)) return { kind: 'array', element: this.input(type.ofType, depth) }
    if (isScalarType(type)) return scalar(type.name)
    if (isEnumType(type)) return literals(type.getValues().map((v) => v.name))
    if (!isInputObjectType(type)) return unknown()
    // Input types can refer to themselves.
    if (depth >= MAX_INPUT_DEPTH) return { kind: 'unresolved', text: type.name, reason: 'depth' }
    return {
      kind: 'object',
      properties: Object.values(type.getFields()).map((f): TypeProperty => {
        const optional = !isNonNullType(f.type) || f.defaultValue !== undefined
        return { name: f.name, type: this.input(f.type, depth + 1), ...(optional ? { optional } : {}) }
      }),
    }
  }

  #collect(
    set: SelectionSetNode,
    parent: GraphQLCompositeType,
    concrete: GraphQLObjectType,
    out: Map<string, Collected>,
    optional: boolean,
    visiting: Set<string>,
  ) {
    for (const sel of set.selections) {
      const maybe = optional || conditional(sel.directives)
      if (sel.kind === Kind.FIELD) {
        const key = sel.alias?.value ?? sel.name.value
        const existing = out.get(key)
        if (existing) {
          existing.nodes.push(sel)
          existing.optional &&= maybe
          continue
        }
        if (sel.name.value === '__typename') {
          out.set(key, { key, typename: concrete.name, nodes: [sel], optional: maybe })
          continue
        }
        // A field the type doesn't have is a validation error; leave it out here.
        const def = concrete.getFields()[sel.name.value]
        if (def) out.set(key, { key, type: def.type, nodes: [sel], optional: maybe })
        continue
      }
      let condition: GraphQLCompositeType | undefined = parent
      let inner: SelectionSetNode | undefined
      if (sel.kind === Kind.INLINE_FRAGMENT) {
        if (sel.typeCondition) condition = this.#composite(sel.typeCondition.name.value)
        inner = sel.selectionSet
      } else {
        const name = sel.name.value
        const frag = this.fragments.get(name)
        if (!frag || visiting.has(name)) continue
        condition = this.#composite(frag.typeCondition.name.value)
        inner = frag.selectionSet
        visiting.add(name)
        if (condition && this.#applies(condition, concrete))
          this.#collect(inner, condition, concrete, out, maybe, visiting)
        visiting.delete(name)
        continue
      }
      if (condition && this.#applies(condition, concrete))
        this.#collect(inner, condition, concrete, out, maybe, visiting)
    }
  }

  #composite(name: string): GraphQLCompositeType | undefined {
    const type = this.schema.getType(name)
    return type && isCompositeType(type) ? type : undefined
  }

  #applies(condition: GraphQLCompositeType, concrete: GraphQLObjectType): boolean {
    if (condition === concrete) return true
    return isAbstractType(condition) && this.schema.isSubType(condition, concrete)
  }
}

function conditional(directives: readonly DirectiveNode[] | undefined): boolean {
  return !!directives?.some((d) => d.name.value === 'include' || d.name.value === 'skip')
}

function scalar(name: string): TypeShape {
  if (name === 'ID' || name === 'String') return { kind: 'primitive', name: 'string' }
  if (name === 'Int' || name === 'Float') return { kind: 'primitive', name: 'number' }
  if (name === 'Boolean') return { kind: 'primitive', name: 'boolean' }
  // Custom scalars (`DateTime`, `JSON`) can be anything on the wire.
  return unknown()
}

function literals(values: string[]): TypeShape {
  const types: TypeShape[] = values.map((value) => ({ kind: 'literal', value }))
  if (types.length === 1) return types[0] as TypeShape
  return { kind: 'union', types }
}

function orNull(shape: TypeShape): TypeShape {
  const nul: TypeShape = { kind: 'primitive', name: 'null' }
  if (shape.kind === 'union') return { ...shape, types: [...shape.types, nul] }
  return { kind: 'union', types: [shape, nul] }
}

function unknown(): TypeShape {
  return { kind: 'primitive', name: 'unknown' }
}

export { GraphQLSchema }
