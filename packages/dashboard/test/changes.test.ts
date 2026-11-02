// M36: the Affected by changes panel, rendered in node with react-dom/server.
import { readFileSync } from 'node:fs'
import { AppModelSchema, type ScanEvent } from '@flow-checker/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Meta } from '../src/api'
import { DataContext } from '../src/context'
import { buildIndex, type ModelIndex } from '../src/model-index'
import { href, parseHash } from '../src/router'
import { ChangesScreen } from '../src/screens/ChangesScreen'
import { Overview } from '../src/screens/Overview'

const model = (name: string) =>
  AppModelSchema.parse(
    JSON.parse(
      readFileSync(new URL(`../../scanner/test/__snapshots__/${name}.model.json`, import.meta.url), 'utf8'),
    ),
  )

const WATCHING: Meta = { canRescan: true, watching: true, root: '/p' }

function scan(files: string[], changes: ScanEvent['changes'] = {}): ScanEvent {
  return { scannedAt: '2026-11-02T10:00:00.000Z', files, changes, changedCode: [], needsRecheck: [] }
}

function render(index: ModelIndex, meta: Meta, view: ReturnType<typeof createElement>, last?: ScanEvent) {
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } })
  if (last) client.setQueryData(['last-scan'], last)
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(DataContext.Provider, { value: { index, meta } }, view),
    ),
  )
}

const changes = () => createElement(ChangesScreen)

describe('routing', () => {
  it('round-trips the changes screen', () => {
    expect(href({ name: 'changes' })).toBe('#/changes')
    expect(parseHash('#/changes')).toEqual({ name: 'changes' })
  })
})

describe('basic fixture', () => {
  const index = buildIndex(model('basic'))

  it('lists the pages, flows and requests a constants file affects, by area', () => {
    const html = render(
      index,
      WATCHING,
      changes(),
      scan(['lib/config.ts'], { requests: { added: 0, removed: 0, changed: 4 } }),
    )
    expect(html).toContain('data-testid="impact-panel"')
    expect(html).toContain('nothing of its own; imported by lib/api.ts')
    expect(html).toContain('The scan found 4 requests changed.')
    expect(html).toContain('<strong>2 pages, 1 flow and 4 requests</strong>')
    // Area headings link to the area; items link to their screens.
    expect(html).toMatch(/<h3><a href="#\/areas\/ar_[^"]+">users<\/a><\/h3>/)
    expect(html).toContain(`href="${href({ name: 'flows', flowId: index.model.flows[0]?.id, q: '' })}"`)
    expect(html).toContain('sent through lib/api.ts (imports lib/config.ts)')
  })

  it('says a comment-only change found nothing new, and still lists what the file affects', () => {
    const html = render(index, WATCHING, changes(), scan(['components/ProfileCard.tsx']))
    expect(html).toContain('nothing new in the code')
    expect(html).toContain('<code>/users/[id]</code>')
    expect(html).toContain('Also touched: 1 component and 1 type')
  })

  it('explains when there is nothing to show', () => {
    expect(render(index, WATCHING, changes())).toContain('No change since this page opened')
    expect(render(index, { canRescan: false }, changes(), scan(['lib/api.ts']))).toContain(
      'watched (<code>--no-watch</code>)',
    )
    const exported: Meta = {
      canRescan: false,
      exported: {
        projectName: 'basic',
        generatedAt: '2026-11-02T00:00:00Z',
        redacted: true,
        captureCounts: { total: 0, included: 0 },
      },
    }
    expect(render(index, exported, changes())).toContain('This is an export: it can')
    expect(render(index, WATCHING, changes(), scan([]))).toContain('manual re-scan')
  })

  it('shows the panel on the overview only after a file changed', () => {
    expect(render(index, WATCHING, createElement(Overview))).not.toContain('impact-panel')
    expect(render(index, WATCHING, createElement(Overview), scan(['types/user.ts']))).toContain(
      'data-testid="impact-panel"',
    )
  })
})
