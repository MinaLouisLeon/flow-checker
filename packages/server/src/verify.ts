// Runs the matcher on captures as they arrive and after each re-scan, keeps your manual
// decisions in `.flow-checker/overrides.json`, compares matched captures with the site's
// declared types (M8), and derives each request site's status. Captures taken before a site's
// code last changed are stale, and a site with only stale captures needs a re-check (M9).

import { splitTrpcCapture } from '@flow-checker/runtime/trpc'
import {
  type AppModel,
  applyVerification,
  type Capture,
  type CaptureMatch,
  type CaptureSummary,
  checkCapture,
  pairRenamedSites,
  type RequestSite,
  type SiteVerification,
  summarizeCapture,
  summarizeTypeChecks,
  type TypeCheck,
  type TypeTable,
  typeTable,
  type VerificationSummary,
} from '@flow-checker/shared'
import { type ServerActionInfo, ServerActionResolver } from './actions'
import { BEGINNING, CodeHistory } from './history'
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
  /** Don't save the code history (export). Pair it with a read-only store. */
  readOnly?: boolean
  /** Server action id → action. Default: Next's manifest in `root`. */
  resolveAction?: (id: string) => ServerActionInfo | undefined
}

export class Verifier {
  private model: AppModel
  private matcher: Matcher
  private sites: Map<string, RequestSite>
  private types: TypeTable
  private readonly store: CaptureStore
  private readonly mapper: SourceMapper
  private readonly resolveAction: (id: string) => ServerActionInfo | undefined
  readonly overrides: OverridesFile
  private readonly history: CodeHistory
  /** During a re-scan: old site id -> new id, for sites whose lines moved. */
  private renamed: Record<string, string> = {}
  private served: AppModel | undefined
  private readonly listeners = new Set<() => void>()

  constructor(options: VerifierOptions) {
    this.model = options.model
    this.matcher = new Matcher(options.model)
    this.sites = new Map(options.model.requests.map((s) => [s.id, s]))
    this.types = typeTable(options.model.types)
    this.store = options.store
    this.mapper = new SourceMapper(options.root)
    const actions = new ServerActionResolver(options.root)
    this.resolveAction = options.resolveAction ?? ((id) => actions.resolve(id))
    this.overrides = options.overrides ?? new OverridesFile(options.root)
    this.history = new CodeHistory(options.root, { persist: !options.readOnly })
    this.history.update(options.model)
    // Captures from earlier runs: match them against the current scan.
    this.rematch(this.store.all())
  }

  /**
   * A new scan result. Every capture is matched again. Site ids include line numbers, so a site
   * whose lines moved gets a new id: its captures and manual matches move with it. `changedAt`:
   * when the files changed, so captures taken while the re-scan ran count as the new code's.
   */
  setModel(model: AppModel, changedAt?: Date): void {
    const renamed = pairRenamedSites(this.model.requests, model.requests)
    if (this.overrides.get().matches.some((m) => m.siteId && renamed[m.siteId])) {
      this.overrides.update((current) => ({
        ...current,
        matches: current.matches.map((m) => {
          const to = m.siteId ? renamed[m.siteId] : undefined
          return to ? { ...m, siteId: to } : m
        }),
      }))
    }
    this.history.update(model, changedAt)
    this.model = model
    this.matcher = new Matcher(model)
    this.sites = new Map(model.requests.map((s) => [s.id, s]))
    this.types = typeTable(model.types)
    this.renamed = renamed
    try {
      this.rematch(this.store.all(), true)
    } finally {
      this.renamed = {}
    }
  }

  /** Taken before the code of the site it matched last changed. */
  isStale(capture: Capture): boolean {
    const match = capture.match
    if (match?.status !== 'matched' || !match.siteId) return false
    const since = this.history.since(this.sites.get(match.siteId)?.hash)
    return since !== undefined && since !== BEGINNING && Date.parse(capture.timestamp) < Date.parse(since)
  }

  /** A capture for lists, with `stale` set. */
  summarize(capture: Capture): CaptureSummary {
    const summary = summarizeCapture(capture)
    return this.isStale(capture) ? { ...summary, stale: true } : summary
  }

