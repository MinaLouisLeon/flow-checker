// Impact check (M36): what changing a file touches. Derived from the model, so `flow-checker impact`,
// `scan --diff` and the dashboard's "Affected by changes" panel give the same answer.
//
// A file is first matched against what the scan found in it: components, types, request call paths,
// navigations, cache links, routes, layouts and the middleware. A file with none of those (constants,
// utils) is followed up the import graph (`AppModel.imports`) to the nearest files that have some.
// From there the impact spreads to whatever uses those things: types to the types, components and
// requests that use them, route handlers to the requests that call them, components and requests to
// the pages that render or send them, and all of it to the flows that pass through it.
import { type Area, type AreaList, buildAreas } from './areas'
import type {
  CallFrame,
  Component,
  Flow,
  FlowStep,
  GraphqlFragment,
  GraphqlOperation,
  NamedType,
  Navigation,
  QueryLink,
  RequestSite,
  Route,
  RouteTreeNode,
  SourceLoc,
  SseEndpoint,
  TrpcProcedure,
} from './model'
import { type ModelIndex, requestLabel } from './model-index'
import type { SummaryLink } from './summary'

/** A changed file (project-relative, forward slashes), optionally only some of its lines (1-based). */
export interface ImpactTarget {
  file: string
  /** Only what starts in these lines, e.g. the declaration around a line. Both or neither. */
  lines?: { from: number; to: number }
}

export interface ImpactFile {
  file: string
  /**
   * `code`: the scan found components, types, requests... in it. `imported`: it has none, but files
   * that do import it. `none`: the scan doesn't know the file (not reached from the app, or excluded).
   */
  found: 'code' | 'imported' | 'none'
  /** What the scan found in it (`component UserList`, `2 requests`). */
  facts: string[]
  /** `imported`: the nearest files with scan facts that import it, directly or further up. */
  via: string[]
  /** Lines were given but nothing starts there, so the whole file was used. */
  wholeFile?: boolean
}

export type ImpactKind = 'page' | 'handler' | 'flow' | 'request' | 'component' | 'type'

export interface ImpactItem {
  kind: ImpactKind
  id: string
  /** A page's path, a request's method and URL, a flow's name. */
  label: string
  /** Why it is affected: the first reason found, the most direct one. */
  reason: string
  /** Pages, flows and requests: the area they belong to. */
  areaId?: string
  link: SummaryLink
}

export interface ImpactGroup {
  /** Absent for the last group: route handlers and requests outside every area. */
  areaId?: string
  name: string
  items: ImpactItem[]
}

export interface Impact {
  files: ImpactFile[]
  pages: ImpactItem[]
  handlers: ImpactItem[]
  flows: ImpactItem[]
  requests: ImpactItem[]
  components: ImpactItem[]
  types: ImpactItem[]
  /** Pages, route handlers, flows and requests by area, in the areas' order. */
  groups: ImpactGroup[]
}

/** Facts of one file: what starts in it, with the reason each one is affected. */
interface Seed {
  components: Map<string, string>
  types: Map<string, string>
  sites: Map<string, string>
  navigations: Map<string, string>
  links: Map<string, string>
  /** Routes affected as a whole: the page file, a layout, a special file, the middleware. */
  routes: Map<string, string>
}

