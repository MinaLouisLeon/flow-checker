// Request performance (M47): the findings (confirmed at runtime first), then the endpoints captures
// showed as slowest, by p95.
import { type PerfFinding, perfFindings } from '@flow-checker/shared'
import { useVerification } from '../api'
import { useData } from '../context'
import { EndpointTimings, PerfRow } from '../PerfView'
import { href } from '../router'
import { CappedList, Empty, Section } from '../ui'

const ORDER: Record<NonNullable<PerfFinding['runtime']>['status'] | 'none', number> = {
  confirmed: 0,
  'not-seen': 1,
  none: 1,
  'not-confirmed': 2,
}

export function PerfScreen() {
  const { index, meta } = useData()
  const findings = [...perfFindings(index.model)].sort(
    (a, b) => ORDER[a.runtime?.status ?? 'none'] - ORDER[b.runtime?.status ?? 'none'],
  )
  const live = Boolean(meta.capture || meta.exported)
  const timings = useVerification(live).data?.perf
  const confirmed = findings.filter((f) => f.runtime?.status === 'confirmed').length
  const count = (kind: PerfFinding['kind']) => findings.filter((f) => f.kind === kind).length

  return (
    <div className="screen screen-narrow">
      <h1>Request performance</h1>
      <p className="muted">
        Requests that wait for each other for no reason (waterfalls), run once per item of a list (N+1), or
        are sent twice on one page load, found in the code. With capture on, the timings of each page load
        confirm them, and every endpoint gets its median (p50) and slow-call (p95) time.
      </p>
      {findings.length === 0 ? (
        <Empty>The scan found no waterfalls, N+1 requests or duplicate requests.</Empty>
      ) : (
        <>
          <p>
            {count('waterfall')} waterfall{count('waterfall') === 1 ? '' : 's'} · {count('n-plus-one')} N+1 ·{' '}
            {count('duplicate')} duplicate{count('duplicate') === 1 ? '' : 's'}
            {confirmed > 0 && <span className="warn"> · {confirmed} confirmed at runtime</span>}
          </p>
          <Section title="To check">
            <CappedList
              className="list perf-list"
              limit={20}
              items={findings}
              render={(f) => <PerfRow key={f.id} finding={f} />}
            />
          </Section>
        </>
      )}
      <Section title="Slowest endpoints">
        {!live ? (
          <Empty>Start the app with capture on to time its requests.</Empty>
        ) : !timings?.endpoints.length ? (
          <Empty>No request captured yet. Use the app, and each endpoint's timings show up here.</Empty>
        ) : (
          <>
            <p className="muted">
              From {timings.loads} page load{timings.loads === 1 ? '' : 's'} and server request
              {timings.loads === 1 ? '' : 's'}. Times in dev include compiling, so compare endpoints with each
              other rather than with production.
            </p>
            <EndpointTimings endpoints={timings.endpoints} />
          </>
        )}
      </Section>
      <p className="muted">
        What each label means:{' '}
        <a href={href({ name: 'glossary', q: '', term: 'perf-waterfall' })}>glossary</a>.
      </p>
    </div>
  )
}
