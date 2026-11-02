// Areas (M30): the app's pages, components, requests and flows grouped by feature. Derived from the
// model (only the `areas` config is stored), so the dashboard, the exporter and the CLI share one
// implementation.
//
// A page's area is the first static segment of its URL, after route groups, dynamic segments and
// locale prefixes (`/[locale]/billing/invoices` → `billing`); pages at the root are `home`. When that
// gives a single area, the pages are grouped by the feature folder that holds most of their
// components instead (`src/features/<x>`, `src/modules/<x>`, whatever the project calls it).
import { buildEndpoints, type EndpointList, requestCallers } from './endpoints'
import { makeId } from './ids'
import type { Route } from './model'
import type { ModelIndex, ScanNote } from './model-index'

export const HOME_AREA = 'home'

/** `route`: by URL segment. `folder`: by the feature folder of the pages' components. */
export type AreaSource = 'route' | 'folder'

export interface Area {
  /** Stable id (`ar_…`) from `key`, used in links. */
  id: string
  /** What the pages were grouped by (`billing`), or the merge target from the config. */
  key: string
  /** `key`, or its name from the config's `rename`. */
  name: string
  /** URL prefixes (`/billing`) or folders (`src/features/billing`) its pages come from. */
  from: string[]
  /** Pages, by path. */
  routeIds: string[]
  /** Components only (or mostly) this area's pages use. */
  componentIds: string[]
  /** Components shared by most areas that its pages use. */
  sharedComponentIds: string[]
  /** Requests its components send (directly or through a route handler or server action they call). */
  requestIds: string[]
  /** Flows that start on its pages. */
  flowIds: string[]
  /** Endpoints its requests call (M29 keys). */
  endpointKeys: string[]
  /** Open scan notes on its pages, components and requests. */
  notes: ScanNote[]
}

export interface AreaList {
  by: AreaSource
  /** `home` first, then by name. */
  areas: Area[]
  byId: Map<string, Area>
  /** Page route id → its area. Every page has one. */
  byRoute: Map<string, Area>
  /** Component id → the areas whose pages use it (shared components: every such area). */
  byComponent: Map<string, Area[]>
  /** Components used by more than half of the areas. */
  sharedComponentIds: string[]
  /** Requests only shared components send. */
  sharedRequestIds: string[]
  /** Area names in the config's `rename` / `merge` that match no area. */
  unknownConfig: string[]
}

