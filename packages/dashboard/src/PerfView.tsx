// Request performance (M47): waterfalls, N+1 requests and duplicates found in the code, with what capture
// timings showed, and endpoints ranked by how slow they answered.
import {
  type EndpointTiming,
  ms,
  PERF_KIND_LABELS,
  PERF_LOOP_LABELS,
  PERF_RUNTIME_LABELS,
  type PerfFinding,
  perfOn,
  perfRuntimeText,
  perfText,
  type Route,
} from '@flow-checker/shared'
import { useData } from './context'
import { useShowDetails } from './details'
import { href } from './router'
import { Badge, CappedList, CodeText, MoreButton, Section, SourceLink, useCapped } from './ui'

/** Shown when requests on the page wait for each other, repeat per item, or are sent twice. */
export function PerfSection({ route }: { route: Route }) {
  const { index } = useData()
  const findings = perfOn(index.model, route.id)
  if (findings.length === 0) return null
  return (
    <Section
      title="Request performance"
      aside={
        <a className="muted" href={href({ name: 'perf' })}>
          {findings.length} to check
        </a>
      }
    >
      <CappedList
        className="list perf-list"
        items={findings}
        render={(f) => <PerfRow key={f.id} finding={f} />}
      />
    </Section>
  )
}

const RUNTIME_TONES = { confirmed: 'warn', 'not-confirmed': 'muted', 'not-seen': 'muted' } as const

/** One finding: its kind, where it is, the sentence, the runtime result, and with details on, its steps. */
export function PerfRow({ finding }: { finding: PerfFinding }) {
  const { index } = useData()
  const details = useShowDetails()
  const runtime = finding.runtime
  const component = finding.componentId ? index.components.get(finding.componentId) : undefined
  return (
    <li data-perf={finding.kind}>
      <div className="cache-row">
        <Badge tone="warn" term={['perf', finding.kind]}>
          {PERF_KIND_LABELS[finding.kind]}
        </Badge>
        {finding.sequential && (
          <Badge tone="warn" term={['perf', 'sequential']}>
            one after another
          </Badge>
        )}
        {runtime && (
          <Badge tone={RUNTIME_TONES[runtime.status]} term={['perf', runtime.status]}>
            {PERF_RUNTIME_LABELS[runtime.status]}
          </Badge>
        )}
        {details && finding.loop && (
          <Badge tone="muted" term={['perf', `loop-${finding.loop.kind}`]}>
            {PERF_LOOP_LABELS[finding.loop.kind]}
          </Badge>
        )}
        {details && (
          <Badge tone="muted" term={['endpoint-side', finding.side === 'client' ? 'browser' : 'server']}>
            {finding.side === 'client' ? 'browser' : 'server'}
          </Badge>
        )}
        <span className="spacer" />
        <SourceLink file={finding.loc.file} line={finding.loc.line} column={finding.loc.column} />
      </div>
      <div>
        <CodeText text={perfText(finding, index.model)} />
      </div>
      {(runtime?.status === 'confirmed' || component) && (
        <div className="muted">
          {runtime?.status === 'confirmed' && perfRuntimeText(runtime)}
          {runtime?.status === 'confirmed' && component && ' · '}
          {component && (
            <>
              {'in '}
              <a href={href({ name: 'component', componentId: component.id })}>
                <code>{component.name}</code>
              </a>
            </>
          )}
        </div>
      )}
      {details && finding.steps && (
        <ol className="perf-steps">
          {finding.steps.map((step, i) => (
            <li key={`${step.loc.line}:${step.loc.column}`}>
              <code>await {step.text}</code>
              {step.needs.length > 0 && (
                <span className="muted"> uses {step.needs.map((n) => n + 1).join(', ')}</span>
              )}
              <SourceLink file={step.loc.file} line={step.loc.line} column={step.loc.column} />
              <span className="muted"> ({i + 1})</span>
            </li>
          ))}
        </ol>
      )}
      {details && (
        <ul className="perf-steps">
          {finding.siteIds.map((id) => (
            <SiteLine key={id} siteId={id} />
          ))}
          {(finding.listSiteIds ?? []).map((id) => (
            <SiteLine key={`list-${id}`} siteId={id} prefix="list from " />
          ))}
        </ul>
      )}
    </li>
  )
}

function SiteLine({ siteId, prefix = '' }: { siteId: string; prefix?: string }) {
  const { index } = useData()
  const site = index.requests.get(siteId)
  if (!site) return null
  const method = site.method ?? '?'
  const url = site.url?.path ?? site.url?.text ?? '?'
  return (
    <li>
      {prefix}
      <a href={href({ name: 'requests', siteId, q: '' })}>
        <code>
          {method} {url}
        </code>
      </a>
    </li>
  )
}

/** Endpoints by p95, slowest first. */
export function EndpointTimings({ endpoints }: { endpoints: readonly EndpointTiming[] }) {
  const { shown, hidden, expand } = useCapped(endpoints, 20)
  return (
    <>
      <table className="perf-table" data-section="timings">
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>
              <a href={href({ name: 'glossary', q: '', term: 'perf-p50' })}>p50</a>
            </th>
            <th>
              <a href={href({ name: 'glossary', q: '', term: 'perf-p95' })}>p95</a>
            </th>
            <th>Slowest</th>
            <th>Calls</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((e) => (
            <tr key={e.key} data-endpoint={e.label}>
              <td>
                <a href={href({ name: 'endpoints', endpointId: e.key, q: '' })}>
                  <code>{e.label}</code>
                </a>
                {e.errors > 0 && <span className="warn"> · {e.errors} failed</span>}
              </td>
              <td>{ms(e.p50)}</td>
              <td>{ms(e.p95)}</td>
              <td>
                <a href={href({ name: 'live', q: '', captureId: e.slowestCaptureId })}>{ms(e.max)}</a>
              </td>
              <td>
                {e.count}
                <span className="muted">
                  {e.browser > 0 && e.server > 0 ? ` (${e.browser} browser, ${e.server} server)` : ''}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <MoreButton hidden={hidden} onClick={expand} />
    </>
  )
}
