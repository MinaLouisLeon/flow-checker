import { createServer, request as httpRequest, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Capture, IngestBatch } from '@flow-checker/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LINK_HEADER, resolveCaptureOptions } from '../src/options'
import { REDACTED_STRING } from '../src/redact'
import { registerServerRuntime, type ServerRuntime } from '../src/server'

const servers: Server[] = []
const received: Capture[] = []
let backendUrl = ''
let appUrl = ''
let runtime: ServerRuntime | undefined

function listen(server: Server): Promise<string> {
  servers.push(server)
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
    ),
  )
}

async function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

/** axios-style call through the http module, reading the response with 'data' listeners. */
function httpPost(url: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      url,
      { method: 'POST', headers: { 'content-type': 'application/json' } },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          text += chunk
        })
        res.on('end', () => resolve(text))
      },
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

beforeAll(async () => {
  const ingestUrl = await listen(
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
      res.end(JSON.stringify({ id: 7, token: 'issued-token' }))
    }),
  )
  appUrl = await listen(
    createServer(async (_req, res) => {
      // A route handler: one hop with fetch, one with the http module (axios on Node).
      await (
        await fetch(`${backendUrl}/login?code=999`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer xyz' },
          body: JSON.stringify({ email: 'a@b.c', password: 'pw' }),
        })
      ).json()
      await httpPost(`${backendUrl}/audit`, JSON.stringify({ event: 'login', secret: 's' }))
      res.writeHead(200).end('ok')
    }),
  )

  process.env.FLOW_CHECKER = '1'
  runtime = registerServerRuntime({
    ingest: `${ingestUrl}/ingest`,
    token: 'secret',
    capture: resolveCaptureOptions(),
  })
})

afterAll(() => {
  delete process.env.FLOW_CHECKER
  for (const server of servers) server.close()
})

describe('registerServerRuntime', () => {
  it('is a no-op without FLOW_CHECKER=1', () => {
    const before = process.env.FLOW_CHECKER
    delete process.env.FLOW_CHECKER
    expect(registerServerRuntime('{"ingest":"http://x/ingest","token":"t"}')).toBeUndefined()
    process.env.FLOW_CHECKER = before
  })

  it('captures fetch and http calls, linked to the incoming request, redacted', async () => {
    expect(runtime).toBeDefined()
    const res = await fetch(`${appUrl}/api/login`, { headers: { [LINK_HEADER]: 'ses_abc.cap_browser1' } })
    expect(await res.text()).toBe('ok')
    await runtime?.flush()

    const login = received.find((c) => c.request.url.startsWith(`${backendUrl}/login`))
    const audit = received.find((c) => c.request.url === `${backendUrl}/audit`)
    expect(login).toBeDefined()
    expect(audit).toBeDefined()

    expect(login).toMatchObject({
      origin: 'server',
      transport: 'fetch',
      sessionId: 'ses_abc',
      parent: { method: 'GET', url: '/api/login', captureId: 'cap_browser1' },
      redacted: true,
      request: {
        method: 'POST',
        url: `${backendUrl}/login?code=${REDACTED_STRING}`,
        headers: { authorization: REDACTED_STRING },
        body: { kind: 'json', value: { email: 'a@b.c', password: REDACTED_STRING } },
      },
      response: { status: 200, body: { kind: 'json', value: { id: 7, token: REDACTED_STRING } } },
    })

    expect(audit).toMatchObject({
      transport: 'http',
      parent: { url: '/api/login', captureId: 'cap_browser1' },
      request: { method: 'POST', body: { kind: 'json', value: { event: 'login', secret: REDACTED_STRING } } },
      response: { status: 200, body: { kind: 'json', value: { id: 7, token: REDACTED_STRING } } },
    })

    // The test's own call to the app has no incoming request around it.
    const outer = received.find((c) => c.request.url === `${appUrl}/api/login`)
    expect(outer?.parent).toBeUndefined()
  })

  it("skips Next's own RSC requests (e.g. the page it renders after a server action redirect)", async () => {
    received.length = 0
    await (await fetch(`${backendUrl}/products/3`, { headers: { rsc: '1' } })).text()
    await (await fetch(`${backendUrl}/products/4`)).text()
    await runtime?.flush()
    const urls = received.map((c) => c.request.url)
    expect(urls).toContain(`${backendUrl}/products/4`)
    expect(urls).not.toContain(`${backendUrl}/products/3`)
  })

  it('wraps fetch again after something puts the native fetch back (Next resetFetch)', async () => {
    const wrapped = globalThis.fetch
    const native = (wrapped as unknown as Record<symbol, typeof fetch>)[
      Symbol.for('flow-checker.wrapped-fetch')
    ]
    expect(native).toBeTypeOf('function')
    globalThis.fetch = native as typeof fetch
    expect(globalThis.fetch).not.toBe(native)

    received.length = 0
    await (await fetch(`${backendUrl}/after-reset`)).text()
    await runtime?.flush()
    expect(received.map((c) => c.request.url)).toContain(`${backendUrl}/after-reset`)
  })

  it('leaves a Next-style patched fetch on top of ours as is', async () => {
    const ours = globalThis.fetch
    const nextPatched = Object.assign((input: RequestInfo | URL, init?: RequestInit) => ours(input, init), {
      __nextPatched: true,
    })
    globalThis.fetch = nextPatched as typeof fetch
    expect(globalThis.fetch).toBe(nextPatched)

    received.length = 0
    await (await fetch(`${backendUrl}/through-next`)).text()
    await runtime?.flush()
    expect(received.filter((c) => c.request.url === `${backendUrl}/through-next`)).toHaveLength(1)
  })
})
