// Server/client leaks (M44): wording shared by the CLI text, the dashboard, the export and the notes.
import type { AppModel, Leak, ModuleLeak, PropLeak, ServerModuleKind } from './model'

/** What kind of server-only module it is, as a phrase. */
export const SERVER_MODULE_LABELS: Record<ServerModuleKind, string> = {
  'server-only': 'the `server-only` marker',
  node: 'a Node.js module with no browser version',
  database: 'a database client',
  'next-server': 'a Next.js server API',
  'node-package': 'a package that only runs on Node.js',
}

/** Short badges for each kind of leak. */
export const LEAK_LABELS: Record<ServerModuleKind | PropLeak['value'], string> = {
  'server-only': 'server-only',
  node: 'Node.js module',
  database: 'database client',
  'next-server': 'server API',
  'node-package': 'Node.js package',
  function: 'function prop',
  'class-instance': 'class instance prop',
  symbol: 'symbol prop',
  'null-prototype': 'prop without a prototype',
}

/** The glossary key of a leak: its module category or its value kind. */
export function leakKind(leak: Leak): ServerModuleKind | PropLeak['value'] {
  return leak.kind === 'module' ? leak.category : leak.value
}

/** "`revalidatePath` from `next/cache`", "`pg`". */
export function importText(leak: ModuleLeak): string {
  return leak.names && leak.names.length > 0
    ? `${leak.names.map((n) => `\`${n}\``).join(', ')} from \`${leak.module}\``
    : `\`${leak.module}\``
}

/** "a function", "a `Thing` instance". */
export function propValueText(leak: PropLeak): string {
  switch (leak.value) {
    case 'function':
      return 'a function'
    case 'class-instance':
      return leak.type ? `a \`${leak.type}\` instance` : 'a class instance'
    case 'symbol':
      return 'a symbol made with `Symbol()`'
    case 'null-prototype':
      return 'an object without a prototype'
  }
}

/** The client component a prop goes to: "`Widget`", "`Dialog` from `ui-kit`". */
export function propTargetText(leak: PropLeak): string {
  return leak.module ? `\`${leak.name}\` from \`${leak.module}\`` : `\`${leak.name}\``
}

/** The leak in one sentence (without the pages). */
export function leakText(leak: Leak, name: (id: string) => string): string {
  if (leak.kind === 'module') {
    const what = `imports ${importText(leak)} (${SERVER_MODULE_LABELS[leak.category]})`
    if (leak.chain.length <= 1) return `client code in \`${leak.file}\` ${what}`
    return `\`${leak.file}\` ${what}, and client code imports it: ${leak.chain.map((f) => `\`${f}\``).join(' → ')}`
  }
  return `\`${name(leak.parentId)}\` hands \`${leak.prop}\` (${propValueText(leak)}) to the client component ${propTargetText(leak)}`
}

/** Why it matters, in one sentence. */
export function leakWhy(leak: Leak): string {
  if (leak.kind === 'prop') {
    return leak.value === 'function'
      ? 'Only server actions and plain data cross from the server to the browser, so the page fails to render.'
      : 'Only plain objects and a few built-ins cross from the server to the browser, so the page fails to render.'
  }
  switch (leak.category) {
    case 'server-only':
      return 'The file is marked for the server only, so the build fails.'
    case 'node':
      return 'The browser has no version of it, so the build fails.'
    case 'next-server':
      return 'Next only allows it in server code, so the build fails.'
    case 'database':
      return 'It either fails to build or sends a database connection to the browser.'
    case 'node-package':
      return 'It only runs on Node.js, so it fails in the browser.'
  }
}

/** The leaks on a page. */
export function leaksOn(model: AppModel, routeId: string): Leak[] {
  return (model.leaks ?? []).filter((l) => l.routeIds.includes(routeId))
}

/** The leaks of a component: module leaks through its boundary, prop leaks it hands or receives. */
export function leaksOfComponent(model: AppModel, componentId: string): Leak[] {
  return (model.leaks ?? []).filter((l) =>
    l.kind === 'module'
      ? l.boundaries.includes(componentId)
      : l.parentId === componentId || l.componentId === componentId,
  )
}
