// Positions for the route map graph: routes are linked to their closest parent route by URL
// path, laid out as a left-to-right tree. Navigation edges are drawn on top (MapScreen).
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
  /** The child sits in a later grid column, next to its parent: the map leaves the edge out. */
  grid?: boolean
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
  const gridded = new Set<string>()
  let row = 0
  const columnX = (column: number) => column * (NODE_WIDTH + COLUMN_GAP)
  const rowY = (r: number) => r * (NODE_HEIGHT + ROW_GAP)
  // Leaves take the next row. A parent sits centered on its first and last child.
  const place = (route: Route, depth: number): number => {
    const kids = children.get(route.id) ?? []
    let y: number
    if (kids.length === 0) {
      y = rowY(row)
      row++
    } else {
      const hasKids = (r: Route) => (children.get(r.id)?.length ?? 0) > 0
      const ys = kids.filter(hasKids).map((k) => place(k, depth + 1))
      const leaves = kids.filter((k) => !hasKids(k))
      if (leaves.length > ROWS_PER_COLUMN) {
        // Many pages under one route (e.g. everything under `/[locale]`): a grid of columns, by
        // route group, instead of one very tall column.
        leaves.sort((a, b) => groupOf(a).localeCompare(groupOf(b)) || a.path.localeCompare(b.path))
        const start = row
        leaves.forEach((leaf, i) => {
          const column = Math.floor(i / ROWS_PER_COLUMN)
          const leafY = rowY(start + (i % ROWS_PER_COLUMN))
          nodes.push({ route: leaf, x: columnX(depth + 1 + column), y: leafY })
          if (column > 0) gridded.add(leaf.id)
          ys.push(leafY)
        })
        row = start + ROWS_PER_COLUMN
      } else {
        for (const leaf of leaves) ys.push(place(leaf, depth + 1))
      }
      y = (Math.min(...ys) + Math.max(...ys)) / 2
    }
    nodes.push({ route, x: columnX(depth), y })
    return y
  }
  for (const root of roots) place(root, 0)

  for (const edge of edges) if (gridded.has(edge.target)) edge.grid = true
  return { nodes, edges }
}

/** Pages per grid column when a route has many leaf pages. */
const ROWS_PER_COLUMN = 8

/** The route group a page is in, e.g. `(dashboard)`, for ordering the grid. */
function groupOf(route: Route): string {
  return route.segments.find((s) => s.kind === 'group')?.raw ?? ''
}
