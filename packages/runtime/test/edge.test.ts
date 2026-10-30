// M14: the edge runtime (middleware before Next.js 16) captures fetch calls with web APIs only.
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Capture, IngestBatch } from '@flow-checker/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type EdgeRuntime, registerEdgeRuntime } from '../src/edge'
import { resolveCaptureOptions } from '../src/options'
import { REDACTED_STRING } from '../src/redact'

const servers: Server[] = []
const received: Capture[] = []
let backendUrl = ''
let ingestUrl = ''
let runtime: EdgeRuntime | undefined

function listen(server: Server): Promise<string> {
  servers.push(server)
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
    ),
  )
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

beforeAll(async () => {
  ingestUrl = await listen(
    createServer(async (req, res) => {
      const batch = JSON.parse(await readBody(req)) as IngestBatch
      expect(batch.token).toBe('secret')
      received.push(...batch.captures)
      res.writeHead(204).end()
    }),
  )
  backendUrl = await listen(
    createServer(async (req, res) => {
      await readBody(req)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id: 1, name: 'Ada', token: 'session-token' }))
    }),
  )
  process.env.FLOW_CHECKER = '1'
  process.env.FLOW_CHECKER_RUNTIME = JSON.stringify({
    ingest: `${ingestUrl}/ingest`,
    token: 'secret',
    capture: resolveCaptureOptions(),
  })
  runtime = registerEdgeRuntime(process.env.FLOW_CHECKER_RUNTIME)
})

afterAll(async () => {
  delete process.env.FLOW_CHECKER
  delete process.env.FLOW_CHECKER_RUNTIME
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))))
})

async function waitFor<T>(find: () => T | undefined): Promise<T> {
  for (let i = 0; i < 100; i++) {
    await runtime?.flush()
    const found = find()
    if (found) return found
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error('capture never arrived')
}

describe('edge runtime', () => {
  it('registers once', () => {
    expect(runtime).toBeDefined()
    expect(registerEdgeRuntime(process.env.FLOW_CHECKER_RUNTIME)).toBe(runtime)
  })

  it('captures fetch calls, redacted, with the response body', async () => {
    const res = await fetch(`${backendUrl}/me`, { headers: { authorization: 'Bearer abc.def.ghi' } })
    expect(await res.json()).toMatchObject({ name: 'Ada' })
    const capture = await waitFor(() => received.find((c) => c.request.url.endsWith('/me')))
    expect(capture).toMatchObject({ origin: 'server', transport: 'fetch', sessionId: 'server' })
    expect(capture.request.method).toBe('GET')
    expect(capture.request.headers.authorization).toBe(REDACTED_STRING)
    expect(capture.response?.status).toBe(200)
    expect(capture.response?.body).toMatchObject({ kind: 'json', value: { token: REDACTED_STRING } })
    expect(capture.redacted).toBe(true)
  })

  it('records request bodies and does not capture its own ingest calls', async () => {
    await fetch(`${backendUrl}/flags`, { method: 'POST', body: JSON.stringify({ path: '/dashboard' }) })
    const capture = await waitFor(() => received.find((c) => c.request.url.endsWith('/flags')))
    expect(capture.request.method).toBe('POST')
    expect(capture.request.body).toMatchObject({ kind: 'json', value: { path: '/dashboard' } })
    expect(received.some((c) => c.request.url.includes('/ingest'))).toBe(false)
  })

  it('does nothing without FLOW_CHECKER=1', () => {
    const enabled = process.env.FLOW_CHECKER
    process.env.FLOW_CHECKER = '0'
    try {
      const g = globalThis as Record<symbol, unknown>
      const installed = Symbol.for('flow-checker.edge')
      const saved = g[installed]
      delete g[installed]
      expect(registerEdgeRuntime(process.env.FLOW_CHECKER_RUNTIME)).toBeUndefined()
      g[installed] = saved
    } finally {
      process.env.FLOW_CHECKER = enabled
    }
  })
})
