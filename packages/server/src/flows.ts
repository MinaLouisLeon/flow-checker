// Confirms inferred flows from what users did (docs/PLAN.md 8, "Flow recording").
//
// Each session timeline (interactions, navigation, and the browser captures with their matched
// request site) is checked against every inferred flow. A flow is split into segments, one per
// user interaction. A segment's requests and navigation must show up after its interaction and
// before the next segment's interaction (in any order: navigation and effect requests are not
// logged in a reliable order). Walked end to end, the flow is confirmed. A walk that navigates
// somewhere the code did not predict becomes a recorded variant.
import { randomBytes } from 'node:crypto'
import {
  type AppModel,
  type Capture,
  type Flow,
  type FlowRun,
  type FlowStatus,
  type FlowsSummary,
  matchedSiteIds,
  type RecordedFlow,
  type RecordedStep,
  type Route,
  routePathRegex,
  type Session,
  servedPaths,
} from '@flow-checker/shared'
import type { OverridesFile } from './overrides'
import type { CaptureStore } from './store'

/** A later step must happen within this long of the previous one. */
const STEP_WINDOW_MS = 60_000
/** The next interaction of a flow (e.g. typing the OTP) may take longer. */
const INTERACTION_WINDOW_MS = 10 * 60_000

const EVENT_TYPES: Record<string, string[]> = {
  onSubmit: ['submit'],
  action: ['submit', 'click'],
  formAction: ['submit', 'click'],
  onClick: ['click'],
  onChange: ['change', 'click'],
  onKeyDown: ['keydown'],
}

export type TimelineEvent =
  | {
      at: number
      iso: string
      kind: 'interaction'
      type: string
      chain: string[]
      target: string
      url: string
    }
  | { at: number; iso: string; kind: 'navigation'; how: 'load' | 'push' | 'replace' | 'pop'; url: string }
  | { at: number; iso: string; kind: 'capture'; capture: Capture }

/** What a segment needs to see. `stepIndex` points into `Flow.steps`. */
type Expect =
  | { stepIndex: number; kind: 'request'; siteId: string; checkable: boolean }
  | { stepIndex: number; kind: 'navigate'; routeId?: string }

interface Segment {
  stepIndex: number
  component: string
  types: string[]
  expects: Expect[]
}

export interface FlowTrackerOptions {
  model: AppModel
  store: CaptureStore
  overrides: OverridesFile
}

export class FlowTracker {
  #model: AppModel
  readonly #store: CaptureStore
  readonly #overrides: OverridesFile
  #summary: FlowsSummary | undefined
  #recording: { id: string; name: string; startedAt: string } | undefined
  readonly #listeners = new Set<() => void>()

  constructor(options: FlowTrackerOptions) {
    this.#model = options.model
    this.#store = options.store
    this.#overrides = options.overrides
    options.store.subscribeSessions(() => this.changed())
    options.store.subscribe(() => this.changed())
  }

  setModel(model: AppModel): void {
    this.#model = model
    this.changed()
  }

  /** The model's flows with the names you gave them. */
  withNames(model: AppModel): AppModel {
    const names = this.#overrides.get().flowNames
    if (Object.keys(names).length === 0) return model
    return {
      ...model,
      flows: model.flows.map((f) => (names[f.id] ? { ...f, name: names[f.id] as string } : f)),
    }
  }

