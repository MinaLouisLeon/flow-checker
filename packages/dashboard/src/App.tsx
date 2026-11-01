import { CLI_NAME } from '@flow-checker/shared'
import { useMemo } from 'react'
import { useFlows, useLastScan, useLiveFeed, useMeta, useModel, useRescan } from './api'
import { DataContext } from './context'
import { buildIndex } from './model-index'
import { href, type Screen, useScreen } from './router'
import { AreasScreen } from './screens/AreasScreen'
import { ComponentPanel } from './screens/ComponentPanel'
import { ComponentsScreen } from './screens/ComponentsScreen'
import { EndpointsScreen } from './screens/EndpointsScreen'
import { ExportScreen } from './screens/ExportScreen'
import { FlowsScreen } from './screens/FlowsScreen'
import { LiveScreen } from './screens/LiveScreen'
import { MapScreen } from './screens/MapScreen'
import { Overview } from './screens/Overview'
import { PageView } from './screens/PageView'
import { RequestsScreen } from './screens/RequestsScreen'
import { TypesScreen } from './screens/TypesScreen'
import { useScrollMemory } from './scroll'
import { Empty } from './ui'

const NAV: {
  label: string
  screen: Screen
  match: Screen['name'][]
  needsCapture?: boolean
  needsExport?: boolean
}[] = [
  { label: 'Overview', screen: { name: 'overview' }, match: ['overview'] },
  { label: 'Map', screen: { name: 'map', view: 'graph', q: '' }, match: ['map', 'page'] },
  { label: 'Areas', screen: { name: 'areas', q: '' }, match: ['areas'] },
  { label: 'Components', screen: { name: 'components', q: '' }, match: ['components', 'component'] },
  { label: 'Requests', screen: { name: 'requests', q: '' }, match: ['requests'] },
  { label: 'Endpoints', screen: { name: 'endpoints', q: '' }, match: ['endpoints'] },
  { label: 'Flows', screen: { name: 'flows', q: '' }, match: ['flows'] },
  { label: 'Types', screen: { name: 'types', q: '' }, match: ['types'] },
  { label: 'Live', screen: { name: 'live', q: '' }, match: ['live'], needsCapture: true },
  { label: 'Export', screen: { name: 'export' }, match: ['export'], needsExport: true },
]

export function App() {
  const model = useModel()
  const meta = useMeta()
  const rescan = useRescan()
  const screen = useScreen()
  useScrollMemory(screen)
  const captureOn = Boolean(meta.data?.capture)
  const exported = meta.data?.exported
  const live = useLiveFeed(captureOn || Boolean(meta.data?.watching))
  const lastScan = useLastScan()
  const index = useMemo(() => (model.data ? buildIndex(model.data) : undefined), [model.data])
  // Page guards a captured session hit (M31), from the flows summary.
  const flows = useFlows(captureOn || Boolean(exported))
  const seenGuards = useMemo(() => {
    const guards = flows.data?.guards
    return guards ? new Map(Object.entries(guards).map(([id, list]) => [id, new Set(list)])) : undefined
  }, [flows.data])

  const error = model.error ?? meta.error
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          {CLI_NAME}
        </a>
        <nav className="nav">
          {NAV.filter(
            (item) =>
              // Explore shows Live too, to explain how to turn capture on.
              (!item.needsCapture || meta.data?.capture || meta.data?.explore) &&
              (!item.needsExport || meta.data?.export),
          ).map((item) => (
            <a
              key={item.label}
              href={href(item.screen)}
              aria-current={item.match.includes(screen.name) ? 'page' : undefined}
            >
              {/* An export has no live feed: the same screen lists the exported captures. */}
              {item.screen.name === 'live' && exported ? 'Captures' : item.label}
            </a>
          ))}
        </nav>
        <span className="spacer" />
        {exported && (
          <span className="muted topbar-meta" title={exported.generatedAt}>
            {exported.projectName} · exported {new Date(exported.generatedAt).toLocaleString()}
          </span>
        )}
        {!exported && meta.data?.scannedAt && (
          <span
            className="muted topbar-meta"
            title={
              lastScan?.files.length
                ? `Re-scanned after a change to ${lastScan.files.join(', ')}`
                : meta.data.scannedAt
            }
          >
            {meta.data.watching && (
              <span className={`live-status live-${live}`} title={`Watching files (${live})`}>
                <span className="dot" />{' '}
              </span>
            )}
            Scanned {new Date(meta.data.scannedAt).toLocaleTimeString()}
            {lastScan?.files.length ? ` · ${shortFiles(lastScan.files)}` : ''}
          </span>
        )}
        {meta.data?.canRescan && (
          <button
            type="button"
            className="button"
            disabled={rescan.isPending}
            onClick={() => rescan.mutate()}
          >
            {rescan.isPending ? 'Scanning…' : 'Re-scan'}
          </button>
        )}
        {meta.data?.version && <span className="muted topbar-meta">v{meta.data.version}</span>}
      </header>

      {exported && !exported.redacted && (
        <div className="banner banner-error">
          Raw export: captured requests are not redacted. Do not share this site.
        </div>
      )}
      {rescan.error && <div className="banner banner-error">Re-scan failed: {rescan.error.message}</div>}
      {lastScan && lastScan.needsRecheck.length > 0 && (
        <div className="banner banner-warn">
          The code of {lastScan.needsRecheck.length} captured request
          {lastScan.needsRecheck.length === 1 ? '' : 's'} changed. Use the app again to re-check{' '}
          {lastScan.needsRecheck.length === 1 ? 'it' : 'them'}.
        </div>
      )}

      <main className="content">
        {error ? (
          <div className="screen">
            <div className="banner banner-error">Could not load the scan: {error.message}</div>
          </div>
        ) : index && meta.data ? (
          <DataContext.Provider
            value={{ index, meta: meta.data, live: captureOn ? live : undefined, seenGuards }}
          >
            <ScreenView screen={screen} />
          </DataContext.Provider>
        ) : (
          <div className="screen">
            <Empty>Loading scan…</Empty>
          </div>
        )}
      </main>
    </div>
  )
}

/** `page.tsx changed`, `page.tsx and 2 more changed`. */
function shortFiles(files: string[]): string {
  const name = (files[0] ?? '').split('/').pop()
  return files.length === 1 ? `${name} changed` : `${name} and ${files.length - 1} more changed`
}

function ScreenView({ screen }: { screen: Screen }) {
  switch (screen.name) {
    case 'overview':
      return <Overview />
    case 'map':
      return <MapScreen view={screen.view} q={screen.q} areas={screen.areas} access={screen.access} />
    case 'areas':
      return <AreasScreen areaId={screen.areaId} q={screen.q} />
    case 'page':
      return <PageView routeId={screen.routeId} componentId={screen.componentId} />
    case 'component':
      return (
        <div className="screen screen-narrow">
          <ComponentPanel componentId={screen.componentId} />
        </div>
      )
    case 'components':
      return <ComponentsScreen {...screen} />
    case 'requests':
      return <RequestsScreen {...screen} />
    case 'endpoints':
      return <EndpointsScreen {...screen} />
    case 'types':
      return <TypesScreen typeId={screen.typeId} q={screen.q} unused={screen.unused} />
    case 'flows':
      return <FlowsScreen flowId={screen.flowId} q={screen.q} />
    case 'live':
      return <LiveScreen captureId={screen.captureId} q={screen.q} filter={screen.filter} />
    case 'export':
      return <ExportScreen />
    case 'not-found':
      return (
        <div className="screen">
          <Empty>
            Nothing here. <a href="#/">Go to the overview</a>
          </Empty>
        </div>
      )
  }
}
