// TypeScript-like rendering of TypeShape IR: used by snapshot tests, `scan --types`, and later the UI and docs.
import type { AppModel, TypeShape } from './model'

/** Renders a shape on one line, e.g. `{ id: number; tags?: string[] }`. */
export function formatTypeShape(shape: TypeShape): string {
  switch (shape.kind) {
    case 'primitive':
      return shape.name
    case 'literal':
      return typeof shape.value === 'string' && !shape.bigint
        ? JSON.stringify(shape.value)
        : String(shape.value)
    case 'object': {
      const members = shape.properties.map(
        (p) =>
          `${p.readonly ? 'readonly ' : ''}${propertyName(p.name)}${p.optional ? '?' : ''}: ${formatTypeShape(p.type)}`,
      )
      for (const index of shape.indexSignatures ?? []) {
        members.push(`[key: ${index.key}]: ${formatTypeShape(index.type)}`)
      }
      if (shape.truncated) members.push('/* … */')
      return members.length === 0 ? '{}' : `{ ${members.join('; ')} }`
    }
    case 'array':
      return `${shape.readonly ? 'readonly ' : ''}${wrap(shape.element)}[]`
    case 'tuple': {
      const elements = shape.elements.map((e) => {
        const type = e.rest ? `${wrap(e.type)}[]` : formatTypeShape(e.type)
        const prefix = e.rest ? '...' : ''
        return e.name
          ? `${prefix}${e.name}${e.optional ? '?' : ''}: ${type}`
          : `${prefix}${type}${e.optional ? '?' : ''}`
      })
      return `${shape.readonly ? 'readonly ' : ''}[${elements.join(', ')}]`
    }
    case 'union':
      return [...shape.types.map(wrapFunction), ...(shape.truncated ? ['/* … */'] : [])].join(' | ')
    case 'intersection':
      return shape.types.map(wrap).join(' & ')
    case 'function': {
      const params = shape.params.map(
        (p) => `${p.rest ? '...' : ''}${p.name}${p.optional ? '?' : ''}: ${formatTypeShape(p.type)}`,
      )
      return `(${params.join(', ')}) => ${formatTypeShape(shape.returns)}`
    }
    case 'ref':
      return shape.name
    case 'external':
      return shape.typeArguments
        ? `${shape.name}<${shape.typeArguments.map(formatTypeShape).join(', ')}>`
        : shape.name
    case 'type-parameter':
      return shape.name
    case 'unresolved':
      return `/* ${shape.reason === 'depth' ? 'not expanded' : 'unsupported'}: ${shape.text} */`
  }
}

/** Named types and component props/used types as text, for snapshots and `scan --types`. */
export function formatTypes(model: AppModel): string {
  const names = new Map(model.types.map((t) => [t.id, t.name]))
  const out: string[] = ['# Types', '']
  for (const t of model.types) {
    out.push(`${t.name}  ${t.declarationKind}  ${t.definedAt.file}:${t.definedAt.line}`)
    out.push(`  ${formatTypeShape(t.shape)}`)
  }
  out.push('', '# Component types', '')
  for (const c of model.components) {
    if (!c.propsType && c.usedTypes.length === 0) continue
    out.push(`${c.name}  ${c.file}:${c.loc.line}`)
    if (c.propsType) {
      const shape = formatTypeShape(c.propsType.shape)
      out.push(`  props: ${c.propsType.text}${shape === c.propsType.text ? '' : ` = ${shape}`}`)
    }
    if (c.usedTypes.length > 0) {
      out.push(`  uses: ${c.usedTypes.map((id) => names.get(id) ?? `(missing ${id})`).join(', ')}`)
    }
  }
  return `${out.join('\n')}\n`
}

function propertyName(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)
}

function wrap(shape: TypeShape): string {
  const text = formatTypeShape(shape)
  return shape.kind === 'union' || shape.kind === 'function' || shape.kind === 'intersection'
    ? `(${text})`
    : text
}

function wrapFunction(shape: TypeShape): string {
  const text = formatTypeShape(shape)
  return shape.kind === 'function' ? `(${text})` : text
}
