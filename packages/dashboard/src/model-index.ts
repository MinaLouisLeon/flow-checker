// Lookup tables and derived facts the screens need, built once per model.
import {
  type AppModel,
  type Component,
  type ComponentRef,
  type NamedType,
  type RequestSite,
  type Route,
  type TypeShape,
  urlText,
} from '@flow-checker/shared'

export interface RenderSite {
  /** The component that renders this one. */
  parentId: string
  ref: ComponentRef
}

export interface TypeUsage {
  /** Components whose props type refers to this type. */
  props: string[]
  /** Components that use this type in their body. */
  usedBy: string[]
  /** Other named types that refer to this one. */
  inTypes: string[]
  /** Requests whose body or response refers to this type. */
  requests: string[]
}

export type NoteKind = 'unresolved-component' | 'unresolved-type' | 'missing-page-component' | 'request'

/** Something the scan could not confirm. Shown as a to-do list on the overview. */
export interface ScanNote {
  kind: NoteKind
  message: string
  file: string
  line?: number
  column?: number
  routeId?: string
  componentId?: string
  typeId?: string
  requestId?: string
}

export interface ModelIndex {
  model: AppModel
  routes: Map<string, Route>
  components: Map<string, Component>
  types: Map<string, NamedType>
  requests: Map<string, RequestSite>
  /** Component id -> requests that start in it. */
  requestsByComponent: Map<string, RequestSite[]>
  /** Route id -> requests a route handler sends (origin) and requests sent to it (callers). */
  handlerRequests: Map<string, RequestSite[]>
  handlerCallers: Map<string, RequestSite[]>
  /** Component id → where it is rendered. */
  renderedBy: Map<string, RenderSite[]>
  /** Component id → routes whose page or layouts render it (directly or further down). */
  routesOf: Map<string, string[]>
  /** Type id → where it is used. */
  typeUsage: Map<string, TypeUsage>
  notes: ScanNote[]
}

export function buildIndex(model: AppModel): ModelIndex {
  const routes = new Map(model.routes.map((r) => [r.id, r]))
  const components = new Map(model.components.map((c) => [c.id, c]))
  const types = new Map(model.types.map((t) => [t.id, t]))
  const requests = new Map(model.requests.map((s) => [s.id, s]))
  const requestsByComponent = new Map<string, RequestSite[]>()
  const handlerRequests = new Map<string, RequestSite[]>()
  const handlerCallers = new Map<string, RequestSite[]>()
  for (const site of model.requests) {
    if (site.componentId) push(requestsByComponent, site.componentId, site)
    if (site.origin === 'route-handler' && site.routeId) push(handlerRequests, site.routeId, site)
    if (site.targetRouteId) push(handlerCallers, site.targetRouteId, site)
  }

  const renderedBy = new Map<string, RenderSite[]>()
  for (const parent of model.components) {
    for (const ref of parent.children) {
      if (!ref.componentId) continue
      push(renderedBy, ref.componentId, { parentId: parent.id, ref })
    }
  }

  const routesOf = new Map<string, string[]>()
  for (const route of model.routes) {
    const roots = [...route.layoutChain.map((l) => l.componentId), route.componentId]
    const seen = new Set<string>()
    for (const id of roots) if (id) walkComponents(id, components, seen)
    for (const id of seen) push(routesOf, id, route.id)
  }

  const typeUsage = new Map<string, TypeUsage>()
  const usage = (id: string) => {
    let u = typeUsage.get(id)
    if (!u) {
      u = { props: [], usedBy: [], inTypes: [], requests: [] }
      typeUsage.set(id, u)
    }
    return u
  }
  for (const c of model.components) {
    if (c.propsType) for (const id of typeRefs(c.propsType.shape)) addOnce(usage(id).props, c.id)
    for (const id of c.usedTypes) addOnce(usage(id).usedBy, c.id)
  }
  for (const t of model.types) {
    for (const id of typeRefs(t.shape)) if (id !== t.id) addOnce(usage(id).inTypes, t.id)
  }
  for (const site of model.requests) {
    for (const ref of [site.bodyType, site.responseType]) {
      if (ref) for (const id of typeRefs(ref.shape)) addOnce(usage(id).requests, site.id)
    }
  }

  return {
    model,
    routes,
    components,
    types,
    requests,
    requestsByComponent,
    handlerRequests,
    handlerCallers,
    renderedBy,
    routesOf,
    typeUsage,
    notes: scanNotes(model),
  }
}

