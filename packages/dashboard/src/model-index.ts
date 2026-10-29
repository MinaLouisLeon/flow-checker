// The model index lives in @flow-checker/shared (the exporter uses it too). These helpers only
// make sense in the dashboard, next to a running app and an editor.
import type { Route } from '@flow-checker/shared'

export {
  buildIndex,
  type ModelIndex,
  type NoteKind,
  type RenderSite,
  requestLabel,
  type ScanNote,
  type TypeUsage,
  typeRefs,
} from '@flow-checker/shared'

/** The URL for a page in the running app, or undefined when the path has dynamic segments. */
export function appUrl(route: Route, appPort: number | undefined): string | undefined {
  if (route.kind !== 'page' || !appPort) return undefined
  if (route.segments.some((s) => s.kind !== 'static' && s.kind !== 'group' && s.kind !== 'slot')) {
    return undefined
  }
  return `http://localhost:${appPort}${route.path}`
}

/** `vscode://` link that opens a file at a position. */
export function editorUrl(root: string | undefined, file: string, line = 1, column = 1): string | undefined {
  if (!root) return undefined
  const path = `${root.replace(/\/+$/, '')}/${file}`
  const encoded = encodeURI(path.startsWith('/') ? path.slice(1) : path)
    .replaceAll('#', '%23')
    .replaceAll('?', '%3F')
  return `vscode://file/${encoded}:${line}:${column}`
}
