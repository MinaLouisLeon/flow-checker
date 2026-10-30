// Type comparison results (M8): captured data checked against the request site's declared types.
import {
  mismatchField,
  type RequestSite,
  type SiteMismatch,
  type TypeCheck,
  type TypeCheckStatus,
  type TypeMismatch,
} from '@flow-checker/shared'
import { href } from './router'
import { Badge, Empty } from './ui'

const KIND_LABEL: Record<TypeMismatch['kind'], string> = {
  'missing-field': 'missing',
  'extra-field': 'not in type',
  'wrong-type': 'wrong type',
  null: 'null',
}

const PART_LABEL = { request: 'Request body', response: 'Response', message: 'Event' } as const

/** `✓ verified`, `✗ type mismatch` or `↻ needs re-check` for sites live capture has seen. */
export function SiteStatusBadge({ site }: { site: RequestSite }) {
  if (site.status === 'needs-recheck') {
    return (
      <Badge tone="warn" title="The code changed after the last capture. Use the app again to re-check it.">
        ↻ needs re-check
      </Badge>
    )
  }
  if (site.status === 'verified') {
    return (
      <Badge tone="ok" title="Live capture recorded this request">
        ✓ verified
      </Badge>
    )
  }
  if (site.status === 'mismatch') {
    return (
      <Badge tone="warn" title="Live capture recorded this request, but its data doesn't match the types">
        ✗ type mismatch
      </Badge>
    )
  }
  return null
}

/** Marks a capture taken before its request site's code last changed. */
export function StaleBadge({ stale }: { stale?: boolean }) {
  if (!stale) return null
  return (
    <Badge tone="muted" title="Taken before the code that sends this request changed">
      stale
    </Badge>
  )
}

/** Badge for one capture's type check. `ok` and `skipped` only show when asked. */
export function TypeCheckBadge({ status, quiet }: { status?: TypeCheckStatus; quiet?: boolean }) {
  if (status === 'mismatch') {
    return (
      <Badge tone="warn" title="The data doesn't match the request site's types">
        ✗ types
      </Badge>
    )
  }
  if (quiet || !status) return null
  return status === 'ok' ? (
    <Badge tone="ok" title="The data matches the request site's types">
      ✓ types
    </Badge>
  ) : (
    <Badge tone="muted" title="The data could not be compared with the types">
      types not checked
    </Badge>
  )
}

/** One capture's result, part by part. */
export function CaptureTypeCheck({ check }: { check: TypeCheck }) {
  return (
    <div className="type-check">
      {check.parts.map((part) => (
        <div key={`${part.part}:${part.event ?? ''}`} className="type-check-part">
          <h4>
            {PART_LABEL[part.part]} {part.event && <code>{part.event}</code>}{' '}
            <code className="muted">{part.type}</code>{' '}
            {part.messages !== undefined && (
              <span className="muted">
                {part.messages} message{part.messages === 1 ? '' : 's'}{' '}
              </span>
            )}
            {part.status === 'ok' && <Badge tone="ok">✓ matches</Badge>}
            {part.status === 'mismatch' && (
              <Badge tone="warn">
                ✗ {part.mismatches.length} mismatch{part.mismatches.length === 1 ? '' : 'es'}
              </Badge>
            )}
            {part.status === 'skipped' && <Badge tone="muted">not checked</Badge>}
          </h4>
          {part.reason && <p className="muted">{part.reason}</p>}
          {part.mismatches.length > 0 && <MismatchTable mismatches={part.mismatches} />}
          {part.truncated && <p className="muted">More mismatches were found than are shown.</p>}
        </div>
      ))}
    </div>
  )
}

/** Every distinct mismatch seen across a site's captures. */
export function SiteTypeCheckView({ mismatches, checked }: { mismatches: SiteMismatch[]; checked: number }) {
  if (mismatches.length === 0) return <Empty>The captured data matches the types.</Empty>
  return (
    <div className="type-check">
      {[
        ...(['response', 'request'] as const).map((part) => ({ part, event: undefined })),
        // Event stream messages, one group per event name (M18).
        ...[...new Set(mismatches.filter((m) => m.part === 'message').map((m) => m.event ?? 'message'))].map(
          (event) => ({ part: 'message' as const, event }),
        ),
      ].map(({ part, event }) => {
        const list = mismatches.filter(
          (m) => m.part === part && (event === undefined || (m.event ?? 'message') === event),
        )
        if (list.length === 0) return null
        return (
          <div key={`${part}:${event ?? ''}`} className="type-check-part">
            <h4>
              {PART_LABEL[part]} {event && <code>{event}</code>}
            </h4>
            <MismatchTable mismatches={list} checked={checked} />
          </div>
        )
      })}
    </div>
  )
}

function MismatchTable({
  mismatches,
  checked,
}: {
  mismatches: (TypeMismatch | SiteMismatch)[]
  /** Site view: captures compared, to show how many had each mismatch. */
  checked?: number
}) {
  return (
    <table className="mismatch-table">
      <thead>
        <tr>
          <th>Field</th>
          <th>Problem</th>
          <th>Expected</th>
          <th>Captured</th>
          {checked !== undefined && <th>Captures</th>}
        </tr>
      </thead>
      <tbody>
        {mismatches.map((m) => (
          <tr key={`${m.kind}:${m.path}`}>
            <td>
              <code>{mismatchField(m.path)}</code>
            </td>
            <td>
              <Badge tone="warn">{KIND_LABEL[m.kind]}</Badge>
            </td>
            <td>
              <code>{m.kind === 'extra-field' ? '—' : m.expected}</code>
            </td>
            <td>
              <code>{m.actual}</code>
              {'count' in m && m.count && m.count > 1 && <span className="muted"> ×{m.count} items</span>}
            </td>
            {checked !== undefined && 'captures' in m && (
              <td>
                <a href={href({ name: 'live', captureId: m.captureId, q: '' })}>
                  {m.captures} of {checked}
                </a>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
