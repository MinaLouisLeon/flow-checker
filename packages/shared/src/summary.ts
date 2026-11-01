// Start here (M32): a one-screen summary of the app for someone who just cloned it. Derived from the
// model (nothing is stored), so the dashboard's first screen, `flow-checker summary` and the export's
// `ONBOARDING.md` show the same items. Each item says where it leads (`SummaryLink`); each view turns
// that into its own link.
import { type AreaList, buildAreas } from './areas'
import { buildEndpoints, type EndpointList } from './endpoints'
import type { FlowsSummary } from './flow-runs'
import type { Component, Flow, RequestSite, Route } from './model'
import type { ModelIndex, NoteKind, ScanNote } from './model-index'

/** Where an item leads, as a dashboard screen. The Markdown export maps it to a file. */
export type SummaryLink =
  | { to: 'overview' }
  | { to: 'map'; view?: 'graph' | 'handlers' }
  | { to: 'page'; routeId: string }
  /** `middleware.ts` / `proxy.ts`: shown on the pages it runs on (`routeId`, the first one). */
  | { to: 'middleware'; routeId?: string }
  | { to: 'areas' }
  | { to: 'area'; areaId: string }
  | { to: 'flows' }
  | { to: 'flow'; flowId: string }
  | { to: 'endpoints'; host?: string }
  | { to: 'components'; kind?: Component['kind'] }
  | { to: 'component'; componentId: string }
  | { to: 'requests'; siteId?: string; transport?: RequestSite['transport']; q?: string }
  | { to: 'types' }
  | { to: 'type'; typeId: string }

export interface SummaryItem {
  /** What the item is: `Next.js`, `Root layout`, an area or flow name. */
  label: string
  /** The main fact: a version, a file, a path. */
  value: string
  /** `value` is code (a path, a file, a URL pattern). */
  code?: boolean
  /** A short extra: `3 pages`, `nothing links here`. */
  detail?: string
  link: SummaryLink
}

export const SUMMARY_SECTIONS = ['stack', 'areas', 'entry', 'flows', 'backends', 'places', 'check'] as const
export type SummarySectionId = (typeof SUMMARY_SECTIONS)[number]

export interface SummarySection {
  id: SummarySectionId
  title: string
  /** A short line under the title: `201 areas by URL, the 6 largest shown`. */
  note?: string
  items: SummaryItem[]
  /** Items left out to keep the summary short. */
  more: number
  /** The full list. */
  link: SummaryLink
  /** Shown when there are no items. */
  empty: string
}

export interface Summary {
  /** Next.js version, when known. */
  nextVersion?: string
  appDir: string
  sections: SummarySection[]
}

export interface SummaryOptions {
  /** Runtime flow states (captures), to show which flows were confirmed. */
  flows?: FlowsSummary
  endpoints?: EndpointList
  areas?: AreaList
}

/** Sections are capped so `flow-checker summary` stays under a screen on large apps. */
export const SUMMARY_LIMITS = { areas: 6, entry: 5, flows: 5, backends: 5, places: 6, check: 3 }

export function buildSummary(index: ModelIndex, options: SummaryOptions = {}): Summary {
  const endpoints = options.endpoints ?? buildEndpoints(index)
  const areas = options.areas ?? buildAreas(index, endpoints)
  return {
    nextVersion: index.model.project.nextVersion,
    appDir: index.model.project.appDir,
    sections: [
      stackSection(index),
      areasSection(areas),
      entrySection(index),
      flowsSection(index, options.flows),
      backendsSection(endpoints),
      placesSection(index),
      checkSection(index),
    ],
  }
}

// --- Stack ------------------------------------------------------------------------------------

