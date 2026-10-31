// tRPC batches at ingest (M16): a batch the runtime didn't split is split by the tool server, and
// server hops that ran inside the batch find the piece they belong to, whichever arrives first.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import type { AppModel, Capture } from '@flow-checker/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CaptureStore, Verifier } from '../src'

const repo = join(import.meta.dirname, '..', '..', '..')
const roots: string[] = []
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

let model: AppModel
let recorded: Capture[]

beforeAll(() => {
  model = scanProject({ root: join(repo, 'fixtures', 'trpc-v10') })
  recorded = JSON.parse(
    readFileSync(join(import.meta.dirname, 'recordings', 'trpc-v10.json'), 'utf8'),
  ).captures
}, 60_000)

/** The recorded home page batch, joined back into the single request the browser sent. */
function homeBatch(): { whole: Capture; hops: Capture[] } {
  const pieces = recorded.filter((c) => c.procedure?.batch)
  const first = pieces[0] as Capture
  const batchId = first.procedure?.batch?.id as string
  const url = new URL(first.request.url)
  url.pathname = `/api/trpc/${pieces.map((p) => p.procedure?.path).join(',')}`
  url.search = `?batch=1&input=${encodeURIComponent('{}')}`
  const { procedure: _, ...rest } = first
  const whole: Capture = {
    ...rest,
    id: batchId,
    request: { ...first.request, url: url.href },
    response: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        kind: 'json',
        value: pieces.map((p) => ({
          result: { data: p.response?.body.kind === 'json' ? p.response.body.value : null },
        })),
      },
    },
  }
  const hops = recorded.filter((c) => c.parent?.captureId === batchId)
  return { whole, hops }
}

function verifier() {
  const root = mkdtempSync(join(tmpdir(), 'fc-trpc-'))
  roots.push(root)
  const store = new CaptureStore({ root })
  return { store, verifier: new Verifier({ root, model, store, resolveAction: () => undefined }) }
}

describe('tRPC batches at ingest', () => {
  it('splits an unsplit batch and matches hops that arrived first to their piece', () => {
    const { whole, hops } = homeBatch()
    expect(hops.length).toBe(2)
    const { store, verifier: v } = verifier()
    // Hops first: their parent isn't there yet.
    v.ingest(hops)
    v.ingest(v.splitTrpc(whole))

    const pieces = store.all().filter((c) => c.procedure?.batch?.id === whole.id)
    expect(pieces.map((p) => p.procedure?.path)).toEqual(['ping', 'todo.list', 'user.list'])
    expect(pieces.every((p) => p.match?.status === 'matched')).toBe(true)

    const site = (id: string | undefined) => model.requests.find((s) => s.id === id)
    for (const hop of hops) {
      const match = store.get(hop.id)?.match
      expect(match?.status).toBe('matched')
      expect(match?.candidates[0]?.evidence.map((e) => e.signal)).toContain('parent')
    }
    // Each piece lists only the hops its own procedure made.
    const children = pieces.map((p) => v.children(p).map((c) => site(c.match?.siteId)?.procedure?.path))
    expect(children).toEqual([[], ['todo.list'], ['user.list']])
  })
})
