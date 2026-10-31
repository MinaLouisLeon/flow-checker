import type { Route, RouteTreeNode } from '@flow-checker/shared'
import {
  Background,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  MiniMap,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { isVerified as isSiteVerified } from '@flow-checker/shared'
import { useMemo, useState } from 'react'
import { useData } from '../context'
import { layoutRoutes, NODE_HEIGHT, NODE_WIDTH } from '../graph-layout'
import { href, type MapView, replaceScreen } from '../router'
import { Badge, Empty, matches, SearchBox, SourceLink } from '../ui'

interface RouteNodeData extends Record<string, unknown> {
  route: Route
  componentCount: number
  noteCount: number
  /** Every request on the route was captured. */
  verified: boolean
  dimmed: boolean
}
type RouteNode = Node<RouteNodeData, 'route'>

const nodeTypes = { route: RouteNodeView }

export function MapScreen({ view, q }: { view: MapView; q: string }) {
  const setView = (next: MapView) => replaceScreen({ name: 'map', view: next, q })
  const setQuery = (next: string) => replaceScreen({ name: 'map', view, q: next })

  return (
    <div className="screen screen-full">
      <div className="toolbar">
        <fieldset className="segmented" aria-label="Map view">
          <button type="button" aria-pressed={view === 'graph'} onClick={() => setView('graph')}>
            Graph
          </button>
          <button type="button" aria-pressed={view === 'tree'} onClick={() => setView('tree')}>
            Tree
          </button>
          <button type="button" aria-pressed={view === 'handlers'} onClick={() => setView('handlers')}>
            Route handlers
          </button>
        </fieldset>
        <SearchBox value={q} onChange={setQuery} placeholder="Search routes and files" />
      </div>
      {view === 'graph' ? (
        <RouteGraphView q={q} />
      ) : view === 'tree' ? (
        <RouteTreeView q={q} />
      ) : (
        <RouteHandlerList q={q} />
      )}
    </div>
  )
}

function RouteGraphView({ q }: { q: string }) {
  const { index } = useData()
  const [showShared, setShowShared] = useState(false)
  const hasSharedEdges = index.navEdges.some((e) => e.shared)
  const { nodes, edges } = useMemo(() => {
    const graph = layoutRoutes(index.model.routes)
    // Counts are the page's own tree: the layouts' components and notes are the same on every
    // page under them, so they would make every page look alike.
    const notesByRoute = new Map<string, number>()
    for (const note of index.notes) {
      if (note.routeId) notesByRoute.set(note.routeId, (notesByRoute.get(note.routeId) ?? 0) + 1)
      else if (note.componentId) {
        for (const [routeId, tree] of index.pageTree)
          if (tree.has(note.componentId)) notesByRoute.set(routeId, (notesByRoute.get(routeId) ?? 0) + 1)
      }
    }
    const componentCount = new Map<string, number>()
    for (const [routeId, tree] of index.pageTree) componentCount.set(routeId, tree.size)
    // Requests per route: from its components, or sent by its route handler.
    const routeRequests = new Map<string, { total: number; verified: number }>()
    const count = (routeId: string, verified: boolean) => {
      const entry = routeRequests.get(routeId) ?? { total: 0, verified: 0 }
      entry.total++
      if (verified) entry.verified++
      routeRequests.set(routeId, entry)
    }
    for (const site of index.model.requests) {
      const verified = isSiteVerified(site)
      if (site.componentId) for (const id of index.routesOf.get(site.componentId) ?? []) count(id, verified)
      else if (site.origin === 'route-handler' && site.routeId) count(site.routeId, verified)
    }
    const nodes: RouteNode[] = graph.nodes.map((n) => ({
      id: n.route.id,
      type: 'route',
      position: { x: n.x, y: n.y },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      data: {
        route: n.route,
        componentCount: componentCount.get(n.route.id) ?? 0,
        noteCount: notesByRoute.get(n.route.id) ?? 0,
        verified: isVerified(routeRequests.get(n.route.id)),
        dimmed: false,
      },
    }))
    const positions = new Map(graph.nodes.map((n) => [n.route.id, { x: n.x, y: n.y }]))
    const edges: Edge[] = [
      // Pages in later grid columns sit next to their parent already; edges to them crossed the grid.
      ...graph.edges
        .filter((e) => !e.grid)
        .map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: 'out',
          targetHandle: 'in',
          className: 'edge-hierarchy',
        })),
      // Links, router calls and redirects between pages (M7). The line style tells them apart
      // (see the legend): text labels piled up on busy maps.
      ...index.navEdges
        .filter((e) => showShared || !e.shared)
        .map((e) => ({
          id: `nav:${e.source}->${e.target}`,
          source: e.source,
          target: e.target,
          type: 'smoothstep',
          ...navHandles(positions.get(e.source), positions.get(e.target)),
          className: `edge-nav${e.kinds.some((k) => k !== 'link') ? ' edge-nav-code' : ''}${e.shared ? ' edge-nav-shared' : ''}`,
          markerEnd: { type: MarkerType.ArrowClosed },
        })),
    ]
    return { nodes, edges }
  }, [index, showShared])

  const shown = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, dimmed: !matches(q, n.data.route.path, n.data.route.file) },
      })),
    [nodes, q],
  )

  if (nodes.length === 0) return <p className="empty">No routes found.</p>

  return (
    <div className="graph">
      <div className="graph-canvas">
        <ReactFlow
          nodes={shown}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesConnectable={false}
          nodesDraggable={false}
          colorMode="system"
          fitView
          // A big app doesn't shrink to unreadable boxes: it opens at a zoom where paths can be
          // read, and the minimap shows the rest.
          fitViewOptions={{ padding: 0.1, minZoom: 0.8, maxZoom: 1.2 }}
          minZoom={0.1}
          onNodeClick={(_, node) => {
            const route = (node as RouteNode).data.route
            window.location.hash = href({ name: 'page', routeId: route.id })
          }}
        >
          <Background gap={24} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
      <div className="legend">
        <span className="legend-item">
          <i className="dot dot-inferred" /> inferred
        </span>
        <span className="legend-item">
          <i className="dot dot-verified" /> verified
        </span>
        <span className="legend-item">
          <i className="line line-hierarchy" /> nested route
        </span>
        <span className="legend-item">
          <i className="line line-nav" /> link
        </span>
        <span className="legend-item">
          <i className="line line-nav-code" /> push / redirect
        </span>
        {hasSharedEdges && (
          <label className="legend-item legend-toggle">
            <input
              type="checkbox"
              checked={showShared}
              onChange={(event) => setShowShared(event.target.checked)}
            />{' '}
            layout links &amp; middleware redirects
          </label>
        )}
      </div>
    </div>
  )
}

