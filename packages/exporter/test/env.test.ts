// M45: page docs list the environment variables each page reads, env.md lists every name with its
// reads, flags and files, issues.md groups the flags, GLOSSARY.md explains the words, and no value
// from a `.env` file reaches any exported file.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import { collectSnapshot } from '@flow-checker/server'
import type { ExportData } from '@flow-checker/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import { dataScript, type ExportFiles, renderMarkdown } from '../src'
import { NOW, repo } from './helpers'

let data: ExportData
let files: ExportFiles

beforeAll(() => {
  const model = scanProject({ root: join(repo, 'fixtures', 'env') })
  data = collectSnapshot({
    root: join(mkdtempSync(join(tmpdir(), 'fc-export-')), 'env'),
    model,
    captures: [],
    toolVersion: '0.0.0-test',
    now: NOW,
  })
  files = renderMarkdown(data)
}, 60_000)

const doc = (path: string) => {
  const found = files[path]
  if (!found) throw new Error(`no ${path}: ${Object.keys(files).join(', ')}`)
  return found
}

describe('environment variables in the export', () => {
  it('page docs list the names the page reads, with the flags on that page', () => {
    const checkout = doc('pages/checkout.md')
    expect(checkout).toContain('## Environment variables')
    expect(checkout).toContain(
      '- `STRIPE_SECRET_KEY` (client): `.env` ⚠ **private name in client code**, `src/components/checkout-button.tsx:6`',
    )
    expect(checkout).toContain(
      '  - `STRIPE_SECRET_KEY` has no `NEXT_PUBLIC_` prefix but is read in client code (`src/components/checkout-button.tsx`), so it is undefined in the browser',
    )
    // `/` reads API_URL on the server only: no flag there.
    const home = doc('pages/index.md')
    expect(home).toContain('- `API_URL` (server): `.env`, `src/lib/config.ts:2`')
    expect(home).not.toContain('private name in client code')
    expect(doc('pages/products.md')).toContain(
      '- `API_URL` (server and client): `.env` ⚠ **private name in client code**',
    )
  })

  it('env.md lists every name, the flags, the files and what nothing reads', () => {
    const env = doc('env.md')
    expect(env).toContain('## To check (4)')
    expect(env).toContain('`DATABASE_URL` is read without a fallback, but no `.env` file defines it')
    expect(env).toContain('| `SENTRY_DSN` | only listed in `.env.example` |')
    expect(env).toContain('`src/components/site-name.tsx:5` client, destructured')
    expect(env).toContain('## Names built at run time')
    expect(env).toContain(
      'Names a `.env` file defines that no scanned code reads: `CDN_URL`, `PRIVATE_KEY`, `UNUSED_TOKEN`.',
    )
    expect(env).toContain("| `.env.example` | never (Next doesn't load it) | 1 |")
    expect(doc('README.md')).toContain('## Environment variables')
  })

  it('groups the flags in issues.md and explains the words in GLOSSARY.md', () => {
    const issues = doc('issues.md')
    expect(issues).toContain('## Environment variables')
    expect(issues).toContain('`NEXT_PUBLIC_SITE_NAME` is destructured from `process.env` in client code')
    const glossary = doc('GLOSSARY.md')
    expect(glossary).toContain('## Environment variables')
    expect(glossary).toContain('private name in client code')
  })

  it('never exports a value from a .env file', () => {
    const everything = [...Object.values(files), dataScript(data)].join('\n')
    expect(everything).not.toContain('fixture-value-')
    // The only value the scan could see is the API URL in `.env`; it must not show up either.
    expect(everything).not.toContain('http://localhost:4010')
  })
})
