// Special files and boundaries (M41): wording shared by the CLI text, the dashboard and the export.
import type { BoundaryGap, PageBoundary, Route, RouteMetadata } from './model'

/** Short labels for boundary kinds, as the dashboard shows them. */
export const BOUNDARY_LABELS: Record<PageBoundary['kind'], string> = {
  loading: 'loading',
  error: 'error',
  'not-found': 'not-found',
  forbidden: 'forbidden',
  unauthorized: 'unauthorized',
  'global-error': 'global-error',
  suspense: '<Suspense>',
  'error-boundary': 'error boundary',
}

/** Short labels for gap kinds. */
export const GAP_LABELS: Record<BoundaryGap['kind'], string> = {
  'blocking-route': 'blocks the build',
  'no-fallback': 'no loading state',
  'no-error-boundary': 'no error boundary',
  'no-not-found': 'no not-found page',
  'slot-no-match': 'slot without default',
  'no-canonical': 'no page to intercept',
}

/** Gaps that make `next build` fail (Next 16). */
export function isBuildError(gap: BoundaryGap): boolean {
  return gap.kind === 'blocking-route' || gap.kind === 'slot-no-match' || gap.kind === 'no-canonical'
}

const REQUEST_APIS = new Set(['cookies', 'headers', 'draftMode', 'connection', 'unstable_noStore'])

/** What the gap is about, as code: `cookies()`, `searchParams`, `fetch`. */
function what(detail: string | undefined): string {
  if (!detail) return 'request data'
  if (REQUEST_APIS.has(detail)) return `\`${detail}()\``
  if (detail === 'searchParams' || detail === 'params') return `awaits \`${detail}\``
  return `requests data (\`${detail}\`)`
}

/** One plain sentence: "reads `cookies()` outside `<Suspense>`, so `next build` fails". */
export function gapText(gap: BoundaryGap): string {
  const more = gap.more ? ` (and ${gap.more} more)` : ''
  switch (gap.kind) {
    case 'blocking-route': {
      const read = gap.detail && REQUEST_APIS.has(gap.detail) ? `reads ${what(gap.detail)}` : what(gap.detail)
      return `${read} outside \`<Suspense>\`, so \`next build\` fails (a blocking route)`
    }
    case 'no-fallback':
      return `waits for a request (\`${gap.detail ?? 'fetch'}\`)${more} with no \`loading\` file or \`<Suspense>\` to show meanwhile`
    case 'no-error-boundary':
      return `fetches on the server (\`${gap.detail ?? 'fetch'}\`)${more}, and no \`error\` file, error boundary or \`global-error\` catches a failure`
    case 'no-not-found': {
      const file = gap.file ?? 'not-found'
      return `calls \`${gap.detail ?? 'notFound'}()\` with no \`${file}\` file above it, so Next shows its default page`
    }
    case 'slot-no-match':
      return `the slot \`${gap.detail ?? '?'}\` has no page for this URL and no \`default\` file: Next 16 fails the build, earlier versions show 404 on a full page load`
    case 'no-canonical':
      return `intercepts \`${gap.detail ?? '?'}\`, which has no page of its own: Next 16 fails the build, earlier versions show 404 on a refresh`
  }
}

const PLACES: Record<NonNullable<BoundaryGap['in']>, string> = {
  layout: 'layout',
  page: 'page',
  component: 'component',
}

/** "no loading state: waits for a request (`fetch`) … (page)". */
export function gapLine(gap: BoundaryGap): string {
  return `${GAP_LABELS[gap.kind]}: ${gapText(gap)}${gap.in ? ` (${PLACES[gap.in]})` : ''}`
}

/** "`loading` in `app/dashboard`", "`<Suspense>` around `TodoList`". */
export function boundaryText(item: PageBoundary): string {
  if (item.in === 'segment') {
    const folder = item.file.slice(0, item.file.lastIndexOf('/'))
    return `\`${item.kind}\` in \`${folder}/\``
  }
  const wraps =
    item.wraps && item.wraps.length > 0 ? ` around ${item.wraps.map((w) => `\`${w}\``).join(', ')}` : ''
  return `${item.kind === 'suspense' ? '`<Suspense>`' : 'an error boundary'}${wraps} (${item.in})`
}

/** The page's title as a line: "`About | Shop`", "set at runtime", "none". */
export function titleText(metadata: RouteMetadata | undefined): string {
  if (!metadata) return 'not scanned (scan again)'
  if (metadata.title) return metadata.title
  if (metadata.titleUnread) return "set in code the scan can't read"
  return 'none'
}

/** True when the page has boundary facts (models written before M41 have none). */
export function hasBoundaries(route: Route): boolean {
  return route.boundaries !== undefined
}
