// M41: page docs say what each page shows while it loads, on an error and on `notFound()`, list
// the gaps and the metadata; issues.md lists the gaps; GLOSSARY.md explains the words. The static
// HTML export carries the same model, so the dashboard's page view works there too.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import { collectSnapshot } from '@flow-checker/server'
import { beforeAll, describe, expect, it } from 'vitest'
import { type ExportFiles, renderMarkdown } from '../src'
import { NOW, repo } from './helpers'

let files: ExportFiles

beforeAll(() => {
  const model = scanProject({ root: join(repo, 'fixtures', 'boundaries') })
  files = renderMarkdown(
    collectSnapshot({
      root: join(mkdtempSync(join(tmpdir(), 'fc-export-')), 'boundaries'),
      model,
      captures: [],
      toolVersion: '0.0.0-test',
      now: NOW,
    }),
  )
}, 60_000)

const pageDoc = (name: string) => {
  const doc = files[`pages/${name}.md`]
  if (!doc)
    throw new Error(`no pages/${name}.md: ${Object.keys(files).filter((f) => f.startsWith('pages/'))}`)
  return doc
}

describe('page docs', () => {
  it('name the files that cover a page and its title', () => {
    const doc = pageDoc('dashboard')
    // The `|` in the title is escaped so the table keeps its two columns.
    expect(doc).toContain('| Title | `Dashboard \\| Boundaries` |')
    expect(doc).toContain('## Boundaries')
    expect(doc).toContain('- While it loads: `src/app/dashboard/loading.tsx`')
    expect(doc).toContain('- On an error: `src/app/dashboard/error.tsx`')
    expect(doc).toContain('- On `notFound()`: `src/app/not-found.tsx`')
    expect(doc).not.toContain('⚠')
  })

  it('list the gap with its source', () => {
    const doc = pageDoc('photos.[id]')
    expect(doc).toContain(
      '- ⚠ no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (page), `src/lib/api.ts:17`',
    )
    expect(doc).toContain('- On `notFound()`: `src/app/photos/not-found.tsx`')
  })

  it('list `<Suspense>` and error boundaries in the components, and the metadata', () => {
    const doc = pageDoc('reports')
    expect(doc).toContain('- `<Suspense>` around `ReportTable` (page)')
    expect(doc).toContain('- an error boundary around `SettingsPanel` (page)')
    expect(doc).toContain('## Metadata')
    expect(doc).toContain('- page `metadata`: title, `src/app/reports/page.tsx:')
  })
})

describe('issues.md and GLOSSARY.md', () => {
  it('lists each gap once, with the code as code', () => {
    const doc = files['issues.md'] ?? ''
    expect(doc).toContain('## Boundary gaps (1)')
    expect(doc).toContain('no loading state: waits for a request (`fetch`)')
  })

  it('explains every boundary word', () => {
    const doc = files['GLOSSARY.md'] ?? ''
    expect(doc).toContain('## Boundaries')
    expect(doc).toContain('blocks the build')
    expect(doc).toContain('slot without default')
  })
})
