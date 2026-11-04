// Environment variables (M45): wording shared by the CLI text, the dashboard, the export and the notes.
// Only names are ever shown: the model holds no values.
import type {
  AppModel,
  EnvFlag,
  EnvFlagKind,
  EnvMap,
  EnvRead,
  EnvSide,
  EnvUnknownRead,
  EnvVar,
} from './model'

/** Next inlines names with this prefix into browser code. */
export const PUBLIC_PREFIX = 'NEXT_PUBLIC_'

/** Short labels for each side. */
export const ENV_SIDE_LABELS: Record<EnvSide, string> = {
  server: 'server',
  client: 'client',
  both: 'server and client',
  config: 'next.config',
}

/** Short badges for each flag. */
export const ENV_FLAG_LABELS: Record<EnvFlagKind, string> = {
  'private-in-client': 'private name in client code',
  'not-defined': 'not defined',
  'not-inlined': 'not inlined',
}

const EMPTY: EnvMap = { files: [], vars: [], unknown: [] }

export function envOf(model: Pick<AppModel, 'env'>): EnvMap {
  return model.env ?? EMPTY
}

/** Every flag with its variable, in name order. */
export function envFlags(env: EnvMap): { variable: EnvVar; flag: EnvFlag }[] {
  return env.vars.flatMap((variable) => (variable.flags ?? []).map((flag) => ({ variable, flag })))
}

/** Reads of a name built at run time in client code: Next can't inline them. */
export function unknownInClient(env: EnvMap): EnvUnknownRead[] {
  return env.unknown.filter((r) => r.side === 'client' || r.side === 'both')
}

/** The reads a flag is about: client reads for the client flags, required reads for `not-defined`. */
export function flaggedReads(variable: EnvVar, kind: EnvFlagKind): EnvRead[] {
  switch (kind) {
    case 'private-in-client':
      return variable.reads.filter((r) => r.side === 'client' || r.side === 'both')
    case 'not-inlined':
      return variable.reads.filter(
        (r) => (r.side === 'client' || r.side === 'both') && r.access === 'destructured',
      )
    case 'not-defined':
      return variable.reads.filter((r) => !r.optional)
  }
}

/** The pages a flag shows up on: for the client flags, only pages whose client code reaches the read. */
export function flagRouteIds(variable: EnvVar, kind: EnvFlagKind): string[] {
  const pages = (r: EnvRead) =>
    kind !== 'not-defined' && r.side === 'both' ? (r.clientRouteIds ?? r.routeIds) : r.routeIds
  return [...new Set(flaggedReads(variable, kind).flatMap(pages))]
}

/** The flag in one sentence (without the pages). */
export function envFlagText(variable: EnvVar, kind: EnvFlagKind): string {
  const name = `\`${variable.name}\``
  switch (kind) {
    case 'private-in-client': {
      const reads = flaggedReads(variable, kind)
      const shared = reads.find((r) => r.side === 'both')
      const where = shared
        ? `\`${shared.loc.file}\`, which server and client code both import`
        : `client code (\`${reads[0]?.loc.file ?? '?'}\`)`
      return `${name} has no \`${PUBLIC_PREFIX}\` prefix but is read in ${where}, so it is undefined in the browser`
    }
    case 'not-inlined':
      return `${name} is destructured from \`process.env\` in client code; Next only inlines \`process.env.${variable.name}\`, so it is undefined in the browser`
    case 'not-defined':
      return `${name} is read without a fallback, but no \`.env\` file defines it`
  }
}

/** A read of a name built at run time, in one sentence. */
export function unknownText(read: EnvUnknownRead): string {
  const what = `\`process.env[${read.key}]\` reads a name built at run time`
  return read.side === 'client' || read.side === 'both'
    ? `${what} in client code; Next can't inline it, so it is undefined in the browser`
    : `${what}, so the scan can't tell which variable it is`
}

/** Where the value comes from: "`.env`, `.env.local`", "set by Next", "only in `.env.example`". */
export function definedText(variable: EnvVar): string {
  if (variable.definedIn.length > 0) return variable.definedIn.map((f) => `\`${f}\``).join(', ')
  if (variable.setBy === 'next') return 'set by Next'
  if (variable.setBy === 'flow-checker') return 'set by flow-checker'
  if (variable.setBy === 'vercel') return 'set by Vercel'
  if (variable.listedIn?.length)
    return `only listed in ${variable.listedIn.map((f) => `\`${f}\``).join(', ')}`
  return 'not defined'
}

/** Whether the app gets a value for it from a file, `next.config` or Next itself. */
export function isDefined(variable: EnvVar): boolean {
  return variable.definedIn.length > 0 || variable.setBy !== undefined
}

/** Defined, or listed in a file such as `.env.example` for each developer to fill in: nothing to point out. */
export function hasSource(variable: EnvVar): boolean {
  return isDefined(variable) || (variable.listedIn?.length ?? 0) > 0
}

/** The sides a name is read on, in a fixed order. */
export function sidesOf(variable: Pick<EnvVar, 'reads'>): EnvSide[] {
  const order: EnvSide[] = ['server', 'client', 'both', 'config']
  const found = new Set(variable.reads.map((r) => r.side))
  return order.filter((s) => found.has(s))
}

/**
 * The names a page's code reads, each with only the reads on that page. A read in a module both
 * sides import is `server` on a page whose client code doesn't reach it.
 */
export function envOn(model: Pick<AppModel, 'env'>, routeId: string): EnvVar[] {
  const out: EnvVar[] = []
  for (const variable of envOf(model).vars) {
    const reads = variable.reads
      .filter((r) => r.routeIds.includes(routeId))
      .map((r) =>
        r.side === 'both' && r.clientRouteIds && !r.clientRouteIds.includes(routeId)
          ? { ...r, side: 'server' as const }
          : r,
      )
    if (reads.length > 0) out.push({ ...variable, reads })
  }
  return out
}

/** The flags that show up on a page. */
export function envFlagsOn(variable: EnvVar, routeId: string): EnvFlag[] {
  return (variable.flags ?? []).filter((f) => flagRouteIds(variable, f.kind).includes(routeId))
}

/** The CLI's `scan --tree` section: files, then each name, then the reads it can't name. */
export function formatEnv(model: Pick<AppModel, 'env' | 'routes'>): string[] {
  const env = model.env
  if (!env) return []
  const paths = new Map(model.routes.map((r) => [r.id, r.path]))
  const out = ['# Environment variables']
  if (env.files.length > 0) {
    out.push(
      `files: ${env.files
        .map((f) => `${f.file} (${f.names}${f.loads.length === 0 ? ', not loaded' : ''})`)
        .join(', ')}`,
    )
  }
  for (const v of env.vars) {
    const flags = (v.flags ?? []).map((f) => ` [${f.kind}]`).join('')
    out.push('', `${v.name}: ${definedText(v).replaceAll('`', '')}${flags}`)
    for (const r of v.reads) {
      const pages = r.routeIds.map((id) => paths.get(id) ?? '?').join(', ')
      out.push(
        `  ${r.side}${r.access === 'direct' ? '' : ` ${r.access}`}${r.optional ? ' optional' : ''}  ${r.loc.file}:${r.loc.line}${pages ? `  ${pages}` : ''}`,
      )
    }
  }
  if (env.unknown.length > 0) {
    out.push('', 'names built at run time:')
    for (const r of env.unknown) out.push(`  ${r.side} process.env[${r.key}]  ${r.loc.file}:${r.loc.line}`)
  }
  return out
}
