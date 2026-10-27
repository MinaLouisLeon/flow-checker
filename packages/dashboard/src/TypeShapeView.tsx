// Renders a resolved TypeShape. Small shapes stay on one line; objects and large unions
// become nested, collapsible lists. Named project types link to the Types screen.
import { formatTypeShape, type TypeShape } from '@flow-checker/shared'
import { Fragment, type ReactNode, useState } from 'react'
import { href } from './router'

const INLINE_LIMIT = 60

/** True when the shape reads well on one line. */
function isInline(shape: TypeShape): boolean {
  switch (shape.kind) {
    case 'object':
      return shape.properties.length === 0 && !shape.indexSignatures?.length
    case 'array':
      return isInline(shape.element)
    case 'union':
    case 'intersection':
      return shape.types.every(isInline) && formatTypeShape(shape).length <= INLINE_LIMIT
    case 'external':
      return (shape.typeArguments ?? []).every(isInline)
    case 'tuple':
    case 'function':
      return formatTypeShape(shape).length <= INLINE_LIMIT
    default:
      return true
  }
}

function needsParens(shape: TypeShape) {
  return shape.kind === 'union' || shape.kind === 'intersection' || shape.kind === 'function'
}

/** One-line rendering with clickable refs. */
function Inline({ shape }: { shape: TypeShape }): ReactNode {
  switch (shape.kind) {
    case 'ref':
      return (
        <a className="t-ref" href={href({ name: 'types', typeId: shape.typeId, q: '' })}>
          {shape.name}
        </a>
      )
    case 'primitive':
      return <span className="t-prim">{shape.name}</span>
    case 'literal':
      return <span className="t-lit">{formatTypeShape(shape)}</span>
    case 'array': {
      const inner = <Inline shape={shape.element} />
      return (
        <>
          {shape.readonly && 'readonly '}
          {needsParens(shape.element) ? <>({inner})</> : inner}[]
        </>
      )
    }
    case 'union':
    case 'intersection':
      return (
        <>
          {shape.types.map((t, i) => (
            <Fragment key={i}>
              {i > 0 && (shape.kind === 'union' ? ' | ' : ' & ')}
              {t.kind === 'function' ? (
                <>
                  (<Inline shape={t} />)
                </>
              ) : (
                <Inline shape={t} />
              )}
            </Fragment>
          ))}
          {shape.kind === 'union' && shape.truncated && ' | …'}
        </>
      )
    case 'external':
      return (
        <>
          <span className="t-ext" title={shape.module}>
            {shape.name}
          </span>
          {shape.typeArguments?.length ? (
            <>
              {'<'}
              {shape.typeArguments.map((t, i) => (
                <Fragment key={i}>
                  {i > 0 && ', '}
                  <Inline shape={t} />
                </Fragment>
              ))}
              {'>'}
            </>
          ) : null}
        </>
      )
    case 'unresolved':
      return (
        <span
          className="t-unresolved"
          title={shape.reason === 'depth' ? 'Not expanded: depth limit' : 'Not expressible'}
        >
          ⚠ {shape.text}
        </span>
      )
    default:
      return <span>{formatTypeShape(shape)}</span>
  }
}

export function TypeShapeView({ shape, depth = 0 }: { shape: TypeShape; depth?: number }) {
  if (isInline(shape)) {
    return (
      <code className="type-inline">
        <Inline shape={shape} />
      </code>
    )
  }
  return <Block shape={shape} depth={depth} />
}

function Block({ shape, depth }: { shape: TypeShape; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  const summary = summaryOf(shape)

  return (
    <div className="type-block">
      <button type="button" className="type-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="caret">{open ? '▾' : '▸'}</span> <code>{summary}</code>
      </button>
      {open && <div className="type-body">{body(shape, depth)}</div>}
    </div>
  )
}

function summaryOf(shape: TypeShape): string {
  switch (shape.kind) {
    case 'object': {
      const n = shape.properties.length
      return `{ ${n} field${n === 1 ? '' : 's'}${shape.indexSignatures?.length ? ', index' : ''} }`
    }
    case 'array':
      return `${shape.readonly ? 'readonly ' : ''}array of`
    case 'union':
      return `one of ${shape.types.length}${shape.truncated ? '+' : ''}`
    case 'intersection':
      return `all of ${shape.types.length}`
    case 'tuple':
      return `tuple [${shape.elements.length}]`
    case 'function':
      return `function (${shape.params.length} param${shape.params.length === 1 ? '' : 's'})`
    case 'external':
      return `${shape.name}<…>`
    default:
      return formatTypeShape(shape)
  }
}

function body(shape: TypeShape, depth: number): ReactNode {
  const next = depth + 1
  switch (shape.kind) {
    case 'object':
      return (
        <ul className="type-props">
          {shape.properties.map((p) => (
            <li key={p.name}>
              <span className="t-key">
                {p.readonly && <span className="t-mod">readonly </span>}
                {p.name}
                {p.optional && <span className="t-opt">?</span>}:
              </span>{' '}
              <TypeShapeView shape={p.type} depth={next} />
            </li>
          ))}
          {shape.indexSignatures?.map((i) => (
            <li key={`[${i.key}]`}>
              <span className="t-key">[key: {i.key}]:</span> <TypeShapeView shape={i.type} depth={next} />
            </li>
          ))}
          {shape.truncated && <li className="muted">… more fields not shown</li>}
        </ul>
      )
    case 'array':
      return <TypeShapeView shape={shape.element} depth={next} />
    case 'union':
    case 'intersection':
      return (
        <ul className="type-props">
          {shape.types.map((t, i) => (
            <li key={i}>
              <span className="t-mod">{shape.kind === 'union' ? '|' : '&'}</span>{' '}
              <TypeShapeView shape={t} depth={next} />
            </li>
          ))}
          {shape.kind === 'union' && shape.truncated && <li className="muted">… more members not shown</li>}
        </ul>
      )
    case 'tuple':
      return (
        <ul className="type-props">
          {shape.elements.map((e, i) => (
            <li key={i}>
              <span className="t-key">
                {e.rest ? '...' : ''}
                {e.name ?? i}
                {e.optional && <span className="t-opt">?</span>}:
              </span>{' '}
              <TypeShapeView shape={e.type} depth={next} />
            </li>
          ))}
        </ul>
      )
    case 'function':
      return (
        <ul className="type-props">
          {shape.params.map((p) => (
            <li key={p.name}>
              <span className="t-key">
                {p.rest ? '...' : ''}
                {p.name}
                {p.optional && <span className="t-opt">?</span>}:
              </span>{' '}
              <TypeShapeView shape={p.type} depth={next} />
            </li>
          ))}
          <li>
            <span className="t-key">returns:</span> <TypeShapeView shape={shape.returns} depth={next} />
          </li>
        </ul>
      )
    case 'external':
      return (
        <ul className="type-props">
          <li className="muted">
            <code>{shape.name}</code>
            {shape.module ? ` from ${shape.module}` : ''} with:
          </li>
          {shape.typeArguments?.map((t, i) => (
            <li key={i}>
              <TypeShapeView shape={t} depth={next} />
            </li>
          ))}
        </ul>
      )
    default:
      return <Inline shape={shape} />
  }
}
