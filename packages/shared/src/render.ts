// Render mode (M38): wording shared by the CLI text, the dashboard and the export.
import type { RenderReason, Route, RouteRender } from './model'

/** A page's render mode; models written before M38 have none, which reads as `unknown`. */
export function renderOf(route: Route): RouteRender {
  return (
    route.render ?? {
      mode: 'unknown',
      reasons: [
        { kind: 'unread', effect: 'unknown', in: 'page', detail: 'scanned by an older version; scan again' },
      ],
    }
  )
}

/** The short label for a badge. */
export const RENDER_LABELS: Record<RouteRender['mode'], string> = {
  static: 'static',
  isr: 'ISR',
  dynamic: 'dynamic',
  partial: 'partial',
  unknown: 'render ?',
}

/** "ISR 1m", "dynamic". */
export function renderLabel(render: RouteRender): string {
  const label = RENDER_LABELS[render.mode]
  return render.mode === 'isr' && render.revalidate !== undefined
    ? `${label} ${durationText(render.revalidate)}`
    : label
}

/** 60 -> `1m`, 3600 -> `1h`, 90 -> `90s`: the units `next build` prints. */
export function durationText(seconds: number): string {
  const units: [number, string][] = [
    [604_800, 'w'],
    [86_400, 'd'],
    [3_600, 'h'],
    [60, 'm'],
  ]
  for (const [size, unit] of units)
    if (seconds >= size && seconds % size === 0) return `${seconds / size}${unit}`
  return `${seconds}s`
}

/** What the reason is: "calls `cookies()`", "`export const dynamic = 'force-dynamic'`". */
export function renderReasonText(reason: RenderReason): string {
  const detail = reason.detail ?? ''
  switch (reason.kind) {
    case 'request-api':
      return `calls \`${detail}()\`, which reads the request`
    case 'search-params':
      return 'reads `searchParams`, which come with each request'
    case 'dynamic-params':
      return `has the dynamic segment ${detail} and no \`generateStaticParams\``
    case 'static-params':
      return '`generateStaticParams` lists the params to prerender'
    case 'segment-config':
      return `\`export const ${detail}\``
    case 'fetch':
      return `fetches with \`${detail}\``
    case 'uncached-data':
      return `requests data outside \`use cache\` (${detail})`
    case 'cached':
      return `caches with \`use cache\`${detail ? ` and \`${detail}\`` : ''}`
    case 'unread':
      return detail
  }
}

const EFFECTS: Record<RenderReason['effect'], string> = {
  dynamic: 'dynamic',
  isr: 'ISR',
  static: 'static',
  unknown: 'not sure',
  info: 'info',
}

const PLACES: Record<RenderReason['in'], string> = { layout: 'layout', page: 'page', component: 'component' }

/** One line: "dynamic: calls `cookies()`, which reads the request (layout)". */
export function renderReasonLine(reason: RenderReason): string {
  const effect =
    reason.effect === 'isr' && reason.revalidate !== undefined
      ? `ISR ${durationText(reason.revalidate)}`
      : EFFECTS[reason.effect]
  return `${effect}: ${renderReasonText(reason)} (${PLACES[reason.in]})`
}
