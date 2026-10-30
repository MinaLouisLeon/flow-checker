// M8 "done when": the mismatch fixture produces the expected type-mismatch flags, and the
// correctly typed fixtures produce none. The captures are real: recorded from each fixture app
// with scripts/record-captures.mjs.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import {
  type AppModel,
  applyVerification,
  type Capture,
  type CaptureMatch,
  checkCapture,
  describeMismatch,
  type SiteVerification,
  summarizeTypeChecks,
  type TypeCheck,
  typeTable,
  urlText,
} from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import type { ServerActionInfo } from '../src/actions'
import { Matcher } from '../src/matcher'

const repo = join(import.meta.dirname, '..', '..', '..')

interface Recording {
  fixture: string
  actions: Record<string, ServerActionInfo>
  captures: Capture[]
}

/** Matches and type-checks every recorded capture, like the verifier does. */
function verify(fixture: string) {
  const recording = JSON.parse(
    readFileSync(join(import.meta.dirname, 'recordings', `${fixture}.json`), 'utf8'),
  ) as Recording
  const model = scanProject({ root: join(repo, 'fixtures', fixture) })
  const matcher = new Matcher(model)
  const types = typeTable(model.types)
  const sites = new Map(model.requests.map((s) => [s.id, s]))
  const matches = new Map<string, CaptureMatch>()
  const checks = new Map<string, { captureId: string; check: TypeCheck }[]>()
  const verification: Record<string, SiteVerification> = {}
  const ordered = [...recording.captures].sort((a, b) =>
    a.origin === b.origin ? 0 : a.origin === 'browser' ? -1 : 1,
  )
  for (const capture of ordered) {
    const parentId = capture.origin === 'server' ? capture.parent?.captureId : undefined
    const match = matcher.match(capture, {
      frames: capture.sourceStack ?? [],
      resolveAction: (id) => recording.actions[id],
      parentMatch: parentId ? matches.get(parentId) : undefined,
    })
    matches.set(capture.id, match)
    const site = match.status === 'matched' && match.siteId ? sites.get(match.siteId) : undefined
    if (!site) continue
    verification[site.id] ??= { captures: 0 }
    const entry = verification[site.id]
    if (entry) entry.captures++
    const check = checkCapture(capture, site, types)
    if (!check) continue
    const list = checks.get(site.id) ?? []
    checks.set(site.id, list)
    list.push({ captureId: capture.id, check })
  }
  for (const [siteId, list] of checks) {
    const entry = verification[siteId]
    const typeCheck = summarizeTypeChecks(list)
    if (entry && typeCheck) entry.typeCheck = typeCheck
  }
  return { model, served: applyVerification(model, { sites: verification }), verification }
}

function label(model: AppModel, siteId: string): string {
  const site = model.requests.find((s) => s.id === siteId)
  if (!site) return siteId
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

describe('type comparison on recorded fixture captures', () => {
  it.each([
    'basic',
    'react-query',
    'server-actions',
    'bff',
    'next-intl',
    'graphql-apollo',
    'graphql-apollo-v3',
    'graphql-urql',
    'graphql-relay',
  ])(
    '%s: correct types give no mismatches',
    (fixture) => {
      const { model, verification } = verify(fixture)
      const found = Object.entries(verification).flatMap(([siteId, v]) =>
        (v.typeCheck?.mismatches ?? []).map(
          (m) => `${label(model, siteId)}: ${m.part} ${describeMismatch(m)}`,
        ),
      )
      expect(found).toEqual([])
      // And the check did run: at least one capture per fixture was compared.
      expect(Object.values(verification).some((v) => (v.typeCheck?.checked ?? 0) > 0)).toBe(true)
    },
    120_000,
  )
})

describe('mismatch fixture', () => {
  it('produces the expected type-mismatch flags', async () => {
    const { model, served, verification } = verify('mismatch')
    const lines: string[] = []
    for (const site of served.requests) {
      lines.push(`${label(model, site.id)}  [${site.status}]`)
      for (const flag of site.flags) lines.push(`  ${flag.kind}: ${flag.message}`)
      for (const m of verification[site.id]?.typeCheck?.mismatches ?? []) {
        lines.push(`  - ${m.part} ${m.kind} ${m.path}: expected ${m.expected}, got ${m.actual}`)
      }
    }
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot('__snapshots__/type-check.txt')

    const byUrl = (path: string, method = 'GET') => {
      const site = served.requests.find((s) => s.url?.path === path && s.method === method)
      const check = site && verification[site.id]?.typeCheck
      return {
        status: site?.status,
        flags: site?.flags.map((f) => f.kind),
        found: check?.mismatches.map((m) => `${m.part} ${m.kind} ${m.path}`),
      }
    }
    expect(byUrl('/users')).toEqual({
      status: 'mismatch',
      flags: ['type-mismatch'],
      found: [
        'response wrong-type response.body[].id',
        'response missing-field response.body[].avatarUrl',
        'response extra-field response.body[].role',
      ],
    })
    expect(byUrl('/settings')).toEqual({
      status: 'mismatch',
      flags: ['type-mismatch'],
      found: ['response null response.body.digest'],
    })
    expect(byUrl('/todos', 'POST')).toEqual({
      status: 'mismatch',
      flags: ['type-mismatch'],
      found: ['request wrong-type request.body.userId', 'response wrong-type response.body.userId'],
    })
    // Correctly typed: verified, no flag.
    expect(byUrl('/todos')).toEqual({ status: 'verified', flags: [], found: [] })
  }, 120_000)
})
