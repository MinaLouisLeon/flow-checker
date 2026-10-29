// Runs the matcher on captures as they arrive and after each re-scan, keeps your manual
// decisions in `.flow-checker/overrides.json`, compares matched captures with the site's
// declared types (M8), and derives each request site's status.
import {
  type AppModel,
  applyVerification,
  type Capture,
  type CaptureMatch,
  checkCapture,
  type RequestSite,
  type SiteVerification,
  summarizeTypeChecks,
  type TypeCheck,
  type TypeTable,
  typeTable,
  type VerificationSummary,
} from '@flow-checker/shared'
import { ServerActionResolver } from './actions'
import { fingerprint, Matcher } from './matcher'
import { OverridesFile } from './overrides'
import { SourceMapper } from './stack'
import type { CaptureStore } from './store'

export interface VerifierOptions {
  /** Project root (for source maps, the action manifest and overrides.json). */
  root: string
  model: AppModel
  store: CaptureStore
  /** Shared with the flow tracker. Default: a new one for `root`. */
  overrides?: OverridesFile
}

export class Verifier {
  private model: AppModel
  private matcher: Matcher
  private sites: Map<string, RequestSite>
  private types: TypeTable
  private readonly store: CaptureStore
  private readonly mapper: SourceMapper
  private readonly actions: ServerActionResolver
  readonly overrides: OverridesFile
  private served: AppModel | undefined
  private readonly listeners = new Set<() => void>()

  constructor(options: VerifierOptions) {
    this.model = options.model
    this.matcher = new Matcher(options.model)
    this.sites = new Map(options.model.requests.map((s) => [s.id, s]))
    this.types = typeTable(options.model.types)
    this.store = options.store
    this.mapper = new SourceMapper(options.root)
    this.actions = new ServerActionResolver(options.root)
    this.overrides = options.overrides ?? new OverridesFile(options.root)
    // Captures from earlier runs: match them against the current scan.
    this.rematch(this.store.all())
  }

  /** A new scan result. Every capture is matched again (site ids are stable across scans). */
  setModel(model: AppModel): void {
    this.model = model
    this.matcher = new Matcher(model)
    this.sites = new Map(model.requests.map((s) => [s.id, s]))
    this.types = typeTable(model.types)
    this.rematch(this.store.all(), true)
  }

  /** Matches and stores new captures from the runtime. */
  ingest(captures: Capture[]): void {
    for (const incoming of captures) {
      // The runtime must not decide these.
      const { match: _, sourceStack: __, typeCheck: ___, ...rest } = incoming
      let capture: Capture = { ...rest }
      const frames = this.mapper.resolve(capture.stack)
      if (frames.length > 0) capture.sourceStack = frames
      capture = this.evaluate(capture)
      this.store.add(capture)
      // Server hops that arrived first can now use this capture's match.
      if (capture.origin === 'browser') this.rematch(this.store.children(capture.id))
    }
    this.changed()
  }

  /**
   * Assigns a capture to a site (`null`: to no site), or clears the decision (`undefined`).
   * The decision applies to every capture with the same fingerprint, now and later.
   */
  assign(captureId: string, siteId: string | null | undefined): Capture | undefined {
    const capture = this.store.get(captureId)
    if (!capture) return undefined
    if (siteId && !this.matcher.hasSite(siteId)) throw new Error(`Unknown request site: ${siteId}`)
    const print = fingerprint(capture)
    this.overrides.update((current) => {
      const matches = current.matches.filter((m) => m.fingerprint !== print)
      if (siteId !== undefined) matches.push({ fingerprint: print, siteId, at: new Date().toISOString() })
      return { ...current, matches }
    })
    this.rematch(this.store.all().filter((c) => fingerprint(c) === print))
    return this.store.get(captureId)
  }

  /** Deletes every capture (and session). Manual decisions in overrides.json stay. */
  clear(): void {
    this.store.clear()
    this.changed()
  }

