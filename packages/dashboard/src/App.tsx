import { CLI_NAME } from '@flow-checker/shared'
import { useMemo } from 'react'
import { useLiveFeed, useMeta, useModel, useRescan } from './api'
import { DataContext } from './context'
import { buildIndex } from './model-index'
import { href, type Screen, useScreen } from './router'
import { ComponentPanel } from './screens/ComponentPanel'
import { LiveScreen } from './screens/LiveScreen'
import { MapScreen } from './screens/MapScreen'
import { Overview } from './screens/Overview'
import { PageView } from './screens/PageView'
import { TypesScreen } from './screens/TypesScreen'
import { Empty } from './ui'

const NAV: { label: string; screen: Screen; match: Screen['name'][]; needsCapture?: boolean }[] = [
  { label: 'Overview', screen: { name: 'overview' }, match: ['overview'] },
  { label: 'Map', screen: { name: 'map', view: 'graph', q: '' }, match: ['map', 'page', 'component'] },
  { label: 'Types', screen: { name: 'types', q: '' }, match: ['types'] },
  { label: 'Live', screen: { name: 'live', q: '' }, match: ['live'], needsCapture: true },
]

export function App() {
  const model = useModel()
  const meta = useMeta()
  const rescan = useRescan()
  const screen = useScreen()
  const captureOn = Boolean(meta.data?.capture)
  const live = useLiveFeed(captureOn)
  const index = useMemo(() => (model.data ? buildIndex(model.data) : undefined), [model.data])

  const error = model.error ?? meta.error
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          {CLI_NAME}
        </a>
        <nav className="nav">
          {NAV.filter((item) => !item.needsCapture || meta.data?.capture).map((item) => (
            <a
              key={item.label}
              href={href(item.screen)}
              aria-current={item.match.includes(screen.name) ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <span className="spacer" />
        {meta.data?.scannedAt && (
          <span className="muted" title={meta.data.scannedAt}>
            Scanned {new Date(meta.data.scannedAt).toLocaleTimeString()}
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
        {meta.data?.version && <span className="muted">v{meta.data.version}</span>}
      </header>

      {rescan.error && <div className="banner banner-error">Re-scan failed: {rescan.error.message}</div>}

      <main className="content">
        {error ? (
          <div className="screen">
            <div className="banner banner-error">Could not load the scan: {error.message}</div>
          </div>
        ) : index && meta.data ? (
          <DataContext.Provider value={{ index, meta: meta.data, live: captureOn ? live : undefined }}>
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

function ScreenView({ screen }: { screen: Screen }) {
  switch (screen.name) {
    case 'overview':
      return <Overview />
    case 'map':
      return <MapScreen view={screen.view} q={screen.q} />
    case 'page':
      return <PageView routeId={screen.routeId} componentId={screen.componentId} />
    case 'component':
      return (
        <div className="screen screen-narrow">
          <ComponentPanel componentId={screen.componentId} />
        </div>
      )
    case 'types':
      return <TypesScreen typeId={screen.typeId} q={screen.q} />
    case 'live':
      return <LiveScreen captureId={screen.captureId} q={screen.q} filter={screen.filter} />
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
