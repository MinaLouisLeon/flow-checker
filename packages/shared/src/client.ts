// Client boundaries (M43): wording shared by the CLI text, the dashboard, the export and the notes.
import type { AppModel, ClientBoundary, ClientUse, PageClientBoundary, Route, RouteClient } from './model'

/** Short labels for client-only code, as the dashboard shows them. */
export const CLIENT_USE_LABELS: Record<ClientUse['kind'], string> = {
  hook: 'hook',
  event: 'event handler',
  'function-prop': 'function prop',
  'browser-api': 'browser API',
  'class-component': 'class component',
  context: 'context',
}

/** `0.4 KB`, `12 KB`, `1.2 MB`. */
export function sizeText(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  const kb = bytes / 1024
  return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "`useState` (hook)", "`onClick` (event handler)". */
export function clientUseText(use: ClientUse): string {
  return `\`${use.name}\` (${CLIENT_USE_LABELS[use.kind]})`
}

/** The page's browser part in one line. */
export function clientSummary(client: RouteClient): string {
  if (client.boundaries.length === 0)
    return 'Nothing runs in the browser: every component renders on the server.'
  const packages =
    client.packages.length > 0
      ? `, plus ${plural(client.packages.length, 'package')} (${client.packages.map((p) => `\`${p}\``).join(', ')})`
      : ''
  const n = client.boundaries.length
  return `${n} \`'use client'\` ${n === 1 ? 'boundary brings' : 'boundaries bring'} ${plural(client.components, 'component')} and ${plural(client.modules, 'project module')} (about ${sizeText(client.bytes)} of source) to the browser${packages}.`
}

/** "Shell, in the page", "Nav, in a layout", "Counter, from Toolbar". */
export function edgeWhere(edge: PageClientBoundary, name: (id: string) => string): string {
  if (!edge.parentId) return edge.in === 'layout' ? 'the layout itself' : 'the page itself'
  const parent = name(edge.parentId)
  return edge.in === 'component' ? `rendered by \`${parent}\`` : `rendered by \`${parent}\` (${edge.in})`
}

/** What would change if the directive moved down, in one sentence. */
export function lowerText(boundary: ClientBoundary, name: (id: string) => string): string {
  const lower = boundary.lower
  if (!lower) return ''
  const own = name(boundary.componentId)
  const list = (ids: string[]) => ids.map((id) => `\`${name(id)}\``).join(', ')
  if (lower.into.length === 0)
    return `nothing in \`${own}\` or below it needs the browser: \`'use client'\` in \`${boundary.file}\` can go, and ${list(lower.server)} render on the server`
  return `nothing in \`${own}\` needs the browser: \`'use client'\` in \`${boundary.file}\` could move down to ${list(lower.into)}, so ${list(lower.server)} render on the server`
}

/** The boundary facts of a `'use client'` component, when a server component renders it. */
export function clientBoundaryOf(model: AppModel, componentId: string): ClientBoundary | undefined {
  return model.clientBoundaries?.find((b) => b.componentId === componentId)
}

/** True when the page has client facts (models written before M43 have none). */
export function hasClient(route: Route): boolean {
  return route.client !== undefined
}

/** "3 components · 4 modules · 2.1 KB". */
export function bundleText(boundary: ClientBoundary): string {
  return `${plural(boundary.componentIds.length, 'component')} · ${plural(boundary.modules.length, 'module')} · ${sizeText(boundary.bytes)}`
}
