// M35: the Walk the app screen and the coverage bars, rendered in node with react-dom/server.
import { readFileSync } from 'node:fs'
import { AppModelSchema, type FlowsSummary } from '@flow-checker/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Meta } from '../src/api'
import { DataContext } from '../src/context'
import { buildIndex, type ModelIndex } from '../src/model-index'
import { href, parseHash } from '../src/router'
import { Overview } from '../src/screens/Overview'
import { StartScreen } from '../src/screens/StartScreen'
import { WalkScreen } from '../src/screens/WalkScreen'

const model = (name: string) =>
  AppModelSchema.parse(
    JSON.parse(
      readFileSync(new URL(`../../scanner/test/__snapshots__/${name}.model.json`, import.meta.url), 'utf8'),
    ),
  )

const LIVE: Meta = { canRescan: true, capture: { storeRaw: false }, appPort: 3000, root: '/p' }
const EXPLORE: Meta = {
  canRescan: true,
  explore: { setup: false, dataDir: '/tmp/x', enableCapture: ['npx flow-checker init', 'npx flow-checker'] },
}

function render(index: ModelIndex, meta: Meta, view: ReturnType<typeof createElement>, flows?: FlowsSummary) {
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } })
  if (flows) client.setQueryData(['flows'], flows)
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(DataContext.Provider, { value: { index, meta } }, view),
    ),
  )
}

const walk = (flowId?: string) => createElement(WalkScreen, { flowId })
const count = (html: string, re: RegExp) => html.match(re)?.length ?? 0

describe('routing', () => {
  it('round-trips the walk screen with and without a flow', () => {
    expect(parseHash(href({ name: 'walk' }))).toEqual({ name: 'walk' })
    expect(href({ name: 'walk', flowId: 'flw_1' })).toBe('#/walk/flw_1')
    expect(parseHash('#/walk/flw_1')).toEqual({ name: 'walk', flowId: 'flw_1' })
  })
})

describe('next-intl, capture on', () => {
  const index = buildIndex(model('next-intl'))
  const login = index.model.flows.find((f) => f.name === 'LoginForm submit')

  it('links the start page in the app with the suggested locale', () => {
    const html = render(index, LIVE, walk())
    expect(html).toContain('href="http://localhost:3000/en/login"')
    expect(html).toMatch(/Open in app ↗<\/a>/)
    expect(html).toContain('aria-label="Value for [locale]"')
    expect(html).toContain('Submit the form in <code>LoginForm</code>')
    expect(count(html, /data-testid="walk-item"/g)).toBe(index.model.flows.length)
    expect(count(html, /data-done="1"/g)).toBe(0)
  })

  it('ticks the steps the best run walked and shows its share', () => {
    const flows: FlowsSummary = {
      flows: {
        [login?.id ?? '']: {
          status: 'partial',
          source: 'inferred',
          runs: 1,
          best: { sessionId: 's', startedAt: '2026-11-02T00:00:00Z', steps: 3, complete: false },
          branches: [],
        },
      },
      recorded: [],
    }
    const html = render(index, LIVE, walk(), flows)
    expect(count(html, /data-done="1"/g)).toBe(3)
    expect(html).toContain('42%')
    expect(html).toContain('partial')
  })

  it('moves a confirmed flow to Walked and reaches 100%', () => {
    const flows: FlowsSummary = {
      flows: {
        [login?.id ?? '']: {
          status: 'confirmed',
          source: 'both',
          runs: 1,
          best: { sessionId: 's', startedAt: '2026-11-02T00:00:00Z', steps: 7, complete: true },
          branches: [],
        },
      },
      recorded: [],
    }
    const html = render(index, LIVE, walk(), flows)
    expect(html).toContain('Every flow was walked end to end.')
    expect(html).toMatch(/data-testid="walk-percent">100%/)
    expect(html).toMatch(/data-testid="coverage-flows".*?100%/)
    // A walked flow can still be opened, to walk it again after a change.
    expect(count(html, /Open in app ↗<\/a>/g)).toBe(1)
  })
})

describe('reading guide', () => {
  const index = buildIndex(model('basic'))

  it('without capture (explore) shows the steps and how to turn capture on, no app links', () => {
    const html = render(index, EXPLORE, walk())
    expect(html).toContain('data-testid="capture-hint"')
    expect(html).toContain('npx flow-checker init')
    expect(html).toContain('as a reading guide')
    expect(html).not.toContain('Open in app')
    expect(html).not.toContain('data-done')
    expect(html).toContain('Click in <code>DeleteUserButton</code>')
  })

  it('asks for a dynamic segment before linking a page that needs one', () => {
    const html = render(index, LIVE, walk())
    expect(html).toContain('Fill in [id] above')
    expect(html).not.toMatch(/Open in app ↗<\/a>/)
  })
})

describe('coverage on Start here and the overview', () => {
  it.each(['basic', 'next-intl', 'react-query'])('%s shows both bars with a link to the walk', (fixture) => {
    const index = buildIndex(model(fixture))
    for (const view of [createElement(StartScreen), createElement(Overview)]) {
      const html = render(index, LIVE, view)
      expect(html).toContain('data-testid="coverage-flows"')
      expect(html).toContain('data-testid="coverage-requests"')
      expect(html).toContain(`href="${href({ name: 'walk' })}"`)
    }
  })
})