/** Data libraries, in the order they are listed. `match` picks the sites each one sends. */
const DATA_LIBRARIES: {
  name: string
  match: (site: RequestSite) => boolean
  link: (sites: RequestSite[]) => SummaryLink
}[] = [
  {
    name: 'React Query',
    match: (s) => /react-query/.test(s.hook?.module ?? ''),
    link: (sites) => ({ to: 'requests', q: sites[0]?.hook?.module }),
  },
  {
    name: 'SWR',
    match: (s) => /^swr(\/|$)/.test(s.hook?.module ?? ''),
    link: (sites) => ({ to: 'requests', q: sites[0]?.hook?.module }),
  },
  { name: 'tRPC', match: (s) => s.transport === 'trpc', link: () => transport('trpc') },
  { name: 'GraphQL', match: (s) => s.transport === 'graphql', link: () => transport('graphql') },
  { name: 'axios', match: (s) => s.transport === 'axios', link: () => transport('axios') },
  { name: 'fetch', match: (s) => s.transport === 'fetch', link: () => transport('fetch') },
  {
    name: 'Server actions',
    match: (s) => s.transport === 'server-action',
    link: () => transport('server-action'),
  },
  { name: 'Event streams (SSE)', match: (s) => s.transport === 'sse', link: () => transport('sse') },
  {
    name: 'socket.io',
    match: (s) => s.transport === 'websocket' && s.socket?.api === 'socket.io',
    link: () => ({ to: 'requests', transport: 'websocket', q: 'socket.io' }),
  },
  {
    name: 'WebSocket',
    match: (s) => s.transport === 'websocket' && s.socket?.api !== 'socket.io',
    link: () => transport('websocket'),
  },
]

function transport(t: RequestSite['transport']): SummaryLink {
  return { to: 'requests', transport: t }
}

function stackSection(index: ModelIndex): SummarySection {
  const { model } = index
  const items: SummaryItem[] = []
  const pages = model.routes.filter((r) => r.kind === 'page').length
  const handlers = model.routes.length - pages
  items.push({
    label: 'Next.js',
    value: model.project.nextVersion ?? 'version not known',
    detail: `App Router in ${model.project.appDir}/, ${plural(pages, 'page')}, ${plural(handlers, 'route handler')}`,
    link: { to: 'map' },
  })
  const byKind = (kind: Component['kind']) => model.components.filter((c) => c.kind === kind).length
  if (model.components.length > 0) {
    items.push({
      label: 'Rendering',
      value: `${byKind('server')} server, ${byKind('client')} client, ${byKind('shared')} shared`,
      detail: plural(model.components.length, 'component'),
      link: { to: 'components' },
    })
  }

  for (const lib of DATA_LIBRARIES) {
    const sites = model.requests.filter(lib.match)
    if (sites.length === 0) continue
    let value = lib.name
    if (lib.name === 'GraphQL') {
      const libraries = [...new Set((model.graphql?.clients ?? []).map((c) => c.library))]
      if (libraries.length > 0) value = `GraphQL (${libraries.join(', ')})`
    }
    items.push({ label: 'Data', value, detail: plural(sites.length, 'request'), link: lib.link(sites) })
  }
  // API clients from the config, one per module.
  const clients = new Map<string, RequestSite[]>()
  for (const site of model.requests) {
    if (site.transport !== 'api-client' || !site.client) continue
    const list = clients.get(site.client.module) ?? []
    list.push(site)
    clients.set(site.client.module, list)
  }
  for (const [module, sites] of clients) {
    items.push({
      label: 'API client',
      value: module,
      code: true,
      detail: plural(sites.length, 'request'),
      link: { to: 'requests', transport: 'api-client', q: module },
    })
  }

  const fromIntl = (module: string | undefined) =>
    module === 'next-intl' || !!module?.startsWith('next-intl/')
  const intl =
    !!model.middleware?.i18n ||
    model.navigations.some((n) => n.api === 'next-intl') ||
    model.components.some((c) => c.children.some((ref) => fromIntl(ref.factory) || fromIntl(ref.module)))
  if (intl) {
    const locales = model.middleware?.i18n?.locales ?? []
    items.push({
      label: 'i18n',
      value: 'next-intl',
      detail: locales.length > 0 ? `locales ${locales.join(', ')}` : undefined,
      link: { to: 'map' },
    })
  }

  const mw = model.middleware
  if (mw) {
    const firstPage = mw.routes.find((r) => index.routes.get(r.routeId)?.kind === 'page')
    items.push({
      label: mw.convention === 'proxy' ? 'Proxy' : 'Middleware',
      value: mw.file,
      code: true,
      detail: `runs on ${plural(mw.routes.length, 'route')}${mw.factory ? `, made by ${mw.factory.module}` : ''}`,
      link: { to: 'middleware', routeId: firstPage?.routeId },
    })
  }

  if (model.postman) {
    items.push({
      label: 'Postman',
      value: model.postman.collection.name,
      detail: `contract with ${plural(model.postman.requests.length, 'request')}`,
      link: { to: 'overview' },
    })
  }

  return {
    id: 'stack',
    title: 'Stack',
    items,
    more: 0,
    link: { to: 'overview' },
    empty: 'Nothing found.',
  }
}

