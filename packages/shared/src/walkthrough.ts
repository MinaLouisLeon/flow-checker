// Guided walk-through (M35): the inferred flows as a checklist of things to do in the running app,
// with how far each one was walked (from the flows summary) and the share of flows and requests that
// real use has confirmed. Derived from the model and the flows summary, so the live dashboard and the
// static export show the same list.
import type { FlowStatus, FlowsSummary } from './flow-runs'
import type { Flow, FlowStep, RequestSite } from './model'
import type { ModelIndex } from './model-index'
import { queryLinkTarget, queryLinkVerb } from './query-keys'
import { entryPageIds } from './summary'
import { hasCaptures } from './verification'

export interface WalkStep {
  kind: FlowStep['kind']
  /** What to do or what should happen, with code in backticks: "Submit the form in `LoginForm`". */
  text: string
  /** Seen in the run that got furthest. */
  done: boolean
  /**
   * False when capture can't see the step on its own (a request sent while the server renders, a
   * cache update): it is ticked with the step after it.
   */
  checkable: boolean
  routeId?: string
  componentId?: string
  siteId?: string
}

export interface WalkItem {
  flowId: string
  name: string
  status: FlowStatus['status']
  /** Times it was walked, fully or in part. */
  runs: number
  /** The page the flow starts on. */
  routeId?: string
  /** Its path in bracket form (`/[locale]/login`). */
  path?: string
  /** It starts on the start page or a page nothing links to, so it can be walked first. */
  entry: boolean
  /** Request steps (they are what capture checks). */
  requests: number
  steps: WalkStep[]
  /** Steps done in order, and their share in percent. */
  done: number
  percent: number
}

export interface Ratio {
  done: number
  total: number
  /** Rounded down, so it says 100 only when everything is done. */
  percent: number
}

export interface Coverage {
  /** Confirmed flows of all flows. */
  flows: Ratio
  /** Request sites with captures of all request sites. */
  requests: Ratio
}

export interface Walkthrough {
  /** Flows not confirmed yet, most important first. */
  todo: WalkItem[]
  /** Confirmed flows, in the same order. */
  walked: WalkItem[]
  coverage: Coverage
  /** Dynamic segments of the start pages, in the order first seen, with a value to suggest. */
  params: { name: string; suggested?: string }[]
}

export function ratio(done: number, total: number): Ratio {
  return { done, total, percent: total > 0 ? Math.floor((done / total) * 100) : 0 }
}

export function buildCoverage(index: ModelIndex, flows: FlowsSummary | undefined): Coverage {
  const { model } = index
  return {
    flows: ratio(
      model.flows.filter((f) => flows?.flows[f.id]?.status === 'confirmed').length,
      model.flows.length,
    ),
    requests: ratio(model.requests.filter(hasCaptures).length, model.requests.length),
  }
}

export function buildWalkthrough(index: ModelIndex, flows: FlowsSummary | undefined): Walkthrough {
  const entry = entryPageIds(index)
  const items = index.model.flows.map((flow) => walkItem(index, flow, flows?.flows[flow.id], entry))
  // Start pages first (they can be opened directly), then flows that check more requests.
  items.sort(
    (a, b) =>
      Number(b.entry) - Number(a.entry) ||
      b.requests - a.requests ||
      b.steps.length - a.steps.length ||
      compareText(a.name, b.name) ||
      compareText(a.flowId, b.flowId),
  )
  return {
    todo: items.filter((i) => i.status !== 'confirmed'),
    walked: items.filter((i) => i.status === 'confirmed'),
    coverage: buildCoverage(index, flows),
    params: startParams(index, items),
  }
}

function walkItem(
  index: ModelIndex,
  flow: Flow,
  status: FlowStatus | undefined,
  entry: Set<string>,
): WalkItem {
  const starts = flow.startRouteIds?.length ? flow.startRouteIds : flow.routeId ? [flow.routeId] : []
  const done = status?.status === 'confirmed' ? flow.steps.length : (status?.best?.steps ?? 0)
  const route = flow.routeId ? index.routes.get(flow.routeId) : undefined
  return {
    flowId: flow.id,
    name: flow.name,
    status: status?.status ?? 'unconfirmed',
    runs: status?.runs ?? 0,
    ...(route ? { routeId: route.id, path: route.path } : {}),
    entry: starts.some((id) => entry.has(id)),
    requests: flow.steps.filter((s) => s.kind === 'request').length,
    steps: flow.steps.map((step, i) => walkStep(index, step, i < done)),
    done,
    percent: ratio(done, flow.steps.length).percent,
  }
}

const EVENT_TEXT: Record<string, (name: string) => string> = {
  onSubmit: (c) => `Submit the form in \`${c}\``,
  action: (c) => `Submit the form in \`${c}\``,
  formAction: (c) => `Submit the form in \`${c}\``,
  onClick: (c) => `Click in \`${c}\``,
  onChange: (c) => `Change a field in \`${c}\``,
  onInput: (c) => `Change a field in \`${c}\``,
  onKeyDown: (c) => `Press a key in \`${c}\``,
  onKeyUp: (c) => `Press a key in \`${c}\``,
  onMouseEnter: (c) => `Hover over \`${c}\``,
  onMouseOver: (c) => `Hover over \`${c}\``,
  onPointerEnter: (c) => `Hover over \`${c}\``,
  onFocus: (c) => `Focus a field in \`${c}\``,
  onBlur: (c) => `Leave a field in \`${c}\``,
}

