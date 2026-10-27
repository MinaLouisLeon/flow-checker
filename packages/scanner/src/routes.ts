// Route discovery from the `app/` directory (docs/PLAN.md 6.2).
import { posix } from 'node:path'
import {
  interceptLevels,
  isPrivateFolder,
  isUrlSegment,
  type LayoutRef,
  parseSegment,
  type Route,
  type RouteTreeNode,
  type Segment,
  SPECIAL_FILES,
  type SpecialFile,
  urlPart,
} from '@flow-checker/shared'
import type { FileSystemHost } from 'ts-morph'
import { compare, relativeTo } from './paths'

const SPECIAL_FILE = new RegExp(`^(${SPECIAL_FILES.join('|')})\\.(tsx|ts|jsx|js)$`)

/** A route before component ids and handler methods are filled in. Paths are absolute. */
export interface FoundRoute extends Omit<Route, 'id' | 'componentId' | 'methods' | 'layoutChain' | 'file'> {
  file: string
  layoutChain: Omit<LayoutRef, 'componentId'>[]
}

export interface RouteWalk {
  /** Paths in `files`/`dir` are project-relative. */
  tree: RouteTreeNode
  routes: FoundRoute[]
}

interface WalkState {
  segments: Segment[]
  /** URL path parts so far, e.g. ['[locale]', 'users']. */
  url: string[]
  layouts: FoundRoute['layoutChain']
  slot?: string
  intercepting?: Route['intercepting']
}

export function walkRoutes(fs: FileSystemHost, root: string, appDir: string): RouteWalk {
  const routes: FoundRoute[] = []

  const walk = (dir: string, segment: Segment, state: WalkState): RouteTreeNode => {
    const entries = fs.readDirSync(dir).sort((a, b) => compare(a.name, b.name))
    const files: Partial<Record<SpecialFile, string>> = {}
    for (const entry of entries) {
      if (!entry.isFile) continue
      const match = SPECIAL_FILE.exec(posix.basename(entry.name))
      const kind = match?.[1] as SpecialFile | undefined
      if (kind && !files[kind]) files[kind] = entry.name
    }

    const layouts = [...state.layouts]
    if (files.layout) layouts.push({ kind: 'layout', file: files.layout })
    if (files.template) layouts.push({ kind: 'template', file: files.template })

    const base = {
      path: `/${state.url.join('/')}`,
      segments: state.segments,
      ...(state.slot ? { slot: state.slot } : {}),
      ...(state.intercepting ? { intercepting: state.intercepting } : {}),
    }
    if (files.page) routes.push({ ...base, kind: 'page', file: files.page, layoutChain: layouts })
    if (files.route) routes.push({ ...base, kind: 'route-handler', file: files.route, layoutChain: [] })

    const children: RouteTreeNode[] = []
    for (const entry of entries) {
      const name = posix.basename(entry.name)
      if (!entry.isDirectory || isPrivateFolder(name) || name === 'node_modules') continue
      const child = parseSegment(name)
      children.push(walk(entry.name, child, enter(state, child, layouts)))
    }

    const relFiles: Partial<Record<SpecialFile, string>> = {}
    for (const kind of SPECIAL_FILES) {
      const file = files[kind]
      if (file) relFiles[kind] = relativeTo(root, file)
    }
    return { segment, dir: relativeTo(root, dir), files: relFiles, children }
  }

  const tree = walk(appDir, { raw: '', kind: 'static', name: '' }, { segments: [], url: [], layouts: [] })
  for (const route of routes) {
    route.file = relativeTo(root, route.file)
    route.layoutChain = route.layoutChain.map((l) => ({ ...l, file: relativeTo(root, l.file) }))
  }
  routes.sort((a, b) => compare(a.path, b.path) || compare(a.file, b.file))
  return { tree, routes }
}

function enter(state: WalkState, segment: Segment, layouts: WalkState['layouts']): WalkState {
  const next: WalkState = { ...state, segments: [...state.segments, segment], layouts }
  if (segment.kind === 'slot') return { ...next, slot: segment.name }
  if (!isUrlSegment(segment)) return next

  if (segment.intercept) {
    const levels = interceptLevels(segment.intercept)
    const base = levels === 'root' ? [] : state.url.slice(0, Math.max(0, state.url.length - levels))
    return {
      ...next,
      url: [...base, urlPart(segment)],
      intercepting: { marker: segment.intercept, from: `/${state.url.join('/')}` },
    }
  }
  return { ...next, url: [...state.url, segment.raw] }
}
