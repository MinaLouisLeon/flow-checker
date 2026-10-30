// Export snapshots of the fixtures: a fresh scan plus the captures recorded from each fixture app
// (packages/server/test/recordings, see scripts/record-captures.mjs), matched by the real verifier.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyPostman, importLocalPostman } from '@flow-checker/postman'
import { scanProject } from '@flow-checker/scanner'
import { collectSnapshot, type ServerActionInfo } from '@flow-checker/server'
import type { Capture, ExportData } from '@flow-checker/shared'

export const repo = join(import.meta.dirname, '..', '..', '..')
export const FIXTURES = [
  'basic',
  'react-query',
  'server-actions',
  'bff',
  'next-intl',
  'mismatch',
  'middleware',
  'postman',
]
export const NOW = new Date('2026-10-29T12:00:00.000Z')

/**
 * Fixtures with a Postman collection: their `postman` config (as in `flow-checker.config.ts`) and
 * the app origin the recordings were made on, applied like the CLI does.
 */
const POSTMAN: Record<string, { collection: string; environment?: string; appOrigins: string[] }> = {
  postman: {
    collection: 'postman/collections/Fixture API',
    environment: 'postman/environments/local.yaml',
    appOrigins: ['http://localhost:3077'],
  },
}

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
  const fixtureRoot = join(repo, 'fixtures', fixture)
  const scanned = scanProject({ root: fixtureRoot })
  const postman = POSTMAN[fixture]
  const model = postman
    ? applyPostman(
        scanned,
        importLocalPostman({
          root: fixtureRoot,
          config: { collection: postman.collection, environment: postman.environment },
          now: NOW,
        }),
        { appOrigins: postman.appOrigins },
      )
    : scanned
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
