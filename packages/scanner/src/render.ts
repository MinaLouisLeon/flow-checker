// Render mode (M38): how Next renders each page in a production build, and why. Request-time APIs
// and server requests come from the walk of the page, its layouts and the components they render;
// segment config, `searchParams` and `generateStaticParams` are read from the page and layout files.
// The rules follow the Next docs and were checked against `next build` (with and without Cache
// Components).
import type { Component, RenderReason, Route, RouteRender, SourceLoc } from '@flow-checker/shared'
import { Node as N, type Node, type SourceFile, ts } from 'ts-morph'
import { componentsBelow, groupBy } from './access'
import { relativeTo } from './paths'
import type { RenderUse, Unfollowed, UseCache } from './requests'

export interface RenderInput {
  root: string
  routes: Route[]
  components: Component[]
  uses: RenderUse[]
  unfollowed: Unfollowed[]
  /** The project file for a project-relative path. */
  fileOf: (file: string) => SourceFile | undefined
  /** `cacheComponents: true` in the Next config. */
  cacheComponents: boolean
}

type Place = RenderReason['in']

/** Sets `render` on every page. */
export function addRouteRender(input: RenderInput): void {
  const { root, components, cacheComponents } = input
  const below = componentsBelow(components)
  const uses = groupBy(input.uses, (u) => u.componentId)
  const unfollowed = groupBy(
    input.unfollowed.filter((u) => u.server),
    (u) => u.componentId,
  )
  const files = new Map<string, FileFacts>()
  const factsOf = (file: string) => {
    let facts = files.get(file)
    if (!facts) {
      const sf = input.fileOf(file)
      facts = sf ? readFile(sf, root) : { config: [], unread: [] }
      files.set(file, facts)
    }
    return facts
  }

  for (const page of input.routes) {
    if (page.kind !== 'page') continue
    const reasons: RenderReason[] = []
    const add = (reason: RenderReason) => {
      const same = reasons.some(
        (r) =>
          r.kind === reason.kind &&
          r.detail === reason.detail &&
          r.loc?.file === reason.loc?.file &&
          r.loc?.line === reason.loc?.line &&
          r.loc?.column === reason.loc?.column,
      )
      if (!same) reasons.push(reason)
    }

    // Segment config, outermost layout first. Cache Components doesn't allow it, so it's ignored there.
    const layouts = page.layoutChain.filter((l) => l.kind === 'layout')
    const segmentFiles: { file: string; in: Place }[] = [
      ...layouts.map((l) => ({ file: l.file, in: 'layout' as const })),
      { file: page.file, in: 'page' as const },
    ]
    const fetchCache: string[] = []
    for (const { file, in: place } of segmentFiles) {
      const facts = factsOf(file)
      for (const unread of facts.unread) {
        add({ kind: 'unread', effect: 'unknown', in: place, detail: unread.text, loc: unread.loc })
      }
      if (cacheComponents) continue
      for (const config of facts.config) {
        if (config.name === 'fetchCache' && typeof config.value === 'string') fetchCache.push(config.value)
        const reason = configReason(config, place)
        if (reason) add(reason)
      }
    }

    // `searchParams` (the page and its `generateMetadata`).
    const pageFacts = factsOf(page.file)
    if (pageFacts.searchParams) {
      add({ kind: 'search-params', effect: 'dynamic', in: 'page', loc: pageFacts.searchParams })
    }

    // Dynamic segments need `generateStaticParams` in the page or a layout at or below them.
    const dynamicSegments = page.segments
      .map((segment, depth) => ({ segment, depth }))
      .filter(({ segment }) => isParam(segment.kind))
    if (dynamicSegments.length > 0) {
      const appDepth = (file: string) => file.split('/').length - 1 - appDirDepth(page)
      const listing = [
        ...layouts.map((l) => ({ file: l.file, in: 'layout' as const, depth: appDepth(l.file) })),
        { file: page.file, in: 'page' as const, depth: page.segments.length },
      ].filter((f) => factsOf(f.file).staticParams)
      const missing = dynamicSegments.filter(({ depth }) => !listing.some((f) => f.depth > depth))
      if (missing.length > 0) {
        add({
          kind: 'dynamic-params',
          effect: 'dynamic',
          in: 'page',
          detail: missing.map(({ segment }) => `\`${segment.raw}\``).join(', '),
        })
      }
      for (const f of listing) {
        add({
          kind: 'static-params',
          effect: 'info',
          in: f.in,
          loc: factsOf(f.file).staticParams as SourceLoc,
        })
      }
    }

    // What the components below the layouts and the page do while they render.
    const roots: { id: string; in: 'layout' | 'page' }[] = [
      ...page.layoutChain.flatMap((l) =>
        l.componentId ? [{ id: l.componentId, in: 'layout' as const }] : [],
      ),
      ...(page.componentId ? [{ id: page.componentId, in: 'page' as const }] : []),
    ]
    const seen = new Set<string>()
    for (const root of roots) {
      for (const id of below(root.id)) {
        if (seen.has(id)) continue
        seen.add(id)
        const place: Place = id === root.id ? root.in : 'component'
        for (const use of uses.get(id) ?? []) {
          const reason = useReason(use, place, cacheComponents, fetchCache)
          if (reason) add(reason)
        }
        for (const call of unfollowed.get(id) ?? []) {
          const why =
            call.why === 'excluded' ? 'from a file the config excludes' : "whose import doesn't resolve"
          add({
            kind: 'unread',
            effect: 'unknown',
            in: place,
            componentId: id,
            detail: `calls \`${call.callee}\` ${why}, which might read the request`,
            loc: call.loc,
          })
        }
      }
    }

    page.render = { ...modeOf(reasons, cacheComponents), reasons: sortReasons(reasons) }
  }
}