// --- Areas ------------------------------------------------------------------------------------

function areasSection(list: AreaList): SummarySection {
  // The largest areas first; ties keep the list's order (home, then by name).
  const sorted = list.areas
    .map((area, i) => ({ area, i }))
    .sort((a, b) => b.area.routeIds.length - a.area.routeIds.length || a.i - b.i)
    .map((x) => x.area)
  const shown = sorted.slice(0, SUMMARY_LIMITS.areas)
  const by = list.by === 'folder' ? 'by feature folder' : 'by URL'
  const total = list.areas.length
  return {
    id: 'areas',
    title: 'Areas',
    note:
      total === 0
        ? undefined
        : total > shown.length
          ? `${plural(total, 'area')} ${by}, the ${shown.length} largest shown`
          : `${plural(total, 'area')} ${by}`,
    items: shown.map((area) => ({
      label: area.name,
      value: area.from.join(', ') || area.key,
      code: true,
      detail: [
        plural(area.routeIds.length, 'page'),
        area.flowIds.length > 0 ? plural(area.flowIds.length, 'flow') : '',
        area.endpointKeys.length > 0 ? plural(area.endpointKeys.length, 'endpoint') : '',
      ]
        .filter(Boolean)
        .join(', '),
      link: { to: 'area', areaId: area.id },
    })),
    more: total - shown.length,
    link: { to: 'areas' },
    empty: 'No pages.',
  }
}

// --- Entry pages ------------------------------------------------------------------------------

function entrySection(index: ModelIndex): SummarySection {
  const pages = index.model.routes.filter((r) => r.kind === 'page')
  const locales = new Set(index.model.middleware?.i18n?.locales ?? [])
  // Pages a user can open by URL: not a slot or an intercepted view of another page.
  const candidates = pages.filter((r) => !r.slot && !r.intercepting)

  // Distinct pages that link or redirect to each page.
  const inbound = new Map<string, Set<string>>()
  for (const edge of index.navEdges) {
    if (edge.source === edge.target) continue
    const set = inbound.get(edge.target) ?? new Set<string>()
    set.add(edge.source)
    inbound.set(edge.target, set)
  }
  const linksTo = (id: string) => inbound.get(id)?.size ?? 0

  const root = rootPage(candidates, locales)
  const items: SummaryItem[] = []
  if (root) {
    items.push({
      label: 'Start page',
      value: root.path,
      code: true,
      detail: linksTo(root.id) > 0 ? linkedFrom(linksTo(root.id)) : undefined,
      link: { to: 'page', routeId: root.id },
    })
  }
  const rest = candidates.filter((r) => r !== root)
  const mostLinked = rest
    .filter((r) => linksTo(r.id) > 1)
    .sort((a, b) => linksTo(b.id) - linksTo(a.id) || compareText(a.path, b.path))
    .slice(0, 2)
  for (const route of mostLinked) {
    items.push({
      label: 'Most linked',
      value: route.path,
      code: true,
      detail: linkedFrom(linksTo(route.id)),
      link: { to: 'page', routeId: route.id },
    })
  }
  // Pages nothing links to: opened by URL, from outside the app, or not reached at all.
  const unlinked = rest.filter((r) => linksTo(r.id) === 0).sort((a, b) => compareText(a.path, b.path))
  const room = Math.max(0, SUMMARY_LIMITS.entry - items.length)
  for (const route of unlinked.slice(0, room)) {
    items.push({
      label: 'Not linked',
      value: route.path,
      code: true,
      detail: 'nothing in the app links here',
      link: { to: 'page', routeId: route.id },
    })
  }
  const hidden = Math.max(0, unlinked.length - room)
  return {
    id: 'entry',
    title: 'Entry pages',
    note:
      unlinked.length > 0
        ? `${plural(unlinked.length, 'page')} nothing links to${hidden > 0 ? `, ${unlinked.length - hidden} shown` : ''}`
        : undefined,
    items,
    more: hidden,
    link: { to: 'map' },
    empty: 'No pages.',
  }
}

