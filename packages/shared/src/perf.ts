// Request performance (M47): wording shared by the CLI text, the dashboard, the export and the notes,
// and the runtime check: captures grouped per page load (a browser page view, or one incoming request
// on the server) confirm the scan's findings, and give each endpoint its p50 / p95.
import type { Capture } from './capture'
import { endpointKeyOf } from './endpoints'
import { matchedSiteIds } from './match'
import type {
  AppModel,
  PerfFinding,
  PerfFindingKind,
  PerfFindingRuntime,
  PerfLoop,
  RequestSite,
} from './model'
import { requestLabel } from './model-index'

export const PERF_KIND_LABELS: Record<PerfFindingKind, string> = {
  waterfall: 'waterfall',
  'n-plus-one': 'N+1',
  duplicate: 'duplicate',
}

export const PERF_RUNTIME_LABELS: Record<PerfFindingRuntime['status'], string> = {
  confirmed: 'confirmed at runtime',
  'not-confirmed': 'not confirmed',
  'not-seen': 'not seen yet',
}

export const PERF_LOOP_LABELS: Record<PerfLoop['kind'], string> = {
  for: 'for loop',
  while: 'while loop',
  callback: 'array callback',
  render: 'rendered per item',
}

export function perfFindings(model: Pick<AppModel, 'perf'>): PerfFinding[] {
  return model.perf?.findings ?? []
}

/** The findings that slow down a page. */
export function perfOn(model: Pick<AppModel, 'perf'>, routeId: string): PerfFinding[] {
  return perfFindings(model).filter((f) => f.routeIds.includes(routeId))
}

type Sites = Pick<AppModel, 'requests'>

function siteMap(model: Sites): Map<string, RequestSite> {
  return new Map(model.requests.map((s) => [s.id, s]))
}

/** The request(s) of a list of sites, by label: "`GET /posts/:id`". */
function requestsText(ids: readonly string[], sites: Map<string, RequestSite>): string {
  const labels = [
    ...new Set(ids.flatMap((id) => (sites.has(id) ? [requestLabel(sites.get(id) as RequestSite)] : []))),
  ]
  if (labels.length === 0) return 'a request'
  const shown = labels.slice(0, 2).map((l) => `\`${l}\``)
  return labels.length > 2 ? `${shown.join(', ')} and ${labels.length - 2} more` : shown.join(' and ')
}

/** For each step, the earlier steps it waits for without using them. */
export function needlessWaits(finding: Pick<PerfFinding, 'steps'>): number[][] {
  const steps = finding.steps ?? []
  return steps.map((step, j) => {
    const out: number[] = []
    for (let i = 0; i < j; i++) if (!step.needs.includes(i) && !needsTransitively(steps, j, i)) out.push(i)
    return out
  })
}

function needsTransitively(steps: NonNullable<PerfFinding['steps']>, j: number, i: number): boolean {
  const seen = new Set<number>()
  const stack = [...(steps[j]?.needs ?? [])]
  while (stack.length > 0) {
    const k = stack.pop() as number
    if (k === i) return true
    if (seen.has(k)) continue
    seen.add(k)
    stack.push(...(steps[k]?.needs ?? []))
  }
  return false
}

/** The finding in one sentence (without the pages or the runtime result). */
export function perfText(finding: PerfFinding, model: Sites): string {
  const sites = siteMap(model)
  const where = finding.fn && finding.fn !== 'anonymous' ? ` in \`${finding.fn}\`` : ''
  switch (finding.kind) {
    case 'waterfall': {
      const steps = finding.steps ?? []
      const waits = needlessWaits(finding)
      const j = waits.findIndex((w) => w.length > 0)
      const late = steps[j]
      const first = steps[waits[j]?.[0] ?? 0]
      if (!late || !first) return `Requests${where} wait for each other`
      const others = waits.filter((w) => w.length > 0).length - 1
      const more = others > 0 ? ` (and ${others} more)` : ''
      return `\`${late.text}\` waits for \`${first.text}\`${where} but doesn't use its result${more}: they could start together`
    }
    case 'n-plus-one': {
      const loop = finding.loop
      const what = requestsText(finding.siteIds, sites)
      if (!loop) return `${what} is sent once per item${where}`
      const over = loop.over ? ` of \`${loop.over}\`` : ''
      if (loop.kind === 'render')
        return `\`${loop.text}\` is rendered once per item${over}${where}, and each sends ${what}`
      const order = finding.sequential ? ', each waiting for the one before' : ''
      return `${what} is sent once per item${over} in \`${loop.text}\`${where}${order}`
    }
    case 'duplicate': {
      const n = finding.siteIds.length
      return `\`${finding.request ?? '?'}\` is sent from ${n} places on one page load and nothing dedupes it`
    }
  }
}

