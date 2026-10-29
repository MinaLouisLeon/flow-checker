// When each request site's current code was first seen (M9, docs/PLAN.md 6.7). Captures taken
// before that are stale: they ran older code. Kept in `.flow-checker/cache/code-hashes.json`, so
// code edited while the tool was off is noticed on the next start.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AppModel } from '@flow-checker/shared'

/** Hashes known before the tool kept a history: their captures count as current. */
export const BEGINNING = new Date(0).toISOString()

interface HistoryData {
  version: 1
  /** Code hash -> ISO time it was first seen. */
  hashes: Record<string, string>
}

export class CodeHistory {
  readonly file: string
  #hashes: Map<string, string>
  /** No history file yet: the first scan sets the baseline. */
  #first: boolean
  readonly #persist: boolean

  /** `persist: false` keeps the history in memory only (export). */
  constructor(root: string, options: { persist?: boolean } = {}) {
    this.file = join(root, '.flow-checker', 'cache', 'code-hashes.json')
    this.#persist = options.persist ?? true
    const data = read(this.file)
    this.#first = !data
    this.#hashes = new Map(Object.entries(data?.hashes ?? {}))
  }

  /**
   * Records the code hashes of a scan. New hashes date from `now`, except on the very first
   * scan, which has nothing to compare with. Hashes no longer in the code are forgotten.
   * Returns the hashes that are new.
   */
  update(model: AppModel, now = new Date()): Set<string> {
    const at = this.#first ? BEGINNING : now.toISOString()
    const current = new Set(model.requests.flatMap((s) => (s.hash ? [s.hash] : [])))
    const added = new Set<string>()
    const next = new Map<string, string>()
    for (const hash of current) {
      const since = this.#hashes.get(hash)
      if (since === undefined) added.add(hash)
      next.set(hash, since ?? at)
    }
    const changed = added.size > 0 || next.size !== this.#hashes.size || this.#first
    this.#hashes = next
    this.#first = false
    if (changed && this.#persist) this.save()
    return added
  }

  /** ISO time the code with this hash was first seen. */
  since(hash: string | undefined): string | undefined {
    return hash === undefined ? undefined : this.#hashes.get(hash)
  }

  private save() {
    const data: HistoryData = { version: 1, hashes: Object.fromEntries(this.#hashes) }
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      writeFileSync(this.file, `${JSON.stringify(data, null, 2)}\n`)
    } catch {
      // Read-only project: the history then only lives for this run.
    }
  }
}

function read(file: string): HistoryData | undefined {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as HistoryData
    if (data?.version === 1 && data.hashes && typeof data.hashes === 'object') return data
  } catch {}
  return undefined
}