export function buildImpact(
  index: ModelIndex,
  targets: readonly ImpactTarget[],
  areas: AreaList = buildAreas(index),
): Impact {
  const { model } = index
  const importers = reverseImports(model.imports ?? {})

  const components = new Map<string, string>()
  const types = new Map<string, string>()
  const sites = new Map<string, string>()
  const navigations = new Map<string, string>()
  const links = new Map<string, string>()
  const routes = new Map<string, string>()
  const flows = new Map<string, string>()
  const addAll = (seed: Seed) => {
    mergeInto(components, seed.components)
    mergeInto(types, seed.types)
    mergeInto(sites, seed.sites)
    mergeInto(navigations, seed.navigations)
    mergeInto(links, seed.links)
    mergeInto(routes, seed.routes)
  }

  const files: ImpactFile[] = []
  for (const target of targets) {
    let seed = seedFile(index, target.file, target.lines)
    const out: ImpactFile = { file: target.file, found: 'code', facts: [], via: [] }
    if (target.lines && isEmpty(seed)) {
      seed = seedFile(index, target.file)
      if (!isEmpty(seed)) out.wholeFile = true
    }
    if (!isEmpty(seed)) {
      out.facts = factsOf(seed)
      addAll(seed)
    } else {
      // Only imported: the nearest importers that the scan knows something about.
      const seen = new Set([target.file])
      const queue = [target.file]
      for (let i = 0; i < queue.length; i++) {
        for (const importer of importers.get(queue[i] as string) ?? []) {
          if (seen.has(importer)) continue
          seen.add(importer)
          const up = seedFile(index, importer, undefined, `${importer} (imports ${target.file})`)
          if (isEmpty(up)) queue.push(importer)
          else {
            out.via.push(importer)
            addAll(up)
          }
        }
      }
      out.found = out.via.length > 0 ? 'imported' : 'none'
      out.via.sort(compareText)
    }
    files.push(out)
  }

  // Types spread to the types that contain them, then to the components and requests using them.
  const typeQueue = [...types.keys()]
  for (let i = 0; i < typeQueue.length; i++) {
    const id = typeQueue[i] as string
    const name = index.types.get(id)?.name ?? id
    const usage = index.typeUsage.get(id)
    if (!usage) continue
    for (const other of usage.inTypes) {
      if (setOnce(types, other, `uses type ${name}`)) typeQueue.push(other)
    }
    for (const c of [...usage.props, ...usage.usedBy]) setOnce(components, c, `uses type ${name}`)
    for (const s of usage.requests) setOnce(sites, s, `its data type uses ${name}`)
  }

  // Requests spread to the requests that lead to them: a page's call to a changed route handler,
  // a form calling a server action whose fetch changed.
  const callers = new Map<string, RequestSite[]>()
  for (const site of model.requests) {
    for (const id of site.chain ?? []) push(callers, id, site)
  }
  const siteQueue = [...sites.keys()]
  for (let i = 0; i < siteQueue.length; i++) {
    const site = index.requests.get(siteQueue[i] as string)
    if (!site) continue
    const up = [
      ...(callers.get(site.id) ?? []),
      // Callers of the handler method that sends it (any method when either is unknown).
      ...(site.origin === 'route-handler' && site.routeId
        ? (index.handlerCallers.get(site.routeId) ?? []).filter(
            (c) => !c.method || !site.handlerMethod || c.method === site.handlerMethod,
          )
        : []),
    ]
    for (const caller of up) {
      if (setOnce(sites, caller.id, `leads to ${requestLabel(site)}`)) siteQueue.push(caller.id)
    }
  }
  // A route handler that changed (its file, or a request it sends) changes what its callers get.
  for (const [id] of [...routes]) {
    if (index.routes.get(id)?.kind !== 'route-handler') continue
    for (const caller of index.handlerCallers.get(id) ?? []) {
      if (setOnce(sites, caller.id, `calls ${index.routes.get(id)?.path}, which changed`)) {
        for (const up of callers.get(caller.id) ?? [])
          setOnce(sites, up.id, `leads to ${requestLabel(caller)}`)
      }
    }
  }

  // Up to the pages: through the component trees and layouts, and from the requests they send.
  for (const [id] of components) {
    const component = index.components.get(id)
    for (const routeId of index.routesOf.get(id) ?? []) {
      const route = index.routes.get(routeId)
      const own = route?.componentId === id
      const layout = route?.layoutChain.find((l) => l.componentId === id)
      setOnce(
        routes,
        routeId,
        own ? 'its page component changed' : layout ? `inside ${layout.file}` : `renders ${component?.name}`,
      )
    }
  }
  for (const [id] of sites) {
    const site = index.requests.get(id)
    if (!site) continue
    const label = requestLabel(site)
    if (site.componentId) {
      for (const routeId of index.routesOf.get(site.componentId) ?? [])
        setOnce(routes, routeId, `sends ${label}`)
    }
    if (site.origin === 'route-handler' && site.routeId) setOnce(routes, site.routeId, `sends ${label}`)
    if (site.origin === 'middleware') {
      for (const r of model.middleware?.routes ?? [])
        setOnce(routes, r.routeId, `the middleware sends ${label}`)
    }
  }
  for (const [id] of navigations) {
    const nav = index.navigations.get(id)
    if (!nav) continue
    const to = nav.href.text
    if (nav.componentId) {
      for (const routeId of index.routesOf.get(nav.componentId) ?? [])
        setOnce(routes, routeId, `goes to ${to}`)
    }
    for (const routeId of nav.sourceRouteIds ?? []) setOnce(routes, routeId, `can be redirected to ${to}`)
  }
  for (const [id] of links) {
    const link = index.queryLinks.get(id)
    for (const routeId of link?.componentId ? (index.routesOf.get(link.componentId) ?? []) : []) {
      setOnce(routes, routeId, `updates the cache with ${link?.method}`)
    }
  }

  // Flows: any step, or the component it starts in.
  for (const flow of model.flows) {
    const reason = flowReason(flow, index, { components, sites, navigations, links })
    if (reason) flows.set(flow.id, reason)
  }

  // Items, by area.
  const areaOfRequest = new Map<string, Area>()
  const areaOfFlow = new Map<string, Area>()
  for (const area of areas.areas) {
    for (const id of area.requestIds) if (!areaOfRequest.has(id)) areaOfRequest.set(id, area)
    for (const id of area.flowIds) if (!areaOfFlow.has(id)) areaOfFlow.set(id, area)
  }
  const pages: ImpactItem[] = []
  const handlers: ImpactItem[] = []
  for (const [id, reason] of routes) {
    const route = index.routes.get(id)
    if (!route) continue
    const item: ImpactItem = {
      kind: route.kind === 'page' ? 'page' : 'handler',
      id,
      label: route.path,
      reason,
      link: { to: 'page', routeId: id },
    }
    const area = areas.byRoute.get(id)
    if (area) item.areaId = area.id
    ;(route.kind === 'page' ? pages : handlers).push(item)
  }
  const flowItems: ImpactItem[] = []
  for (const [id, reason] of flows) {
    const flow = index.flows.get(id)
    if (!flow) continue
    const area = areaOfFlow.get(id) ?? (flow.routeId ? areas.byRoute.get(flow.routeId) : undefined)
    flowItems.push({
      kind: 'flow',
      id,
      label: flow.name,
      reason,
      ...(area ? { areaId: area.id } : {}),
      link: { to: 'flow', flowId: id },
    })
  }
  const requestItems: ImpactItem[] = []
  for (const [id, reason] of sites) {
    const site = index.requests.get(id)
    if (!site) continue
    const area = areaOfRequest.get(id)
    requestItems.push({
      kind: 'request',
      id,
      label: requestLabel(site),
      reason,
      ...(area ? { areaId: area.id } : {}),
      link: { to: 'requests', siteId: id },
    })
  }
  const componentItems: ImpactItem[] = []
  for (const [id, reason] of components) {
    const c = index.components.get(id)
    if (c)
      componentItems.push({
        kind: 'component',
        id,
        label: c.name,
        reason,
        link: { to: 'component', componentId: id },
      })
  }
  const typeItems: ImpactItem[] = []
  for (const [id, reason] of types) {
    const t = index.types.get(id)
    if (t) typeItems.push({ kind: 'type', id, label: t.name, reason, link: { to: 'type', typeId: id } })
  }
  for (const list of [pages, handlers, flowItems, requestItems, componentItems, typeItems]) {
    list.sort((a, b) => compareText(a.label, b.label) || compareText(a.id, b.id))
  }

  const groups: ImpactGroup[] = []
  const grouped = [...pages, ...flowItems, ...requestItems]
  for (const area of areas.areas) {
    const items = grouped.filter((i) => i.areaId === area.id)
    if (items.length > 0) groups.push({ areaId: area.id, name: area.name, items })
  }
  const rest = [...handlers, ...grouped.filter((i) => !i.areaId)]
  if (rest.length > 0) groups.push({ name: 'Outside the areas', items: rest })

  return {
    files,
    pages,
    handlers,
    flows: flowItems,
    requests: requestItems,
    components: componentItems,
    types: typeItems,
    groups,
  }
}

