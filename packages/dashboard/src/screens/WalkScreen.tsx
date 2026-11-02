// Walk the app (M35): the flows not confirmed yet as a checklist. Each one says what to do, opens its
// start page in the running app, and ticks its steps as the captures and page changes arrive (the
// flows summary is pushed by the live feed). Without capture it is a reading guide. The list comes
// from `buildWalkthrough()` in shared.
import { buildWalkthrough, type Coverage, fillPath, type Ratio, type WalkItem } from '@flow-checker/shared'
import { useEffect, useMemo, useRef } from 'react'
import { useFlows } from '../api'
import { useData } from '../context'
import { href } from '../router'
import { CappedList, CodeText, Empty, Section } from '../ui'
import { useWalkParams } from '../walk-params'
import { FlowStatusBadge } from './FlowsScreen'
import { CaptureHint } from './LiveScreen'

export function WalkScreen({ flowId }: { flowId?: string }) {
  const { index, meta } = useData()
  const captureOn = Boolean(meta.capture)
  const exported = Boolean(meta.exported)
  // Steps can be done here: capture runs and the app has a port to open.
  const live = captureOn && !exported && Boolean(meta.appPort)
  const flows = useFlows(captureOn || exported).data
  const walk = useMemo(() => buildWalkthrough(index, flows), [index, flows])
  const [values, setValue] = useWalkParams(meta.root ?? meta.exported?.projectName ?? '', walk.params)
  // The flow asked for in the URL comes first.
  const todo = useMemo(() => pickFirst(walk.todo, flowId), [walk.todo, flowId])
  const walked = useMemo(() => pickFirst(walk.walked, flowId), [walk.walked, flowId])
  const card = (item: WalkItem) => (
    <WalkCard
      key={item.flowId}
      item={item}
      selected={item.flowId === flowId}
      ticks={captureOn || exported}
      appUrl={live && meta.appPort ? `http://localhost:${meta.appPort}` : undefined}
      values={values}
    />
  )

  return (
    <div className="screen walk">
      <div className="start-head">
        <h1>Walk the app</h1>
        <p className="muted">
          {live
            ? 'Do each flow below in the running app. Steps tick as the requests and page changes come in, and a flow is confirmed once it is walked end to end.'
            : exported
              ? 'The flows found in the code, with what was walked before this export.'
              : 'The flows found in the code, as a reading guide: what a user does, what the app sends and where it goes next.'}
        </p>
      </div>
      {meta.explore && !captureOn && <CaptureHint explore={meta.explore} />}
      {!meta.explore && !captureOn && !exported && (
        <div className="banner banner-info">
          Capture is off, so nothing can be ticked. Start the dashboard with <code>flow-checker</code> (after{' '}
          <code>flow-checker init</code>) to walk the flows in the app.
        </div>
      )}
      <CoverageBars coverage={walk.coverage} />

      {live && walk.params.length > 0 && (
        <Section title="Values for the page links">
          <div className="walk-params">
            {walk.params.map((p) => (
              <label key={p.name}>
                <code>[{p.name}]</code>
                <input
                  aria-label={`Value for [${p.name}]`}
                  value={values[p.name] ?? ''}
                  placeholder={p.suggested ?? p.name}
                  onChange={(event) => setValue(p.name, event.target.value)}
                />
              </label>
            ))}
          </div>
          <p className="muted">Used in every "Open in app" link and remembered for this project.</p>
        </Section>
      )}

      {index.model.flows.length === 0 ? (
        <Empty>
          No flows found. A flow starts at an event handler that sends a request or opens another page, like a
          form's onSubmit.
        </Empty>
      ) : (
        <>
          <Section title="To walk" aside={<span className="count">{walk.todo.length}</span>}>
            {todo.length === 0 ? (
              <p className="empty">Every flow was walked end to end.</p>
            ) : (
              <CappedList items={todo} className="walk-list" limit={10} render={card} />
            )}
          </Section>
          {walked.length > 0 && (
            <Section title="Walked" aside={<span className="count">{walk.walked.length}</span>}>
              <CappedList items={walked} className="walk-list" limit={5} render={card} />
            </Section>
          )}
        </>
      )}
    </div>
  )
}