/** The runtime result in a few words: "confirmed in 3 of 4 loads, 120 ms to save". */
export function perfRuntimeText(runtime: PerfFindingRuntime | undefined): string | undefined {
  if (!runtime) return undefined
  if (runtime.status === 'not-seen') return 'not seen at runtime yet'
  const loads = `${runtime.confirmed} of ${runtime.loads} load${runtime.loads === 1 ? '' : 's'}`
  if (runtime.status === 'not-confirmed') return `not confirmed at runtime (${loads})`
  const extra: string[] = []
  if (runtime.savedMs !== undefined) extra.push(`about ${ms(runtime.savedMs)} to save`)
  if (runtime.maxCalls !== undefined) extra.push(`up to ${runtime.maxCalls} requests per load`)
  if (runtime.totalMs !== undefined) extra.push(`${ms(runtime.totalMs)} together`)
  return `confirmed at runtime in ${loads}${extra.length ? `: ${extra.join(', ')}` : ''}`
}

/** `12 ms`, `1.4 s`. */
export function ms(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`
  return `${Math.round(value)} ms`
}

/** The CLI's `scan --tree` section: each finding with its requests and pages. */
export function formatPerf(model: Pick<AppModel, 'perf' | 'routes' | 'requests'>): string[] {
  const findings = perfFindings(model)
  if (findings.length === 0) return []
  const paths = new Map(model.routes.map((r) => [r.id, r.path]))
  const sites = siteMap(model)
  const out = ['# Request performance']
  for (const f of findings) {
    const fn = f.fn ? ` in ${f.fn}` : ''
    out.push('', `${f.kind} (${f.side})${fn} ${f.loc.file}:${f.loc.line}`)
    if (f.steps) {
      f.steps.forEach((step, i) => {
        const needs = step.needs.length ? ` needs ${step.needs.map((n) => n + 1).join(', ')}` : ''
        out.push(`  ${i + 1}. await ${step.text}${needs}  ${step.loc.file}:${step.loc.line}`)
      })
    }
    if (f.loop) {
      const over = f.loop.over ? ` over ${f.loop.over}` : ''
      out.push(`  ${f.loop.kind} ${f.loop.text}${over}${f.sequential ? ' sequential' : ''}`)
    }
    if (f.request) out.push(`  request ${f.request}`)
    for (const id of f.siteIds) {
      const site = sites.get(id)
      if (site) out.push(`  sends ${requestLabel(site)}`)
    }
    for (const id of f.listSiteIds ?? []) {
      const site = sites.get(id)
      if (site) out.push(`  list from ${requestLabel(site)}`)
    }
    const pages = f.routeIds.map((id) => paths.get(id) ?? '?').join(', ')
    if (pages) out.push(`  pages: ${pages}`)
  }
  return out
}

// --- Runtime ---------------------------------------------------------------------------------

/** Timings of one endpoint from captures (M47). */
export interface EndpointTiming {
  /** `Endpoint.key` (M29). */
  key: string
  /** `GET https://api.example.com/posts/:id`, without the query (it isn't part of the endpoint). */
  label: string
  siteIds: string[]
  /** Captured calls with a duration. */
  count: number
  p50: number
  p95: number
  max: number
  /** Calls that failed or answered 4xx / 5xx. */
  errors: number
  /** Calls sent from the browser and from the server. */
  browser: number
  server: number
  /** The slowest call. */
  slowestCaptureId: string
}