/** True when the impact touches nothing. */
export function isEmptyImpact(impact: Impact): boolean {
  return (
    impact.pages.length +
      impact.handlers.length +
      impact.flows.length +
      impact.requests.length +
      impact.components.length +
      impact.types.length ===
    0
  )
}

/**
 * What starts in a file (or in some of its lines). `from` names the file in the reasons; for a file
 * reached through the import graph it says which import led there.
 */
function seedFile(index: ModelIndex, file: string, lines?: ImpactTarget['lines'], from: string = file): Seed {
  const { model } = index
  const of = entitiesByFile(index).get(file) ?? NO_ENTITIES
  const inFile = (loc: SourceLoc | undefined) =>
    !!loc && loc.file === file && (!lines || (loc.line >= lines.from && loc.line <= lines.to))
  const at = (loc: SourceLoc) => (from === file ? `${file}:${loc.line}` : from)
  const seed: Seed = {
    components: new Map(),
    types: new Map(),
    sites: new Map(),
    navigations: new Map(),
    links: new Map(),
    routes: new Map(),
  }

  for (const c of of.components) if (inFile(c.loc)) seed.components.set(c.id, `defined in ${at(c.loc)}`)
  for (const t of of.types) if (inFile(t.definedAt)) seed.types.set(t.id, `defined in ${at(t.definedAt)}`)
  for (const site of of.sites) {
    const frame = site.callStack.find(inFile)
    if (frame) seed.sites.set(site.id, frameReason(site, frame, at(frame)))
  }
  for (const nav of of.navigations) {
    const loc = inFile(nav.loc) ? nav.loc : nav.callStack.find(inFile)
    if (loc) seed.navigations.set(nav.id, `navigates in ${at(loc)}`)
  }
  for (const link of of.links) {
    const loc = inFile(link.loc) ? link.loc : link.callStack.find(inFile)
    if (loc) seed.links.set(link.id, `${link.method} in ${at(loc)}`)
  }
  // Server-side definitions that requests are tied to: tRPC procedures, GraphQL documents, streams.
  for (const p of of.procedures) {
    if (!inFile(p.loc)) continue
    for (const id of p.siteIds) setOnce(seed.sites, id, `calls procedure ${p.path}, defined in ${at(p.loc)}`)
  }
  for (const op of of.operations) {
    if (!inFile(op.loc)) continue
    for (const id of op.siteIds)
      setOnce(seed.sites, id, `sends ${op.name || 'an operation'}, written in ${at(op.loc)}`)
  }
  for (const fragment of of.fragments) {
    if (!inFile(fragment.loc)) continue
    for (const id of fragment.componentIds) setOnce(seed.components, id, `reads fragment ${fragment.name}`)
  }
  for (const stream of of.streams) {
    if (!inFile(stream.loc)) continue
    for (const id of stream.siteIds) setOnce(seed.sites, id, `opens the stream in ${at(stream.loc)}`)
  }

  // The rest is about whole files, so it doesn't apply to a line range.
  if (lines) return seed
  for (const route of of.routes) {
    if (route.file === file)
      seed.routes.set(route.id, route.kind === 'page' ? `its page file changed` : `its file changed`)
    const layout = route.layoutChain.find((l) => l.file === file)
    if (layout && route.kind === 'page') setOnce(seed.routes, route.id, `inside ${from}`)
  }
  // `loading`, `error`, `not-found`... apply to every page below their folder.
  const special = specialFileDir(model.routeTree, file)
  if (special) {
    for (const route of model.routes) {
      if (route.kind === 'page' && (route.file.startsWith(`${special}/`) || special === ''))
        setOnce(seed.routes, route.id, `uses ${from}`)
    }
  }
  if (model.middleware?.file === file) {
    for (const r of model.middleware.routes) {
      if (index.routes.get(r.routeId)?.kind === 'page')
        setOnce(seed.routes, r.routeId, `the middleware runs on it`)
    }
  }
  return seed
}

