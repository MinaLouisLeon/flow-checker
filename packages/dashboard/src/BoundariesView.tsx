// Special files and boundaries (M41): what the page shows while it loads, on an error and on
// `notFound()`, the gaps, and its metadata.
import {
  BOUNDARY_LABELS,
  type BoundaryGap,
  boundaryText,
  GAP_LABELS,
  gapText,
  isBuildError,
  type PageBoundary,
  type Route,
  titleText,
} from '@flow-checker/shared'
import { useData } from './context'
import { useShowDetails } from './details'
import { siteHref } from './RequestView'
import { href } from './router'
import { Badge, CodeText, Section, SourceLink } from './ui'

const PLACE: Record<NonNullable<BoundaryGap['in']>, string> = {
  layout: 'layout',
  page: 'page',
  component: 'component',
}

/** The nearest special file of a kind, or a component boundary, in words. */
function nearestText(items: PageBoundary[], kind: PageBoundary['kind']): PageBoundary | undefined {
  return items.find((i) => i.kind === kind && i.nearest)
}

export function BoundariesSection({ route }: { route: Route }) {
  const { index } = useData()
  const details = useShowDetails()
  const boundaries = route.boundaries
  if (!boundaries) {
    return (
      <Section title="Boundaries">
        <p className="muted">
          Scanned by an older version; scan again to see loading, error and not-found handling.
        </p>
      </Section>
    )
  }
  const { items, gaps } = boundaries
  const loading = nearestText(items, 'loading')
  const error = nearestText(items, 'error') ?? nearestText(items, 'global-error')
  const notFound = nearestText(items, 'not-found')
  const inComponents = items.filter((i) => i.in !== 'segment')
  const fileText = (item: PageBoundary | undefined, none: string) =>
    item ? <SourceLink file={item.file} /> : <span className="muted">{none}</span>
  return (
    <Section
      title="Boundaries"
      aside={gaps.length > 0 ? <span className="count">{gaps.length}</span> : undefined}
    >
      <ul className="list boundary-summary">
        <li>
          <span>While it loads</span>
          <span className="spacer" />
          {loading ? (
            fileText(loading, '')
          ) : inComponents.some((i) => i.kind === 'suspense') ? (
            <span className="muted">only the {'<Suspense>'} parts below</span>
          ) : (
            fileText(undefined, 'nothing: navigation waits for the page')
          )}
        </li>
        <li>
          <span>On an error</span>
          <span className="spacer" />
          {fileText(error, "Next's default error page")}
        </li>
        <li>
          <span>
            On <code>notFound()</code>
          </span>
          <span className="spacer" />
          {fileText(notFound, "Next's default 404 page")}
        </li>
      </ul>
      {gaps.length > 0 && (
        <ul className="list gap-list">
          {gaps.map((gap, i) => {
            const component = gap.componentId ? index.components.get(gap.componentId) : undefined
            const site = gap.siteId ? index.requests.get(gap.siteId) : undefined
            return (
              <li key={`${gap.kind}-${i}`} data-gap={gap.kind}>
                <Badge tone="warn" term={['boundary', gap.kind]}>
                  {isBuildError(gap) ? '⛔ ' : '⚠ '}
                  {GAP_LABELS[gap.kind]}
                </Badge>
                <span>
                  <CodeText text={gapText(gap)} />
                  {component && gap.in && (
                    <span className="muted">
                      {' '}
                      · {PLACE[gap.in]}{' '}
                      <a href={href({ name: 'page', routeId: route.id, componentId: component.id })}>
                        {component.name}
                      </a>
                    </span>
                  )}
                  {site && (
                    <>
                      {' · '}
                      <a href={siteHref(site)}>request</a>
                    </>
                  )}
                </span>
                <span className="spacer" />
                {gap.loc && <SourceLink file={gap.loc.file} line={gap.loc.line} column={gap.loc.column} />}
              </li>
            )
          })}
        </ul>
      )}
      {details && items.length > 0 && (
        <ul className="list boundary-list">
          {items.map((item, i) => (
            <li key={`${item.kind}-${item.file}-${i}`} data-boundary={item.kind}>
              <Badge tone="muted" term={['boundary', item.kind]}>
                {BOUNDARY_LABELS[item.kind]}
              </Badge>
              <span>
                <CodeText text={boundaryText(item)} />
                {item.nearest && <span className="muted"> · shown for this page</span>}
              </span>
              <span className="spacer" />
              <SourceLink
                file={item.loc?.file ?? item.file}
                line={item.loc?.line}
                column={item.loc?.column}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

export function MetadataSection({ route }: { route: Route }) {
  const metadata = route.metadata
  if (!metadata) return null
  return (
    <Section title="Metadata">
      <p>
        Title:{' '}
        {metadata.title ? (
          <code>{metadata.title}</code>
        ) : (
          <span className="muted">{titleText(metadata)}</span>
        )}
      </p>
      {metadata.sources.length === 0 ? (
        <p className="muted">
          Neither the page nor its layouts export <code>metadata</code> or <code>generateMetadata</code>.
        </p>
      ) : (
        <ul className="list metadata-list">
          {metadata.sources.map((source) => (
            <li key={`${source.file}-${source.kind}`}>
              <span>
                {source.in} <code>{source.kind}</code>
                {source.fields ? (
                  <span className="muted"> · {source.fields.join(', ') || 'nothing'}</span>
                ) : (
                  <span className="muted"> · fields the scan can't read</span>
                )}
                {source.template && (
                  <span className="muted">
                    {' '}
                    · template <code>{source.template}</code>
                  </span>
                )}
              </span>
              <span className="spacer" />
              <SourceLink file={source.loc.file} line={source.loc.line} column={source.loc.column} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
