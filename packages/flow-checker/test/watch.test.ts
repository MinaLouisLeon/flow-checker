// M9 "done when": editing a fixture file updates the dashboard in under a second, and the request
// sites whose code changed go to `needs-recheck`. Uses the basic fixture's recorded captures.
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ENV, type RuntimeConfig } from '@flow-checker/runtime/options'
import type { AppModel, Capture, CaptureSummary, RequestSite, ScanEvent } from '@flow-checker/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type DevSession, startDev } from '../src/cli/dev'
import type { CliIO } from '../src/cli/run'

const repo = join(import.meta.dirname, '..', '..', '..')
const fixture = join(repo, 'fixtures', 'basic')
const recording = JSON.parse(
  readFileSync(join(repo, 'packages', 'server', 'test', 'recordings', 'basic.json'), 'utf8'),
) as { captures: Capture[] }

let root: string
let server: DevSession
let live: LiveFeed
const logs: string[] = []

/** Server-sent events from `/api/live`, read as they arrive. */
class LiveFeed {
  #events: { event: string; data: unknown }[] = []
  #waiters: (() => void)[] = []
  #abort = new AbortController()

  constructor(url: string) {
    void this.#read(url)
  }

  async #read(url: string) {
    try {
      const res = await fetch(url, { signal: this.#abort.signal })
      const reader = res.body?.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      while (reader) {
        const { value, done } = await reader.read()
        if (done) return
        buffer += value
        for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
          const block = buffer.slice(0, end)
          buffer = buffer.slice(end + 2)
          const event = /^event: (.*)$/m.exec(block)?.[1] ?? 'message'
          const data = /^data: (.*)$/m.exec(block)?.[1] ?? 'null'
          this.#events.push({ event, data: JSON.parse(data) })
          for (const wake of this.#waiters.splice(0)) wake()
        }
      }
    } catch {
      // Aborted on close.
    }
  }

  /** The next event with this name, dropping the ones before it. */
  async next<T>(name: string, timeoutMs: number): Promise<T> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const at = this.#events.findIndex((e) => e.event === name)
      if (at >= 0) {
        const [found] = this.#events.splice(0, at + 1).slice(-1)
        return found?.data as T
      }
      const left = deadline - Date.now()
      if (left <= 0) throw new Error(`No "${name}" event within ${timeoutMs} ms`)
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, left)
        this.#waiters.push(() => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
  }

  close() {
    this.#abort.abort()
  }
}

const file = (rel: string) => join(root, rel)
const read = (rel: string) => readFileSync(file(rel), 'utf8')
const write = (rel: string, text: string) => writeFileSync(file(rel), text)

async function get<T>(path: string): Promise<T> {
  return (await (await fetch(`${server.url}${path}`)).json()) as T
}

function site(model: AppModel, path: string): RequestSite {
  const found = model.requests.find((s) => s.callStack.map((f) => f.callee).join(' > ') === path)
  if (!found) throw new Error(`No site ${path}`)
  return found
}

const statuses = (model: AppModel) =>
  Object.fromEntries(model.requests.map((s) => [s.callStack.map((f) => f.callee).join(' > '), s.status]))

