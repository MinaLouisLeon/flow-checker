// Flows (M7): user flows inferred from the code, confirmed when a session walks them, plus
// recorded variants (a walk that went elsewhere) and flows you recorded by name.
import {
  type Flow,
  type FlowStatus,
  type FlowStep,
  queryLinkTarget,
  queryLinkVerb,
  type RecordedFlow,
  urlText,
} from '@flow-checker/shared'
import { useState } from 'react'
import { useDeleteRecording, useFlows, useRenameFlow } from '../api'
import { useData } from '../context'
import type { ModelIndex } from '../model-index'
import { siteHref } from '../RequestView'
import { href, replaceScreen } from '../router'
import { SiteStatusBadge } from '../TypeCheckView'
import { Badge, Empty, matches, SearchBox, Section, SourceLink } from '../ui'

export function FlowsScreen({ flowId, q }: { flowId?: string; q: string }) {
  const { index, meta } = useData()
  const captureOn = Boolean(meta.capture)
  const summary = useFlows(captureOn).data
  const flows = index.model.flows.filter((f) =>
    matches(q, f.name, ...f.routeIds.map((id) => index.routes.get(id)?.path)),
  )
  const recorded = (summary?.recorded ?? []).filter((r) => matches(q, r.name))
  const selectedFlow = flowId ? index.flows.get(flowId) : undefined
  const selectedRecording = flowId ? summary?.recorded.find((r) => r.id === flowId) : undefined

  return (
    <div className="screen screen-split">
      <div className="split-main">
        <div className="toolbar">
          <SearchBox
            value={q}
            onChange={(next) => replaceScreen({ name: 'flows', flowId, q: next })}
            placeholder="Search flows and pages"
          />
          <span className="muted">
            {flows.length} of {index.model.flows.length}
          </span>
        </div>
        {index.model.flows.length === 0 ? (
          <Empty>
            No flows found. A flow starts at an event handler that sends a request, like a form's onSubmit.
          </Empty>
        ) : (
          <ul className="list flow-list">
            {flows.map((flow) => (
              <li key={flow.id} className={flow.id === flowId ? 'selected' : undefined}>
                <a href={href({ name: 'flows', flowId: flow.id, q })}>{flow.name}</a>
                <span className="muted flow-route">{routeTrail(flow, index)}</span>
                <span className="spacer" />
                {captureOn && <FlowStatusBadge status={summary?.flows[flow.id]} />}
              </li>
            ))}
          </ul>
        )}
        {recorded.length > 0 && (
          <Section title="Recorded" aside={<span className="count">{recorded.length}</span>}>
            <ul className="list flow-list">
              {recorded.map((r) => (
                <li key={r.id} className={r.id === flowId ? 'selected' : undefined}>
                  <a href={href({ name: 'flows', flowId: r.id, q })}>{r.name}</a>
                  <span className="spacer" />
                  <Badge tone={r.kind === 'variant' ? 'warn' : 'neutral'}>
                    {r.kind === 'variant' ? 'unexpected path' : 'recorded'}
                  </Badge>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <aside className="split-side">
        {selectedFlow ? (
          <FlowDetail
            flow={selectedFlow}
            status={summary?.flows[selectedFlow.id]}
            captureOn={captureOn}
            variants={
              summary?.recorded.filter((r) => r.kind === 'variant' && r.flowId === selectedFlow.id) ?? []
            }
          />
        ) : selectedRecording ? (
          <RecordingDetail recording={selectedRecording} />
        ) : (
          <Empty>Select a flow to see its steps.</Empty>
        )}
      </aside>
    </div>
  )
}

function routeTrail(flow: Flow, index: ModelIndex): string {
  return flow.routeIds.map((id) => index.routes.get(id)?.path ?? '?').join(' → ')
}

function FlowStatusBadge({ status }: { status?: FlowStatus }) {
  if (!status || status.status === 'unconfirmed') {
    return (
      <Badge tone="muted" term={['flow-status', 'unconfirmed']}>
        not walked yet
      </Badge>
    )
  }
  if (status.status === 'partial') {
    return (
      <Badge tone="warn" term={['flow-status', 'partial']}>
        partial
      </Badge>
    )
  }
  return (
    <Badge tone="ok" title={`Walked end to end ${status.runs} time(s)`} term={['flow-status', 'confirmed']}>
      ✓ confirmed
    </Badge>
  )
}

function FlowDetail({
  flow,
  status,
  captureOn,
  variants,
}: {
  flow: Flow
  status?: FlowStatus
  captureOn: boolean
  variants: RecordedFlow[]
}) {
  const { index, meta } = useData()
  const rename = useRenameFlow()
  const [editing, setEditing] = useState<string | undefined>(undefined)
  const done = status?.best?.steps ?? 0

  return (
    <div className="panel flow-detail">
      <div className="panel-head">
        {captureOn && <FlowStatusBadge status={status} />}
        <Badge tone="muted" title="Where this flow comes from">
          {status?.source === 'both' ? 'inferred + recorded' : 'inferred'}
        </Badge>
        {status && status.runs > 0 && <span className="muted">{status.runs} run(s)</span>}
      </div>

      {editing === undefined ? (
        <h2 className="flow-title">
          {flow.name}{' '}
          {captureOn && !meta.exported && (
            <button type="button" className="button button-small" onClick={() => setEditing(flow.name)}>
              Rename
            </button>
          )}
        </h2>
      ) : (
        <form
          className="flow-rename"
          onSubmit={(event) => {
            event.preventDefault()
            rename.mutate({ flowId: flow.id, name: editing }, { onSuccess: () => setEditing(undefined) })
          }}
        >
          <input
            aria-label="Flow name"
            value={editing}
            onChange={(event) => setEditing(event.target.value)}
            // biome-ignore lint/a11y/noAutofocus: the field appears because the user asked to rename
            autoFocus
          />
          <button type="submit" className="button" disabled={rename.isPending}>
            Save
          </button>
          <button type="button" className="button" onClick={() => setEditing(undefined)}>
            Cancel
          </button>
        </form>
      )}
      <p className="muted">{routeTrail(flow, index)}</p>

      <Section title="Steps">
        <ol className="flow-steps">
          {flow.steps.map((step, i) => (
            <li
              key={i}
              className={`flow-step flow-step-${step.kind}${captureOn && i < done ? ' flow-step-done' : ''}`}
            >
              <span className="flow-step-mark" aria-hidden>
                {captureOn && i < done ? '✓' : i + 1}
              </span>
              <StepView step={step} />
              {flow.branches
                .map((branch, b) => ({ branch, seen: status?.branches[b] ?? false }))
                .filter(({ branch }) => branch.after === i)
                .map(({ branch, seen }, b) => (
                  <div key={b} className="flow-branch">
                    <span className="flow-branch-label">on error</span>
                    {branch.steps.map((s, j) => (
                      <StepView key={j} step={s} />
                    ))}
                    {captureOn && (
                      <Badge
                        tone={seen ? 'ok' : 'muted'}
                        title={seen ? 'Seen in a session' : 'Never exercised yet'}
                      >
                        {seen ? '✓ seen' : 'unconfirmed'}
                      </Badge>
                    )}
                  </div>
                ))}
            </li>
          ))}
        </ol>
      </Section>
      {variants.length > 0 && (
        <Section title="Unexpected paths" aside={<span className="count">{variants.length}</span>}>
          <ul className="list">
            {variants.map((v) => (
              <li key={v.id}>
                <a href={href({ name: 'flows', flowId: v.id, q: '' })}>{v.name}</a>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {captureOn && !status?.best && (
        <p className="notes">
          Walk this flow in the app (or record it from the Live screen) and it is confirmed here.
        </p>
      )}
    </div>
  )
}

function StepView({ step }: { step: FlowStep }) {
  const { index } = useData()
  switch (step.kind) {
    case 'interaction': {
      const component = index.components.get(step.componentId)
      const route = step.routeId ? index.routes.get(step.routeId) : undefined
      return (
        <span className="flow-step-body">
          <Badge tone="client">{step.event}</Badge>{' '}
          <a href={href({ name: 'component', componentId: step.componentId })}>{component?.name ?? '?'}</a>
          {route && (
            <>
              {' '}
              <span className="muted">on</span>{' '}
              <a href={href({ name: 'page', routeId: route.id })}>
                <code>{route.path}</code>
              </a>
            </>
          )}{' '}
          <SourceLink file={step.loc.file} line={step.loc.line} column={step.loc.column} />
        </span>
      )
    }
    case 'request': {
      const site = index.requests.get(step.siteId)
      if (!site) return <span className="flow-step-body muted">request {step.siteId}</span>
      const link = siteHref(site)
      const text =
        site.transport === 'server-action'
          ? `action ${site.serverAction?.name ?? '?'}`
          : site.url
            ? urlText(site.url)
            : '?'
      return (
        <span className="flow-step-body">
          <span className={`method method-${(site.method ?? 'unknown').toLowerCase()}`}>
            {site.method ?? '?'}
          </span>{' '}
          {link ? (
            <a href={link}>
              <code>{text}</code>
            </a>
          ) : (
            <code>{text}</code>
          )}
          {step.onLoad && <span className="muted"> on load</span>}
          {site.responseType && <span className="muted"> → {site.responseType.text}</span>}{' '}
          <SiteStatusBadge site={site} />
        </span>
      )
    }
    case 'navigate': {
      const nav = index.navigations.get(step.navigationId)
      const route = step.routeId ? index.routes.get(step.routeId) : undefined
      return (
        <span className="flow-step-body">
          <span className="muted">{nav?.kind ?? 'navigate'} →</span>{' '}
          {route ? (
            <a href={href({ name: 'page', routeId: route.id })}>
              <code>{route.path}</code>
            </a>
          ) : (
            <code>{nav ? urlText(nav.href) : '?'}</code>
          )}
        </span>
      )
    }
    case 'query-update': {
      const link = index.queryLinks.get(step.linkId)
      if (!link) return <span className="flow-step-body muted">cache update {step.linkId}</span>
      const targets = link.targetSiteIds.map((id) => index.requests.get(id)).filter((s) => !!s)
      return (
        <span className="flow-step-body">
          <span className="muted">{link.method}</span> <code>{queryLinkTarget(link)}</code>
          {targets.length > 0 && (
            <span className="muted">
              {' '}
              → {queryLinkVerb(link.kind)}{' '}
              {[...new Set(targets.map((t) => `${t.method ?? '?'} ${t.url ? urlText(t.url) : '?'}`))].join(
                ', ',
              )}
            </span>
          )}
        </span>
      )
    }
  }
}

function RecordingDetail({ recording }: { recording: RecordedFlow }) {
  const { index, meta } = useData()
  const remove = useDeleteRecording()
  const flow = recording.flowId ? index.flows.get(recording.flowId) : undefined
  return (
    <div className="panel flow-detail">
      <div className="panel-head">
        <Badge tone={recording.kind === 'variant' ? 'warn' : 'neutral'}>
          {recording.kind === 'variant' ? 'unexpected path' : 'recorded'}
        </Badge>
        <span className="spacer" />
        <span className="muted">{new Date(recording.startedAt).toLocaleString()}</span>
      </div>
      <h2 className="flow-title">{recording.name}</h2>
      {flow && (
        <p>
          {recording.kind === 'variant' ? 'Follows ' : 'Walks '}
          <a href={href({ name: 'flows', flowId: flow.id, q: '' })}>{flow.name}</a>
          {recording.kind === 'variant' && recording.divergedAt !== undefined && (
            <span className="muted">
              {' '}
              up to step {recording.divergedAt}, then goes somewhere the code does not lead.
            </span>
          )}
        </p>
      )}
      <Section title="What happened">
        <ol className="flow-steps">
          {recording.steps.map((step, i) => (
            <li key={i} className={`flow-step flow-step-${step.kind}`}>
              <span className="flow-step-mark" aria-hidden>
                {i + 1}
              </span>
              <span className="flow-step-body">
                {step.kind === 'interaction' ? (
                  <>
                    <Badge tone="client">{step.type}</Badge> {step.component ?? '?'}{' '}
                    <span className="muted">{step.target}</span>
                  </>
                ) : step.kind === 'request' ? (
                  <>
                    <span className={`method method-${step.method.toLowerCase()}`}>{step.method}</span>{' '}
                    <a href={href({ name: 'live', captureId: step.captureId, q: '' })}>
                      <code>{step.path}</code>
                    </a>{' '}
                    {step.status !== undefined && <span className="muted">{step.status}</span>}
                  </>
                ) : (
                  <>
                    <span className="muted">{step.how} →</span>{' '}
                    {step.routeId ? (
                      <a href={href({ name: 'page', routeId: step.routeId })}>
                        <code>{step.path}</code>
                      </a>
                    ) : (
                      <code>{step.path}</code>
                    )}
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      </Section>
      {recording.kind === 'named' && !meta.exported && (
        <button
          type="button"
          className="button"
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(recording.id, {
              onSuccess: () => replaceScreen({ name: 'flows', q: '' }),
            })
          }
        >
          Delete recording
        </button>
      )}
    </div>
  )
}