  /** One capture per tRPC procedure (M16), using the scanned endpoint. Others come back as they are. */
  splitTrpc(capture: Capture): Capture[] {
    return splitTrpcCapture(capture, this.model.trpc ? [this.model.trpc.endpoint] : [])
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
      // Server hops that arrived first can now use this capture's match. Hops of a split tRPC
      // batch point to the whole request's id.
      if (capture.origin === 'browser') {
        const batch = capture.procedure?.batch?.id
        this.rematch([...this.store.children(capture.id), ...(batch ? this.store.children(batch) : [])])
      }
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
    const checks = new Map<string, { captureId: string; check: TypeCheck; stale: boolean }[]>()
    for (const capture of this.store.all()) {
      const match = capture.match
      if (match?.status !== 'matched' || !match.siteId) continue
      const entry = sites[match.siteId] ?? { captures: 0 }
      sites[match.siteId] = entry
      entry.captures++
      const stale = this.isStale(capture)
      if (stale) entry.stale = (entry.stale ?? 0) + 1
      if (!entry.lastAt || capture.timestamp >= entry.lastAt) {
        entry.lastAt = capture.timestamp
        entry.lastCaptureId = capture.id
      }
      if (capture.typeCheck?.siteId === match.siteId) {
        const list = checks.get(match.siteId) ?? []
        checks.set(match.siteId, list)
        list.push({ captureId: capture.id, check: capture.typeCheck, stale })
      }
    }
    for (const [siteId, entry] of Object.entries(sites)) {
      const since = this.history.since(this.sites.get(siteId)?.hash)
      if (since && since !== BEGINNING) entry.changedAt = since
    }
    for (const [siteId, list] of checks) {
      const entry = sites[siteId]
      // Captures of the current code decide. Stale ones count only while there are no others.
      const fresh = list.filter((c) => !c.stale)
      const typeCheck = summarizeTypeChecks(fresh.length > 0 ? fresh : list)
      if (entry && typeCheck) entry.typeCheck = typeCheck
    }
    return sites
  }

  /** The capture with its match and, when matched, the type comparison against that site. */
  private evaluate(incoming: Capture): Capture {
    const capture = this.namePersisted(incoming)
    const { typeCheck: _, ...rest } = capture
    const match = this.matchOne(capture)
    const site = match.status === 'matched' && match.siteId ? this.sites.get(match.siteId) : undefined
    const typeCheck = site ? checkCapture(capture, site, this.types) : undefined
    return typeCheck ? { ...rest, match, typeCheck } : { ...rest, match }
  }

  /** A GraphQL query sent by persisted id only: the operation that id belongs to (M17). */
  private namePersisted(capture: Capture): Capture {
    const op = capture.operation
    const hash = op?.hash
    if (!op || !hash || op.name) return capture
    const found = this.model.graphql?.operations.find((o) => o.hashes.includes(hash))
    return found ? { ...capture, operation: { ...op, name: found.name, type: found.type } } : capture
  }

  private matchOne(capture: Capture): CaptureMatch {
    // The site's lines moved: keep the match instead of scoring again with outdated line numbers.
    const previous = capture.match
    const movedTo = previous?.siteId ? this.renamed[previous.siteId] : undefined
    if (previous?.status === 'matched' && previous.by === 'auto' && movedTo) {
      return {
        ...previous,
        siteId: movedTo,
        candidates: previous.candidates.map((c) => ({ ...c, siteId: this.renamed[c.siteId] ?? c.siteId })),
      }
    }
    const print = fingerprint(capture)
    const decision = this.overrides.get().matches.find((m) => m.fingerprint === print)
    const parentId = capture.origin === 'server' ? capture.parent?.captureId : undefined
    const context = {
      frames: capture.sourceStack ?? [],
      resolveAction: this.resolveAction,
      override: decision ? decision.siteId : undefined,
    }
    const parent = parentId ? this.store.get(parentId) : undefined
    // A split tRPC batch: the hop's parent is one of its pieces.
    const parents = parent ? [parent] : parentId ? this.batchPieces(parentId) : []
    return this.matcher.matchWithParents(
      capture,
      context,
      parents.map((p) => p.match),
    )
  }

  /**
   * Server hops made for a browser capture. For a piece of a tRPC batch, the hops of the whole
   * request that matched a site its own site leads to.
   */
  children(capture: Capture): Capture[] {
    const direct = this.store.children(capture.id)
    const batch = capture.procedure?.batch?.id
    if (!batch) return direct
    const siteId = capture.match?.status === 'matched' ? capture.match.siteId : undefined
    const chain = new Set((siteId && this.sites.get(siteId)?.chain) || [])
    const hops = this.store.children(batch).filter((c) => !!c.match?.siteId && chain.has(c.match.siteId))
    return [...direct, ...hops]
  }

  /** The captures a batched tRPC request was split into, by the whole request's id. */
  private batchPieces(batchId: string): Capture[] {
    return this.store.all().filter((c) => c.procedure?.batch?.id === batchId)
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
        const batch = capture.procedure?.batch?.id
        const children = [...this.store.children(capture.id), ...(batch ? this.store.children(batch) : [])]
        for (const hop of children) if (!listed.has(hop.id) && !hops.includes(hop)) hops.push(hop)
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
