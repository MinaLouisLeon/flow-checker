// Plain-text rendering of a model: used by `flow-checker scan --tree` and snapshot tests.
import { accessOf, guardText } from './access'
import { urlText } from './format-requests'
import type {
  AppModel,
  Component,
  ComponentRef,
  MatcherCondition,
  Middleware,
  MiddlewareMatcher,
  Route,
  RouteTreeNode,
} from './model'

export function formatModel(model: AppModel): string {
  const components = new Map(model.components.map((c) => [c.id, c]))
  const out: string[] = []

  out.push('# Route tree', '')
  out.push(...formatRouteTree(model.routeTree))

  out.push('', '# Routes', '')
  for (const route of model.routes) out.push(formatRouteLine(route))

  if (model.middleware) out.push('', '# Middleware', '', ...formatMiddleware(model.middleware, model.routes))

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
    out.push(...formatAccess(route))
  }

  return `${out.join('\n')}\n`
}

function formatAccess(route: Route): string[] {
  const access = accessOf(route)
  const out = [`access: ${access.status}`]
  for (const guard of access.guards) out.push(`  ${guardText(guard)}  ${guard.loc.file}:${guard.loc.line}`)
  for (const reason of access.reasons ?? []) out.push(`  ? ${reason.text}`)
  return out
}

function formatMiddleware(mw: Middleware, routeList: Route[]): string[] {
  const routes = new Map(routeList.map((r) => [r.id, r]))
  const path = (id: string | undefined) => (id ? (routes.get(id)?.path ?? id) : '?')
  const factory = mw.factory ? `  (from ${mw.factory.module} ${mw.factory.name})` : ''
  const out = [`${mw.file}  ${mw.convention}  export ${mw.exportName ?? '?'}${factory}`]
  if (mw.matcherText !== undefined) out.push(`matcher: ? ${mw.matcherText}`)
  else
    out.push(
      `matcher: ${mw.matchers.length > 0 ? mw.matchers.map(matcherText).join(', ') : '(every request)'}`,
    )
  if (mw.i18n) {
    const extra = [
      mw.i18n.defaultLocale && `default ${mw.i18n.defaultLocale}`,
      mw.i18n.localePrefix && `prefix ${mw.i18n.localePrefix}`,
    ]
    out.push(
      `locales: ${mw.i18n.locales.join(', ')}${extra.some(Boolean) ? ` (${extra.filter(Boolean).join(', ')})` : ''}`,
    )
  }
  out.push('runs on:')
  if (mw.routes.length === 0) out.push('  (no route)')
  for (const r of mw.routes) {
    const route = routes.get(r.routeId)
    const kind = route?.kind === 'route-handler' ? 'route' : 'page'
    out.push(`  ${path(r.routeId)}  ${kind}${r.conditional ? '  [conditional]' : ''}`)
  }
  for (const rw of mw.rewrites) {
    const from = rw.from ? `${rw.from.path}${rw.from.kind === 'prefix' ? '/*' : ''}` : '(where it runs)'
    const target = rw.targetRouteId ? ` -> ${path(rw.targetRouteId)}` : ''
    out.push(`rewrite ${from} to ${urlText(rw.href)}${target}${rw.condition ? `  if ${rw.condition}` : ''}`)
  }
  return out
}

function matcherText(m: MiddlewareMatcher): string {
  const cond = (word: string, list: MatcherCondition[] | undefined) =>
    list?.map((c) => `${word} ${c.type} ${c.key}${c.value !== undefined ? `=${c.value}` : ''}`) ?? []
  const extra = [
    ...cond('has', m.has),
    ...cond('missing', m.missing),
    ...(m.locale === false ? ['locale: false'] : []),
  ]
  return extra.length > 0 ? `${m.source} (${extra.join(', ')})` : m.source
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
