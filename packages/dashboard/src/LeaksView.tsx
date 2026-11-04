// Server/client leaks (M44): server-only modules the page's client code imports, and props its
// server components hand to client components that can't cross to the browser.
import {
  LEAK_LABELS,
  type Leak,
  leakKind,
  leaksOn,
  leakText,
  leakWhy,
  type Route,
} from '@flow-checker/shared'
import { useData } from './context'
import { Badge, CappedList, CodeText, Section, SourceLink } from './ui'

/** Shown only when the page has leaks: each one breaks the page. */
export function LeaksSection({ route }: { route: Route }) {
  const { index } = useData()
  const leaks = leaksOn(index.model, route.id)
  if (leaks.length === 0) return null
  return (
    <Section title="Server/client leaks" aside={<span className="count">{leaks.length}</span>}>
      <p className="muted">
        Next rejects these, so the page fails to build or render: server-only code that client code imports,
        and props that can't cross to the browser.
      </p>
      <CappedList
        className="list leak-list"
        items={leaks}
        render={(leak) => (
          <LeakRow
            key={`${leak.loc.file}:${leak.loc.line}:${leak.loc.column}:${leakKey(leak)}`}
            leak={leak}
          />
        )}
      />
    </Section>
  )
}

function leakKey(leak: Leak): string {
  return leak.kind === 'module' ? leak.module : leak.prop
}

export function LeakRow({ leak }: { leak: Leak }) {
  const { index } = useData()
  const name = (id: string) => index.components.get(id)?.name ?? '?'
  const kind = leakKind(leak)
  return (
    <li data-leak={leak.kind === 'module' ? leak.module : leak.prop}>
      <div className="cache-row">
        <Badge tone="warn" term={['leak', kind]}>
          {LEAK_LABELS[kind]}
        </Badge>
        <span>
          <CodeText text={leakText(leak, name)} />
        </span>
        <span className="spacer" />
        <SourceLink file={leak.loc.file} line={leak.loc.line} column={leak.loc.column} />
      </div>
      <div className="muted">
        <CodeText text={leakWhy(leak)} />
      </div>
    </li>
  )
}
