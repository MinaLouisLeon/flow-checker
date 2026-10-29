// Export snapshots (M10): captures are redacted again unless raw, local paths are removed, the
// newest captures per site are kept, and reading `.flow-checker/` never changes it.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import type { Capture } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { collectSnapshot, EXPORT_CAPTURES_PER_SITE } from '../src'

const repo = join(import.meta.dirname, '..', '..', '..')
const fixtureRoot = join(repo, 'fixtures', 'next-intl')
const model = scanProject({ root: fixtureRoot })
const recording = JSON.parse(
  readFileSync(join(import.meta.dirname, 'recordings', 'next-intl.json'), 'utf8'),
) as {
  captures: Capture[]
}
const login = recording.captures.find((c) => c.request.url.endsWith('/auth/login')) as Capture

function tempRoot(): string {
  return join(mkdtempSync(join(tmpdir(), 'fc-snap-')), 'app')
}

/** The login capture as `capture.storeRaw` would have saved it, from a project at `root`. */
function rawLogin(root: string): Capture {
  return {
    ...login,
    id: 'cap_raw',
    redacted: false,
    redactedPaths: [],
    request: {
      ...login.request,
      headers: { ...login.request.headers, authorization: 'Bearer secret-token' },
      body: { kind: 'json', value: { email: 'ada@example.com', password: 'hunter2' } },
    },
    stack: [`at onSubmit (${join(root, 'src', 'components', 'LoginForm.tsx')}:18:5)`],
    error: undefined,
  }
}

describe('collectSnapshot', () => {
  it('redacts captures saved raw, unless the export is raw too', () => {
    const root = tempRoot()
    const capture = rawLogin(root)
    const redacted = collectSnapshot({ root, model, captures: [capture] })
    const out = redacted.captures[0]
    expect(redacted.redacted).toBe(true)
    expect(out?.request.headers.authorization).toBe('[REDACTED:string]')
    expect(JSON.stringify(out?.request.body)).not.toContain('hunter2')
    expect(out?.redactedPaths).toEqual(
      expect.arrayContaining(['request.headers.authorization', 'request.body.password']),
    )

    const raw = collectSnapshot({ root, model, captures: [capture], raw: true })
    expect(raw.redacted).toBe(false)
    expect(raw.captures[0]?.request.headers.authorization).toBe('Bearer secret-token')
  })

  it('removes the absolute project path from stack frames', () => {
    const root = tempRoot()
    const data = collectSnapshot({ root, model, captures: [rawLogin(root)] })
    const stack = data.captures[0]?.stack.join('\n') ?? ''
    expect(stack).toContain('src')
    expect(stack).not.toContain(root)
    expect(stack).not.toContain(root.split('\\').join('/'))
  })

  it('applies verification to the model and keeps the newest captures per site', () => {
    const root = tempRoot()
    const many = Array.from({ length: EXPORT_CAPTURES_PER_SITE + 5 }, (_, i) => ({
      ...login,
      id: `cap_${String(i).padStart(2, '0')}`,
      timestamp: new Date(Date.parse(login.timestamp) + i * 1000).toISOString(),
    }))
    const data = collectSnapshot({ root, model, captures: many })
    expect(data.captureCounts).toEqual({ total: many.length, included: EXPORT_CAPTURES_PER_SITE })
    expect(data.captures.map((c) => c.id)).toEqual(many.slice(5).map((c) => c.id))
    const siteId = data.captures[0]?.match?.siteId
    expect(data.verification?.sites[siteId ?? '']?.captures).toBe(many.length)
    expect(data.model.requests.find((s) => s.id === siteId)?.status).toBe('verified')
  })

  it('has no verification or flow results without captures', () => {
    const data = collectSnapshot({ root: tempRoot(), model, captures: [] })
    expect(data.verification).toBeUndefined()
    expect(data.flows).toBeUndefined()
    expect(data.model.requests.every((s) => s.status === 'inferred')).toBe(true)
  })

  it('reads saved captures without changing .flow-checker/', () => {
    const root = tempRoot()
    const unmatched = join(root, '.flow-checker', 'captures', '_unmatched')
    mkdirSync(unmatched, { recursive: true })
    const saved = JSON.stringify(login, null, 2)
    writeFileSync(join(unmatched, `${login.id}.json`), saved)

    const data = collectSnapshot({ root, model })
    // Matched in the export...
    expect(data.captures[0]?.match?.status).toBe('matched')
    // ...but the file was not moved, and no code history or overrides were written.
    expect(readdirSync(join(root, '.flow-checker', 'captures'))).toEqual(['_unmatched'])
    expect(readFileSync(join(unmatched, `${login.id}.json`), 'utf8')).toBe(saved)
    expect(existsSync(join(root, '.flow-checker', 'cache'))).toBe(false)
    expect(existsSync(join(root, '.flow-checker', 'overrides.json'))).toBe(false)
  })
})
