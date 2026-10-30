// Generated GraphQL types hide fragment data behind markers (fragment masking): codegen's client
// preset puts `' $fragmentRefs': { TodoItemFragment: ... }` where a fragment is spread, and Relay
// puts `" $fragmentSpreads": FragmentRefs<"TodoItem_todo">`. The server still sends those fields,
// so captured data is checked against the unmasked type: the fragments' fields merged back in.
import type { TypeProperty, TypeShape } from '@flow-checker/shared'

const CODEGEN_REFS = ' $fragmentRefs'
const RELAY_SPREADS = ' $fragmentSpreads'
/** Markers that only exist in the types, never in the data. */
const HIDDEN = new Set([CODEGEN_REFS, RELAY_SPREADS, ' $fragmentName', ' $fragmentType', ' $data'])
const MAX_DEPTH = 16

export interface UnmaskContext {
  /** A named type's shape (`ref` targets). */
  deref(id: string): TypeShape | undefined
  /** Relay: a fragment's `$data` type, by fragment name. */
  relayFragment(name: string): TypeShape | undefined
}

/** The shape with fragment data merged in. Unchanged when it has no fragment markers. */
export function unmask(shape: TypeShape, ctx: UnmaskContext): TypeShape {
  return hasMarker(shape, ctx, new Set()) ? walk(shape, ctx, 0, new Set()) : shape
}

function walk(shape: TypeShape, ctx: UnmaskContext, depth: number, seen: Set<string>): TypeShape {
  if (depth > MAX_DEPTH) return shape
  switch (shape.kind) {
    case 'ref': {
      const target = ctx.deref(shape.typeId)
      if (!target || seen.has(shape.typeId) || !hasMarker(target, ctx, new Set())) return shape
      return walk(target, ctx, depth + 1, new Set([...seen, shape.typeId]))
    }
    case 'array':
      return { ...shape, element: walk(shape.element, ctx, depth + 1, seen) }
    case 'tuple':
      return {
        ...shape,
        elements: shape.elements.map((e) => ({ ...e, type: walk(e.type, ctx, depth + 1, seen) })),
      }
    case 'union':
      return { ...shape, types: shape.types.map((t) => walk(t, ctx, depth + 1, seen)) }
    case 'intersection': {
      const parts = shape.types.map((t) => walk(t, ctx, depth + 1, seen))
      return parts.every((p) => p.kind === 'object')
        ? parts.reduce<TypeShape>(merge, emptyObject())
        : { ...shape, types: parts }
    }
    case 'object': {
      const properties: TypeProperty[] = []
      const spread: TypeShape[] = []
      for (const prop of shape.properties) {
        if (prop.name === CODEGEN_REFS) {
          // `{ TodoItemFragment: TodoItemFragment }`: each property is a fragment's type.
          const refs = resolved(prop.type, ctx)
          if (refs.kind === 'object')
            for (const p of refs.properties) spread.push(walk(p.type, ctx, depth + 1, seen))
          continue
        }
        if (prop.name === RELAY_SPREADS) {
          for (const name of fragmentNames(prop.type, ctx)) {
            const data = ctx.relayFragment(name)
            if (data) spread.push(walk(data, ctx, depth + 1, seen))
          }
          continue
        }
        if (HIDDEN.has(prop.name)) continue
        properties.push({ ...prop, type: walk(prop.type, ctx, depth + 1, seen) })
      }
      let out: TypeShape = { ...shape, properties }
      for (const part of spread) {
        const obj = resolved(part, ctx)
        if (obj.kind === 'object') out = merge(out, obj)
      }
      return out
    }
    default:
      return shape
  }
}

/** Relay's `FragmentRefs<"A" | "B">`: the fragment names. */
function fragmentNames(shape: TypeShape, ctx: UnmaskContext): string[] {
  const s = resolved(shape, ctx)
  if (s.kind === 'external') return (s.typeArguments ?? []).flatMap((a) => literalStrings(a))
  if (s.kind === 'object') return s.properties.map((p) => p.name)
  return []
}

function literalStrings(shape: TypeShape): string[] {
  if (shape.kind === 'literal' && typeof shape.value === 'string') return [shape.value]
  if (shape.kind === 'union') return shape.types.flatMap(literalStrings)
  return []
}

function resolved(shape: TypeShape, ctx: UnmaskContext): TypeShape {
  let current = shape
  for (let i = 0; i < 8 && current.kind === 'ref'; i++) current = ctx.deref(current.typeId) ?? current
  if (current.kind === 'union') {
    // An optional `' $fragmentRefs'` can come as `X | undefined`.
    const rest = current.types.filter((t) => !(t.kind === 'primitive' && t.name === 'undefined'))
    if (rest.length === 1) return resolved(rest[0] as TypeShape, ctx)
  }
  if (current.kind === 'intersection' && current.types.every((t) => resolved(t, ctx).kind === 'object')) {
    return current.types.map((t) => resolved(t, ctx)).reduce<TypeShape>(merge, emptyObject())
  }
  return current
}

/** Both objects' properties; nested objects (and arrays of them) are merged too. */
function merge(a: TypeShape, b: TypeShape): TypeShape {
  if (a.kind !== 'object' || b.kind !== 'object') return a
  const properties = [...a.properties]
  for (const prop of b.properties) {
    if (HIDDEN.has(prop.name)) continue
    const at = properties.findIndex((p) => p.name === prop.name)
    if (at < 0) {
      properties.push(prop)
      continue
    }
    const existing = properties[at] as TypeProperty
    properties[at] = { ...existing, type: mergeValues(existing.type, prop.type) }
  }
  return { ...a, properties }
}

function mergeValues(a: TypeShape, b: TypeShape): TypeShape {
  if (a.kind === 'object' && b.kind === 'object') return merge(a, b)
  if (a.kind === 'array' && b.kind === 'array') return { ...a, element: mergeValues(a.element, b.element) }
  if (a.kind === 'union' && b.kind === 'union') {
    // `X | null` on both sides: merge the non-null members.
    const objA = a.types.find((t) => t.kind === 'object' || t.kind === 'array')
    const objB = b.types.find((t) => t.kind === 'object' || t.kind === 'array')
    if (objA && objB) return { ...a, types: a.types.map((t) => (t === objA ? mergeValues(objA, objB) : t)) }
  }
  return a
}

function emptyObject(): TypeShape {
  return { kind: 'object', properties: [] }
}

function hasMarker(shape: TypeShape, ctx: UnmaskContext, seen: Set<string>): boolean {
  switch (shape.kind) {
    case 'ref': {
      if (seen.has(shape.typeId)) return false
      seen.add(shape.typeId)
      const target = ctx.deref(shape.typeId)
      return !!target && hasMarker(target, ctx, seen)
    }
    case 'object':
      return shape.properties.some((p) => HIDDEN.has(p.name) || hasMarker(p.type, ctx, seen))
    case 'array':
      return hasMarker(shape.element, ctx, seen)
    case 'tuple':
      return shape.elements.some((e) => hasMarker(e.type, ctx, seen))
    case 'union':
    case 'intersection':
      return shape.types.some((t) => hasMarker(t, ctx, seen))
    default:
      return false
  }
}
