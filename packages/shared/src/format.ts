// Plain-text rendering of a model: used by `flow-checker scan --tree` and snapshot tests.
import type { AppModel, Component, ComponentRef, Route, RouteTreeNode } from './model'

export function formatModel(model: AppModel): string {
  const components = new Map(model.components.map((c) => [c.id, c]))
  const out: string[] = []

  out.push('# Route tree', '')
  out.push(...formatRouteTree(model.routeTree))

  out.push('', '# Routes', '')
  for (const route of model.routes) out.push(formatRouteLine(route))

  const layoutIds = new Set<string>()
  for (const route of model.routes) {
    for (const layout of route.layoutChain) if (layout.componentId) layoutIds.add(layout.componentId)
  }
  if (layoutIds.size > 0) {
    out.push('', '# Layouts')
    for (const id of [...layoutIds].sort(byFile(components))) {
      out.push('', ...formatComponentTree(id, components))
    }
  }

  out.push('', '# Pages')
  for (const route of model.routes) {
    if (route.kind !== 'page') continue
    out.push('', `## ${route.path}${route.slot ? ` @${route.slot}` : ''}  ${route.file}`)
    if (route.layoutChain.length > 0) {
      out.push(`layouts: ${route.layoutChain.map((l) => l.file).join(' > ')}`)
    }
    out.push(...(route.componentId ? formatComponentTree(route.componentId, components) : ['(no component)']))
  }

  return `${out.join('\n')}\n`
}

function formatRouteTree(root: RouteTreeNode): string[] {
  const lines: string[] = []
  const label = (node: RouteTreeNode, isRoot: boolean) => {
    const name = isRoot ? node.dir : node.segment.raw
    const files = Object.keys(node.files)
    const kind = node.segment.kind === 'static' ? '' : ` (${node.segment.kind})`
    const intercept = node.segment.intercept ? ` (intercepts ${node.segment.intercept})` : ''
    return `${name}${kind}${intercept}${files.length > 0 ? ` [${files.join(', ')}]` : ''}`
  }
  const walk = (node: RouteTreeNode, prefix: string) => {
    node.children.forEach((child, i) => {
      const last = i === node.children.length - 1
      lines.push(`${prefix}${last ? '└─ ' : '├─ '}${label(child, false)}`)
      walk(child, `${prefix}${last ? '   ' : '│  '}`)
    })
  }
  lines.push(label(root, true))
  walk(root, '')
  return lines
}

function formatRouteLine(route: Route): string {
  const kind = route.kind === 'route-handler' ? `route ${route.methods?.join(',') ?? ''}` : 'page'
  const extra = [
    route.slot && `slot @${route.slot}`,
    route.intercepting && `intercepts from ${route.intercepting.from} ${route.intercepting.marker}`,
  ].filter(Boolean)
  return `${route.path}  ${kind}  ${route.file}${extra.length > 0 ? `  (${extra.join(', ')})` : ''}`
}

function formatComponentTree(rootId: string, components: Map<string, Component>): string[] {
  const root = components.get(rootId)
  if (!root) return [`(missing component ${rootId})`]
  const lines = [componentLabel(root)]
  const walk = (component: Component, prefix: string, path: Set<string>) => {
    component.children.forEach((ref, i) => {
      const last = i === component.children.length - 1
      const target = ref.componentId ? components.get(ref.componentId) : undefined
      const cycle = target ? path.has(target.id) : false
      lines.push(`${prefix}${last ? '└─ ' : '├─ '}${refLabel(ref, target)}${cycle ? ' (cycle)' : ''}`)
      if (target && !cycle) {
        walk(target, `${prefix}${last ? '   ' : '│  '}`, new Set([...path, target.id]))
      }
    })
  }
  walk(root, '', new Set([root.id]))
  return lines
}

function componentLabel(c: Component): string {
  return `${c.name}  ${c.kind}${c.clientBoundary ? ' (use client)' : ''}  ${c.file}:${c.loc.line}`
}

function refLabel(ref: ComponentRef, target: Component | undefined): string {
  const flags = [ref.conditional && 'conditional', ref.dynamic && 'dynamic'].filter(Boolean)
  const suffix = flags.length > 0 ? `  [${flags.join(', ')}]` : ''
  if (target) {
    const name = ref.name === target.name ? target.name : `${ref.name} = ${target.name}`
    return `${componentLabel({ ...target, name })}${suffix}`
  }
  const factory = ref.factory ? ` (from ${ref.factory})` : ''
  return `${ref.name}  ${ref.resolution}${ref.module ? ` ${ref.module}` : ''}${factory}${suffix}`
}

function byFile(components: Map<string, Component>) {
  return (a: string, b: string) => {
    const ca = components.get(a)
    const cb = components.get(b)
    const fa = ca?.file ?? ''
    const fb = cb?.file ?? ''
    return fa < fb ? -1 : fa > fb ? 1 : 0
  }
}
