// Runs the matcher on captures as they arrive and after each re-scan, keeps your manual
// decisions in `.flow-checker/overrides.json`, and derives each request site's status.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  type AppModel,
  type Capture,
  type CaptureMatch,
  type Overrides,
  OverridesSchema,
  type SiteVerification,
  type VerificationSummary,
} from '@flow-checker/shared'
import { ServerActionResolver } from './actions'
import { fingerprint, Matcher } from './matcher'
import { SourceMapper } from './stack'
import type { CaptureStore } from './store'

export interface VerifierOptions {
  /** Project root (for source maps, the action manifest and overrides.json). */
  root: string
  model: AppModel
  store: CaptureStore
}

export class Verifier {
  private model: AppModel
  private matcher: Matcher
  private readonly store: CaptureStore
  private readonly mapper: SourceMapper
  private readonly actions: ServerActionResolver
  private readonly overridesFile: string
  private overrides: Overrides
  private served: AppModel | undefined
  private readonly listeners = new Set<() => void>()

  constructor(options: VerifierOptions) {
    this.model = options.model
    this.matcher = new Matcher(options.model)
    this.store = options.store
    this.mapper = new SourceMapper(options.root)
    this.actions = new ServerActionResolver(options.root)
    this.overridesFile = join(options.root, '.flow-checker', 'overrides.json')
    this.overrides = readOverrides(this.overridesFile)
    // Captures from earlier runs: match them against the current scan.
    this.rematch(this.store.all())
  }

  /** A new scan result. Every capture is matched again (site ids are stable across scans). */
  setModel(model: AppModel): void {
    this.model = model
    this.matcher = new Matcher(model)
    this.rematch(this.store.all(), true)
  }

  /** Matches and stores new captures from the runtime. */
  ingest(captures: Capture[]): void {
    for (const incoming of captures) {
      // The runtime must not decide these.
      const { match: _, sourceStack: __, ...rest } = incoming
      const capture: Capture = { ...rest }
      const frames = this.mapper.resolve(capture.stack)
      if (frames.length > 0) capture.sourceStack = frames
      capture.match = this.matchOne(capture)
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
    const matches = this.overrides.matches.filter((m) => m.fingerprint !== print)
    if (siteId !== undefined) matches.push({ fingerprint: print, siteId, at: new Date().toISOString() })
    this.overrides = { ...this.overrides, matches }
    writeOverrides(this.overridesFile, this.overrides)
    this.rematch(this.store.all().filter((c) => fingerprint(c) === print))
    return this.store.get(captureId)
  }

  /** Deletes every capture (and session). Manual decisions in overrides.json stay. */
  clear(): void {
    this.store.clear()
    this.changed()
  }

  /** The model with each site's status from its matched captures. */
  servedModel(): AppModel {
    if (this.served) return this.served
    const sites = this.siteVerification()
    this.served = {
      ...this.model,
      requests: this.model.requests.map((site) =>
        site.status === 'inferred' && sites[site.id] ? { ...site, status: 'verified' } : site,
      ),
    }
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
    }
    return sites
  }

  private matchOne(capture: Capture): CaptureMatch {
    const print = fingerprint(capture)
    const decision = this.overrides.matches.find((m) => m.fingerprint === print)
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
      const match = this.matchOne(capture)
      if (JSON.stringify(match) === JSON.stringify(capture.match)) continue
      this.store.add({ ...capture, match })
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

function readOverrides(file: string): Overrides {
  try {
    const parsed = OverridesSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
    if (parsed.success) return parsed.data
  } catch {}
  return { version: 1, matches: [] }
}

function writeOverrides(file: string, overrides: Overrides) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(overrides, null, 2)}\n`)
}
