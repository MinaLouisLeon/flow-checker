// M43: page docs say where each page's browser part starts and what each boundary brings;
// component docs say what needs the browser; issues.md lists the boundary that could move lower;
// GLOSSARY.md explains the words.
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
  const model = scanProject({ root: join(repo, 'fixtures', 'client-boundaries') })
  files = renderMarkdown(
    collectSnapshot({
      root: join(mkdtempSync(join(tmpdir(), 'fc-export-')), 'client-boundaries'),
      model,
      captures: [],
      toolVersion: '0.0.0-test',
      now: NOW,
    }),
  )
}, 60_000)

const doc = (prefix: string, name: string) => {
  const found = files[`${prefix}/${name}.md`]
  if (!found)
    throw new Error(
      `no ${prefix}/${name}.md: ${Object.keys(files).filter((f) => f.startsWith(`${prefix}/`))}`,
    )
  return found
}

describe('client boundaries in the export', () => {
  it('page docs list each boundary, where it starts and what it brings', () => {
    const home = doc('pages', 'index')
    expect(home).toContain('## Client boundaries')
    expect(home).toContain("6 `'use client'` boundaries bring 9 components and 10 project modules")
    expect(home).toMatch(
      /- \[`LikeButton`\]\([^)]+\), rendered by `HomePage` \(page\): 1 component · 2 modules/,
    )
    expect(home).toContain('  - through `src/components/index.ts`')
    expect(home).toContain('  - loaded on demand')
    expect(home).toContain(
      "  - ⚠ could move lower: nothing in `Shell` needs the browser: `'use client'` in `src/components/shell.tsx` could move down to `Menu`, so `Shell`, `Heading` render on the server",
    )
    expect(doc('pages', 'cart')).toContain('  - packages: `zod`')
    expect(doc('pages', 'settings')).toContain('the page itself')
  })

  it('component docs say what needs the browser and what a boundary brings', () => {
    const cart = doc('components', 'Cart')
    expect(cart).toContain('| Needs the browser for | `useState` (hook), `onRemove` (function prop) |')
    expect(cart).toContain('| Brings to the browser | 3 components · 5 modules · 1.7 KB, packages `zod` |')
    expect(doc('components', 'Shell')).toContain('⚠ Could move lower')
  })

  it('issues.md lists only the planted boundary, linked to its component', () => {
    const issues = files['issues.md'] ?? ''
    expect(issues).toContain('## Client boundaries that could move lower')
    expect(issues.match(/could move down to/g)?.length).toBe(1)
    expect(issues).toMatch(/\[`Shell`\]\([^)]+\): nothing in `Shell` needs the browser/)
  })

  it('GLOSSARY.md explains the client words', () => {
    const glossary = files['GLOSSARY.md'] ?? ''
    expect(glossary).toContain('## Client boundaries')
    expect(glossary).toContain('could move lower')
    expect(glossary).toContain('function prop')
  })
})
