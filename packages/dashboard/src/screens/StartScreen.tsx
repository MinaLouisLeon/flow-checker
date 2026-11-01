// Start here (M32): the first screen. What the app is built with, its areas, where to start, its main
// flows and backends, where things live and what to check, each item linking to its screen. The
// items come from `buildSummary()` in shared, like `flow-checker summary` and `ONBOARDING.md`.
import { buildCoverage, buildSummary, type SummaryItem, type SummarySection } from '@flow-checker/shared'
import { useMemo } from 'react'
import { useFlows } from '../api'
import { useData } from '../context'
import { areasOf, endpointsOf } from '../lists'
import { href, summaryScreen } from '../router'
import { CaptureHint } from './LiveScreen'
import { CoverageBars } from './WalkScreen'

const MORE_TEXT: Record<SummarySection['id'], string> = {
  stack: 'Overview',
  areas: 'All areas',
  entry: 'All pages on the map',
  flows: 'All flows',
  backends: 'All endpoints',
  places: 'All components',
  check: 'The full to-do list on the overview',
}

export function StartScreen() {
  const { index, meta } = useData()
  const flows = useFlows(Boolean(meta.capture || meta.exported)).data
  const summary = useMemo(
    () => buildSummary(index, { flows, endpoints: endpointsOf(index), areas: areasOf(index) }),
    [index, flows],
  )
  const coverage = useMemo(() => buildCoverage(index, flows), [index, flows])
  const app = index.model.project

  return (
    <div className="screen">
      <div className="start-head">
        <h1>Start here</h1>
        <p className="muted">
          A short tour of this {app.nextVersion ? `Next.js ${app.nextVersion}` : 'Next.js'} app, read from its
          code. Every item opens its screen; the <a href={href({ name: 'overview' })}>overview</a> has the
          counts and the full to-do list.
        </p>
      </div>
      {meta.explore && !meta.capture && <CaptureHint explore={meta.explore} />}
      <CoverageBars coverage={coverage} link />
      <div className="start-grid">
        {summary.sections.map((section) => (
          <StartSection key={section.id} section={section} />
        ))}
      </div>
    </div>
  )
}

function StartSection({ section }: { section: SummarySection }) {
  const all = href(summaryScreen(section.link))
  return (
    <section className={`section start-section start-${section.id}`} data-testid={`start-${section.id}`}>
      <header className="section-head">
        <h2>{section.title}</h2>
      </header>
      {section.note && <p className="muted start-note">{section.note}</p>}
      {section.items.length === 0 ? (
        <p className="empty">{section.empty}</p>
      ) : (
        <ul className="list start-list">
          {section.items.map((item) => (
            <StartItem key={`${item.label} ${item.value}`} item={item} />
          ))}
        </ul>
      )}
      <a className="start-all" href={all}>
        {section.more > 0 ? `${section.more} more · ` : ''}
        {MORE_TEXT[section.id]} →
      </a>
    </section>
  )
}

function StartItem({ item }: { item: SummaryItem }) {
  return (
    <li>
      <span className="start-label muted">{item.label}</span>
      <a className="start-value" href={href(summaryScreen(item.link))}>
        {item.code ? <code>{item.value}</code> : item.value}
      </a>
      {item.detail && <span className="start-detail muted">{item.detail}</span>}
    </li>
  )
}
