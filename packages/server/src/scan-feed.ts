// New scan results from outside the server (the file watcher, M9). The server applies each one
// and tells the dashboard over the live feed.
import type { AppModel } from '@flow-checker/shared'

export interface ScanUpdate {
  model: AppModel
  /** How long the scan took. */
  durationMs?: number
  /** Project-relative files that changed, for the dashboard notice. */
  files?: string[]
  /** When the files changed. New code dates from then (default: when the update is applied). */
  changedAt?: Date
}

export type ScanListener = (update: ScanUpdate) => void

export class ScanFeed {
  readonly #listeners = new Set<ScanListener>()

  publish(update: ScanUpdate): void {
    for (const listener of this.#listeners) {
      try {
        listener(update)
      } catch {}
    }
  }

  subscribe(listener: ScanListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
