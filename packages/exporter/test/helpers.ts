// Export snapshots of the fixtures: a fresh scan plus the captures recorded from each fixture app
// (packages/server/test/recordings, see scripts/record-captures.mjs), matched by the real verifier.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import { collectSnapshot, type ServerActionInfo } from '@flow-checker/server'
import type { Capture, ExportData } from '@flow-checker/shared'

export const repo = join(import.meta.dirname, '..', '..', '..')
export const FIXTURES = ['basic', 'react-query', 'server-actions', 'bff', 'next-intl', 'mismatch']
export const NOW = new Date('2026-10-29T12:00:00.000Z')

interface Recording {
  actions: Record<string, ServerActionInfo>
  captures: Capture[]
}

export function fixtureSnapshot(
  fixture: string,
  options: { captures?: boolean; raw?: boolean } = {},
): ExportData {
  const recording = JSON.parse(
    readFileSync(join(repo, 'packages', 'server', 'test', 'recordings', `${fixture}.json`), 'utf8'),
  ) as Recording
  const model = scanProject({ root: join(repo, 'fixtures', fixture) })
  // An empty project folder: no saved overrides or code history, so the result is stable.
  const root = join(mkdtempSync(join(tmpdir(), 'fc-export-')), fixture)
  return collectSnapshot({
    root,
    model,
    captures: options.captures === false ? [] : recording.captures,
    resolveAction: (id) => recording.actions[id],
    toolVersion: '0.0.0-test',
    raw: options.raw,
    now: NOW,
  })
}
