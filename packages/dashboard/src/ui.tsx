import { accessOf, type Component, type ComponentRef, guardText, type Route } from '@flow-checker/shared'
import { type ReactNode, useEffect, useState } from 'react'
import { useData } from './context'
import { CAP, capped } from './lists'
import { editorUrl } from './model-index'

/**
 * A page's access label (M31): `guarded`, `access unknown`, or `open` (left out when `compact`, so
 * busy lists only mark the pages that can stop). The title lists the guards.
 */
export function AccessBadge({ route, compact }: { route: Route; compact?: boolean }) {
  if (route.kind !== 'page') return null
  const access = accessOf(route)
  const lines = [...access.guards.map(guardText), ...(access.reasons ?? []).map((r) => `? ${r.text}`)].map(
    (line) => line.replaceAll('`', ''),
  )
  const title = lines.length > 0 ? lines.join('\n') : 'Nothing redirects or stops this page'
  if (access.status === 'guarded')
    return (
      <Badge tone="shared" title={title}>
        guarded
      </Badge>
    )
  if (access.status === 'unknown')
    return (
      <Badge tone="muted" title={title}>
        access ?
      </Badge>
    )
  return compact ? null : (
    <Badge tone="ok" title={title}>
      open
    </Badge>
  )
}

/** Text with `code` spans, as the shared wording writes it (M31). */
export function CodeText({ text }: { text: string }) {
  const parts = text.split('`')
  return <>{parts.map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : part))}</>
}

/** The compact access badge for a page chip in a list, when the page can stop. */
export function PageAccess({ route }: { route: Route | undefined }) {
  return route ? <AccessBadge route={route} compact /> : null
}

export function Badge({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: 'neutral' | 'server' | 'client' | 'shared' | 'warn' | 'ok' | 'muted'
  title?: string
  children: ReactNode
}) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  )
}

export function KindBadge({ component }: { component: Component }) {
  const titles = {
    server: 'Server component: only rendered from server components',
    client: component.clientBoundary
      ? "Client component: the file starts with 'use client'"
      : "Client component: rendered below a 'use client' boundary",
    shared: 'Rendered from both server and client components',
  }
  return (
    <>
      <Badge tone={component.kind} title={titles[component.kind]}>
        {component.kind}
      </Badge>
      {component.clientBoundary && (
        <Badge tone="muted" title="This file starts the client boundary">
          use client
        </Badge>
      )}
    </>
  )
}

export function RefBadges({ site: r }: { site: ComponentRef }) {
  return (
    <>
      {r.conditional && (
        <Badge tone="muted" title="Only rendered on some paths">
          conditional
        </Badge>
      )}
      {r.dynamic && (
        <Badge tone="muted" title="Loaded with next/dynamic or React.lazy">
          lazy
        </Badge>
      )}
      {r.resolution === 'excluded' && (
        <Badge tone="muted" title="In a file the config's include/exclude leaves out">
          excluded
        </Badge>
      )}
      {r.resolution === 'unresolved' && (
        <Badge tone="warn" title="The scanner could not find this component">
          ⚠ unresolved
        </Badge>
      )}
      {r.resolution === 'prop' && (
        <Badge tone="muted" title="Passed in by the parent, e.g. an `as` prop">
          from props
        </Badge>
      )}
    </>
  )
}

/** `file:line` that opens in VS Code when the project root is known. */
export function SourceLink({ file, line, column }: { file: string; line?: number; column?: number }) {
  const { meta } = useData()
  const label = line ? `${file}:${line}` : file
  const url = editorUrl(meta.root, file, line, column)
  if (!url) return <code className="source">{label}</code>
  return (
    <a className="source" href={url} title="Open in editor">
      <code>{label}</code>
    </a>
  )
}

export function Section({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="section">
      <header className="section-head">
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <input
      className="search"
      type="search"
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <select
      className="select"
      aria-label={label}
      title={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

const PAGE_SIZE = 200

/**
 * Long lists render 200 rows at a time, so typing in a search box stays quick on large apps.
 * `resetKey` (the filters) starts again from the first page; `selected` is always shown.
 */
export function usePaged<T>(items: T[], resetKey: string, selected = -1) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  useEffect(() => setLimit(PAGE_SIZE), [resetKey])
  const shown = Math.max(limit, selected + 1)
  return {
    items: items.slice(0, shown),
    more: Math.max(0, items.length - shown),
    showMore: () => setLimit(shown + PAGE_SIZE),
  }
}

export function ShowMore({ more, onClick }: { more: number; onClick: () => void }) {
  if (more <= 0) return null
  return (
    <button type="button" className="button show-more" onClick={onClick}>
      Show {Math.min(more, PAGE_SIZE)} more <span className="muted">({more} hidden)</span>
    </button>
  )
}

export function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => f?.toLowerCase().includes(q))
}

/** A list that grows with the app: the first few entries, then "+N more" (M23). */
export function useCapped<T>(items: readonly T[], limit = CAP) {
  const [expanded, setExpanded] = useState(false)
  return { ...capped(items, expanded, limit), expand: () => setExpanded(true) }
}

export function MoreButton({ hidden, onClick }: { hidden: number; onClick: () => void }) {
  if (hidden <= 0) return null
  return (
    <button type="button" className="more-button" onClick={onClick}>
      +{hidden} more
    </button>
  )
}

/** A capped `<ul>`: the first entries, then a "+N more" row. */
export function CappedList<T>({
  items,
  className,
  limit,
  render,
}: {
  items: readonly T[]
  className?: string
  limit?: number
  /** Renders one entry, keyed (a `<li>`). */
  render: (item: T) => ReactNode
}) {
  const { shown, hidden, expand } = useCapped(items, limit)
  return (
    <ul className={className}>
      {shown.map(render)}
      {hidden > 0 && (
        <li className="more-row">
          <MoreButton hidden={hidden} onClick={expand} />
        </li>
      )}
    </ul>
  )
}