function pickFirst(items: WalkItem[], flowId: string | undefined): WalkItem[] {
  const at = flowId ? items.findIndex((i) => i.flowId === flowId) : -1
  return at <= 0 ? items : [items[at] as WalkItem, ...items.slice(0, at), ...items.slice(at + 1)]
}

function WalkCard({
  item,
  selected,
  ticks,
  appUrl,
  values,
}: {
  item: WalkItem
  selected: boolean
  ticks: boolean
  appUrl?: string
  values: Record<string, string>
}) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])
  const filled = item.path ? fillPath(item.path, values) : undefined
  return (
    <li
      ref={ref}
      className={`walk-card${selected ? ' selected' : ''}`}
      data-testid="walk-item"
      data-flow={item.flowId}
    >
      <div className="walk-head">
        {ticks && <FlowStatusBadge status={item} />}
        <a className="walk-name" href={href({ name: 'flows', flowId: item.flowId, q: '' })}>
          {item.name}
        </a>
        {item.path && (
          <a className="muted" href={href({ name: 'page', routeId: item.routeId ?? '' })}>
            <code>{item.path}</code>
          </a>
        )}
        <span className="spacer" />
        {ticks && (
          <span className="walk-percent" data-testid="walk-percent">
            {item.percent}%
          </span>
        )}
        {appUrl &&
          item.path &&
          (filled?.path ? (
            <a
              className="button button-small"
              href={`${appUrl}${filled.path}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in app ↗
            </a>
          ) : (
            <span className="muted">Fill in {filled?.missing.map((m) => `[${m}]`).join(', ')} above</span>
          ))}
      </div>
      <ol className="flow-steps">
        {item.steps.map((step, i) => {
          const done = ticks && step.done
          return (
            <li
              key={i}
              className={`flow-step flow-step-${step.kind}${done ? ' flow-step-done' : ''}`}
              data-done={done ? '1' : undefined}
            >
              <span className="flow-step-mark" aria-hidden>
                {done ? '✓' : i + 1}
              </span>
              <span className="flow-step-body">
                <CodeText text={step.text} />
                {!step.checkable && (
                  <span className="muted" title="Capture can't see this step on its own">
                    {' '}
                    (ticks with the step before it)
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </li>
  )
}

/** Confirmed flows and captured requests (M35), on this screen, Start here and the overview. */
export function CoverageBars({ coverage, link }: { coverage: Coverage; link?: boolean }) {
  return (
    <div className="coverage" data-testid="coverage">
      <CoverageRow
        id="flows"
        label="Flows confirmed"
        ratio={coverage.flows}
        detail={`${coverage.flows.done} of ${coverage.flows.total} walked end to end`}
      />
      <CoverageRow
        id="requests"
        label="Requests captured"
        ratio={coverage.requests}
        detail={`${coverage.requests.done} of ${coverage.requests.total} seen in the running app`}
      />
      {link && (
        <a className="start-all" href={href({ name: 'walk' })}>
          Walk the app →
        </a>
      )}
    </div>
  )
}

function CoverageRow({
  id,
  label,
  ratio,
  detail,
}: {
  id: string
  label: string
  ratio: Ratio
  detail: string
}) {
  return (
    <div className="coverage-row" data-testid={`coverage-${id}`}>
      <span className="coverage-label">{label}</span>
      <div
        className="progress"
        role="progressbar"
        aria-label={label}
        aria-valuenow={ratio.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-bar" style={{ width: `${ratio.percent}%` }} />
      </div>
      <span className="coverage-percent">{ratio.percent}%</span>
      <span className="muted coverage-detail">{detail}</span>
    </div>
  )
}