/** What captures say about request performance (M47). Part of `VerificationSummary`. */
export interface PerfSummary {
  /** Finding id → its runtime result. */
  findings: Record<string, PerfFindingRuntime>
  /** Slowest first (by p95, then p50). */
  endpoints: EndpointTiming[]
  /** Page loads (browser page views and incoming server requests) the captures came from. */
  loads: number
}

/** Captures more than this far apart with no load id are separate loads. */
const LOAD_GAP_MS = 3000
/** A request that starts this close to the end of another is counted as waiting for it. */
const SEQUENTIAL_SLACK_MS = 2

interface Timed {
  capture: Capture
  start: number
  end: number
}

/**
 * Groups captures per load: a browser page view (`view`) or an incoming server request
 * (`parent.requestId`). Older captures have neither: the page (or incoming URL) and session, split
 * where they are more than 3 s apart.
 */
export function groupLoads(captures: readonly Capture[]): Timed[][] {
  const byKey = new Map<string, Timed[]>()
  const loose = new Map<string, Timed[]>()
  for (const capture of captures) {
    if (capture.stream || capture.transport === 'eventsource' || capture.transport === 'websocket') continue
    const start = Date.parse(capture.timestamp)
    if (!Number.isFinite(start)) continue
    const timed = { capture, start, end: start + Math.max(0, capture.durationMs) }
    const id =
      capture.origin === 'server'
        ? capture.parent?.requestId && `s:${capture.parent.requestId}`
        : capture.view && `b:${capture.view}`
    if (id) {
      const list = byKey.get(id)
      if (list) list.push(timed)
      else byKey.set(id, [timed])
      continue
    }
    const where =
      capture.origin === 'server' ? `${capture.parent?.method} ${capture.parent?.url}` : capture.pageUrl
    const key = `${capture.origin} ${capture.sessionId} ${where ?? ''}`
    const list = loose.get(key)
    if (list) list.push(timed)
    else loose.set(key, [timed])
  }
  const loads = [...byKey.values()]
  for (const list of loose.values()) {
    list.sort((a, b) => a.start - b.start)
    let current: Timed[] = []
    let last = Number.NEGATIVE_INFINITY
    for (const t of list) {
      if (current.length > 0 && t.start - last > LOAD_GAP_MS) {
        loads.push(current)
        current = []
      }
      current.push(t)
      last = Math.max(last, t.end)
    }
    if (current.length > 0) loads.push(current)
  }
  for (const load of loads) load.sort((a, b) => a.start - b.start)
  return loads
}

/** Matches findings and endpoints with captures. `captures` must already be matched (M6). */
export function summarizePerf(
  model: Pick<AppModel, 'perf' | 'requests'>,
  captures: readonly Capture[],
): PerfSummary {
  const loads = groupLoads(captures)
  const indexed = indexLoads(loads)
  const findings: Record<string, PerfFindingRuntime> = {}
  for (const finding of perfFindings(model)) findings[finding.id] = checkFinding(finding, indexed)
  return { findings, endpoints: endpointTimings(model, loads), loads: loads.length }
}

interface IndexedLoads {
  /** Per load: site id → its captures. */
  sites: Map<string, Timed[]>[]
  /** Site id → the loads (indexes) that captured it, in order. */
  loadsOf: Map<string, number[]>
}

function indexLoads(loads: Timed[][]): IndexedLoads {
  const sites = loads.map(bySite)
  const loadsOf = new Map<string, number[]>()
  sites.forEach((map, i) => {
    for (const id of map.keys()) {
      const list = loadsOf.get(id)
      if (list) list.push(i)
      else loadsOf.set(id, [i])
    }
  })
  return { sites, loadsOf }
}

/**
 * The sites a capture is from: its match, or for an ambiguous one the sites tied at the top. A
 * duplicate is the same call in two places, so its captures are often ambiguous between them.
 */
