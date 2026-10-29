// What an export contains (M10, docs/PLAN.md 10). The tool server's data is collected once into
// this snapshot. The Markdown renderer reads it, and the static HTML site embeds it as
// `window.__FLOW_CHECKER__` so the dashboard runs without a server.
import type { Capture } from './capture'
import type { FlowsSummary } from './flow-runs'
import type { VerificationSummary } from './match'
import type { AppModel } from './model'

export const EXPORT_VERSION = 1

/** A capture as exported: redacted (unless `--raw`) and with project paths made relative. */
export type ExportCapture = Capture & {
  /** Taken before the matched site's code last changed (M9). */
  stale?: boolean
}

export interface ExportData {
  version: typeof EXPORT_VERSION
  /** ISO time of the export. */
  generatedAt: string
  /** flow-checker version that made it. */
  toolVersion?: string
  /** Project folder name, used as the title. */
  projectName: string
  /**
   * The scan with live results applied: request statuses, type-mismatch and stale flags, flow
   * names you gave in the dashboard.
   */
  model: AppModel
  /** Present when captures were found. */
  verification?: VerificationSummary
  /** Present when captures were found. */
  flows?: FlowsSummary
  /** Captures, oldest first. The newest ones per site, see `captureCounts`. */
  captures: ExportCapture[]
  /** Captures before trimming (`total`) and how many are included (`included`). */
  captureCounts: { total: number; included: number }
  /** Sensitive values in captures are masked. False only with `--raw` and `capture.storeRaw`. */
  redacted: boolean
}