function isParam(kind: string): boolean {
  return kind === 'dynamic' || kind === 'catch-all' || kind === 'optional-catch-all'
}

/** How many path parts `app/` (or `src/app/`) has, from the page file and its segments. */
function appDirDepth(page: Route): number {
  return page.file.split('/').length - 1 - page.segments.length
}

/** The mode the reasons add up to, and the ISR time. */
export function modeOf(
  reasons: readonly RenderReason[],
  cacheComponents: boolean,
): Pick<RouteRender, 'mode' | 'revalidate'> {
  const has = (effect: RenderReason['effect']) => reasons.some((r) => r.effect === effect)
  const times = reasons.flatMap((r) =>
    r.effect === 'isr' && r.revalidate !== undefined ? [r.revalidate] : [],
  )
  const isr = (): Pick<RouteRender, 'mode' | 'revalidate'> =>
    times.length > 0 ? { mode: 'isr', revalidate: Math.min(...times) } : { mode: 'static' }
  // `force-static` / `error` prerender whatever the page reads.
  if (!cacheComponents && has('static')) return isr()
  if (has('dynamic')) {
    // With Cache Components the static shell around the dynamic parts has a time too.
    if (!cacheComponents) return { mode: 'dynamic' }
    return times.length > 0 ? { mode: 'partial', revalidate: Math.min(...times) } : { mode: 'partial' }
  }
  if (has('unknown')) return { mode: 'unknown' }
  return isr()
}

const EFFECT_ORDER: Record<RenderReason['effect'], number> = {
  static: 0,
  dynamic: 1,
  unknown: 2,
  isr: 3,
  info: 4,
}
const PLACE_ORDER: Record<Place, number> = { layout: 0, page: 1, component: 2 }

function sortReasons(reasons: RenderReason[]): RenderReason[] {
  return [...reasons].sort(
    (a, b) =>
      EFFECT_ORDER[a.effect] - EFFECT_ORDER[b.effect] ||
      PLACE_ORDER[a.in] - PLACE_ORDER[b.in] ||
      (a.loc?.file ?? '').localeCompare(b.loc?.file ?? '') ||
      (a.loc?.line ?? 0) - (b.loc?.line ?? 0) ||
      (a.loc?.column ?? 0) - (b.loc?.column ?? 0),
  )
}

