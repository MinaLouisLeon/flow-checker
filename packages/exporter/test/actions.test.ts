// M46: page docs list the server actions each page uses, actions.md lists every action with its auth
// check, input check and changes, issues.md groups the open ones, and GLOSSARY.md explains the words.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanProject } from '@flow-checker/scanner'
import { collectSnapshot } from '@flow-checker/server'
import type { ExportData } from '@flow-checker/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import { type ExportFiles, renderMarkdown } from '../src'
import { NOW, repo } from './helpers'

let data: ExportData
let files: ExportFiles

beforeAll(() => {
  const model = scanProject({ root: join(repo, 'fixtures', 'action-safety') })
  data = collectSnapshot({
    root: join(mkdtempSync(join(tmpdir(), 'fc-export-')), 'action-safety'),
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

describe('server actions in the export', () => {
  it('page docs list the actions the page uses, with the flag sentence', () => {
    const post = doc('pages/posts.[id].md')
    expect(post).toContain('## Server actions')
    expect(post).toContain('Each one is a public `POST` endpoint ([all](../actions.md)).')
    expect(post).toMatch(
      /- `deletePost` \(`src\/actions\/posts\.ts:25`\): ⚠ \*\*\[open to anyone\]\(\.\.\/GLOSSARY\.md#action-unprotected\)\*\*, \[no auth check\]/,
    )
    expect(post).toContain(
      '  - Server action `deletePost` changes data (`db.post.delete`) with no auth check',
    )
    expect(doc('pages/search.md')).not.toContain('open to anyone')
  })

  it('actions.md lists every action, the open ones first', () => {
    const actions = doc('actions.md')
    expect(actions).toContain('## To check (3)')
    expect(actions).toContain('| Action | Auth | Input | Changes | Pages |')
    expect(actions).toContain('Auth checked by its wrapper `withAdmin`.')
    expect(actions).toContain('Input checked by `v.parse` (valibot).')
    expect(actions).toContain('`purgePosts`<br>`src/actions/posts.ts:52`<br>unused')
    expect(doc('README.md')).toContain(
      '## Server actions\n\n[10 server actions](actions.md), 3 notes to check.',
    )
  })

  it('issues.md groups the open actions and GLOSSARY.md explains the words', () => {
    expect(doc('issues.md')).toContain('## Server actions open to anyone (3)')
    const glossary = doc('GLOSSARY.md')
    expect(glossary).toContain('## Server actions')
    expect(glossary).toContain('**open to anyone** (`unprotected`)')
  })
})
