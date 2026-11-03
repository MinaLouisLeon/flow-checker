// Special files and boundaries (M41): for each page, the `loading`, `error`, `not-found`,
// `forbidden`, `unauthorized` and `global-error` files and the `<Suspense>` / error boundaries that
// cover it, the gaps where nothing does, and its `metadata` / `generateMetadata`.
//
// The rules were checked with `next build` (16.4.3) on a scratch app: a folder's `loading` and
// `error` wrap the page and the layouts in folders below, never the layout in their own folder; a
// layout's `<Suspense>` around `{children}` covers everything below it; with Cache Components,
// `cookies()`, an uncached `fetch`, `params` (without `generateStaticParams`) and `searchParams`
// outside `<Suspense>` fail the build unless the page or a layout says `instant = false`. Every URL a
// slot (or `children`) matches needs a page or a `default` file in each sibling slot, and every
// intercepting route a plain page at its URL, or the build fails.
import {
  BOUNDARY_FILES,
  type BoundaryGap,
  type Component,
  type MetadataSource,
  type PageBoundary,
  type Route,
  type RouteMetadata,
  type RouteTreeNode,
  type SourceLoc,
} from '@flow-checker/shared'
import { Node as N, type Node, type ObjectLiteralExpression, type SourceFile, ts } from 'ts-morph'
import { componentsBelow } from './access'
import { relativeTo } from './paths'
import { functionOf, propRead } from './render'
import type { RenderUse } from './requests'

export interface BoundaryInput {
  root: string
  /** Project-relative app directory (`app`, `src/app`). */
  appDir: string
  tree: RouteTreeNode
  /** Pages already have `render` and `access`. */
  routes: Route[]
  components: Component[]
  uses: RenderUse[]
  /** The project file for a project-relative path. */
  fileOf: (file: string) => SourceFile | undefined
  cacheComponents: boolean
}

type Place = 'layout' | 'page' | 'component'

/** Where a root of the page's tree sits: a layout or template in folder `folder`, or the page. */
interface Root {
  id: string
  in: 'layout' | 'page'
  folder: number
  file: string
}

const GAP_ORDER: Record<BoundaryGap['kind'], number> = {
  'blocking-route': 0,
  'slot-no-match': 1,
  'no-canonical': 2,
  'no-fallback': 3,
  'no-error-boundary': 4,
  'no-not-found': 5,
}

const EXIT_CALL = { 'not-found': 'notFound', forbidden: 'forbidden', unauthorized: 'unauthorized' } as const