/** Forward edges go left to right. Within a column or backwards they use the top and bottom. */
function navHandles(
  source: { x: number; y: number } | undefined,
  target: { x: number; y: number } | undefined,
): { sourceHandle: string; targetHandle: string } {
  if (!source || !target || target.x > source.x) return { sourceHandle: 'out', targetHandle: 'in' }
  // Back to a page on the left: a U underneath both.
  if (target.x < source.x) return { sourceHandle: 'bottom-out', targetHandle: 'bottom-in' }
  return target.y >= source.y
    ? { sourceHandle: 'bottom-out', targetHandle: 'top-in' }
    : { sourceHandle: 'top-out', targetHandle: 'bottom-in' }
}

function isVerified(entry: { total: number; verified: number } | undefined): boolean {
  return Boolean(entry && entry.total > 0 && entry.verified === entry.total)
}

function RouteNodeView({ data }: NodeProps<RouteNode>) {
  const { route, componentCount, noteCount, verified, dimmed } = data
  const handler = route.kind === 'route-handler'
  return (
    <div
      className={`route-node ${verified ? 'status-verified' : 'status-inferred'}${handler ? ' route-node-handler' : ''}${dimmed ? ' dimmed' : ''}`}
      title={route.file}
    >
      <Handle type="target" id="in" position={Position.Left} isConnectable={false} />
      {/* Navigation between pages in the same column goes over the top or bottom edge. */}
      <Handle type="target" id="top-in" position={Position.Top} isConnectable={false} />
      <Handle type="target" id="bottom-in" position={Position.Bottom} isConnectable={false} />
      <Handle type="source" id="top-out" position={Position.Top} isConnectable={false} />
      <Handle type="source" id="bottom-out" position={Position.Bottom} isConnectable={false} />
      <div className="route-node-path">{route.path}</div>
      <div className="route-node-meta">
        {handler ? (
          <span>{route.methods?.join(' ') || 'route handler'}</span>
        ) : (
          <span>
            {componentCount} component{componentCount === 1 ? '' : 's'}
          </span>
        )}
        {route.slot && <span>@{route.slot}</span>}
        {route.intercepting && <span>intercepts</span>}
        {noteCount > 0 && <span className="warn">⚠ {noteCount}</span>}
      </div>
      <Handle type="source" id="out" position={Position.Right} isConnectable={false} />
    </div>
  )
}

