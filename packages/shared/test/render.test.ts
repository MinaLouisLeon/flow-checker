// M38: render mode wording, and models written before it.
import { describe, expect, it } from 'vitest'
import {
  AppModelSchema,
  durationText,
  MODEL_VERSION,
  type Route,
  renderLabel,
  renderOf,
  renderReasonLine,
} from '../src/index'

describe('render wording', () => {
  it('prints durations the way next build does', () => {
    expect(durationText(60)).toBe('1m')
    expect(durationText(3600)).toBe('1h')
    expect(durationText(86_400)).toBe('1d')
    expect(durationText(604_800)).toBe('1w')
    expect(durationText(90)).toBe('90s')
    expect(durationText(1)).toBe('1s')
  })

  it('labels ISR with its time', () => {
    expect(renderLabel({ mode: 'isr', revalidate: 300, reasons: [] })).toBe('ISR 5m')
    expect(renderLabel({ mode: 'dynamic', reasons: [] })).toBe('dynamic')
    expect(renderLabel({ mode: 'unknown', reasons: [] })).toBe('render ?')
  })

  it('writes one line per reason', () => {
    expect(
      renderReasonLine({ kind: 'request-api', effect: 'dynamic', in: 'layout', detail: 'cookies' }),
    ).toBe('dynamic: calls `cookies()`, which reads the request (layout)')
    expect(
      renderReasonLine({
        kind: 'segment-config',
        effect: 'isr',
        in: 'page',
        detail: 'revalidate = 60',
        revalidate: 60,
      }),
    ).toBe('ISR 1m: `export const revalidate = 60` (page)')
    expect(renderReasonLine({ kind: 'static-params', effect: 'info', in: 'page' })).toBe(
      'info: `generateStaticParams` lists the params to prerender (page)',
    )
  })

  it('loads version 12 models without render, read as unknown', () => {
    const parsed = AppModelSchema.parse({
      version: 12,
      project: { appDir: 'app' },
      routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'app', files: {}, children: [] },
      routes: [{ id: 'rt_1', path: '/', kind: 'page', file: 'app/page.tsx', segments: [], layoutChain: [] }],
      components: [],
      types: [],
    })
    expect(parsed.version).toBe(MODEL_VERSION)
    const render = renderOf(parsed.routes[0] as Route)
    expect(render.mode).toBe('unknown')
    expect(render.reasons[0]?.detail).toContain('older version')
  })
})