export function capturedSites(capture: Pick<Capture, 'match'>): string[] {
  const match = capture.match
  if (match?.status === 'ambiguous') {
    const top = Math.max(...match.candidates.map((c) => c.score))
    return match.candidates.filter((c) => c.score === top).map((c) => c.siteId)
  }
  return matchedSiteIds(match)
}

function bySite(load: Timed[]): Map<string, Timed[]> {
  const out = new Map<string, Timed[]>()
  for (const t of load) {
    for (const id of capturedSites(t.capture)) {
      const list = out.get(id)
      if (list) list.push(t)
      else out.set(id, [t])
    }
  }
  return out
}

function checkFinding(finding: PerfFinding, indexed: IndexedLoads): PerfFindingRuntime {
  const ids = new Set(finding.siteIds)
  const loadIndexes = [...new Set(finding.siteIds.flatMap((id) => indexed.loadsOf.get(id) ?? []))].sort(
    (a, b) => a - b,
  )
  let seen = 0
  let confirmed = 0
  const saved: number[] = []
  const calls: number[] = []
  const totals: number[] = []
  let maxCalls = 0
  let last: Timed | undefined
  for (const i of loadIndexes) {
    const sites = indexed.sites[i] as Map<string, Timed[]>
    let shown: Timed[] | undefined
    if (finding.kind === 'waterfall') {
      const steps = finding.steps ?? []
      // The first call of each step in this load.
      const firsts = steps.map((s) =>
        s.siteIds
          .flatMap((id) => sites.get(id) ?? [])
          .sort((a, b) => a.start - b.start)
          .at(0),
      )
      if (firsts.filter(Boolean).length < 2) continue
      seen++
      const waits = needlessWaits(finding)
      const waited = waits.some((list, j) =>
        list.some((i) => {
          const a = firsts[i]
          const b = firsts[j]
          return !!a && !!b && b.start >= a.end - SEQUENTIAL_SLACK_MS
        }),
      )
      if (!waited) continue
      const present = firsts.filter((t): t is Timed => !!t)
      const span = Math.max(...present.map((t) => t.end)) - Math.min(...present.map((t) => t.start))
      saved.push(Math.max(0, span - Math.max(...present.map((t) => t.end - t.start))))
      shown = present
    } else {
      const list = [...new Set(finding.siteIds.flatMap((id) => sites.get(id) ?? []))]
      if (list.length === 0) continue
      seen++
      let repeated: Timed[] = []
      if (finding.kind === 'n-plus-one') {
        // One request per item: different URLs (React's dev double effects repeat the same one).
        const urls = new Set(list.map((t) => `${t.capture.request.method} ${t.capture.request.url}`))
        if (urls.size >= 2) repeated = list
      } else {
        // The same request from two of its sites.
        const byUrl = new Map<string, Timed[]>()
        for (const t of list) {
          const key = `${t.capture.request.method} ${t.capture.request.url}`
          byUrl.set(key, [...(byUrl.get(key) ?? []), t])
        }
        for (const same of byUrl.values()) {
          const from = new Set(same.flatMap((t) => capturedSites(t.capture).filter((id) => ids.has(id))))
          if (from.size >= 2 && same.length > repeated.length) repeated = same
        }
      }
      if (repeated.length === 0) continue
      // N+1: distinct requests, so React's dev double effects don't count twice.
      const count =
        finding.kind === 'n-plus-one'
          ? new Set(repeated.map((t) => `${t.capture.request.method} ${t.capture.request.url}`)).size
          : repeated.length
      calls.push(count)
      maxCalls = Math.max(maxCalls, count)
      totals.push(Math.max(...repeated.map((t) => t.end)) - Math.min(...repeated.map((t) => t.start)))
      shown = repeated
    }
    confirmed++
    const newest = shown.reduce((a, b) => (b.start > a.start ? b : a))
    if (!last || newest.start > last.start) last = newest
  }
  if (seen === 0) return { status: 'not-seen', loads: 0, confirmed: 0 }
  if (confirmed === 0) return { status: 'not-confirmed', loads: seen, confirmed: 0 }
  return {
    status: 'confirmed',
    loads: seen,
    confirmed,
    ...(saved.length > 0 ? { savedMs: Math.round(median(saved)) } : {}),
    ...(calls.length > 0 ? { maxCalls, totalMs: Math.round(median(totals)) } : {}),
    ...(last ? { captureId: last.capture.id, lastAt: last.capture.timestamp } : {}),
  }
}

