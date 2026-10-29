// Multi-line TypeScript-like rendering of a TypeShape, for code blocks in the docs. Short shapes
// stay on one line (the same text as `formatTypeShape`).
import { formatTypeShape, type NamedType, type TypeShape } from '@flow-checker/shared'

const WIDTH = 80

export function prettyShape(shape: TypeShape, indent = ''): string {
  const one = formatTypeShape(shape)
  if (indent.length + one.length <= WIDTH) return one
  const inner = `${indent}  `
  switch (shape.kind) {
    case 'object': {
      const lines = shape.properties.map(
        (p) =>
          `${inner}${p.readonly ? 'readonly ' : ''}${propertyName(p.name)}${p.optional ? '?' : ''}: ${prettyShape(p.type, inner)}`,
      )
      for (const index of shape.indexSignatures ?? []) {
        lines.push(`${inner}[key: ${index.key}]: ${prettyShape(index.type, inner)}`)
      }
      if (shape.truncated) lines.push(`${inner}/* … */`)
      return lines.length === 0 ? '{}' : `{\n${lines.join('\n')}\n${indent}}`
    }
    case 'array': {
      const element = prettyShape(shape.element, indent)
      const wrapped =
        shape.element.kind === 'union' ||
        shape.element.kind === 'function' ||
        shape.element.kind === 'intersection'
          ? `(${element})`
          : element
      return `${shape.readonly ? 'readonly ' : ''}${wrapped}[]`
    }
    case 'union':
      return [
        ...shape.types.map((t) => `\n${inner}| ${prettyShape(t, inner)}`),
        ...(shape.truncated ? [`\n${inner}| /* … */`] : []),
      ].join('')
    case 'intersection':
      return shape.types.map((t) => prettyShape(t, indent)).join(' & ')
    default:
      return one
  }
}

/**
 * A named type as a resolved declaration, e.g. `interface User { ... }` or
 * `type Role = "a" | "b"`. Enums and classes are shown as the type of their values.
 */
export function declaration(type: NamedType): string {
  const body = prettyShape(type.shape)
  if (type.declarationKind === 'interface' && type.shape.kind === 'object') {
    return `interface ${type.name} ${body}`
  }
  return `type ${type.name} = ${body.trimStart()}`
}

function propertyName(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)
}
