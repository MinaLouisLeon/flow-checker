// Guarded pages (M31): a captured redirect or stopped page marks the guards it fits as seen, in
// the flows summary the dashboard and the export read.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveCaptureOptions } from '@flow-checker/runtime/options'
import { scanProject } from '@flow-checker/scanner'
import type { AppModel, FlowsSummary, SessionEvent } from '@flow-checker/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CaptureStore, createApp } from '../src'

const APP = 'http://localhost:3000'
const fixture = (name: string) => join(import.meta.dirname, '..', '..', '..', 'fixtures', name)

let middleware: AppModel
let actions: AppModel
beforeAll(() => {
  middleware = scanProject({ root: fixture('middleware') })
  actions = scanProject({ root: fixture('server-actions') })
}, 60_000)

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

async function seen(model: AppModel, events: SessionEvent[]): Promise<Record<string, string[]>> {
  const root = mkdtempSync(join(tmpdir(), 'flow-checker-guards-'))
  dirs.push(root)
  const store = new CaptureStore({ root })
  const app = createApp({ root, model, capture: { store, token: 'tok', options: resolveCaptureOptions() } })
  const call = (path: string, init?: RequestInit) => app.request(`http://127.0.0.1:4400${path}`, init)
  const batch = JSON.stringify({ token: 'tok', sessionId: 'ses_1', captures: [], events })
  expect((await call('/ingest', { method: 'POST', body: batch })).status).toBe(204)
  const summary = (await (await call('/api/flows')).json()) as FlowsSummary
  return summary.guards ?? {}
}

const at = (s: number) => new Date(Date.parse('2026-11-01T10:00:00Z') + s * 1000).toISOString()
const pageId = (model: AppModel, path: string) =>
  model.routes.find((r) => r.path === path && r.kind === 'page')?.id

describe('seen guards', () => {
  it('marks the middleware redirects to the page a navigation ended on', async () => {
    const guards = await seen(middleware, [
      { kind: 'navigation', at: at(0), how: 'load', url: `${APP}/` },
      { kind: 'redirect', at: at(1), from: `${APP}/dashboard`, to: `${APP}/login` },
      { kind: 'navigation', at: at(1), how: 'push', url: `${APP}/login` },
    ])
    const dashboard = middleware.routes.find((r) => r.path === '/dashboard')
    // Both redirects go to /login: either may have happened.
    expect(guards[dashboard?.id as string]?.sort()).toEqual(dashboard?.access?.guards.map((g) => g.id).sort())
    expect(Object.keys(guards)).toEqual([dashboard?.id])
  })

  it('does not mark a guard whose target is another page', async () => {
    const guards = await seen(middleware, [
      { kind: 'redirect', at: at(1), from: `${APP}/dashboard`, to: `${APP}/products` },
    ])
    expect(guards).toEqual({})
  })

  it('marks notFound() from a 404 answer, and leaves other pages alone', async () => {
    const guards = await seen(actions, [
      { kind: 'redirect', at: at(0), from: `${APP}/products/999`, to: `${APP}/products/999`, status: 404 },
      { kind: 'redirect', at: at(1), from: `${APP}/products`, to: `${APP}/products`, status: 404 },
    ])
    const product = actions.routes.find((r) => r.path === '/products/[id]')
    expect(guards).toEqual({ [product?.id as string]: [product?.access?.guards[0]?.id] })
  })

  it('reads a page left right after it loaded, with no click, as a browser redirect', async () => {
    const home = pageId(actions, '/')
    // `/` redirects to /products while it renders; in a client navigation Next moves on in the browser.
    expect(
      await seen(actions, [
        { kind: 'navigation', at: at(0), how: 'load', url: `${APP}/` },
        { kind: 'navigation', at: at(1), how: 'replace', url: `${APP}/products` },
      ]),
    ).toEqual({
      [home as string]: actions.routes.find((r) => r.id === home)?.access?.guards.map((g) => g.id),
    })
    // A click in between makes it the user's navigation.
    expect(
      await seen(actions, [
        { kind: 'navigation', at: at(0), how: 'load', url: `${APP}/` },
        {
          kind: 'interaction',
          at: at(1),
          type: 'click',
          target: 'a',
          componentChain: ['Home'],
          url: `${APP}/`,
        },
        { kind: 'navigation', at: at(2), how: 'push', url: `${APP}/products` },
      ]),
    ).toEqual({})
  })
})