function endpointTimings(model: Pick<AppModel, 'requests'>, loads: Timed[][]): EndpointTiming[] {
  const sites = siteMap(model)
  const byKey = new Map<
    string,
    {
      label: string
      siteIds: Set<string>
      durations: number[]
      slowest?: Timed
      errors: number
      browser: number
      server: number
    }
  >()
  for (const load of loads) {
    for (const t of load) {
      const keys = new Map<string, RequestSite[]>()
      for (const id of capturedSites(t.capture)) {
        const site = sites.get(id)
        if (!site || site.transport === 'sse' || site.transport === 'websocket') continue
        const key = endpointKeyOf(site)
        keys.set(key, [...(keys.get(key) ?? []), site])
      }
      // An ambiguous capture counts only when every site it may be from calls the same endpoint.
      if (t.capture.match?.status === 'ambiguous' && keys.size > 1) continue
      for (const [key, list] of keys) {
        const site = list[0] as RequestSite
        let entry = byKey.get(key)
        if (!entry) {
          entry = {
            label: timingLabel(site),
            siteIds: new Set(),
            durations: [],
            errors: 0,
            browser: 0,
            server: 0,
          }
          byKey.set(key, entry)
        }
        for (const s of list) entry.siteIds.add(s.id)
        const duration = t.end - t.start
        entry.durations.push(duration)
        if (!entry.slowest || duration > entry.slowest.end - entry.slowest.start) entry.slowest = t
        const status = t.capture.response?.status
        if (t.capture.error || (status !== undefined && status >= 400)) entry.errors++
        if (t.capture.origin === 'browser') entry.browser++
        else entry.server++
      }
    }
  }
  const out: EndpointTiming[] = []
  for (const [key, e] of byKey) {
    const sorted = [...e.durations].sort((a, b) => a - b)
    out.push({
      key,
      label: e.label,
      siteIds: [...e.siteIds].sort(),
      count: sorted.length,
      p50: Math.round(percentile(sorted, 50)),
      p95: Math.round(percentile(sorted, 95)),
      max: Math.round(sorted.at(-1) ?? 0),
      errors: e.errors,
      browser: e.browser,
      server: e.server,
      slowestCaptureId: e.slowest?.capture.id ?? '',
    })
  }
  return out.sort(
    (a, b) => b.p95 - a.p95 || b.p50 - a.p50 || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0),
  )
}

/** `GET https://api.test/posts/:id`: the site's request without its query, which isn't part of the endpoint. */
function timingLabel(site: RequestSite): string {
  if (!site.url?.path || site.transport === 'trpc' || site.transport === 'graphql') return requestLabel(site)
  return requestLabel({ ...site, url: { ...site.url, query: undefined } })
}

/** Nearest-rank percentile of sorted values. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] as number
}

function median(values: readonly number[]): number {
  return percentile(
    [...values].sort((a, b) => a - b),
    50,
  )
}

/** The model with each finding's runtime result. Returns the same model when nothing changed. */
export function applyPerfRuntime(model: AppModel, results: Record<string, PerfFindingRuntime>): AppModel {
  if (!model.perf) return model
  let changed = false
  const findings = model.perf.findings.map((f) => {
    const runtime = results[f.id]
    if (!runtime && !f.runtime) return f
    if (runtime && JSON.stringify(runtime) === JSON.stringify(f.runtime)) return f
    changed = true
    if (!runtime) {
      const { runtime: _, ...rest } = f
      return rest
    }
    return { ...f, runtime }
  })
  return changed ? { ...model, perf: { ...model.perf, findings } } : model
}