/**
 * Pages a newcomer starts from (M35): the start page and the pages nothing in the app links or
 * redirects to. Slots and intercepted views aren't entry pages.
 */
export function entryPageIds(index: ModelIndex): Set<string> {
  const pages = index.model.routes.filter((r) => r.kind === 'page' && !r.slot && !r.intercepting)
  const locales = new Set(index.model.middleware?.i18n?.locales ?? [])
  const linked = new Set(index.navEdges.filter((e) => e.source !== e.target).map((e) => e.target))
  const out = new Set(pages.filter((r) => !linked.has(r.id)).map((r) => r.id))
  const root = rootPage(pages, locales)
  if (root) out.add(root.id)
  return out
}

function linkedFrom(n: number): string {
  return n === 1 ? '1 page links here' : `${n} pages link here`
}

/** `/`, else the shortest page with no static URL part (`/[locale]`). */
function rootPage(pages: Route[], locales: Set<string>): Route | undefined {
  const exact = pages.find((r) => r.path === '/')
  if (exact) return exact
  const homes = pages.filter((r) =>
    r.path
      .split('/')
      .filter(Boolean)
      .every((part) => part.startsWith('[') || locales.has(part)),
  )
  return homes.sort((a, b) => a.path.length - b.path.length || compareText(a.path, b.path))[0]
}

// --- Main flows -------------------------------------------------------------------------------

function flowsSection(index: ModelIndex, runs: FlowsSummary | undefined): SummarySection {
  const { flows } = index.model
  const confirmed = (f: Flow) => runs?.flows[f.id]?.status === 'confirmed'
  // Longest first (steps, then pages it passes through); confirmed before inferred on ties.
  const sorted = [...flows].sort(
    (a, b) =>
      b.steps.length - a.steps.length ||
      b.routeIds.length - a.routeIds.length ||
      Number(confirmed(b)) - Number(confirmed(a)) ||
      compareText(a.name, b.name),
  )
  const shown = sorted.slice(0, SUMMARY_LIMITS.flows)
  const confirmedCount = flows.filter(confirmed).length
  return {
    id: 'flows',
    title: 'Main flows',
    note:
      flows.length === 0
        ? undefined
        : `${plural(flows.length, 'flow')}${runs ? `, ${confirmedCount} confirmed` : ''}${
            flows.length > shown.length ? `, the ${shown.length} longest shown` : ''
          }`,
    items: shown.map((flow) => {
      const paths: string[] = []
      for (const id of flow.routeIds) {
        const path = index.routes.get(id)?.path
        if (path && paths[paths.length - 1] !== path) paths.push(path)
      }
      const status = runs?.flows[flow.id]?.status
      return {
        label: flow.name,
        value: paths.join(' → ') || '(no page)',
        code: paths.length > 0,
        detail: [plural(flow.steps.length, 'step'), status && status !== 'unconfirmed' ? status : '']
          .filter(Boolean)
          .join(', '),
        link: { to: 'flow', flowId: flow.id },
      }
    }),
    more: flows.length - shown.length,
    link: { to: 'flows' },
    empty: 'No flows found: no event handler leads to a request or another page.',
  }
}