  /** Renames a flow. An empty name goes back to the inferred one. */
  rename(flowId: string, name: string): boolean {
    if (!this.#model.flows.some((f) => f.id === flowId)) return false
    this.#overrides.update((current) => {
      const flowNames = { ...current.flowNames }
      if (name.trim()) flowNames[flowId] = name.trim()
      else delete flowNames[flowId]
      return { ...current, flowNames }
    })
    this.changed()
    return true
  }

  /** Starts recording a named flow: everything that happens until `stop` is kept. */
  start(name: string): { id: string; name: string; startedAt: string } {
    this.#recording = {
      id: `rec_${randomBytes(6).toString('hex')}`,
      name: name.trim() || 'Recorded flow',
      startedAt: new Date().toISOString(),
    }
    // Without a name, the recording is named after the pages it went through when it stops.
    this.#unnamed = !name.trim()
    this.changed()
    return this.#recording
  }

  #unnamed = false

  /** Stops the recording and saves it to overrides.json. */
  stop(): RecordedFlow | undefined {
    const recording = this.#recording
    if (!recording) return undefined
    this.#recording = undefined
    const endedAt = new Date().toISOString()
    const from = Date.parse(recording.startedAt)
    const to = Date.parse(endedAt)
    const events = loadsFirst(
      this.#store
        .allSessions()
        .flatMap((s) => this.#timeline(s))
        .filter((e) => e.at >= from && e.at <= to)
        .sort((a, b) => a.at - b.at),
    )
    const steps = events.map((e) => this.#recordedStep(e)).filter((s): s is RecordedStep => Boolean(s))
    // The inferred flow walked end to end inside the recording, if any.
    let flowId: string | undefined
    for (const flow of this.#model.flows) {
      const segments = segmentsOf(flow, this.#model)
      if (this.#runs(flow, segments, events).some((r) => r.run.complete)) {
        flowId = flow.id
        break
      }
    }
    const saved: RecordedFlow = {
      id: recording.id,
      name: this.#unnamed ? recordingName(steps, recording.startedAt) : recording.name,
      kind: 'named',
      ...(flowId ? { flowId } : {}),
      startedAt: recording.startedAt,
      endedAt,
      steps,
    }
    this.#overrides.update((current) => ({ ...current, recordings: [...current.recordings, saved] }))
    this.changed()
    return saved
  }

  deleteRecording(id: string): boolean {
    const before = this.#overrides.get().recordings.length
    this.#overrides.update((current) => ({
      ...current,
      recordings: current.recordings.filter((r) => r.id !== id),
    }))
    this.changed()
    return this.#overrides.get().recordings.length < before
  }

  summary(): FlowsSummary {
    if (this.#summary) return this.#summary
    const flows: Record<string, FlowStatus> = {}
    const variants = new Map<string, RecordedFlow>()
    const timelines = this.#store
      .allSessions()
      .map((s) => ({ session: s, events: this.#timeline(s) }))
      .filter((t) => t.events.length > 0)

    for (const flow of this.#model.flows) {
      const segments = segmentsOf(flow, this.#model)
      const status: FlowStatus = {
        status: 'unconfirmed',
        source: 'inferred',
        runs: 0,
        branches: flow.branches.map(() => false),
      }
      for (const { session, events } of timelines) {
        for (const found of this.#runs(flow, segments, events)) {
          const run: FlowRun = { ...found.run, sessionId: session.id }
          if (run.steps < 2) continue
          status.runs++
          if (
            !status.best ||
            run.steps > status.best.steps ||
            (run.steps === status.best.steps && run.startedAt > status.best.startedAt)
          ) {
            status.best = run
          }
          for (const index of found.branchesSeen) status.branches[index] = true
          if (found.divergence) {
            const variant = this.#variant(flow, session, events, found)
            if (variant && !variants.has(variant.id)) variants.set(variant.id, variant)
          }
        }
      }
      if (status.best?.complete) {
        status.status = 'confirmed'
        status.source = 'both'
      } else if (status.best) {
        status.status = 'partial'
      }
      flows[flow.id] = status
    }

    this.#summary = {
      flows,
      recorded: [...this.#overrides.get().recordings, ...variants.values()],
      ...(this.#recording ? { recording: this.#recording } : {}),
    }
    return this.#summary
  }

  /** Called after flow results may have changed. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  changed(): void {
    this.#summary = undefined
    for (const listener of this.#listeners) {
      try {
        listener()
      } catch {}
    }
  }

  // --- Matching ------------------------------------------------------------------------------

  /** Every attempt at the flow in one timeline: one per matching start interaction. */
  #runs(flow: Flow, segments: Segment[], events: TimelineEvent[]) {
    const out: {
      run: Omit<FlowRun, 'sessionId'>
      branchesSeen: number[]
      divergence?: { index: number; stepIndex: number; routeId?: string }
      startIndex: number
    }[] = []
    const first = segments[0]
    if (!first) return out
    events.forEach((event, startIndex) => {
      if (!fits(event, first)) return
      const result = this.#walk(flow, segments, events, startIndex)
      out.push({ ...result, startIndex, run: { ...result.run, startedAt: event.iso } })
    })
    return out
  }

  #walk(flow: Flow, segments: Segment[], events: TimelineEvent[], startIndex: number) {
    const branchesSeen: number[] = []
    let divergence: { index: number; stepIndex: number; routeId?: string } | undefined
    let matched = 0 // flow steps done, in order
    let segStart = startIndex
    let lastAt = (events[startIndex] as TimelineEvent).at

    walk: for (let k = 0; k < segments.length; k++) {
      const segment = segments[k] as Segment
      if (k > 0) {
        const at = findIndex(
          events,
          segStart + 1,
          (e) => fits(e, segment) && e.at - lastAt <= INTERACTION_WINDOW_MS,
        )
        if (at < 0) break
        segStart = at
      }
      matched = segment.stepIndex + 1
      const startAt = (events[segStart] as TimelineEvent).at
      const next = segments[k + 1]
      let end = events.length
      for (let i = segStart + 1; i < events.length; i++) {
        const e = events[i] as TimelineEvent
        if (e.at - startAt > STEP_WINDOW_MS || (next && fits(e, next))) {
          end = i
          break
        }
      }
      const window = events.slice(segStart + 1, end)
      lastAt = startAt

      for (const expect of segment.expects) {
        if (expect.kind === 'request') {
          if (!expect.checkable) {
            matched = expect.stepIndex + 1
            continue
          }
          const hit = window.find(
            (e) => e.kind === 'capture' && matchedSiteIds(e.capture.match).includes(expect.siteId),
          )
          if (!hit) break walk
          lastAt = Math.max(lastAt, hit.at)
          matched = expect.stepIndex + 1
          continue
        }
        // A target the scan could not resolve accepts any client-side navigation.
        const hit = window.find(
          (e) =>
            e.kind === 'navigation' &&
            (expect.routeId ? this.#routeOf(e.url) === expect.routeId : e.how !== 'load'),
        )
        if (hit) {
          lastAt = Math.max(lastAt, hit.at)
          matched = expect.stepIndex + 1
          continue
        }
        // Went somewhere else: an error branch the code knows about, or a new variant.
        const other = window.find((e) => e.kind === 'navigation' && e.how !== 'load')
        const otherRoute = other && other.kind === 'navigation' ? this.#routeOf(other.url) : undefined
        const branch = flow.branches.findIndex((b) =>
          b.steps.some((s) => s.kind === 'navigate' && s.routeId && s.routeId === otherRoute),
        )
        if (branch >= 0) branchesSeen.push(branch)
        else if (other) {
          divergence = {
            index: events.indexOf(other),
            stepIndex: expect.stepIndex,
            ...(otherRoute ? { routeId: otherRoute } : {}),
          }
        }
        break walk
      }
    }
    return {
      run: { steps: matched, complete: matched >= flow.steps.length },
      branchesSeen,
      ...(divergence ? { divergence } : {}),
    }
  }

  #variant(
    flow: Flow,
    session: Session,
    events: TimelineEvent[],
    found: { startIndex: number; divergence?: { index: number; stepIndex: number; routeId?: string } },
  ): RecordedFlow | undefined {
    const divergence = found.divergence
    if (!divergence) return undefined
    const routes = new Map(this.#model.routes.map((r) => [r.id, r]))
    const where = divergence.routeId ? (routes.get(divergence.routeId)?.path ?? '?') : 'another page'
    const steps = events
      .slice(found.startIndex, divergence.index + 1)
      .map((e) => this.#recordedStep(e))
      .filter((s): s is RecordedStep => Boolean(s))
    return {
      // One variant per flow, divergence point and destination.
      id: `var_${flow.id}_${divergence.stepIndex}_${divergence.routeId ?? 'x'}`,
      name: `${this.withNames(this.#model).flows.find((f) => f.id === flow.id)?.name ?? flow.name} → ${where}`,
      kind: 'variant',
      flowId: flow.id,
      divergedAt: divergence.stepIndex,
      sessionId: session.id,
      startedAt: (events[found.startIndex] as TimelineEvent).iso,
      steps,
    }
  }

  // --- Timeline ------------------------------------------------------------------------------

  #timeline(session: Session): TimelineEvent[] {
    const out: TimelineEvent[] = []
    for (const event of session.events) {
      const at = Date.parse(event.at)
      if (!Number.isFinite(at)) continue
      if (event.kind === 'interaction') {
        out.push({
          at,
          iso: event.at,
          kind: 'interaction',
          type: event.type,
          chain: event.componentChain,
          target: event.target,
          url: event.url,
        })
      } else if (event.kind === 'navigation') {
        out.push({ at, iso: event.at, kind: 'navigation', how: event.how, url: event.url })
      } else {
        const capture = this.#store.get(event.captureId)
        // Another site's script talking to its servers is not a step of the app's flow.
        if (capture && !capture.match?.thirdParty) out.push({ at, iso: event.at, kind: 'capture', capture })
      }
    }
    // Stable: events with the same time keep their logged order.
    const sorted = out
      .map((e, i) => ({ e, i }))
      .sort((a, b) => a.e.at - b.e.at || a.i - b.i)
      .map(({ e }) => e)
    return loadsFirst(sorted)
  }

  #recordedStep(e: TimelineEvent): RecordedStep | undefined {
    if (e.kind === 'interaction') {
      if (e.type === 'keydown') return undefined
      const routeId = this.#routeOf(e.url)
      return {
        kind: 'interaction',
        at: e.iso,
        type: e.type,
        ...(e.chain[0] ? { component: e.chain[0] } : {}),
        target: e.target,
        ...(routeId ? { routeId } : {}),
      }
    }
    if (e.kind === 'navigation') {
      const routeId = this.#routeOf(e.url)
      return { kind: 'navigate', at: e.iso, how: e.how, path: pathOf(e.url), ...(routeId ? { routeId } : {}) }
    }
    const c = e.capture
    const siteId = c.match?.status === 'matched' ? c.match.siteId : undefined
    return {
      kind: 'request',
      at: e.iso,
      captureId: c.id,
      ...(siteId ? { siteId } : {}),
      method: c.request.method,
      path: pathOf(c.request.url),
      ...(c.response ? { status: c.response.status } : {}),
    }
  }

  #pages: { model: AppModel; list: { route: Route; re: RegExp }[] } | undefined

  #routeOf(url: string): string | undefined {
    if (this.#pages?.model !== this.#model) {
      const list = this.#model.routes
        .filter((r) => r.kind === 'page' && !r.slot && !r.intercepting)
        .map((route) => ({
          route,
          re: routePathRegex(route.path),
          dynamic: (route.path.match(/\[/g) ?? []).length,
        }))
        .sort((a, b) => a.dynamic - b.dynamic)
      this.#pages = { model: this.#model, list }
    }
    // Middleware rewrites and next-intl's default locale: the route that really answers (M14).
    for (const path of servedPaths(this.#model.middleware, pathOf(url))) {
      const found = this.#pages.list.find((p) => p.re.test(path))
      if (found) return found.route.id
    }
    return undefined
  }
}

/** Splits a flow at its interactions, with what each part must show. */
/** A name for a recording saved without one: the pages it went through, e.g. `/en → /en/jobs`. */
export function recordingName(steps: RecordedStep[], startedAt: string): string {
  const paths: string[] = []
  for (const step of steps) {
    if (step.kind === 'navigate' && paths.at(-1) !== step.path) paths.push(step.path)
  }
  if (paths.length === 0) {
    const time = new Date(startedAt).toTimeString().slice(0, 5)
    return `Recorded flow ${time}`
  }
  const shown = paths.length > 3 ? [paths[0], '…', paths.at(-1)] : paths
  return shown.join(' → ')
}

/**
 * A page `load` is logged once the runtime starts, after the page's first requests went out.
 * It is moved before the browser captures made on that page just before it.
 */
export function loadsFirst(events: TimelineEvent[]): TimelineEvent[] {
  const out = [...events]
  for (let i = 0; i < out.length; i++) {
    const nav = out[i] as TimelineEvent
    if (nav.kind !== 'navigation' || nav.how !== 'load') continue
    let to = i
    while (to > 0) {
      const before = out[to - 1] as TimelineEvent
      if (before.kind !== 'capture' || before.capture.origin !== 'browser') break
      if (before.capture.pageUrl !== nav.url) break
      to--
    }
    if (to < i) {
      out.splice(i, 1)
      out.splice(to, 0, nav)
    }
  }
  return out
}

function segmentsOf(flow: Flow, model: AppModel): Segment[] {
  const components = new Map(model.components.map((c) => [c.id, c.name]))
  const sites = new Map(model.requests.map((s) => [s.id, s]))
  const segments: Segment[] = []
  flow.steps.forEach((step, stepIndex) => {
    if (step.kind === 'interaction') {
      segments.push({
        stepIndex,
        component: components.get(step.componentId) ?? '',
        types: EVENT_TYPES[step.event] ?? [],
        expects: [],
      })
      return
    }
    const segment = segments[segments.length - 1]
    if (!segment) return
    if (step.kind === 'request') {
      // Server-side requests (server components) are not linked to a browser session.
      const site = sites.get(step.siteId)
      const checkable = Boolean(site) && site?.trigger.kind !== 'server-render'
      segment.expects.push({ stepIndex, kind: 'request', siteId: step.siteId, checkable })
    } else if (step.kind === 'query-update') {
      // A cache update leaves no trace of its own; the refetches it causes show up as captures.
      segment.expects.push({ stepIndex, kind: 'request', siteId: '', checkable: false })
    } else {
      segment.expects.push({
        stepIndex,
        kind: 'navigate',
        ...(step.routeId ? { routeId: step.routeId } : {}),
      })
    }
  })
  return segments
}

/** An interaction that can be the segment's: right event type, from (near) its component. */
function fits(event: TimelineEvent, segment: Segment): boolean {
  if (event.kind !== 'interaction') return false
  if (segment.types.length > 0 && !segment.types.includes(event.type)) return false
  return event.chain.slice(0, 4).includes(segment.component)
}

function findIndex(events: TimelineEvent[], from: number, test: (e: TimelineEvent) => boolean): number {
  for (let i = from; i < events.length; i++) if (test(events[i] as TimelineEvent)) return i
  return -1
}

function pathOf(url: string): string {
  try {
    return decodeURI(new URL(url, 'http://localhost').pathname)
  } catch {
    return url
  }
}
