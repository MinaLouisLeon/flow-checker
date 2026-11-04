// Plain-text rendering of a model: used by `flow-checker scan --tree` and snapshot tests.
import { accessOf, guardText } from './access'
import { ACTION_AUTH_LABELS, ACTION_INPUT_LABELS, actionsOn, formatActions } from './actions'
import { gapLine, titleText } from './boundaries'
import { formatCache } from './cache'
import { CLIENT_USE_LABELS, sizeText } from './client'
import { envFlagsOn, envOn, formatEnv } from './env'
import { urlText } from './format-requests'
import { importText, leaksOn, SERVER_MODULE_LABELS } from './leaks'
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
import { renderLabel, renderOf, renderReasonLine } from './render'

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
    out.push(...formatRender(route))
    out.push(...formatBoundaries(route))
    out.push(...formatClient(route, components))
    out.push(...formatPageLeaks(model, route))
    out.push(...formatPageEnv(model, route))
    out.push(...formatPageActions(model, route))
  }

  const cache = formatCache(model)
  if (cache.length > 0) out.push('', ...cache)
  if (model.clientBoundaries) out.push('', ...formatClientBoundaries(model, components))
  if (model.leaks) out.push('', ...formatLeaks(model, components))
  if (model.env) out.push('', ...formatEnv(model))
  if (model.actions) out.push('', ...formatActions(model))

  return `${out.join('\n')}\n`
}

function formatAccess(route: Route): string[] {
  const access = accessOf(route)
  const out = [`access: ${access.status}`]
  for (const guard of access.guards) out.push(`  ${guardText(guard)}  ${guard.loc.file}:${guard.loc.line}`)
  for (const reason of access.reasons ?? []) out.push(`  ? ${reason.text}`)
  return out
}

function formatRender(route: Route): string[] {
  const render = renderOf(route)
  const out = [`render: ${renderLabel(render)}`]
  for (const reason of render.reasons) {
    const at = reason.loc ? `  ${reason.loc.file}:${reason.loc.line}` : ''
    out.push(`  ${renderReasonLine(reason)}${at}`)
  }
  return out
}

