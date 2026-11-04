// M47: page docs list the waterfalls, N+1 and duplicate requests that slow each page down, perf.md lists
// every finding with what the recorded captures showed and the endpoints by p95, issues.md groups the
// findings, and GLOSSARY.md explains the words.
import type { ExportData } from '@flow-checker/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import { type ExportFiles, renderMarkdown } from '../src'
import { fixtureSnapshot } from './helpers'

let data: ExportData
let files: ExportFiles

beforeAll(() => {
  data = fixtureSnapshot('perf')
  files = renderMarkdown(data)
}, 60_000)

const doc = (path: string) => {
  const found = files[path]
  if (!found) throw new Error(`no ${path}: ${Object.keys(files).join(', ')}`)
  return found
}

describe('request performance in the export', () => {
  it('page docs list the findings with their runtime result and steps', () => {
    const home = doc('pages/index.md')
    expect(home).toContain('## Request performance')
    expect(home).toContain('Requests that slow this page down ([all](../perf.md)).')
    expect(home).toMatch(
      /- ⚠ \*\*\[waterfall\]\(\.\.\/GLOSSARY\.md#perf-waterfall\)\*\*, \[confirmed at runtime\]\(\.\.\/GLOSSARY\.md#perf-confirmed\) \(`src\/app\/page\.tsx:6`\): `getProducts\(\)` waits for `getUser\(1\)`/,
    )
    expect(home).toMatch(/ {2}- confirmed at runtime in \d+ of \d+ loads: about \d+ ms to save\./)
    expect(home).toContain('  1. `await getUser(1)` (`src/app/page.tsx:5`)')
    expect(doc('pages/products.md')).toContain('[one after another](../GLOSSARY.md#perf-sequential)')
    expect(doc('pages/users.[id].md')).not.toContain('## Request performance')
  })

  it('perf.md lists every finding and the slowest endpoints', () => {
    const perf = doc('perf.md')
    expect(perf).toContain('## To check (5)')
    expect(perf).toContain('| Finding | Where | At runtime | Pages |')
    expect(perf).toContain('## Slowest endpoints')
    expect(perf).toContain('| Endpoint | p50 | p95 | Slowest | Calls | Failed |')
    expect(perf).toContain('`GET http://localhost:4010/products`')
    expect(doc('README.md')).toContain('## Request performance\n\n[5 request performance notes, ')
  })

  it('issues.md groups the findings and GLOSSARY.md explains the words', () => {
    expect(doc('issues.md')).toContain('## Request performance (5)')
    const glossary = doc('GLOSSARY.md')
    expect(glossary).toContain('## Request performance')
    expect(glossary).toContain('**N+1** (`n-plus-one`)')
  })

  it('says how to time endpoints when nothing was captured', () => {
    const empty = renderMarkdown({ ...data, verification: undefined, captures: [] })
    expect(empty['perf.md']).toContain(
      'No request was captured. Run the app with capture on to time its endpoints.',
    )
  })
})
