// Captures and sessions on disk (docs/PLAN.md 13):
//   .flow-checker/captures/<siteId>/<captureId>.json   (`_unmatched` until M6 matches them)
//   .flow-checker/sessions/<sessionId>.json
// Everything is also kept in memory (newest `limit` captures) for the API.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type Capture,
  CaptureSchema,
  type CaptureSummary,
  type Session,
  type SessionEvent,
  SessionSchema,
  summarizeCapture,
} from '@flow-checker/shared'

export const UNMATCHED_DIR = '_unmatched'
const SESSION_WRITE_MS = 500

export type StoreListener = (capture: Capture) => void

export interface CaptureStoreOptions {
  /** Project root; files go to `<root>/.flow-checker`. */
  root: string
  /** Captures kept in memory. Default: 2000. */
  limit?: number
}

export class CaptureStore {
  readonly dir: string
  private readonly limit: number
  private captures: Capture[] = []
  private readonly byId = new Map<string, Capture>()
  private readonly sessions = new Map<string, Session>()
  private readonly dirtySessions = new Set<string>()
  private sessionTimer: ReturnType<typeof setTimeout> | undefined
  private readonly listeners = new Set<StoreListener>()

  constructor(options: CaptureStoreOptions) {
    this.dir = join(options.root, '.flow-checker')
    this.limit = options.limit ?? 2000
  }

  /** Reads captures and sessions saved by earlier runs. Unreadable files are skipped. */
  load(): this {
    const capturesDir = join(this.dir, 'captures')
    const loaded: Capture[] = []
    if (existsSync(capturesDir)) {
      for (const sub of readdirSync(capturesDir, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue
        for (const file of readdirSync(join(capturesDir, sub.name))) {
          if (!file.endsWith('.json')) continue
          const parsed = CaptureSchema.safeParse(readJson(join(capturesDir, sub.name, file)))
          if (parsed.success) loaded.push(parsed.data)
        }
      }
    }
    loaded.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    for (const capture of loaded.slice(-this.limit)) this.remember(capture)

    const sessionsDir = join(this.dir, 'sessions')
    if (existsSync(sessionsDir)) {
      for (const file of readdirSync(sessionsDir)) {
        if (!file.endsWith('.json')) continue
        const parsed = SessionSchema.safeParse(readJson(join(sessionsDir, file)))
        if (parsed.success) this.sessions.set(parsed.data.id, parsed.data)
      }
    }
    return this
  }

  add(capture: Capture): void {
    const folder = join(this.dir, 'captures', UNMATCHED_DIR)
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, `${safeName(capture.id)}.json`), `${JSON.stringify(capture, null, 2)}\n`)
    this.remember(capture)
    for (const listener of this.listeners) {
      try {
        listener(capture)
      } catch {}
    }
  }

  addEvents(sessionId: string, events: SessionEvent[]): void {
    if (events.length === 0) return
    const now = new Date().toISOString()
    let session = this.sessions.get(sessionId)
    if (!session) {
      session = { version: 1, id: sessionId, startedAt: events[0]?.at ?? now, updatedAt: now, events: [] }
      this.sessions.set(sessionId, session)
    }
    session.events.push(...events)
    session.updatedAt = now
    this.dirtySessions.add(sessionId)
    this.sessionTimer ??= setTimeout(() => this.writeSessions(), SESSION_WRITE_MS)
  }

  /** Newest first. */
  list(options: { limit?: number; sessionId?: string } = {}): CaptureSummary[] {
    const out: CaptureSummary[] = []
    for (let i = this.captures.length - 1; i >= 0 && out.length < (options.limit ?? 500); i--) {
      const capture = this.captures[i]
      if (!capture || (options.sessionId && capture.sessionId !== options.sessionId)) continue
      out.push(summarizeCapture(capture))
    }
    return out
  }

  get(id: string): Capture | undefined {
    return this.byId.get(id)
  }

  /** Captures the given browser capture led to on the server (BFF hops, action fetches). */
  children(id: string): CaptureSummary[] {
    return this.captures.filter((c) => c.parent?.captureId === id).map(summarizeCapture)
  }

  session(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  get size(): number {
    return this.captures.length
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Deletes every capture and session, in memory and on disk. */
  clear(): void {
    this.captures = []
    this.byId.clear()
    this.sessions.clear()
    this.dirtySessions.clear()
    rmSync(join(this.dir, 'captures'), { recursive: true, force: true })
    rmSync(join(this.dir, 'sessions'), { recursive: true, force: true })
  }

  /** Writes pending session changes. Call before exit. */
  writeSessions(): void {
    if (this.sessionTimer) clearTimeout(this.sessionTimer)
    this.sessionTimer = undefined
    if (this.dirtySessions.size === 0) return
    const folder = join(this.dir, 'sessions')
    mkdirSync(folder, { recursive: true })
    for (const id of this.dirtySessions) {
      const session = this.sessions.get(id)
      if (session)
        writeFileSync(join(folder, `${safeName(id)}.json`), `${JSON.stringify(session, null, 2)}\n`)
    }
    this.dirtySessions.clear()
  }

  private remember(capture: Capture) {
    const existing = this.byId.get(capture.id)
    if (existing) this.captures = this.captures.filter((c) => c !== existing)
    this.captures.push(capture)
    this.byId.set(capture.id, capture)
    while (this.captures.length > this.limit) {
      const dropped = this.captures.shift()
      if (dropped) this.byId.delete(dropped.id)
    }
  }
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

/** Ids come from the runtime: keep them to safe file names. */
export function safeName(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100) || '_'
}
