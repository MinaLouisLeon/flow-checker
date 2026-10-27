import type { Route, RouteTreeNode } from '@flow-checker/shared'
import {
  Background,
  Controls,
  type Edge,
  Handle,
  MiniMap,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo } from 'react'
import { useData } from '../context'
import { layoutRoutes, NODE_HEIGHT, NODE_WIDTH } from '../graph-layout'
import { href, replaceScreen } from '../router'
import { Badge, matches, SearchBox } from '../ui'

interface RouteNodeData extends Record<string, unknown> {
  route: Route
  componentCount: number
  noteCount: number
  dimmed: boolean
}
type RouteNode = Node<RouteNodeData, 'route'>

const nodeTypes = { route: RouteNodeView }

export function MapScreen({ view, q }: { view: 'graph' | 'tree'; q: string }) {
  const setView = (next: 'graph' | 'tree') => replaceScreen({ name: 'map', view: next, q })
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
        </fieldset>
        <SearchBox value={q} onChange={setQuery} placeholder="Search routes and files" />
      </div>
      {view === 'graph' ? <RouteGraphView q={q} /> : <RouteTreeView q={q} />}
    </div>
  )
}

function RouteGraphView({ q }: { q: string }) {
  const { index } = useData()
  const { nodes, edges } = useMemo(() => {
    const graph = layoutRoutes(index.model.routes)
    const notesByRoute = new Map<string, number>()
    for (const note of index.notes) {
      const routeIds = note.routeId
        ? [note.routeId]
        : note.componentId
          ? (index.routesOf.get(note.componentId) ?? [])
          : []
      for (const id of routeIds) notesByRoute.set(id, (notesByRoute.get(id) ?? 0) + 1)
    }
    const componentCount = new Map<string, number>()
    for (const [, routeIds] of index.routesOf) {
      for (const id of routeIds) componentCount.set(id, (componentCount.get(id) ?? 0) + 1)
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
        dimmed: false,
      },
    }))
    const edges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      className: 'edge-hierarchy',
    }))
    return { nodes, edges }
  }, [index])

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
          fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
          minZoom={0.2}
          onNodeClick={(_, node) => {
            const route = (node as RouteNode).data.route
            if (route.kind === 'page') window.location.hash = href({ name: 'page', routeId: route.id })
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
      </div>
    </div>
  )
}

function RouteNodeView({ data }: NodeProps<RouteNode>) {
  const { route, componentCount, noteCount, dimmed } = data
  const handler = route.kind === 'route-handler'
  return (
    <div
      className={`route-node status-inferred${handler ? ' route-node-handler' : ''}${dimmed ? ' dimmed' : ''}`}
      title={route.file}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
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
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
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
  if (!subtreeMatches(node, q)) return null
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
            if (route?.kind === 'page') {
              return (
                <a
                  key={kind}
                  className="file-chip file-chip-page"
                  href={href({ name: 'page', routeId: route.id })}
                >
                  {kind}
                </a>
              )
            }
            return (
              <span key={kind} className={`file-chip${route ? ' file-chip-route' : ''}`} title={file}>
                {kind}
                {route?.methods?.length ? ` ${route.methods.join(' ')}` : ''}
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