/** Each file's entities, so a file is matched without going through the whole model. */
interface FileEntities {
  components: Component[]
  types: NamedType[]
  sites: RequestSite[]
  navigations: Navigation[]
  links: QueryLink[]
  procedures: TrpcProcedure[]
  operations: GraphqlOperation[]
  fragments: GraphqlFragment[]
  streams: SseEndpoint[]
  /** Routes whose page or handler file, or one of whose layouts, is the file. */
  routes: Route[]
}

function emptyEntities(): FileEntities {
  return {
    components: [],
    types: [],
    sites: [],
    navigations: [],
    links: [],
    procedures: [],
    operations: [],
    fragments: [],
    streams: [],
    routes: [],
  }
}

const NO_ENTITIES = emptyEntities()

const byFileCache = new WeakMap<ModelIndex, Map<string, FileEntities>>()

function entitiesByFile(index: ModelIndex): Map<string, FileEntities> {
  const cached = byFileCache.get(index)
  if (cached) return cached
  const out = new Map<string, FileEntities>()
  const add = <K extends keyof FileEntities>(file: string, key: K, value: FileEntities[K][number]) => {
    let entry = out.get(file)
    if (!entry) {
      entry = emptyEntities()
      out.set(file, entry)
    }
    const list = entry[key] as FileEntities[K][number][]
    if (!list.includes(value)) list.push(value)
  }
  const { model } = index
  for (const c of model.components) add(c.loc.file, 'components', c)
  for (const t of model.types) add(t.definedAt.file, 'types', t)
  for (const site of model.requests) for (const f of site.callStack) add(f.file, 'sites', site)
  for (const nav of model.navigations)
    for (const l of [nav.loc, ...nav.callStack]) add(l.file, 'navigations', nav)
  for (const link of model.queryLinks)
    for (const l of [link.loc, ...link.callStack]) add(l.file, 'links', link)
  for (const p of model.trpc?.procedures ?? []) add(p.loc.file, 'procedures', p)
  for (const op of model.graphql?.operations ?? []) add(op.loc.file, 'operations', op)
  for (const fragment of model.graphql?.fragments ?? []) add(fragment.loc.file, 'fragments', fragment)
  for (const stream of model.streams ?? []) add(stream.loc.file, 'streams', stream)
  for (const route of model.routes) {
    add(route.file, 'routes', route)
    for (const l of route.layoutChain) add(l.file, 'routes', route)
  }
  byFileCache.set(index, out)
  return out
}

