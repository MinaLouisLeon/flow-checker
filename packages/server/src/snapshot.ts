// Collects everything an export needs (M10, docs/PLAN.md 10) into one `ExportData` snapshot:
// the scan with live results applied, verification and flow results, and the captures.
// Captures are redacted again (unless `raw`), and absolute project paths in them are made
// relative, so an export can be shared.
import { basename, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { type RuntimeCaptureOptions, resolveCaptureOptions } from '@flow-checker/runtime/options'
import { compileRules, redactCapture } from '@flow-checker/runtime/redact'
import {
  type AppModel,
  type Capture,
  EXPORT_VERSION,
  type ExportCapture,
  type ExportData,
} from '@flow-checker/shared'
import type { ServerActionInfo } from './actions'
import { FlowTracker } from './flows'
import { OverridesFile } from './overrides'
import { CaptureStore } from './store'
import { Verifier } from './verify'

/** Newest captures kept per request site. */
export const EXPORT_CAPTURES_PER_SITE = 10
/** Newest unmatched or ambiguous captures kept. */
export const EXPORT_UNMATCHED_CAPTURES = 100

export interface SnapshotOptions {
  /** Absolute project root. */
  root: string
  /** flow-checker version, shown in the export. */
  toolVersion?: string
  /** Capture settings from the config: the redaction rules. */
  capture?: RuntimeCaptureOptions
  /** Keep captures as stored, without redacting them again. */
  raw?: boolean
  /** Export time. Default: now. */
  now?: Date
}

export interface LiveSnapshotOptions extends SnapshotOptions {
  store: CaptureStore
  verifier: Verifier
  flows: FlowTracker
}

/** A snapshot of a running tool server. */
export function buildSnapshot(options: LiveSnapshotOptions): ExportData {
  const { store, verifier, flows } = options
  const model = flows.withNames(verifier.servedModel())
  const all = store.all()
  const flowSummary = flows.summary()
  const hasCaptures = all.length > 0
  const captures = pickCaptures(all, verifier)
  const capture = options.capture ?? resolveCaptureOptions(undefined)
  const rules = compileRules(capture.redact)
  const raw = options.raw ?? false
  const exported: ExportCapture[] = captures.map((c) => {
    const redacted = raw ? c : redactCapture(c, rules, false)
    const out: ExportCapture = relativeCapture(redacted, options.root)
    return verifier.isStale(c) ? { ...out, stale: true } : out
  })
  const { recording: _, ...flowResults } = flowSummary
  return {
    version: EXPORT_VERSION,
    generatedAt: (options.now ?? new Date()).toISOString(),
    ...(options.toolVersion ? { toolVersion: options.toolVersion } : {}),
    projectName: basename(options.root),
    model,
    ...(hasCaptures ? { verification: verifier.summary() } : {}),
    ...(hasCaptures || flowSummary.recorded.length > 0 ? { flows: flowResults } : {}),
    captures: exported,
    captureCounts: { total: all.length, included: exported.length },
    redacted: exported.every((c) => c.redacted),
  }
}

export interface OfflineSnapshotOptions extends SnapshotOptions {
  /** A fresh scan of the project. */
  model: AppModel
  /** Captures to use instead of the ones saved in `.flow-checker/` (tests). */
  captures?: Capture[]
  /** Server action id → action. Default: Next's manifest in the project. */
  resolveAction?: (id: string) => ServerActionInfo | undefined
}

/**
 * A snapshot without a running tool server: reads the captures, sessions and your decisions
 * saved in `.flow-checker/` and matches them against the scan, like `flow-checker dev` would.
 * Nothing in `.flow-checker/` is changed.
 */
export function collectSnapshot(options: OfflineSnapshotOptions): ExportData {
  const store = new CaptureStore({ root: options.root, readOnly: true })
  if (options.captures) for (const c of options.captures) store.add(c)
  else store.load()
  const overrides = new OverridesFile(options.root)
  const verifier = new Verifier({
    root: options.root,
    model: options.model,
    store,
    overrides,
    readOnly: true,
    ...(options.resolveAction ? { resolveAction: options.resolveAction } : {}),
  })
  const flows = new FlowTracker({ model: options.model, store, overrides })
  return buildSnapshot({ ...options, store, verifier, flows })
}

/**
 * The newest captures per site, the newest unmatched ones, and every capture the verification
 * points at (latest capture, type mismatch examples). Oldest first.
 */
function pickCaptures(all: readonly Capture[], verifier: Verifier): Capture[] {
  const keep = new Set<string>()
  const perSite = new Map<string, number>()
  let unmatched = 0
  for (let i = all.length - 1; i >= 0; i--) {
    const c = all[i]
    if (!c) continue
    const siteId = c.match?.status === 'matched' ? c.match.siteId : undefined
    if (siteId) {
      const n = perSite.get(siteId) ?? 0
      if (n >= EXPORT_CAPTURES_PER_SITE) continue
      perSite.set(siteId, n + 1)
      keep.add(c.id)
    } else if (unmatched < EXPORT_UNMATCHED_CAPTURES) {
      unmatched++
      keep.add(c.id)
    }
  }
  if (all.length > 0) {
    for (const site of Object.values(verifier.summary().sites)) {
      if (site.lastCaptureId) keep.add(site.lastCaptureId)
      for (const m of site.typeCheck?.mismatches ?? []) keep.add(m.captureId)
    }
  }
  return all.filter((c) => keep.has(c.id))
}

/** Replaces the absolute project root in stack frames and errors, so no local path is exported. */
function relativeCapture(capture: Capture, root: string): Capture {
  const prefixes = rootPrefixes(root)
  const strip = (text: string) => prefixes.reduce((out, prefix) => out.split(prefix).join(''), text)
  return {
    ...capture,
    stack: capture.stack.map(strip),
    ...(capture.error ? { error: strip(capture.error) } : {}),
  }
}

function rootPrefixes(root: string): string[] {
  const trimmed = root.replace(/[\\/]+$/, '')
  const forward = trimmed.replaceAll('\\', '/')
  const url = pathToFileURL(trimmed).href
  const set = new Set([`${url}/`, `${trimmed}${sep}`, `${forward}/`, `${trimmed.replaceAll('/', '\\')}\\`])
  // Longest first, so the file URL goes before the plain path inside it.
  return [...set].sort((a, b) => b.length - a.length)
}