/** Route handlers only, as a list: in the tree they sit at the bottom of each folder (M23). */
function RouteHandlerList({ q }: { q: string }) {
  const { index } = useData()
  const all = index.model.routes.filter((r) => r.kind === 'route-handler')
  const handlers = all.filter((r) => matches(q, r.path, r.file)).sort((a, b) => a.path.localeCompare(b.path))
  if (all.length === 0) return <Empty>No route handlers found.</Empty>
  if (handlers.length === 0) return <Empty>No route handlers match.</Empty>
  return (
    <ul className="list handler-list">
      {handlers.map((route) => {
        const callers = index.handlerCallers.get(route.id)?.length ?? 0
        const sends = index.handlerRequests.get(route.id)?.length ?? 0
        return (
          <li key={route.id}>
            <a href={href({ name: 'page', routeId: route.id })}>
              <code>{route.path}</code>
            </a>
            {(route.methods ?? []).map((m) => (
              <span key={m} className={`method method-${m.toLowerCase()}`}>
                {m}
              </span>
            ))}
            <span className="muted">
              {callers} caller{callers === 1 ? '' : 's'} · sends {sends}
            </span>
            <span className="spacer" />
            <SourceLink file={route.file} />
          </li>
        )
      })}
    </ul>
  )
}

const SEGMENT_LABEL: Record<string, string | undefined> = {
  dynamic: 'dynamic',
  'catch-all': 'catch-all',
  'optional-catch-all': 'optional catch-all',
  group: 'group',
  slot: 'slot',
}

function RouteTreeView({ q }: { q: string }) {
  const { index } = useData()
  const routeByFile = useMemo(() => new Map(index.model.routes.map((r) => [r.file, r])), [index])
  return (
    <div className="tree-view">
      <ul className="tree">
        <TreeNode node={index.model.routeTree} q={q} routeByFile={routeByFile} root />
      </ul>
    </div>
  )
}

function subtreeMatches(node: RouteTreeNode, q: string): boolean {
  return matches(q, node.dir, ...Object.values(node.files)) || node.children.some((c) => subtreeMatches(c, q))
}

/** Folders with no route file anywhere below (`components`, `hooks`, ...) are not routes. */
function hasRouteFiles(node: RouteTreeNode): boolean {
  return Object.keys(node.files).length > 0 || node.children.some(hasRouteFiles)
}

function TreeNode({
  node,
  q,
  routeByFile,
  root,
}: {
  node: RouteTreeNode
  q: string
  routeByFile: Map<string, Route>
  root?: boolean
}) {
  if (!subtreeMatches(node, q) || (!root && !hasRouteFiles(node))) return null
  const { segment } = node
  const kind = SEGMENT_LABEL[segment.kind]
  const files = Object.entries(node.files)
  return (
    <li>
      <div className="tree-row">
        <span className={`seg seg-${segment.kind}`}>{root ? node.dir : segment.raw}</span>
        {kind && <Badge tone="muted">{kind}</Badge>}
        {segment.intercept && <Badge tone="muted">intercepts {segment.intercept}</Badge>}
        <span className="files">
          {files.map(([kind, file]) => {
            const route = routeByFile.get(file)
            if (route) {
              return (
                <a
                  key={kind}
                  className={`file-chip ${route.kind === 'page' ? 'file-chip-page' : 'file-chip-route'}`}
                  href={href({ name: 'page', routeId: route.id })}
                  title={route.file}
                >
                  {kind}
                  {route.methods?.length ? ` ${route.methods.join(' ')}` : ''}
                </a>
              )
            }
            return (
              <span key={kind} className="file-chip" title={file}>
                {kind}
              </span>
            )
          })}
        </span>
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.dir} node={child} q={q} routeByFile={routeByFile} />
          ))}
        </ul>
      )}
    </li>
  )
}