describe('watch + incremental re-scan', () => {
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'flow-checker-watch-'))
    cpSync(fixture, root, {
      recursive: true,
      filter: (src) => !/[\\/](node_modules|\.next|\.flow-checker)([\\/]|$)/.test(src),
    })
    symlinkSync(join(fixture, 'node_modules'), join(root, 'node_modules'), 'junction')
    // Captures from an earlier run: matched on start.
    const unmatched = join(root, '.flow-checker', 'captures', '_unmatched')
    mkdirSync(unmatched, { recursive: true })
    for (const capture of recording.captures) {
      writeFileSync(join(unmatched, `${capture.id}.json`), JSON.stringify(capture))
    }

    const io: CliIO = { out: (t) => logs.push(t), err: (t) => logs.push(t) }
    const started = await startDev({ root, port: 0, open: false }, io)
    if (typeof started === 'number') throw new Error(`startDev failed: ${logs.join('\n')}`)
    server = started
    live = new LiveFeed(`${server.url}/api/live`)
    await live.next('ready', 5000)
  })

  afterAll(async () => {
    live?.close()
    await server?.close()
    unlinkSync(join(root, 'node_modules'))
    rmSync(root, { recursive: true, force: true })
  })

  it('starts with the recorded captures verifying their sites', async () => {
    const model = await get<AppModel>('/api/model')
    expect(statuses(model)).toEqual({
      'getUsers > fetch': 'verified',
      'getUser > fetch': 'verified',
      'deleteUser > api.delete': 'verified',
      'getTodos > fetch': 'verified',
    })
    expect(logs.join('\n')).toContain('Watching for file changes.')
  })

  it('keeps captures with code that only moved', async () => {
    const before = await get<AppModel>('/api/model')
    write('lib/api.ts', `// Moves every line down.\n\n${read('lib/api.ts')}`)
    const event = await live.next<ScanEvent>('scan', 5000)
    expect(event.files).toEqual(['lib/api.ts'])
    expect(event.needsRecheck).toEqual([])
    expect(event.changedCode).toEqual([])

    const model = await get<AppModel>('/api/model')
    expect(site(model, 'getUsers > fetch').id).not.toBe(site(before, 'getUsers > fetch').id)
    expect(Object.values(statuses(model))).toEqual(['verified', 'verified', 'verified', 'verified'])
  })

  it('marks a site whose code changed as needs-recheck in under a second', async () => {
    const before = await get<AppModel>('/api/model')
    const edited = read('lib/api.ts').replace(
      "{ cache: 'no-store' })\n  if (!res.ok) throw new Error('Failed to load users')",
      "{ cache: 'no-store', headers: { accept: 'application/json' } })\n  if (!res.ok) throw new Error('Failed to load users')",
    )
    expect(edited).not.toBe(read('lib/api.ts'))

    const started = performance.now()
    write('lib/api.ts', edited)
    const event = await live.next<ScanEvent>('scan', 1000)
    const model = await get<AppModel>('/api/model')
    const elapsed = performance.now() - started
    expect(elapsed).toBeLessThan(1000)

    const users = site(model, 'getUsers > fetch')
    expect(event.needsRecheck).toEqual([users.id])
    expect(event.changedCode).toEqual([users.id])
    expect(statuses(model)).toEqual({
      'getUsers > fetch': 'needs-recheck',
      'getUser > fetch': 'verified',
      'deleteUser > api.delete': 'verified',
      'getTodos > fetch': 'verified',
    })
    expect(users.flags.map((f) => f.kind)).toContain('stale')
    expect(users.id).toBe(site(before, 'getUsers > fetch').id)

    const captures = await get<CaptureSummary[]>(`/api/sites/${users.id}/captures`)
    expect(captures.length).toBeGreaterThan(0)
    expect(captures.every((c) => c.stale)).toBe(true)
    // Written for `flow-checker scan` users and the next start.
    const onDisk = JSON.parse(read('.flow-checker/model.json')) as AppModel
    expect(site(onDisk, 'getUsers > fetch').hash).toBe(users.hash)
  })

  it('verifies the site again with a new capture', async () => {
    const model = await get<AppModel>('/api/model')
    const users = site(model, 'getUsers > fetch')
    const [old] = await get<CaptureSummary[]>(`/api/sites/${users.id}/captures`)
    const original = recording.captures.find((c) => c.id === old?.id)
    if (!original) throw new Error('recorded capture not found')

    const config = JSON.parse(server.appEnv[ENV.server] ?? '{}') as RuntimeConfig
    const fresh: Capture = { ...original, id: `${original.id}x`, timestamp: new Date().toISOString() }
    const res = await fetch(server.ingestUrl, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ token: config.token, captures: [fresh], events: [] }),
    })
    expect(res.status).toBe(204)
    await live.next('verification', 2000)

    const after = await get<AppModel>('/api/model')
    expect(site(after, 'getUsers > fetch').status).toBe('verified')
    const captures = await get<CaptureSummary[]>(`/api/sites/${users.id}/captures`)
    expect(captures.find((c) => c.id === fresh.id)?.stale).toBeUndefined()
  })

  it('remembers changes made while the tool was off', async () => {
    await server.close()
    live.close()
    write('lib/api.ts', read('lib/api.ts').replace('/todos?userId=', '/todos?owner='))
    const io: CliIO = { out: (t) => logs.push(t), err: (t) => logs.push(t) }
    const started = await startDev({ root, port: 0, open: false, watch: false }, io)
    if (typeof started === 'number') throw new Error(`startDev failed: ${logs.join('\n')}`)
    server = started
    live = new LiveFeed(`${server.url}/api/live`)

    const model = await get<AppModel>('/api/model')
    expect(site(model, 'getTodos > fetch').status).toBe('needs-recheck')
    expect(site(model, 'getUser > fetch').status).toBe('verified')
  })
})