function walkStep(index: ModelIndex, step: FlowStep, done: boolean): WalkStep {
  switch (step.kind) {
    case 'interaction': {
      const name = index.components.get(step.componentId)?.name ?? '?'
      const route = step.routeId ? index.routes.get(step.routeId) : undefined
      const what = EVENT_TEXT[step.event]?.(name) ?? `Use \`${step.event}\` in \`${name}\``
      return {
        kind: step.kind,
        text: route ? `${what} on \`${route.path}\`` : what,
        done,
        checkable: true,
        ...(step.routeId ? { routeId: step.routeId } : {}),
        componentId: step.componentId,
      }
    }
    case 'request': {
      const site = index.requests.get(step.siteId)
      const what = site ? `\`${shortRequest(site)}\`` : 'a request'
      const server = site?.trigger.kind === 'server-render'
      // A socket or an event stream stays open: it is opened rather than sent.
      const opens = site?.transport === 'websocket' || site?.transport === 'sse'
      return {
        kind: step.kind,
        text: server
          ? `The server sends ${what} while it renders the page`
          : step.onLoad
            ? `The page ${opens ? 'opens' : 'loads'} ${what}`
            : `It ${opens ? 'opens' : 'sends'} ${what}`,
        done,
        checkable: Boolean(site) && !server,
        siteId: step.siteId,
      }
    }
    case 'navigate': {
      const route = step.routeId ? index.routes.get(step.routeId) : undefined
      const nav = index.navigations.get(step.navigationId)
      const to = route?.path ?? nav?.href.text
      return {
        kind: step.kind,
        text: to ? `It goes to \`${to}\`` : 'It goes to another page',
        done,
        checkable: true,
        ...(route ? { routeId: route.id } : {}),
      }
    }
    case 'query-update': {
      const link = index.queryLinks.get(step.linkId)
      return {
        kind: step.kind,
        text: link
          ? `It ${queryLinkVerb(link.kind)} \`${queryLinkTarget(link)}\` in the cache`
          : 'It updates the cache',
        done,
        checkable: false,
      }
    }
  }
}

/** `POST /auth/login`, `tRPC todo.add`, `GraphQL GetTodos`, `action createProduct`, `WebSocket /echo`. */
export function shortRequest(site: RequestSite): string {
  if (site.transport === 'server-action') return `action ${site.serverAction?.name ?? '?'}`
  if (site.procedure) return `tRPC ${site.procedure.path}`
  if (site.operation) return `GraphQL ${site.operation.name || 'anonymous operation'}`
  const path = `${site.url?.path ?? site.url?.text ?? '?'}${site.url?.query ? `?${site.url.query}` : ''}`
  if (site.transport === 'websocket') return `WebSocket ${path}`
  if (site.transport === 'sse') return `event stream ${path}`
  return `${site.method ?? '?'} ${path}`
}

// --- Page links -------------------------------------------------------------------------------

/** `[id]`, `[...slug]`, `[[...slug]]`. */
const PARAM = /^\[(\[)?(\.\.\.)?([^\]]+)\]?\]$/

/** The dynamic segment names of a path in bracket form, in order. */
export function pathParams(path: string): string[] {
  return path
    .split('/')
    .map((part) => PARAM.exec(part)?.[3])
    .filter((name): name is string => Boolean(name))
}

/**
 * The real URL path for a page path in bracket form, with the given values for its dynamic segments.
 * An optional catch-all may be left empty; any other missing value is listed in `missing`.
 */
export function fillPath(path: string, values: Record<string, string>): { path?: string; missing: string[] } {
  const missing: string[] = []
  const out: string[] = []
  for (const part of path.split('/').filter(Boolean)) {
    const m = PARAM.exec(part)
    if (!m) {
      out.push(part)
      continue
    }
    const [, optional, catchAll, name = ''] = m
    const value = (values[name] ?? '').trim().replace(/^\/+|\/+$/g, '')
    if (!value) {
      if (!optional) missing.push(name)
      continue
    }
    // A catch-all takes several segments: keep its slashes, encode each piece.
    out.push(catchAll ? value.split('/').map(encodeURIComponent).join('/') : encodeURIComponent(value))
  }
  return missing.length > 0 ? { missing } : { path: `/${out.join('/')}`, missing }
}

/** The dynamic segments the start pages need, with the locale suggested for next-intl's segment. */
function startParams(index: ModelIndex, items: WalkItem[]): Walkthrough['params'] {
  const i18n = index.model.middleware?.i18n
  const suggestedLocale = i18n?.defaultLocale ?? i18n?.locales[0]
  const seen = new Map<string, string | undefined>()
  for (const item of items) {
    if (!item.path) continue
    pathParams(item.path).forEach((name) => {
      if (seen.has(name)) return
      // The first segment of a next-intl app is the locale (`/[locale]/...`).
      const first = item.path?.split('/').filter(Boolean)[0] === `[${name}]`
      seen.set(name, first && suggestedLocale ? suggestedLocale : undefined)
    })
  }
  return [...seen].map(([name, suggested]) => (suggested ? { name, suggested } : { name }))
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
