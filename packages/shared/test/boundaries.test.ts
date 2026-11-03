// M41: one wording for boundary gaps and titles, shared by the CLI, the dashboard and the export.
import { describe, expect, it } from 'vitest'
import {
  AppModelSchema,
  type BoundaryGap,
  BoundaryGapSchema,
  boundaryText,
  GAP_LABELS,
  gapLine,
  gapText,
  isBuildError,
  MODEL_VERSION,
  titleText,
} from '../src/index'

describe('gap wording', () => {
  it('says what each gap does, in plain words', () => {
    const text = (gap: BoundaryGap) => gapText(gap)
    expect(text({ kind: 'blocking-route', detail: 'cookies' })).toBe(
      'reads `cookies()` outside `<Suspense>`, so `next build` fails (a blocking route)',
    )
    expect(text({ kind: 'blocking-route', detail: 'searchParams' })).toBe(
      'awaits `searchParams` outside `<Suspense>`, so `next build` fails (a blocking route)',
    )
    expect(text({ kind: 'blocking-route', detail: 'fetch' })).toContain('requests data (`fetch`) outside')
    expect(text({ kind: 'no-fallback', detail: 'axios', more: 2 })).toBe(
      'waits for a request (`axios`) (and 2 more) with no `loading` file or `<Suspense>` to show meanwhile',
    )
    expect(text({ kind: 'no-not-found', detail: 'forbidden', file: 'forbidden' })).toBe(
      'calls `forbidden()` with no `forbidden` file above it, so Next shows its default page',
    )
    expect(text({ kind: 'slot-no-match', detail: '@modal' })).toContain('the slot `@modal` has no page')
    expect(text({ kind: 'no-canonical', detail: '/post/[id]' })).toContain('intercepts `/post/[id]`')
  })

  it('has a label for every kind and pairs its backticks', () => {
    for (const kind of BoundaryGapSchema.shape.kind.options) {
      expect(GAP_LABELS[kind]).toBeTruthy()
      expect(gapLine({ kind, in: 'page' }).split('`').length % 2, kind).toBe(1)
    }
  })

  it('marks the gaps `next build` rejects', () => {
    expect(isBuildError({ kind: 'blocking-route' })).toBe(true)
    expect(isBuildError({ kind: 'slot-no-match' })).toBe(true)
    expect(isBuildError({ kind: 'no-fallback' })).toBe(false)
  })

  it('names files by folder and component boundaries by what they wrap', () => {
    expect(boundaryText({ kind: 'loading', file: 'app/shop/loading.tsx', in: 'segment' })).toBe(
      '`loading` in `app/shop/`',
    )
    expect(
      boundaryText({ kind: 'suspense', file: 'app/page.tsx', in: 'page', wraps: ['List', 'children'] }),
    ).toBe('`<Suspense>` around `List`, `children` (page)')
  })
})

describe('titles', () => {
  it('says why there is no title', () => {
    expect(titleText({ title: 'About | Shop', sources: [] })).toBe('About | Shop')
    expect(titleText({ titleUnread: true, sources: [] })).toBe("set in code the scan can't read")
    expect(titleText({ sources: [] })).toBe('none')
    expect(titleText(undefined)).toBe('not scanned (scan again)')
  })
})

describe('older models', () => {
  it('loads version 14 models without boundaries or metadata', () => {
    const parsed = AppModelSchema.parse({
      version: 14,
      project: { appDir: 'app' },
      routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'app', files: {}, children: [] },
      routes: [{ id: 'rt_1', path: '/', kind: 'page', file: 'app/page.tsx', segments: [], layoutChain: [] }],
      components: [],
      types: [],
    })
    expect(parsed.version).toBe(MODEL_VERSION)
    expect(parsed.routes[0]?.boundaries).toBeUndefined()
    expect(parsed.routes[0]?.metadata).toBeUndefined()
  })
})