/** Builds the areas. `endpoints` can be passed when the caller has built them already. */
export function buildAreas(index: ModelIndex, endpoints: EndpointList = buildEndpoints(index)): AreaList {
  const { model } = index
  const config = model.areas ?? {}
  const pages = model.routes.filter((r) => r.kind === 'page')
  const locales = new Set(model.middleware?.i18n?.locales ?? [])

  // 1. Group key per page: by route segment, else by feature folder.
  const routeKeys = new Map(pages.map((r) => [r.id, routeKey(r, locales)]))
  let by: AreaSource = 'route'
  let keys = routeKeys
  let from = new Map(pages.map((r) => [r.id, routeFrom(r, locales)]))
  if (new Set(routeKeys.values()).size <= 1) {
    const folders = folderKeys(pages, index)
    if (folders && new Set(folders.keys.values()).size > 1) {
      by = 'folder'
      keys = folders.keys
      from = folders.from
    }
  }

  // 2. The config: merge first, then rename the merged areas.
  const unknownConfig: string[] = []
  const found = new Set(keys.values())
  const mergedInto = new Map<string, string>()
  for (const [target, sources] of Object.entries(config.merge ?? {})) {
    for (const source of sources) {
      if (!found.has(source)) unknownConfig.push(source)
      else mergedInto.set(source, target)
    }
  }
  const finalKey = (key: string) => mergedInto.get(key) ?? key
  const finalKeys = new Set([...found].map(finalKey))
  for (const key of Object.keys(config.rename ?? {})) if (!finalKeys.has(key)) unknownConfig.push(key)

  const drafts = new Map<string, Area>()
  const byRoute = new Map<string, Area>()
  for (const route of pages) {
    const key = finalKey(keys.get(route.id) ?? HOME_AREA)
    let area = drafts.get(key)
    if (!area) {
      area = {
        id: makeId('ar', key),
        key,
        name: config.rename?.[key] ?? key,
        from: [],
        routeIds: [],
        componentIds: [],
        sharedComponentIds: [],
        requestIds: [],
        flowIds: [],
        endpointKeys: [],
        notes: [],
      }
      drafts.set(key, area)
    }
    area.routeIds.push(route.id)
    const origin = from.get(route.id)
    if (origin) addOnce(area.from, origin)
    byRoute.set(route.id, area)
  }
  const areas = [...drafts.values()].sort(compareAreas)
  for (const area of areas) {
    area.routeIds.sort((a, b) => compareText(index.routes.get(a)?.path ?? a, index.routes.get(b)?.path ?? b))
    area.from.sort(compareText)
  }

  // 3. Components: in every area whose pages (or their layouts) render them.
  const byComponent = new Map<string, Area[]>()
  const sharedComponentIds: string[] = []
  const shared = new Set<string>()
  for (const component of model.components) {
    const list: Area[] = []
    for (const routeId of index.routesOf.get(component.id) ?? []) {
      const area = byRoute.get(routeId)
      if (area && !list.includes(area)) list.push(area)
    }
    if (list.length === 0) continue
    list.sort(compareAreas)
    byComponent.set(component.id, list)
    if (areas.length > 1 && list.length * 2 > areas.length) {
      shared.add(component.id)
      sharedComponentIds.push(component.id)
      for (const area of list) area.sharedComponentIds.push(component.id)
    } else for (const area of list) area.componentIds.push(component.id)
  }

  // 4. Requests follow the components behind them; requests only shared components send are shared too.
  const sharedRequestIds: string[] = []
  const requestAreas = new Map<string, Area[]>()
  for (const site of model.requests) {
    const callers = requestCallers(site, index).componentIds
    const list: Area[] = []
    for (const id of callers) {
      if (shared.has(id)) continue
      for (const area of byComponent.get(id) ?? []) if (!list.includes(area)) list.push(area)
    }
    if (list.length > 0) {
      requestAreas.set(site.id, list)
      for (const area of list) {
        area.requestIds.push(site.id)
        for (const ep of endpoints.bySite.get(site.id) ?? []) addOnce(area.endpointKeys, ep.key)
      }
    } else if (callers.length > 0) sharedRequestIds.push(site.id)
  }

  // 5. Flows: the area of the page they start on, else of their component.
  for (const flow of model.flows) {
    const area =
      (flow.routeId ? byRoute.get(flow.routeId) : undefined) ??
      (shared.has(flow.componentId) ? undefined : byComponent.get(flow.componentId)?.[0])
    area?.flowIds.push(flow.id)
  }

  // 6. Open notes on what the area owns.
  for (const note of index.notes) {
    const list = note.requestId
      ? requestAreas.get(note.requestId)
      : note.componentId
        ? shared.has(note.componentId)
          ? undefined
          : byComponent.get(note.componentId)
        : note.routeId
          ? [byRoute.get(note.routeId)].filter((a): a is Area => !!a)
          : undefined
    for (const area of list ?? []) area.notes.push(note)
  }

  return {
    by,
    areas,
    byId: new Map(areas.map((a) => [a.id, a])),
    byRoute,
    byComponent,
    sharedComponentIds,
    sharedRequestIds,
    unknownConfig,
  }
}

/** Static URL parts of a page, without route groups, slots, dynamic segments and locale prefixes. */
function staticParts(route: Pick<Route, 'path'>, locales: Set<string>): string[] {
  return route.path.split('/').filter((part) => part && !part.startsWith('[') && !locales.has(part))
}

/** `/[locale]/billing/invoices` → `billing`; root pages → `home`. */
export function routeKey(route: Pick<Route, 'path'>, locales: Set<string> = new Set()): string {
  return staticParts(route, locales)[0] ?? HOME_AREA
}