function frameReason(site: RequestSite, frame: CallFrame, where: string): string {
  return site.callStack[0] === frame ? `sent from ${where}` : `sent through ${where}`
}

/** The folder of a special file (`loading.tsx`, `error.tsx`...) other than pages and route handlers. */
function specialFileDir(node: RouteTreeNode, file: string): string | undefined {
  for (const [kind, f] of Object.entries(node.files)) {
    if (f === file && kind !== 'page' && kind !== 'route') return node.dir
  }
  for (const child of node.children) {
    const found = specialFileDir(child, file)
    if (found !== undefined) return found
  }
  return undefined
}

function flowReason(
  flow: Flow,
  index: ModelIndex,
  hit: {
    components: Map<string, string>
    sites: Map<string, string>
    navigations: Map<string, string>
    links: Map<string, string>
  },
): string | undefined {
  const steps: FlowStep[] = [...flow.steps, ...flow.branches.flatMap((b) => b.steps)]
  for (const step of steps) {
    if (step.kind === 'request' && hit.sites.has(step.siteId)) {
      const site = index.requests.get(step.siteId)
      return `sends ${site ? requestLabel(site) : step.siteId}`
    }
    if (step.kind === 'interaction' && hit.components.has(step.componentId))
      return `starts in ${index.components.get(step.componentId)?.name ?? step.componentId}`
    if (step.kind === 'navigate' && hit.navigations.has(step.navigationId)) {
      const nav = index.navigations.get(step.navigationId)
      return `goes to ${nav?.href.text ?? step.navigationId}`
    }
    if (step.kind === 'query-update' && hit.links.has(step.linkId))
      return `updates the cache with ${index.queryLinks.get(step.linkId)?.method ?? step.linkId}`
  }
  if (hit.components.has(flow.componentId))
    return `starts in ${index.components.get(flow.componentId)?.name ?? flow.componentId}`
  return undefined
}