/** Sets `boundaries` and `metadata` on every page. */
export function addRouteBoundaries(input: BoundaryInput): void {
  const { routes, cacheComponents } = input
  const components = new Map(input.components.map((c) => [c.id, c]))
  const below = componentsBelow(input.components)
  const usesOf = new Map<string, RenderUse[]>()
  for (const use of input.uses) {
    const list = usesOf.get(use.componentId)
    if (list) list.push(use)
    else usesOf.set(use.componentId, [use])
  }
  const nodes = new Map<string, RouteTreeNode>()
  const index = (node: RouteTreeNode) => {
    nodes.set(node.dir, node)
    for (const child of node.children) index(child)
  }
  index(input.tree)
  const pages = routes.filter((r) => r.kind === 'page')
  const files = new Map<string, FileFacts>()
  const factsOf = (file: string) => {
    let facts = files.get(file)
    if (!facts) {
      const sf = input.fileOf(file)
      facts = sf ? readFile(sf, input.root) : {}
      files.set(file, facts)
    }
    return facts
  }

  for (const page of pages) {
    const folders = foldersOf(input.appDir, page)
    const folderNodes = folders.map((dir) => nodes.get(dir))
    const leaf = folders.length - 1
    const folderOf = (file: string) => folders.indexOf(file.slice(0, file.lastIndexOf('/')))
    const chain = page.layoutChain.flatMap((l): Root[] =>
      l.componentId ? [{ id: l.componentId, in: 'layout', folder: folderOf(l.file), file: l.file }] : [],
    )
    const roots: Root[] = [
      ...chain,
      ...(page.componentId
        ? [{ id: page.componentId, in: 'page' as const, folder: leaf, file: page.file }]
        : []),
    ]
    const place = (id: string): Place =>
      id === page.componentId ? 'page' : chain.some((r) => r.id === id) ? 'layout' : 'component'

    // A folder's file covers the layouts in folders below it and the page in its own folder.
    const covers = (folder: number, root: Root) =>
      root.in === 'page' ? folder <= root.folder : folder < root.folder
    const fileCovers = (kind: (typeof BOUNDARY_FILES)[number], root: Root) =>
      folderNodes.some((node, j) => node?.files[kind] !== undefined && covers(j, root))
    // A layout's boundary around the prop the page comes through: `children`, or the slot below it.
    const propCovers = (kind: 'suspense' | 'error-boundary', root: Root) =>
      chain.some((layout) => {
        if (layout.folder < 0 || !covers(layout.folder, root)) return false
        const next = page.segments[layout.folder]
        const prop = next?.kind === 'slot' && layout.folder < leaf ? next.name : 'children'
        return (components.get(layout.id)?.boundaries ?? []).some(
          (b) => b.kind === kind && b.wraps.includes(prop),
        )
      })
    const suspended = uncoveredBelow(
      roots.map((r) => ({ id: r.id, covered: fileCovers('loading', r) || propCovers('suspense', r) })),
      components,
      'suspense',
    )
    const unguarded = uncoveredBelow(
      roots.map((r) => ({
        id: r.id,
        // `global-error` replaces the root layout too, so it covers every part of every page.
        covered:
          fileCovers('error', r) ||
          folderNodes[0]?.files['global-error'] !== undefined ||
          propCovers('error-boundary', r),
      })),
      components,
      'errorBoundary',
    )
    const tree = new Set(roots.flatMap((r) => below(r.id)))

    // --- What covers the page ---
    const items: PageBoundary[] = []
    folderNodes.forEach((node, j) => {
      for (const kind of BOUNDARY_FILES) {
        const file = node?.files[kind]
        if (!file || (kind === 'global-error' && j !== 0)) continue
        items.push({ kind, file, in: 'segment' })
      }
    })
    for (const kind of BOUNDARY_FILES) {
      const nearest = kind === 'global-error' ? undefined : items.filter((i) => i.kind === kind).at(-1)
      if (nearest) nearest.nearest = true
    }
    const globalError = items.find((i) => i.kind === 'global-error')
    if (globalError && !items.some((i) => i.kind === 'error')) globalError.nearest = true
    const seenBoundary = new Set<string>()
    for (const root of roots) {
      for (const id of below(root.id)) {
        const component = components.get(id)
        for (const b of component?.boundaries ?? []) {
          const key = `${b.loc.file}:${b.loc.line}:${b.loc.column}`
          if (seenBoundary.has(key)) continue
          seenBoundary.add(key)
          items.push({
            kind: b.kind,
            file: b.loc.file,
            in: place(id),
            componentId: id,
            wraps: b.wraps,
            loc: b.loc,
          })
        }
      }
    }

    // --- Gaps ---
    const gaps: BoundaryGap[] = []
    const render = page.render
    const mode = render?.mode
    const reasons = render?.reasons ?? []

    if (
      cacheComponents &&
      !reasons.some((r) => r.kind === 'segment-config' && r.detail === 'instant = false')
    ) {
      const seen = new Set<string>()
      const block = (gap: BoundaryGap) => {
        const key = `${gap.detail}@${gap.loc?.file}:${gap.loc?.line}:${gap.loc?.column}`
        if (seen.has(key)) return
        seen.add(key)
        gaps.push(gap)
      }
      for (const reason of reasons) {
        if (reason.effect !== 'dynamic') continue
        if ((reason.kind === 'request-api' || reason.kind === 'uncached-data') && reason.componentId) {
          if (!suspended.has(reason.componentId)) continue
          block({
            kind: 'blocking-route',
            in: reason.in,
            componentId: reason.componentId,
            ...(reason.siteId ? { siteId: reason.siteId } : {}),
            detail: (reason.detail ?? '').replace(/`/g, ''),
            ...(reason.loc ? { loc: reason.loc } : {}),
          })
        }
      }
      // Passing `searchParams` or `params` on to a child doesn't block; awaiting them does.
      const awaited = page.componentId ? factsOf(page.file).searchParams : undefined
      if (awaited && page.componentId && suspended.has(page.componentId)) {
        block({
          kind: 'blocking-route',
          in: 'page',
          componentId: page.componentId,
          detail: 'searchParams',
          loc: awaited,
        })
      }
      // `params` only count for segments with no `generateStaticParams`.
      if (reasons.some((r) => r.kind === 'dynamic-params')) {
        for (const root of roots) {
          const read = factsOf(root.file).params
          if (read && suspended.has(root.id)) {
            block({ kind: 'blocking-route', in: root.in, componentId: root.id, detail: 'params', loc: read })
          }
        }
      }
    }

    const uncached = [...tree]
      .flatMap((id) => usesOf.get(id) ?? [])
      .filter((u): u is Extract<RenderUse, { kind: 'data' }> => u.kind === 'data' && !isCached(u))
      .sort(
        (a, b) =>
          PLACE_ORDER[place(a.componentId)] - PLACE_ORDER[place(b.componentId)] || compareLoc(a.loc, b.loc),
      )
    const dataGap = (kind: 'no-fallback' | 'no-error-boundary', list: typeof uncached) => {
      const first = list[0]
      if (!first) return
      gaps.push({
        kind,
        in: place(first.componentId),
        componentId: first.componentId,
        siteId: first.siteId,
        detail: first.transport,
        ...(list.length > 1 ? { more: list.length - 1 } : {}),
        loc: first.loc,
      })
    }
    if (!cacheComponents && mode === 'dynamic') {
      dataGap(
        'no-fallback',
        uncached.filter((u) => suspended.has(u.componentId)),
      )
    }
    if (mode === 'dynamic' || mode === 'partial') {
      dataGap(
        'no-error-boundary',
        uncached.filter((u) => unguarded.has(u.componentId)),
      )
    }

    for (const guard of page.access?.guards ?? []) {
      if (guard.in === 'middleware' || !guard.componentId) continue
      if (guard.kind !== 'not-found' && guard.kind !== 'forbidden' && guard.kind !== 'unauthorized') continue
      const kind = guard.kind
      const reaching = roots.filter((r) => below(r.id).includes(guard.componentId as string))
      if (reaching.length === 0 || reaching.every((r) => fileCovers(kind, r))) continue
      gaps.push({
        kind: 'no-not-found',
        in: guard.in,
        componentId: guard.componentId,
        detail: EXIT_CALL[kind],
        file: kind,
        loc: guard.loc,
      })
    }

    if (!page.intercepting) gaps.push(...slotGaps(page, pages, chain, folders, folderNodes, components))
    if (page.intercepting && !pages.some((r) => !r.intercepting && r.path === page.path)) {
      const component = page.componentId ? components.get(page.componentId) : undefined
      gaps.push({
        kind: 'no-canonical',
        in: 'page',
        ...(page.componentId ? { componentId: page.componentId } : {}),
        detail: page.path,
        loc: component?.loc ?? { file: page.file, line: 1, column: 1 },
      })
    }

    gaps.sort((a, b) => GAP_ORDER[a.kind] - GAP_ORDER[b.kind] || compareLoc(a.loc, b.loc))
    page.boundaries = { items, gaps }
    page.metadata = metadataOf(page, factsOf)
  }
}

const PLACE_ORDER: Record<Place, number> = { layout: 0, page: 1, component: 2 }

function compareLoc(a: SourceLoc | undefined, b: SourceLoc | undefined): number {
  const fa = a?.file ?? ''
  const fb = b?.file ?? ''
  if (fa !== fb) return fa < fb ? -1 : 1
  return (a?.line ?? 0) - (b?.line ?? 0) || (a?.column ?? 0) - (b?.column ?? 0)
}

/** The app folder, then each folder down to the page's (groups and slots included). */
function foldersOf(appDir: string, page: Route): string[] {
  const out = [appDir]
  let dir = appDir
  for (const segment of page.segments) {
    dir = `${dir}/${segment.raw}`
    out.push(dir)
  }
  return out
}

/** A server request whose answer Next keeps: `use cache`, `unstable_cache`, or a `fetch` that asks to be cached. */
function isCached(use: Extract<RenderUse, { kind: 'data' }>): boolean {
  if (use.cached) return true
  const f = use.fetch
  if (!f || f.unread) return false
  return (
    f.cache === 'force-cache' ||
    f.revalidate === false ||
    (typeof f.revalidate === 'number' && f.revalidate > 0)
  )
}

/**
 * Components reached from a root with no boundary of the kind above them on some path. A root is
 * covered by special files and its layouts' boundaries; below it, by a ref inside a boundary.
 */
function uncoveredBelow(
  roots: { id: string; covered: boolean }[],
  components: Map<string, Component>,
  flag: 'suspense' | 'errorBoundary',
): Set<string> {
  const covered = new Set<string>()
  const uncovered = new Set<string>()
  const stack = roots.map((r) => [r.id, r.covered] as [string, boolean])
  while (stack.length > 0) {
    const [id, isCovered] = stack.pop() as [string, boolean]
    const seen = isCovered ? covered : uncovered
    if (seen.has(id) || uncovered.has(id)) continue
    seen.add(id)
    for (const ref of components.get(id)?.children ?? []) {
      if (ref.componentId) stack.push([ref.componentId, isCovered || ref[flag] === true])
    }
  }
  return uncovered
}

/**
 * Each layout around the page passes its slots as props; on a full page load every sibling slot
 * needs a page for the URL or a `default` file. Intercepting pages only show on client navigation,
 * so they don't count as a match.
 */
function slotGaps(
  page: Route,
  pages: Route[],
  chain: Root[],
  folders: string[],
  folderNodes: (RouteTreeNode | undefined)[],
  components: Map<string, Component>,
): BoundaryGap[] {
  const gaps: BoundaryGap[] = []
  const leaf = folders.length - 1
  for (const layout of chain) {
    const j = layout.folder
    const node = folderNodes[j]
    // Slots are props of the layout in their parent folder (not of a template).
    if (!node || node.files.layout !== layout.file) continue
    const slots = node.children.filter((c) => c.segment.kind === 'slot')
    if (slots.length === 0) continue
    const next = page.segments[j]
    const own = next?.kind === 'slot' && j < leaf ? next.name : 'children'
    const plain = pages.filter((r) => !r.intercepting && r.path === page.path)
    const inDir = (r: Route, dir: string) => r.file.startsWith(`${dir}/`)
    const siblings: { name: string; dir: string; matched: boolean; fallback: boolean }[] = slots
      .filter((s) => s.segment.name !== own)
      .map((s) => ({
        name: `@${s.segment.name}`,
        dir: s.dir,
        matched: plain.some((r) => inDir(r, s.dir)),
        fallback: s.files.default !== undefined,
      }))
    if (own !== 'children') {
      siblings.push({
        name: 'children',
        dir: node.dir,
        matched: plain.some((r) => inDir(r, node.dir) && !slots.some((s) => inDir(r, s.dir))),
        fallback: node.files.default !== undefined,
      })
    }
    for (const slot of siblings) {
      if (slot.matched || slot.fallback) continue
      const component = components.get(layout.id)
      gaps.push({
        kind: 'slot-no-match',
        in: 'layout',
        componentId: layout.id,
        detail: slot.name,
        dir: slot.dir,
        loc: component?.loc ?? { file: layout.file, line: 1, column: 1 },
      })
    }
  }
  return gaps
}

// --- Reading page and layout files ---------------------------------------------------------------

interface TitleRead {
  /** `title`, `title.default` or `title.absolute`. */
  text?: string
  template?: string
  absolute?: true
  /** It has a title the scan can't read. */
  unread?: true
}

interface MetadataRead {
  kind: MetadataSource['kind']
  fields?: string[]
  title?: TitleRead
  loc: SourceLoc
}

interface FileFacts {
  metadata?: MetadataRead
  /** Where the default export awaits its `params` prop. */
  params?: SourceLoc
  /** Where the default export awaits its `searchParams` prop. */
  searchParams?: SourceLoc
}

function readFile(file: SourceFile, root: string): FileFacts {
  const loc = (node: Node): SourceLoc => {
    const { line, column } = file.getLineAndColumnAtPos(node.getStart())
    return { file: relativeTo(root, file.getFilePath()), line, column }
  }
  const facts: FileFacts = {}
  const exported = file.getExportedDeclarations()
  const main = functionOf(exported.get('default')?.[0])
  const params = main ? awaitedProp(main, 'params') : undefined
  if (params) facts.params = loc(params)
  const searchParams = main ? awaitedProp(main, 'searchParams') : undefined
  if (searchParams) facts.searchParams = loc(searchParams)

  const metadata = exported.get('metadata')?.[0]
  if (metadata && N.isVariableDeclaration(metadata)) {
    const init = metadata.getInitializer()
    const object = init ? unwrap(init) : undefined
    facts.metadata =
      object && N.isObjectLiteralExpression(object)
        ? { kind: 'metadata', ...readObject(object), loc: loc(metadata) }
        : { kind: 'metadata', title: { unread: true }, loc: loc(metadata) }
  }
  const generate = exported.get('generateMetadata')?.[0]
  const fn = functionOf(generate)
  if (generate && fn) {
    const object = returnedObject(fn)
    facts.metadata = object
      ? { kind: 'generateMetadata', ...readObject(object), loc: loc(generate) }
      : { kind: 'generateMetadata', title: { unread: true }, loc: loc(generate) }
  }
  return facts
}

/**
 * Where a function awaits one of its props: `await params`, `use(params)`, `params.then(...)`, with
 * `({ params })` or `props.params`. Handing it on to a child component doesn't count.
 */
function awaitedProp(fn: Node, prop: string): Node | undefined {
  const read = propRead(fn, prop)
  if (!read) return undefined
  const uses: Node[] = []
  if (N.isBindingElement(read)) {
    const name = read.getNameNode()
    if (!N.isIdentifier(name)) return undefined
    for (const id of fn.getDescendantsOfKind(ts.SyntaxKind.Identifier)) {
      if (id !== name && id.getText() === name.getText() && id.getSymbol() === name.getSymbol()) uses.push(id)
    }
  } else {
    const object = N.isPropertyAccessExpression(read) ? read.getExpression().getText() : undefined
    for (const access of fn.getDescendantsOfKind(ts.SyntaxKind.PropertyAccessExpression)) {
      if (access.getName() === prop && access.getExpression().getText() === object) uses.push(access)
    }
  }
  return uses.find((use) => {
    let node = use
    let parent = node.getParent()
    while (parent && (N.isParenthesizedExpression(parent) || N.isAsExpression(parent))) {
      node = parent
      parent = node.getParent()
    }
    if (!parent) return false
    if (N.isAwaitExpression(parent)) return true
    if (N.isPropertyAccessExpression(parent) && parent.getName() === 'then') return true
    return (
      N.isCallExpression(parent) &&
      parent.getExpression().getText() === 'use' &&
      parent.getArguments()[0] === node
    )
  })
}

function unwrap(node: Node): Node {
  let value = node
  while (N.isAsExpression(value) || N.isSatisfiesExpression(value) || N.isParenthesizedExpression(value)) {
    value = value.getExpression()
  }
  return value
}

/** The object a function returns: `return { ... }` (not in a nested function), or `() => ({ ... })`. */
function returnedObject(fn: Node): ObjectLiteralExpression | undefined {
  if (N.isArrowFunction(fn)) {
    const body = unwrap(fn.getBody())
    if (N.isObjectLiteralExpression(body)) return body
  }
  for (const ret of fn.getDescendantsOfKind(ts.SyntaxKind.ReturnStatement)) {
    if (ret.getFirstAncestor((a) => N.isFunctionLikeDeclaration(a)) !== fn) continue
    const expr = ret.getExpression()
    const value = expr ? unwrap(expr) : undefined
    if (value && N.isObjectLiteralExpression(value)) return value
  }
  return undefined
}

function readObject(object: ObjectLiteralExpression): Pick<MetadataRead, 'fields' | 'title'> {
  const fields: string[] = []
  let spread = false
  let title: TitleRead | undefined
  for (const prop of object.getProperties()) {
    if (N.isSpreadAssignment(prop)) {
      spread = true
      continue
    }
    const name =
      N.isPropertyAssignment(prop) || N.isShorthandPropertyAssignment(prop) || N.isMethodDeclaration(prop)
        ? prop.getName().replace(/^['"]|['"]$/g, '')
        : undefined
    if (!name) continue
    fields.push(name)
    if (name !== 'title') continue
    const value = N.isPropertyAssignment(prop)
      ? prop.getInitializer()
      : N.isShorthandPropertyAssignment(prop)
        ? prop.getNameNode()
        : undefined
    title = value ? readTitle(value) : { unread: true }
  }
  // A spread may bring a title in.
  if (!title && spread) title = { unread: true }
  return { ...(spread ? {} : { fields }), ...(title ? { title } : {}) }
}

function readTitle(node: Node): TitleRead {
  const value = resolveConst(unwrap(node))
  const text = textOf(value)
  if (text !== undefined) return { text }
  if (!N.isObjectLiteralExpression(value)) return { unread: true }
  const out: TitleRead = {}
  for (const prop of value.getProperties()) {
    if (!N.isPropertyAssignment(prop)) return { unread: true }
    const part = textOf(resolveConst(unwrap(prop.getInitializer() ?? prop)))
    const name = prop.getName()
    if (part === undefined) {
      if (name === 'default' || name === 'absolute') out.unread = true
      continue
    }
    if (name === 'default') out.text = out.text ?? part
    else if (name === 'absolute') {
      out.text = part
      out.absolute = true
    } else if (name === 'template') out.template = part
  }
  return out
}

/** An identifier's value when it is a constant declared with a value (`const SITE = 'Shop'`). */
function resolveConst(node: Node): Node {
  if (!N.isIdentifier(node)) return node
  const decl = node.getSymbol()?.getDeclarations()[0]
  const init = decl && N.isVariableDeclaration(decl) ? decl.getInitializer() : undefined
  return init ? unwrap(init) : node
}

/** A string, or a template with `{name}` for the values only known at runtime. */
function textOf(node: Node): string | undefined {
  if (N.isStringLiteral(node) || N.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralValue()
  if (N.isTemplateExpression(node)) {
    let out = node.getHead().getLiteralText()
    for (const span of node.getTemplateSpans()) {
      out += `{${span.getExpression().getText()}}${span.getLiteral().getLiteralText()}`
    }
    return out
  }
  return undefined
}

/** The page's metadata: the layouts' and the page's own, and the title Next renders. */
function metadataOf(page: Route, factsOf: (file: string) => FileFacts): RouteMetadata {
  const pageFolder = page.file.slice(0, page.file.lastIndexOf('/'))
  const items = [
    ...page.layoutChain
      .filter((l) => l.kind === 'layout')
      .map((l) => ({
        file: l.file,
        in: 'layout' as const,
        leaf: l.file.slice(0, l.file.lastIndexOf('/')) === pageFolder,
      })),
    { file: page.file, in: 'page' as const, leaf: true },
  ]
  const sources: MetadataSource[] = []
  // Next's own order (`resolveTitle`): a title goes into the template of the layouts above; the
  // layout in the page's own folder doesn't pass its template to the page.
  let resolved: { text?: string; template?: string; unread?: true } | undefined
  let stash: string | null | 'unread' = null
  for (const item of items) {
    const read = factsOf(item.file).metadata
    if (read) {
      const title = read.title
      sources.push({
        kind: read.kind,
        in: item.in,
        file: item.file,
        ...(read.fields ? { fields: read.fields } : {}),
        ...(title?.text !== undefined ? { title: title.text } : {}),
        ...(title?.template !== undefined ? { template: title.template } : {}),
        ...(title?.absolute ? { absolute: true as const } : {}),
        loc: read.loc,
      })
      if (title?.unread) resolved = { unread: true }
      else if (title) {
        const text: string | undefined =
          title.text === undefined || title.absolute
            ? title.text
            : stash === 'unread'
              ? undefined
              : stash
                ? stash.replace(/%s/g, title.text)
                : title.text
        resolved = {
          ...(text !== undefined ? { text } : {}),
          ...(title.template !== undefined ? { template: title.template } : {}),
          ...(text === undefined && title.text !== undefined ? { unread: true as const } : {}),
        }
      }
    }
    if (!item.leaf) stash = resolved?.unread ? 'unread' : (resolved?.template ?? null)
  }
  return {
    ...(resolved?.text ? { title: resolved.text } : {}),
    ...(resolved?.unread ? { titleUnread: true as const } : {}),
    sources,
  }
}