/** The URL prefix the key comes from, as written: `/[locale]/billing`. */
function routeFrom(route: Pick<Route, 'path'>, locales: Set<string>): string {
  const key = staticParts(route, locales)[0]
  if (!key) return '/'
  const parts = route.path.split('/').filter(Boolean)
  return `/${parts.slice(0, parts.indexOf(key) + 1).join('/')}`
}

/**
 * Pages grouped by feature folder. Each page's home folder is the deepest folder that holds more than
 * half of its components (outside the app directory, and leaving out components most pages use).
 * The base is the folder whose sub-folders split those homes the most (`src/features`); a page's key
 * is its sub-folder there. Pages without one keep their route key.
 */
function folderKeys(
  pages: Route[],
  index: ModelIndex,
): { keys: Map<string, string>; from: Map<string, string> } | undefined {
  const appDir = `${index.model.project.appDir.replace(/\/+$/, '')}/`
  const pageCount = new Map<string, number>()
  for (const route of pages) {
    for (const id of index.pageTree.get(route.id) ?? []) pageCount.set(id, (pageCount.get(id) ?? 0) + 1)
  }
  const common = (id: string) => pages.length > 2 && (pageCount.get(id) ?? 0) * 2 > pages.length

  const homes = new Map<string, string[]>()
  for (const route of pages) {
    const files: string[] = []
    for (const id of index.pageTree.get(route.id) ?? []) {
      const file = index.components.get(id)?.file
      if (file && !file.startsWith(appDir) && !common(id)) files.push(file)
    }
    if (files.length === 0) continue
    const counts = new Map<string, number>()
    for (const file of files) {
      const dirs = file.split('/').slice(0, -1)
      for (let i = 1; i <= dirs.length; i++) {
        const dir = dirs.slice(0, i).join('/')
        counts.set(dir, (counts.get(dir) ?? 0) + 1)
      }
    }
    let home: string[] | undefined
    for (const [dir, n] of counts) {
      const parts = dir.split('/')
      if (n * 2 > files.length && (!home || parts.length > home.length)) home = parts
    }
    if (home) homes.set(route.id, home)
  }
  if (homes.size < 2) return undefined

  // The base folder: the one with the most distinct sub-folders among the homes below it.
  const children = new Map<string, Set<string>>()
  for (const home of homes.values()) {
    for (let i = 0; i < home.length; i++) {
      const base = home.slice(0, i).join('/')
      const set = children.get(base) ?? new Set<string>()
      set.add(home[i] as string)
      children.set(base, set)
    }
  }
  let base: string | undefined
  let best = 1
  for (const [dir, set] of children) {
    const depth = dir ? dir.split('/').length : 0
    const bestDepth = base ? base.split('/').length : 0
    if (set.size > best || (set.size === best && base !== undefined && depth > bestDepth)) {
      base = dir
      best = set.size
    }
  }
  if (base === undefined) return undefined

  const baseParts = base ? base.split('/') : []
  const keys = new Map<string, string>()
  const from = new Map<string, string>()
  for (const route of pages) {
    const home = homes.get(route.id)
    const under = home && home.length > baseParts.length && baseParts.every((p, i) => home[i] === p)
    const key = under ? home[baseParts.length] : undefined
    if (home && key) {
      keys.set(route.id, key)
      from.set(route.id, home.slice(0, baseParts.length + 1).join('/'))
    } else {
      keys.set(route.id, routeKey(route))
      from.set(route.id, routeFrom(route, new Set()))
    }
  }
  return { keys, from }
}

function compareAreas(a: Area, b: Area): number {
  const home = Number(b.key === HOME_AREA) - Number(a.key === HOME_AREA)
  return home || compareText(a.name.toLowerCase(), b.name.toLowerCase()) || compareText(a.key, b.key)
}

/** Locale-free, so the order is the same on every machine (exports are golden-tested). */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function addOnce<T>(list: T[], value: T) {
  if (!list.includes(value)) list.push(value)
}