// --- Backends ---------------------------------------------------------------------------------

function backendsSection(list: EndpointList): SummarySection {
  const shown = list.hosts.slice(0, SUMMARY_LIMITS.backends)
  return {
    id: 'backends',
    title: 'Backends',
    note: list.hosts.length > 0 ? plural(list.endpoints.length, 'endpoint') : undefined,
    items: shown.map((host) => {
      const browser = host.endpoints.filter((e) => e.browser).length
      return {
        label: host.kind === 'app' ? 'This app' : host.kind === 'unknown' ? 'Unknown' : 'External',
        value: host.label,
        code: host.kind === 'external',
        detail: `${plural(host.endpoints.length, 'endpoint')}${browser > 0 ? `, ${browser} called from the browser` : ''}`,
        link: { to: 'endpoints', host: host.key },
      }
    }),
    more: list.hosts.length - shown.length,
    link: { to: 'endpoints' },
    empty: 'The app sends no requests.',
  }
}

// --- Where things live ------------------------------------------------------------------------

function placesSection(index: ModelIndex): SummarySection {
  const { model } = index
  const items: SummaryItem[] = []
  const pages = model.routes.filter((r) => r.kind === 'page')

  // Root layout: the outermost layout wrapping the most pages.
  const layouts = new Map<string, { file: string; componentId?: string; pages: number; routeId: string }>()
  for (const route of pages) {
    const outer = route.layoutChain.find((l) => l.kind === 'layout')
    if (!outer) continue
    const entry = layouts.get(outer.file) ?? {
      file: outer.file,
      componentId: outer.componentId,
      pages: 0,
      routeId: route.id,
    }
    entry.pages++
    layouts.set(outer.file, entry)
  }
  const rootLayout = [...layouts.values()].sort((a, b) => b.pages - a.pages || compareText(a.file, b.file))[0]
  if (rootLayout) {
    items.push({
      label: 'Root layout',
      value: rootLayout.file,
      code: true,
      detail:
        layouts.size > 1
          ? `wraps ${plural(rootLayout.pages, 'page')}, ${layouts.size} root layouts`
          : undefined,
      link: rootLayout.componentId
        ? { to: 'component', componentId: rootLayout.componentId }
        : { to: 'page', routeId: rootLayout.routeId },
    })
  }

  // Files that send the most requests through a helper: the API client.
  const senders = new Map<string, number>()
  for (const site of model.requests) {
    if (site.callStack.length < 2) continue
    const file = site.callStack[site.callStack.length - 1]?.file
    if (file) senders.set(file, (senders.get(file) ?? 0) + 1)
  }
  const topSenders = [...senders]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]))
    .slice(0, 2)
  for (const [file, n] of topSenders) {
    items.push({
      label: 'Sends requests',
      value: file,
      code: true,
      detail: plural(n, 'request'),
      link: { to: 'requests', q: file },
    })
  }

  // Route handlers: the folder most of them are in.
  const handlers = model.routes.filter((r) => r.kind === 'route-handler')
  if (handlers.length > 0) {
    items.push({
      label: 'Route handlers',
      value: commonFolder(handlers.map((r) => r.file)),
      code: true,
      detail: plural(handlers.length, 'handler'),
      link: { to: 'map', view: 'handlers' },
    })
  }

  // The most-used types.
  const uses = (id: string) => {
    const u = index.typeUsage.get(id)
    return u ? u.props.length + u.usedBy.length + u.requests.length + u.inTypes.length : 0
  }
  const topTypes = model.types
    // Generic instances (`Exact<{ id: string }>`) are helpers, not the app's own types.
    .filter((t) => uses(t.id) >= 2 && !t.name.includes('<'))
    .sort((a, b) => uses(b.id) - uses(a.id) || compareText(a.name, b.name))
    .slice(0, 2)
  for (const type of topTypes) {
    items.push({
      label: 'Type',
      value: type.name,
      code: true,
      detail: `${type.definedAt.file}, used ${uses(type.id)} times`,
      link: { to: 'type', typeId: type.id },
    })
  }

  return {
    id: 'places',
    title: 'Where things live',
    items: items.slice(0, SUMMARY_LIMITS.places),
    more: Math.max(0, items.length - SUMMARY_LIMITS.places),
    link: { to: 'components' },
    empty: 'Nothing found.',
  }
}