function useReason(
  use: RenderUse,
  place: Place,
  cacheComponents: boolean,
  fetchCache: readonly string[],
): RenderReason | undefined {
  const base = { in: place, componentId: use.componentId, loc: use.loc }
  if (use.kind === 'request-api') return { ...base, kind: 'request-api', effect: 'dynamic', detail: use.api }
  // `unstable_cache` sets the page's time with or without Cache Components; `use cache` needs them.
  if (use.kind === 'cached') {
    return cacheComponents || use.cached.api ? cachedReason(base, use.cached) : undefined
  }
  const site = { siteId: use.siteId }
  if (use.cached?.api) return cachedReason({ ...base, ...site }, use.cached)
  const options = use.fetch
  if (cacheComponents) {
    if (use.cached) return cachedReason({ ...base, ...site }, use.cached)
    // A fetch that asks to be cached is prerendered (checked with `next build`); `next.tags` alone isn't enough.
    if (use.transport === 'fetch' && options && !options.unread) {
      if (typeof options.revalidate === 'number' && options.revalidate > 0) {
        const detail = `next: { revalidate: ${options.revalidate} }`
        return { ...base, ...site, kind: 'fetch', effect: 'isr', detail, revalidate: options.revalidate }
      }
      if (options.cache === 'force-cache' || options.revalidate === false) {
        const detail =
          options.cache === 'force-cache' ? "cache: 'force-cache'" : 'next: { revalidate: false }'
        return { ...base, ...site, kind: 'fetch', effect: 'info', detail }
      }
    }
    return { ...base, ...site, kind: 'uncached-data', effect: 'dynamic', detail: `\`${use.transport}\`` }
  }
  if (!options) return undefined
  if (options.unread) {
    return {
      ...base,
      ...site,
      kind: 'unread',
      effect: 'unknown',
      detail: "the cache options of this `fetch` can't be read",
    }
  }
  // `fetchCache` changes what a fetch's own options do.
  const forced = fetchCache.find((v) => v === 'force-cache' || v === 'force-no-store')
  if (forced === 'force-no-store') {
    return { ...base, ...site, kind: 'fetch', effect: 'dynamic', detail: "fetchCache = 'force-no-store'" }
  }
  if (options.cache === 'no-store' && forced !== 'force-cache') {
    return { ...base, ...site, kind: 'fetch', effect: 'dynamic', detail: "cache: 'no-store'" }
  }
  if (options.revalidate === 0 && forced !== 'force-cache') {
    return { ...base, ...site, kind: 'fetch', effect: 'dynamic', detail: 'next: { revalidate: 0 }' }
  }
  if (typeof options.revalidate === 'number' && options.revalidate > 0) {
    return {
      ...base,
      ...site,
      kind: 'fetch',
      effect: 'isr',
      detail: `next: { revalidate: ${options.revalidate} }`,
      revalidate: options.revalidate,
    }
  }
  if (
    options.cache === undefined &&
    fetchCache.some((v) => v === 'default-no-store' || v === 'only-no-store')
  ) {
    const value = fetchCache.find((v) => v === 'default-no-store' || v === 'only-no-store')
    return { ...base, ...site, kind: 'fetch', effect: 'dynamic', detail: `fetchCache = '${value}'` }
  }
  return undefined
}

/** A `use cache` scope (with its `cacheLife`) or an `unstable_cache()` call. */
function cachedReason(base: Omit<RenderReason, 'kind' | 'effect'>, cached: UseCache): RenderReason {
  const timed = cached.revalidate !== undefined
  const detail = cached.api ?? cached.life
  return {
    ...base,
    kind: 'cached',
    // `unstable_cache` without a time keeps its data until revalidated.
    effect: timed ? 'isr' : cached.api ? 'info' : 'unknown',
    ...(detail ? { detail } : {}),
    ...(timed ? { revalidate: cached.revalidate } : {}),
    loc: cached.loc,
  }
}

// --- Reading page and layout files ---------------------------------------------------------------

interface SegmentConfig {
  name: 'dynamic' | 'revalidate' | 'fetchCache'
  value: string | number | false
  loc: SourceLoc
}

interface FileFacts {
  config: SegmentConfig[]
  /** Config values the scan can't read. */
  unread: { text: string; loc: SourceLoc }[]
  /** Where `generateStaticParams` is exported. */
  staticParams?: SourceLoc
  /** Where the page (or its `generateMetadata`) reads `searchParams`. */
  searchParams?: SourceLoc
}

const CONFIG_NAMES = ['dynamic', 'revalidate', 'fetchCache'] as const

