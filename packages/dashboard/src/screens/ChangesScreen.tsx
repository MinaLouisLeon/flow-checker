// Affected by changes (M36): what the latest re-scan changed and the pages, flows and requests the
// changed files affect. The impact comes from `buildImpact()` in shared, like `flow-checker impact`
// and `scan --diff`. It needs a running flow-checker that watches files: the live feed's `scan` event
// says which files changed.
import {
  buildImpact,
  type EntityKind,
  fileFacts,
  type Impact,
  type ImpactItem,
  impactCounts,
  type ScanEvent,
} from '@flow-checker/shared'
import { useMemo } from 'react'
import { useLastScan } from '../api'
import { useData } from '../context'
import { areasOf } from '../lists'
import type { ModelIndex } from '../model-index'
import { href, summaryScreen } from '../router'
import { CappedList, Empty, SourceLink } from '../ui'

const KIND_TEXT: Record<ImpactItem['kind'], string> = {
  page: 'page',
  handler: 'route handler',
  flow: 'flow',
  request: 'request',
  component: 'component',
  type: 'type',
}

const ENTITY_TEXT: Record<EntityKind, [string, string]> = {
  routes: ['route', 'routes'],
  components: ['component', 'components'],
  types: ['type', 'types'],
  requests: ['request', 'requests'],
  navigations: ['navigation', 'navigations'],
  flows: ['flow', 'flows'],
}

export function ChangesScreen() {
  const { meta } = useData()
  const lastScan = useLastScan()
  return (
    <div className="screen screen-narrow">
      <h1>Affected by changes</h1>
      <p className="muted">
        When you save a file, flow-checker scans again and lists here what the change touches: the pages,
        flows and requests to check. <code>flow-checker impact &lt;file&gt;</code> and{' '}
        <code>flow-checker scan --diff &lt;ref&gt;</code> give the same answer in a terminal.
      </p>
      <ImpactPanel lastScan={lastScan} watching={Boolean(meta.watching)} exported={Boolean(meta.exported)} />
    </div>
  )
}

/** The panel, also shown on the overview after a re-scan. */
export function ImpactPanel({
  lastScan,
  watching,
  exported,
}: {
  lastScan: ScanEvent | undefined
  watching: boolean
  exported: boolean
}) {
  const { index } = useData()
  const impact = useMemo(() => (lastScan ? impactOfScan(index, lastScan) : undefined), [index, lastScan])

  if (exported)
    return (
      <Empty>
        This is an export: it can't see changes. Run <code>flow-checker explore</code> (or <code>dev</code>)
        and edit a file to see what it affects.
      </Empty>
    )
  if (!watching)
    return (
      <Empty>
        Files aren't watched (<code>--no-watch</code>), so changes aren't seen. Use{' '}
        <code>flow-checker impact &lt;file&gt;</code> in a terminal instead.
      </Empty>
    )
  if (!lastScan || !impact)
    return (
      <Empty>No change since this page opened. Edit and save a file: what it affects shows up here.</Empty>
    )
  if (lastScan.files.length === 0)
    return <Empty>The last scan was a manual re-scan, so no file is known to have changed.</Empty>

  return (
    <section className="section impact" data-testid="impact-panel">
      <header className="section-head">
        <h2>Affected by changes</h2>
        <span className="muted">Re-scanned {new Date(lastScan.scannedAt).toLocaleTimeString()}</span>
      </header>
      <ul className="list impact-files">
        {impact.files.map((file) => (
          <li key={file.file}>
            <SourceLink file={file.file} />
            <span className="muted">{fileFacts(file)}</span>
          </li>
        ))}
      </ul>
      <p className="impact-summary">
        {changeText(lastScan)} The change affects <strong>{impactCounts(impact)}</strong>.
      </p>
      {impact.groups.map((group) => (
        <div key={group.areaId ?? '-'} className="impact-group">
          <h3>
            {group.areaId ? (
              <a href={href({ name: 'areas', areaId: group.areaId, q: '' })}>{group.name}</a>
            ) : (
              group.name
            )}
          </h3>
          <CappedList
            className="list impact-items"
            items={group.items}
            limit={8}
            render={(item) => <ImpactRow key={`${item.kind}:${item.id}`} item={item} />}
          />
        </div>
      ))}
      {impact.components.length + impact.types.length > 0 && (
        <details className="impact-also">
          <summary>
            Also touched: {count(impact.components.length, 'component')}
            {impact.components.length > 0 && impact.types.length > 0 ? ' and ' : ''}
            {count(impact.types.length, 'type')}
          </summary>
          <CappedList
            className="list impact-items"
            items={[...impact.components, ...impact.types]}
            render={(item) => <ImpactRow key={`${item.kind}:${item.id}`} item={item} />}
          />
        </details>
      )}
    </section>
  )
}

function ImpactRow({ item }: { item: ImpactItem }) {
  return (
    <li>
      <span className="muted impact-kind">{KIND_TEXT[item.kind]}</span>
      <a href={href(summaryScreen(item.link))}>
        <code>{item.label}</code>
      </a>
      <span className="muted impact-reason">{item.reason}</span>
    </li>
  )
}

export function impactOfScan(index: ModelIndex, scan: ScanEvent): Impact {
  return buildImpact(
    index,
    scan.files.map((file) => ({ file })),
    areasOf(index),
  )
}

/** `The scan found 1 component changed and 1 request added.` */
function changeText(scan: ScanEvent): string {
  const parts: string[] = []
  for (const [kind, c] of Object.entries(scan.changes) as [
    EntityKind,
    { added: number; removed: number; changed: number },
  ][]) {
    const [one, many] = ENTITY_TEXT[kind]
    for (const what of ['added', 'removed', 'changed'] as const) {
      if (c[what] > 0) parts.push(`${c[what]} ${c[what] === 1 ? one : many} ${what}`)
    }
  }
  if (parts.length === 0) return 'The scan found nothing new in the code (a comment or formatting change).'
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
  return `The scan found ${list}.`
}

function count(n: number, word: string): string {
  return n === 0 ? '' : `${n} ${word}${n === 1 ? '' : 's'}`
}
