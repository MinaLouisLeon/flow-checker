// Turns saved example bodies into a TypeShape: what the code would declare if it had a type.
// Several examples are merged: a property missing from some of them is optional, and values of
// different JSON types become a union.
import type { TypeProperty, TypeShape } from '@flow-checker/shared'

const MAX_DEPTH = 12
/** Array items sampled per array. */
const MAX_ITEMS = 50

export function shapeOfValues(values: readonly unknown[]): TypeShape | undefined {
  if (values.length === 0) return undefined
  return merge(values.map((v) => shapeOf(v, 0)))
}

export function shapeOf(value: unknown, depth = 0): TypeShape {
  if (value === null) return { kind: 'primitive', name: 'null' }
  if (depth > MAX_DEPTH) return { kind: 'primitive', name: 'unknown' }
  switch (typeof value) {
    case 'string':
      return { kind: 'primitive', name: 'string' }
    case 'number':
      return { kind: 'primitive', name: 'number' }
    case 'boolean':
      return { kind: 'primitive', name: 'boolean' }
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((v) => shapeOf(v, depth + 1))
    return {
      kind: 'array',
      element: items.length > 0 ? merge(items) : { kind: 'primitive', name: 'unknown' },
    }
  }
  if (typeof value === 'object') {
    const properties: TypeProperty[] = Object.entries(value as Record<string, unknown>).map(([name, v]) => ({
      name,
      type: shapeOf(v, depth + 1),
    }))
    return { kind: 'object', properties }
  }
  return { kind: 'primitive', name: 'unknown' }
}

/** One shape that every input fits. */
function merge(shapes: TypeShape[]): TypeShape {
  const members: TypeShape[] = []
  for (const shape of shapes) {
    for (const s of shape.kind === 'union' ? shape.types : [shape]) add(members, s)
  }
  if (members.length === 1) return members[0] as TypeShape
  // `null` last, like `T | null` in code.
  members.sort((a, b) => Number(isNull(a)) - Number(isNull(b)))
  return { kind: 'union', types: members }
}

/** Adds a shape to a union's members, merging objects with objects and arrays with arrays. */
function add(members: TypeShape[], shape: TypeShape): void {
  const index = members.findIndex(
    (m) =>
      m.kind === shape.kind &&
      (m.kind !== 'primitive' || (shape.kind === 'primitive' && m.name === shape.name)),
  )
  const existing = members[index]
  if (!existing) {
    members.push(shape)
    return
  }
  if (existing.kind === 'object' && shape.kind === 'object') members[index] = mergeObjects(existing, shape)
  else if (existing.kind === 'array' && shape.kind === 'array') {
    members[index] = { kind: 'array', element: mergeElements(existing.element, shape.element) }
  }
}

/** An empty array's `unknown` element gives way to what other examples show. */
function mergeElements(a: TypeShape, b: TypeShape): TypeShape {
  if (isUnknown(a)) return b
  if (isUnknown(b)) return a
  return merge([a, b])
}

function mergeObjects(
  a: Extract<TypeShape, { kind: 'object' }>,
  b: Extract<TypeShape, { kind: 'object' }>,
): TypeShape {
  const names = [...new Set([...a.properties.map((p) => p.name), ...b.properties.map((p) => p.name)])]
  const properties = names.map((name): TypeProperty => {
    const pa = a.properties.find((p) => p.name === name)
    const pb = b.properties.find((p) => p.name === name)
    const type = pa && pb ? merge([pa.type, pb.type]) : ((pa ?? pb)?.type as TypeShape)
    const optional = !pa || !pb || pa.optional || pb.optional
    return optional ? { name, type, optional: true } : { name, type }
  })
  return { kind: 'object', properties }
}

const isNull = (s: TypeShape) => s.kind === 'primitive' && s.name === 'null'
const isUnknown = (s: TypeShape) => s.kind === 'primitive' && s.name === 'unknown'
