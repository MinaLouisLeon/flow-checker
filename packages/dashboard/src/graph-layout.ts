// Positions for the route map graph. Until navigation edges are scanned (M7), routes are
// linked to their closest parent route by URL path, laid out as a left-to-right tree.
import type { Route } from '@flow-checker/shared'

export interface GraphNode {
  route: Route
  x: number
  y: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  kind: 'hierarchy'
}

export interface RouteGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export const NODE_WIDTH = 220
export const NODE_HEIGHT = 56
const COLUMN_GAP = 80
const ROW_GAP = 20

function pathParts(path: string): string[] {
  return path.split('/').filter(Boolean)
}

/**
 * Parent = the route whose path is the longest proper prefix of this one. Pages win over
 * route handlers, and plain pages win over slot or intercepting pages at the same path.
 */
export function parentOf(route: Route, routes: Route[]): Route | undefined {
  const parts = pathParts(route.path)
  for (let len = parts.length - 1; len >= 0; len--) {
    const prefix = `/${parts.slice(0, len).join('/')}`
    const candidates = routes.filter((r) => r !== route && r.path === prefix)
    const best = candidates.sort((a, b) => rank(a) - rank(b))[0]
    if (best) return best
  }
  return undefined
}

function rank(route: Route): number {
  if (route.kind === 'route-handler') return 2
  return route.slot || route.intercepting ? 1 : 0
}

export function layoutRoutes(routes: Route[]): RouteGraph {
  const sorted = [...routes].sort((a, b) => a.path.localeCompare(b.path) || rank(a) - rank(b))
  const children = new Map<string, Route[]>()
  const roots: Route[] = []
  const edges: GraphEdge[] = []

  for (const route of sorted) {
    const parent = parentOf(route, sorted)
    if (!parent) {
      roots.push(route)
      continue
    }
    const list = children.get(parent.id) ?? []
    list.push(route)
    children.set(parent.id, list)
    edges.push({ id: `${parent.id}->${route.id}`, source: parent.id, target: route.id, kind: 'hierarchy' })
  }

  const nodes: GraphNode[] = []
  let row = 0
  // Leaves take the next row. A parent sits centered on its first and last child.
  const place = (route: Route, depth: number): number => {
    const kids = children.get(route.id) ?? []
    let y: number
    if (kids.length === 0) {
      y = row * (NODE_HEIGHT + ROW_GAP)
      row++
    } else {
      const ys = kids.map((k) => place(k, depth + 1))
      y = ((ys[0] ?? 0) + (ys[ys.length - 1] ?? 0)) / 2
    }
    nodes.push({ route, x: depth * (NODE_WIDTH + COLUMN_GAP), y })
    return y
  }
  for (const root of roots) place(root, 0)

  return { nodes, edges }
}