function readFile(file: SourceFile, root: string): FileFacts {
  const loc = (node: Node): SourceLoc => {
    const { line, column } = file.getLineAndColumnAtPos(node.getStart())
    return { file: relativeTo(root, file.getFilePath()), line, column }
  }
  const facts: FileFacts = { config: [], unread: [] }
  const exported = file.getExportedDeclarations()
  for (const name of CONFIG_NAMES) {
    const decl = exported.get(name)?.[0]
    if (!decl) continue
    const init = N.isVariableDeclaration(decl) ? decl.getInitializer() : undefined
    const value = init ? literalOf(init) : undefined
    if (value === undefined) {
      facts.unread.push({ text: `the value of \`export const ${name}\` can't be read`, loc: loc(decl) })
    } else {
      facts.config.push({ name, value, loc: loc(decl) })
    }
  }
  const params = exported.get('generateStaticParams')?.[0]
  if (params) facts.staticParams = loc(params)
  for (const name of ['default', 'generateMetadata']) {
    const fn = functionOf(exported.get(name)?.[0])
    const read = fn ? searchParamsRead(fn) : undefined
    if (read) {
      facts.searchParams = loc(read)
      break
    }
  }
  return facts
}

function configReason(config: SegmentConfig, place: Place): RenderReason | undefined {
  const written = `${config.name} = ${typeof config.value === 'string' ? `'${config.value}'` : config.value}`
  const base = { kind: 'segment-config' as const, in: place, detail: written, loc: config.loc }
  switch (config.name) {
    case 'dynamic':
      if (config.value === 'force-dynamic') return { ...base, effect: 'dynamic' }
      if (config.value === 'force-static' || config.value === 'error') return { ...base, effect: 'static' }
      return undefined
    case 'revalidate':
      if (config.value === 0) return { ...base, effect: 'dynamic' }
      if (typeof config.value === 'number' && config.value > 0) {
        return { ...base, effect: 'isr', revalidate: config.value }
      }
      return undefined
    case 'fetchCache':
      // Shown where it changes a fetch (see `useReason`).
      return undefined
  }
}

/** A string, number or `false` literal (through `as const`, `satisfies` and parentheses). */
function literalOf(node: Node): string | number | false | undefined {
  let value = node
  while (N.isAsExpression(value) || N.isSatisfiesExpression(value) || N.isParenthesizedExpression(value)) {
    value = value.getExpression()
  }
  if (N.isStringLiteral(value) || N.isNoSubstitutionTemplateLiteral(value)) return value.getLiteralValue()
  if (N.isNumericLiteral(value)) return value.getLiteralValue()
  if (value.getKind() === ts.SyntaxKind.FalseKeyword) return false
  return undefined
}

function functionOf(decl: Node | undefined): Node | undefined {
  if (!decl) return undefined
  if (N.isFunctionDeclaration(decl) || N.isArrowFunction(decl) || N.isFunctionExpression(decl)) return decl
  if (N.isVariableDeclaration(decl)) {
    const init = decl.getInitializer()
    return init && (N.isArrowFunction(init) || N.isFunctionExpression(init)) ? init : undefined
  }
  return undefined
}

/** `({ searchParams })` or `props.searchParams` in the function's first parameter. */
function searchParamsRead(fn: Node): Node | undefined {
  if (!N.isFunctionDeclaration(fn) && !N.isArrowFunction(fn) && !N.isFunctionExpression(fn)) return undefined
  const param = fn.getParameters()[0]
  if (!param) return undefined
  const name = param.getNameNode()
  if (N.isObjectBindingPattern(name)) {
    return name
      .getElements()
      .find((e) => (e.getPropertyNameNode()?.getText() ?? e.getName()) === 'searchParams')
  }
  if (!N.isIdentifier(name)) return undefined
  const text = name.getText()
  return fn
    .getDescendantsOfKind(ts.SyntaxKind.PropertyAccessExpression)
    .find((p) => p.getName() === 'searchParams' && p.getExpression().getText() === text)
}

/** `cacheComponents: true` (or Next 15's `experimental.dynamicIO: true`) in the Next config. */
// Parsed on its own, not added to the project: the config imports Next's types, and every
// re-scan would type-check them again.
export function cacheComponentsOn(text: string | undefined): boolean {
  if (!text) return false
  const file = ts.createSourceFile('next.config.ts', text, ts.ScriptTarget.Latest, false)
  let found = false
  const visit = (node: ts.Node) => {
    if (found) return
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      (node.name.text === 'cacheComponents' || node.name.text === 'dynamicIO') &&
      node.initializer.kind === ts.SyntaxKind.TrueKeyword
    ) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}