function factsOf(seed: Seed): string[] {
  const out: string[] = []
  const count = (n: number, word: string) => {
    if (n > 0) out.push(`${n} ${word}${n === 1 ? '' : 's'}`)
  }
  count(seed.components.size, 'component')
  count(seed.types.size, 'type')
  count(seed.sites.size, 'request')
  count(seed.navigations.size, 'navigation')
  count(seed.links.size, 'cache update')
  if (
    seed.components.size + seed.types.size + seed.sites.size + seed.navigations.size + seed.links.size ===
    0
  )
    count(seed.routes.size, 'route')
  return out
}

function isEmpty(seed: Seed): boolean {
  return (
    seed.components.size +
      seed.types.size +
      seed.sites.size +
      seed.navigations.size +
      seed.links.size +
      seed.routes.size ===
    0
  )
}

function reverseImports(imports: Record<string, string[]>): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [file, targets] of Object.entries(imports)) for (const t of targets) push(out, t, file)
  for (const list of out.values()) list.sort(compareText)
  return out
}

// --- Plain text -------------------------------------------------------------------------------

const KIND_WORDS: Record<ImpactKind, string> = {
  page: 'page',
  handler: 'route handler',
  flow: 'flow',
  request: 'request',
  component: 'component',
  type: 'type',
}

/** One line: `3 pages, 1 flow and 4 requests`. */
export function impactCounts(impact: Impact): string {
  const parts = [
    [impact.pages.length, 'page'],
    [impact.handlers.length, 'route handler'],
    [impact.flows.length, 'flow'],
    [impact.requests.length, 'request'],
  ] as const
  const shown = parts.filter(([n]) => n > 0).map(([n, word]) => `${n} ${word}${n === 1 ? '' : 's'}`)
  if (shown.length === 0) return 'no pages, flows or requests'
  return shown.length === 1 ? (shown[0] as string) : `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`
}

/** What a file is to the scan, in a few words. */
export function fileFacts(file: ImpactFile): string {
  if (file.found === 'code')
    return `${file.facts.join(', ')}${file.wholeFile ? ' (whole file: nothing starts on that line)' : ''}`
  if (file.found === 'imported') return `nothing of its own; imported by ${file.via.join(', ')}`
  return 'not in the scan (not imported from the app, excluded, or not a source file)'
}

/** `flow-checker impact` and `scan --diff`: the impact as plain text. */
export function formatImpact(impact: Impact): string {
  const out: string[] = []
  const width = Math.min(40, Math.max(...impact.files.map((f) => f.file.length)))
  out.push(impact.files.length === 1 ? 'Changed file' : `Changed files (${impact.files.length})`)
  for (const file of impact.files) out.push(`  ${file.file.padEnd(width)}  ${fileFacts(file)}`)
  out.push('', `Affects ${impactCounts(impact)}.`)
  for (const group of impact.groups) {
    out.push('', group.areaId ? `Area ${group.name}` : group.name)
    const labelWidth = Math.min(40, Math.max(...group.items.map((i) => i.label.length)))
    for (const item of group.items) {
      out.push(`  ${KIND_WORDS[item.kind].padEnd(13)}  ${item.label.padEnd(labelWidth)}  ${item.reason}`)
    }
  }
  const also = [
    impact.components.length > 0
      ? `${impact.components.length} component${impact.components.length === 1 ? '' : 's'}`
      : '',
    impact.types.length > 0 ? `${impact.types.length} type${impact.types.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean)
  if (also.length > 0) {
    out.push('', `Also touched: ${also.join(' and ')}`)
    for (const item of [...impact.components, ...impact.types])
      out.push(`  ${KIND_WORDS[item.kind].padEnd(13)}  ${item.label}  ${item.reason}`)
  }
  return `${out.join('\n')}\n`
}

// --- Helpers ----------------------------------------------------------------------------------

function setOnce(map: Map<string, string>, id: string, reason: string): boolean {
  if (map.has(id)) return false
  map.set(id, reason)
  return true
}

function mergeInto(target: Map<string, string>, from: Map<string, string>) {
  for (const [id, reason] of from) setOnce(target, id, reason)
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
