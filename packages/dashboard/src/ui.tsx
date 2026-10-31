import type { Component, ComponentRef } from '@flow-checker/shared'
import type { ReactNode } from 'react'
import { useData } from './context'
import { editorUrl } from './model-index'

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

export function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => f?.toLowerCase().includes(q))
}