  /** The model with each site's status (and type-mismatch flag) from its matched captures. */
  servedModel(): AppModel {
    this.served ??= applyVerification(this.model, { sites: this.siteVerification() })
    return this.served
  }

  summary(): VerificationSummary {
    const counts = { matched: 0, ambiguous: 0, unmatched: 0, manual: 0 }
    for (const capture of this.store.all()) {
      const match = capture.match
      if (!match) continue
      counts[match.status]++
      if (match.by === 'manual') counts.manual++
    }
    return { sites: this.siteVerification(), counts }
  }

  /** Called after matches change (debounce on the receiving side). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private siteVerification(): Record<string, SiteVerification> {
    const sites: Record<string, SiteVerification> = {}
    const checks = new Map<string, { captureId: string; check: TypeCheck }[]>()
    for (const capture of this.store.all()) {
      const match = capture.match
      if (match?.status !== 'matched' || !match.siteId) continue
      const entry = sites[match.siteId] ?? { captures: 0 }
      sites[match.siteId] = entry
      entry.captures++
      if (!entry.lastAt || capture.timestamp >= entry.lastAt) {
        entry.lastAt = capture.timestamp
        entry.lastCaptureId = capture.id
      }
      if (capture.typeCheck?.siteId === match.siteId) {
        const list = checks.get(match.siteId) ?? []
        checks.set(match.siteId, list)
        list.push({ captureId: capture.id, check: capture.typeCheck })
      }
    }
    for (const [siteId, list] of checks) {
      const entry = sites[siteId]
      const typeCheck = summarizeTypeChecks(list)
      if (entry && typeCheck) entry.typeCheck = typeCheck
    }
    return sites
  }

  /** The capture with its match and, when matched, the type comparison against that site. */
  private evaluate(capture: Capture): Capture {
    const { typeCheck: _, ...rest } = capture
    const match = this.matchOne(capture)
    const site = match.status === 'matched' && match.siteId ? this.sites.get(match.siteId) : undefined
    const typeCheck = site ? checkCapture(capture, site, this.types) : undefined
    return typeCheck ? { ...rest, match, typeCheck } : { ...rest, match }
  }

  private matchOne(capture: Capture): CaptureMatch {
    const print = fingerprint(capture)
    const decision = this.overrides.get().matches.find((m) => m.fingerprint === print)
    const parentId = capture.origin === 'server' ? capture.parent?.captureId : undefined
    return this.matcher.match(capture, {
      frames: capture.sourceStack ?? [],
      resolveAction: (id) => this.actions.resolve(id),
      parentMatch: parentId ? this.store.get(parentId)?.match : undefined,
      override: decision ? decision.siteId : undefined,
    })
  }

  /**
   * Matches captures again and saves the ones whose match changed. Browser captures go first,
   * so server hops see their parent's new match. `force` notifies even when nothing changed.
   */
  private rematch(captures: readonly Capture[], force = false): void {
    const ordered = [...captures].sort((a, b) =>
      a.origin === b.origin ? 0 : a.origin === 'browser' ? -1 : 1,
    )
    const listed = new Set(ordered.map((c) => c.id))
    const hops: Capture[] = []
    let changed = false
    for (const capture of ordered) {
      const next = this.evaluate(capture)
      if (
        JSON.stringify(next.match) === JSON.stringify(capture.match) &&
        JSON.stringify(next.typeCheck) === JSON.stringify(capture.typeCheck)
      ) {
        continue
      }
      this.store.add(next)
      changed = true
      // Server hops of a re-matched browser capture use its site as evidence.
      if (capture.origin === 'browser') {
        for (const hop of this.store.children(capture.id)) if (!listed.has(hop.id)) hops.push(hop)
      }
    }
    if (hops.length > 0) this.rematch(hops)
    if (changed || force) this.changed()
  }

  private changed() {
    this.served = undefined
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {}
    }
  }
}
