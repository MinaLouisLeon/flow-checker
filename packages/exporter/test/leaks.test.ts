// M44: page docs list each page's server/client leaks, component docs name theirs, issues.md groups
// them, and GLOSSARY.md explains the words.
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
  const model = scanProject({ root: join(repo, 'fixtures', 'leaks') })
  files = renderMarkdown(
    collectSnapshot({
      root: join(mkdtempSync(join(tmpdir(), 'fc-export-')), 'leaks'),
      model,
      captures: [],
      toolVersion: '0.0.0-test',
      now: NOW,
    }),
  )
}, 60_000)

const doc = (path: string) => {
  const found = files[path]
  if (!found) throw new Error(`no ${path}: ${Object.keys(files).join(', ')}`)
  return found
}

describe('server/client leaks in the export', () => {
  it('page docs list the leaks with where they are and why the page breaks', () => {
    const files_ = doc('pages/files.md')
    expect(files_).toContain('## Server/client leaks')
    expect(files_).toContain(
      '- ⚠ **Node.js module**: `src/lib/disk.ts` imports `fs` (a Node.js module with no browser version), and client code imports it: `src/components/file-badge.tsx` → `src/lib/format-size.ts` → `src/lib/disk.ts`, `src/lib/disk.ts:2`',
    )
    expect(files_).toContain('  - The browser has no version of it, so the build fails.')
    expect(doc('pages/receipt.md')).toContain('`total` (a `Money` instance)')
    expect(doc('pages/index.md')).not.toContain('Server/client leaks')
  })

  it('component docs name the leaks they hand on or bring', () => {
    expect(doc('components/ProductsPage.md')).toContain(
      '| Leaks | ⚠ `ProductsPage` hands `onSelect` (a function)',
    )
    expect(doc('components/StatsCard.md')).toContain('imports `pg` (a database client)')
  })

  it('issues.md groups every leak, linked to its page', () => {
    const issues = doc('issues.md')
    expect(issues).toContain('## Server/client leaks')
    const section = issues.slice(issues.indexOf('## Server/client leaks'))
    const group = section.slice(0, section.indexOf('\n## ', 4) > 0 ? section.indexOf('\n## ', 4) : undefined)
    expect(group.match(/^- /gm)?.length).toBe(9)
    expect(group).toContain('[`/help`](pages/help.md): `HelpPage` hands `onClick` (a function)')
  })

  it('GLOSSARY.md explains each kind of leak', () => {
    const glossary = doc('GLOSSARY.md')
    expect(glossary).toContain('## Server/client leaks')
    expect(glossary).toContain('<a id="leak-database"></a>**database client**')
  })
})