function formatBoundaries(route: Route): string[] {
  const boundaries = route.boundaries
  if (!boundaries) return []
  const files = boundaries.items.map((b) =>
    b.in === 'segment'
      ? `${b.kind}${b.nearest ? '*' : ''} ${b.file}`
      : `${b.kind} in ${b.in}${b.wraps?.length ? ` around ${b.wraps.join(', ')}` : ''} ${b.loc?.file}:${b.loc?.line}`,
  )
  const out = [`boundaries: ${files.length > 0 ? '' : '(none)'}`.trimEnd()]
  for (const file of files) out.push(`  ${file}`)
  for (const gap of boundaries.gaps) {
    const at = gap.loc ? `  ${gap.loc.file}:${gap.loc.line}` : ''
    out.push(`  ! ${gapLine(gap)}${at}`)
  }
  const meta = route.metadata
  if (meta) {
    const from = meta.sources.map((m) => `${m.in} ${m.kind}`).join(', ')
    out.push(`title: ${titleText(meta)}${from ? `  (${from})` : ''}`)
  }
  return out
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Where the page's browser part starts (M43). */
function formatClient(route: Route, components: Map<string, Component>): string[] {
  const client = route.client
  if (!client) return []
  if (client.boundaries.length === 0) return ['client: (none)']
  const name = (id: string) => components.get(id)?.name ?? '?'
  const packages = client.packages.length > 0 ? `, packages ${client.packages.join(', ')}` : ''
  const out = [
    `client: ${count(client.boundaries.length, 'boundary', 'boundaries')}, ${count(client.components, 'component')}, ${count(client.modules, 'module')}, ${sizeText(client.bytes)}${packages}`,
  ]
  for (const edge of client.boundaries) {
    const from = edge.parentId ? `from ${name(edge.parentId)} (${edge.in})` : `is the ${edge.in}`
    const via = edge.via ? ` through ${edge.via}` : ''
    const lazy = edge.dynamic ? ' [dynamic]' : ''
    out.push(`  ${name(edge.componentId)}  ${from}${via}${lazy}  ${edge.loc.file}:${edge.loc.line}`)
  }
  return out
}

/** Each boundary: what it brings to the browser, why it needs it, and whether it could move lower. */
function formatClientBoundaries(model: AppModel, components: Map<string, Component>): string[] {
  const name = (id: string) => components.get(id)?.name ?? '?'
  const out = ['# Client boundaries']
  for (const b of model.clientBoundaries ?? []) {
    out.push('', `## ${name(b.componentId)}  ${b.file}`)
    const shared = b.componentIds.filter((id) => components.get(id)?.kind === 'shared')
    out.push(
      `components: ${b.componentIds.map(name).join(', ')}${shared.length > 0 ? `  (also on the server: ${shared.map(name).join(', ')})` : ''}`,
    )
    out.push(`modules: ${b.modules.length}, ${sizeText(b.bytes)}`)
    for (const file of b.modules) out.push(`  ${file}`)
    if (b.packages.length > 0) out.push(`packages: ${b.packages.join(', ')}`)
    out.push(
      `uses: ${b.uses.length > 0 ? b.uses.map((u) => `${u.name} (${CLIENT_USE_LABELS[u.kind]}) ${u.loc.file}:${u.loc.line}`).join(', ') : '(none)'}`,
    )
    if (b.lower) {
      const into = b.lower.into.length > 0 ? b.lower.into.map(name).join(', ') : '(nothing: drop it)'
      out.push(`could move lower: into ${into}; on the server: ${b.lower.server.map(name).join(', ')}`)
    }
  }
  return out
}

/** The page's server/client leaks, one line each (M44). */
function formatPageLeaks(model: AppModel, route: Route): string[] {
  const leaks = leaksOn(model, route.id)
  if (leaks.length === 0) return []
  return [
    `leaks: ${leaks.length}`,
    ...leaks.map((l) =>
      l.kind === 'module'
        ? `  module ${l.module} in ${l.file}:${l.loc.line}`
        : `  prop ${l.name}.${l.prop} (${l.value})  ${l.loc.file}:${l.loc.line}`,
    ),
  ]
}

/** The environment variables the page's code reads, with the flags that show up on it (M45). */
function formatPageEnv(model: AppModel, route: Route): string[] {
  const vars = envOn(model, route.id)
  if (vars.length === 0) return []
  const line = vars
    .map((v) => {
      const flags = envFlagsOn(v, route.id).map((f) => ` [${f.kind}]`)
      return `${v.name}${flags.join('')}`
    })
    .join(', ')
  return [`env: ${line}`]
}

/** The server actions the page uses, with their labels (M46). */
function formatPageActions(model: AppModel, route: Route): string[] {
  const actions = actionsOn(model, route.id)
  if (actions.length === 0) return []
  const line = actions
    .map((a) => {
      const flags = (a.flags ?? []).map((f) => ` [${f.kind}]`).join('')
      return `${a.name} (${ACTION_AUTH_LABELS[a.auth.status]}, ${ACTION_INPUT_LABELS[a.input.status]})${flags}`
    })
    .join(', ')
  return [`actions: ${line}`]
}

/** Every leak: server-only modules client code imports, then props that can't cross (M44). */
function formatLeaks(model: AppModel, components: Map<string, Component>): string[] {
  const name = (id: string) => components.get(id)?.name ?? '?'
  const paths = (ids: string[]) => {
    const routes = new Map(model.routes.map((r) => [r.id, r.path]))
    return ids.map((id) => routes.get(id) ?? '?').join(', ') || '(none)'
  }
  const out = ['# Server/client leaks']
  for (const l of model.leaks ?? []) {
    out.push('')
    if (l.kind === 'module') {
      out.push(
        `module ${importText(l).replaceAll('`', '')}: ${SERVER_MODULE_LABELS[l.category].replaceAll('`', '')}  ${l.file}:${l.loc.line}`,
        `  chain: ${l.chain.join(' > ')}`,
        `  boundaries: ${l.boundaries.map(name).join(', ')}; pages: ${paths(l.routeIds)}`,
      )
    } else {
      const to = l.module ? `${l.name} (${l.module})` : l.name
      out.push(
        `prop ${l.prop}: ${l.value}${l.type ? ` ${l.type}` : ''}, from ${name(l.parentId)} to ${to}  ${l.loc.file}:${l.loc.line}`,
        `  pages: ${paths(l.routeIds)}`,
      )
    }
  }
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
  const flags = [
    ref.conditional && 'conditional',
    ref.dynamic && 'dynamic',
    ref.suspense && 'suspense',
    ref.errorBoundary && 'error boundary',
  ].filter(Boolean)
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
