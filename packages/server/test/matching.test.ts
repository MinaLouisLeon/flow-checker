// M6 "done when": at least 95% of fixture captures are matched automatically, to the right site.
// The captures are real: recorded from each fixture app with scripts/record-captures.mjs.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import { type AppModel, type Capture, type CaptureMatch, urlText } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import type { ServerActionInfo } from '../src/actions'
import { Matcher } from '../src/matcher'

const FIXTURES = ['basic', 'react-query', 'server-actions', 'bff', 'next-intl']
const repo = join(import.meta.dirname, '..', '..', '..')

interface Recording {
  fixture: string
  actions: Record<string, ServerActionInfo>
  captures: Capture[]
}

function load(fixture: string) {
  const recording = JSON.parse(
    readFileSync(join(import.meta.dirname, 'recordings', `${fixture}.json`), 'utf8'),
  ) as Recording
  const model = scanProject({ root: join(repo, 'fixtures', fixture) })
  return { recording, model }
}

/** Matches like the verifier does: browser captures first, so server hops see their parent. */
function replay(model: AppModel, recording: Recording, degrade?: { noStack?: boolean; noActions?: boolean }) {
  const matcher = new Matcher(model)
  const matches = new Map<string, CaptureMatch>()
  const ordered = [...recording.captures].sort((a, b) =>
    a.origin === b.origin ? 0 : a.origin === 'browser' ? -1 : 1,
  )
  for (const original of ordered) {
    const capture = degrade?.noStack ? { ...original, stack: [] } : original
    const parentId = capture.origin === 'server' ? capture.parent?.captureId : undefined
    matches.set(
      capture.id,
      matcher.match(capture, {
        frames: degrade?.noStack ? [] : (capture.sourceStack ?? []),
        resolveAction: (id) => (degrade?.noActions ? undefined : recording.actions[id]),
        parentMatch: parentId ? matches.get(parentId) : undefined,
      }),
    )
  }
  return matches
}

function label(model: AppModel, siteId: string | undefined): string {
  const site = model.requests.find((s) => s.id === siteId)
  if (!site) return '-'
  const component = model.components.find((c) => c.id === site.componentId)
  const route = model.routes.find((r) => r.id === site.routeId)
  const owner = component?.name ?? (route ? `${site.handlerMethod} ${route.path}` : site.serverAction?.name)
  const target =
    site.transport === 'server-action'
      ? `action ${site.serverAction?.name}`
      : site.url
        ? urlText(site.url)
        : '?'
  return `${owner} · ${site.method} ${target}`
}

function describeCapture(c: Capture): string {
  const url = new URL(c.request.url)
  const action = c.serverAction ? ` [action]` : ''
  const parent = c.parent ? ` (in ${c.parent.method} ${new URL(c.parent.url, url).pathname})` : ''
  return `${c.origin} ${c.request.method} ${url.host}${url.pathname}${action}${parent}`
}

describe('matching recorded fixture captures', () => {
  const loaded = FIXTURES.map((fixture) => ({ fixture, ...load(fixture) }))

  it('auto-matches at least 95% of captures, each to the right site', async () => {
    let total = 0
    let matched = 0
    const lines: string[] = []
    for (const { fixture, recording, model } of loaded) {
      const matches = replay(model, recording)
      lines.push(`## ${fixture}`)
      for (const capture of recording.captures) {
        const match = matches.get(capture.id)
        total++
        if (match?.status === 'matched') matched++
        lines.push(`${describeCapture(capture)}\n  → ${match?.status} ${label(model, match?.siteId)}`)
      }
      lines.push('')
    }
    // The snapshot is the check that each capture went to the right site: review it on change.
    await expect(lines.join('\n')).toMatchFileSnapshot('__snapshots__/matching.txt')
    expect(total).toBeGreaterThanOrEqual(30)
    expect(matched / total).toBeGreaterThanOrEqual(0.95)
  }, 120_000)

  it('verifies every request site the fixture runs exercised', () => {
    for (const { recording, model } of loaded) {
      const matches = replay(model, recording)
      const verified = new Set([...matches.values()].map((m) => m.siteId).filter(Boolean))
      // Sites with no recording step: none. Every scanned request was exercised.
      const missing = model.requests.filter((s) => !verified.has(s.id)).map((s) => label(model, s.id))
      expect(missing).toEqual([])
    }
  }, 120_000)

  it('still matches most captures without source maps or the action manifest', () => {
    let total = 0
    let matched = 0
    for (const { recording, model } of loaded) {
      const strict = replay(model, recording)
      for (const [id, match] of replay(model, recording, { noStack: true, noActions: true })) {
        total++
        if (match.status !== 'matched') continue
        // Never a different site than with all signals.
        expect(match.siteId).toBe(strict.get(id)?.siteId)
        matched++
      }
    }
    expect(matched / total).toBeGreaterThanOrEqual(0.9)
  }, 120_000)
})