/** Ids of the named types a shape refers to, in order, without repeats. */
export function typeRefs(shape: TypeShape): string[] {
  const out: string[] = []
  const visit = (s: TypeShape) => {
    switch (s.kind) {
      case 'ref':
        addOnce(out, s.typeId)
        return
      case 'object':
        for (const p of s.properties) visit(p.type)
        for (const i of s.indexSignatures ?? []) visit(i.type)
        return
      case 'array':
        visit(s.element)
        return
      case 'tuple':
        for (const e of s.elements) visit(e.type)
        return
      case 'union':
      case 'intersection':
        for (const t of s.types) visit(t)
        return
      case 'function':
        for (const p of s.params) visit(p.type)
        visit(s.returns)
        return
      case 'external':
        for (const t of s.typeArguments ?? []) visit(t)
        return
      default:
        return
    }
  }
  visit(shape)
  return out
}

function hasUnresolved(shape: TypeShape): boolean {
  switch (shape.kind) {
    case 'unresolved':
      return true
    case 'object':
      return (
        shape.properties.some((p) => hasUnresolved(p.type)) ||
        (shape.indexSignatures ?? []).some((i) => hasUnresolved(i.type))
      )
    case 'array':
      return hasUnresolved(shape.element)
    case 'tuple':
      return shape.elements.some((e) => hasUnresolved(e.type))
    case 'union':
    case 'intersection':
      return shape.types.some(hasUnresolved)
    case 'function':
      return shape.params.some((p) => hasUnresolved(p.type)) || hasUnresolved(shape.returns)
    case 'external':
      return (shape.typeArguments ?? []).some(hasUnresolved)
    default:
      return false
  }
}

function scanNotes(model: AppModel): ScanNote[] {
  const notes: ScanNote[] = []
  for (const route of model.routes) {
    if (route.kind === 'page' && !route.componentId) {
      notes.push({
        kind: 'missing-page-component',
        message: `No default-export component found for ${route.path}`,
        file: route.file,
        routeId: route.id,
      })
    }
  }
  for (const c of model.components) {
    for (const ref of c.children) {
      if (ref.resolution !== 'unresolved') continue
      notes.push({
        kind: 'unresolved-component',
        message: `<${ref.name}> in ${c.name} could not be traced to a component`,
        file: ref.loc.file,
        line: ref.loc.line,
        column: ref.loc.column,
        componentId: c.id,
      })
    }
    if (c.propsType && hasUnresolved(c.propsType.shape)) {
      notes.push({
        kind: 'unresolved-type',
        message: `Props of ${c.name} are only partly resolved`,
        file: c.loc.file,
        line: c.loc.line,
        column: c.loc.column,
        componentId: c.id,
      })
    }
  }
  for (const site of model.requests) {
    const first = site.callStack[0]
    for (const flag of site.flags) {
      notes.push({
        kind: 'request',
        message: `${requestLabel(site)}: ${flag.message}`,
        file: first?.file ?? '',
        ...(first ? { line: first.line, column: first.column } : {}),
        ...(site.componentId ? { componentId: site.componentId } : {}),
        ...(site.origin === 'route-handler' && site.routeId ? { routeId: site.routeId } : {}),
        requestId: site.id,
      })
    }
  }
  for (const t of model.types) {
    if (!hasUnresolved(t.shape)) continue
    notes.push({
      kind: 'unresolved-type',
      message: `${t.name} is only partly resolved`,
      file: t.definedAt.file,
      line: t.definedAt.line,
      column: t.definedAt.column,
      typeId: t.id,
    })
  }
  return notes
}

/** Ids of every component reachable from `id`, cycles included once. */
function walkComponents(id: string, components: Map<string, Component>, seen: Set<string>) {
  if (seen.has(id)) return
  seen.add(id)
  for (const ref of components.get(id)?.children ?? []) {
    if (ref.componentId) walkComponents(ref.componentId, components, seen)
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

function addOnce<T>(list: T[], value: T) {
  if (!list.includes(value)) list.push(value)
}

/** The URL for a page in the running app, or undefined when the path has dynamic segments. */
export function appUrl(route: Route, appPort: number | undefined): string | undefined {
  if (route.kind !== 'page' || !appPort) return undefined
  if (route.segments.some((s) => s.kind !== 'static' && s.kind !== 'group' && s.kind !== 'slot')) {
    return undefined
  }
  return `http://localhost:${appPort}${route.path}`
}

/** `vscode://` link that opens a file at a position. */
export function editorUrl(root: string | undefined, file: string, line = 1, column = 1): string | undefined {
  if (!root) return undefined
  const path = `${root.replace(/\/+$/, '')}/${file}`
  const encoded = encodeURI(path.startsWith('/') ? path.slice(1) : path)
    .replaceAll('#', '%23')
    .replaceAll('?', '%3F')
  return `vscode://file/${encoded}:${line}:${column}`
}

/** Short label for a request, e.g. `GET /users/:id` or `POST createProduct (server action)`. */
export function requestLabel(site: RequestSite): string {
  const method = site.method ?? '?'
  if (site.transport === 'server-action') return `${method} ${site.serverAction?.name ?? '?'} (server action)`
  return `${method} ${site.url ? urlText(site.url) : '?'}`
}