/** The deepest folder holding every file, else the most common parent folder. */
function commonFolder(files: string[]): string {
  const split = files.map((f) => f.split('/').slice(0, -1))
  const first = split[0] ?? []
  let n = 0
  while (n < first.length && split.every((parts) => parts[n] === first[n])) n++
  // Route handlers sit in their own folders; `app/api/users/route.ts` alone gives `app/api/users`.
  const common = first.slice(0, files.length === 1 ? Math.max(0, n - 1) : n).join('/')
  return `${common || '.'}/`
}

// --- To check ---------------------------------------------------------------------------------

/** The kinds most worth a look first. */
const NOTE_ORDER: NoteKind[] = [
  'type-mismatch',
  'needs-recheck',
  'missing-page-component',
  'request',
  'middleware',
  'unresolved-component',
  'unresolved-type',
]

const NOTE_LABEL: Record<NoteKind, string> = {
  'type-mismatch': 'Type mismatch',
  'needs-recheck': 'Changed',
  'missing-page-component': 'Page',
  request: 'Request',
  middleware: 'Middleware',
  'unresolved-component': 'Component',
  'unresolved-type': 'Type',
}

function checkSection(index: ModelIndex): SummarySection {
  const notes = [...index.notes].sort((a, b) => NOTE_ORDER.indexOf(a.kind) - NOTE_ORDER.indexOf(b.kind))
  const shown = notes.slice(0, SUMMARY_LIMITS.check)
  return {
    id: 'check',
    title: 'To check',
    note: notes.length > 0 ? `${plural(notes.length, 'open note')}` : undefined,
    items: shown.map((note) => ({
      label: NOTE_LABEL[note.kind],
      value: note.message,
      detail: note.line ? `${note.file}:${note.line}` : note.file,
      link: noteLink(note),
    })),
    more: notes.length - shown.length,
    link: { to: 'overview' },
    empty: 'The scan resolved every page, component, type and request.',
  }
}

export function noteLink(note: ScanNote): SummaryLink {
  if (note.requestId) return { to: 'requests', siteId: note.requestId }
  if (note.routeId) return { to: 'page', routeId: note.routeId }
  if (note.componentId) return { to: 'component', componentId: note.componentId }
  if (note.typeId) return { to: 'type', typeId: note.typeId }
  return { to: 'overview' }
}

// --- Plain text -------------------------------------------------------------------------------

/** `flow-checker summary`: the same sections as plain text. */
export function formatSummary(summary: Summary, projectName?: string): string {
  const title = [
    `Start here${projectName ? `: ${projectName}` : ''}`,
    summary.nextVersion ? `(Next.js ${summary.nextVersion})` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const out = [title]
  for (const section of summary.sections) {
    out.push('', `${section.title}${section.note ? ` (${section.note})` : ''}`)
    if (section.items.length === 0) {
      out.push(`  ${section.empty}`)
      continue
    }
    const width = Math.min(18, Math.max(...section.items.map((i) => i.label.length)))
    for (const item of section.items) {
      const label = item.label.length > width ? item.label : item.label.padEnd(width)
      out.push(`  ${label}  ${item.value}${item.detail ? `  (${item.detail})` : ''}`)
    }
    if (section.more > 0) out.push(`  … ${section.more} more`)
  }
  return `${out.join('\n')}\n`
}

// --- Helpers ----------------------------------------------------------------------------------

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** Locale-free, so the order is the same on every machine (exports are golden-tested). */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
