// Environment variables (M45): the names a page's code reads, where, and whether a `.env` file
// defines them. Only names: the model holds no values.
import {
  definedText,
  ENV_FLAG_LABELS,
  ENV_SIDE_LABELS,
  type EnvFlag,
  type EnvRead,
  type EnvVar,
  envFlagsOn,
  envFlagText,
  envOn,
  hasSource,
  type Route,
  sidesOf,
} from '@flow-checker/shared'
import { useData } from './context'
import { useShowDetails } from './details'
import { href } from './router'
import { Badge, CappedList, CodeText, Section, SourceLink } from './ui'

/** Shown when the page's code reads environment variables. */
export function EnvSection({ route }: { route: Route }) {
  const { index } = useData()
  const vars = envOn(index.model, route.id)
  if (vars.length === 0) return null
  const flagged = vars.filter((v) => envFlagsOn(v, route.id).length > 0).length
  return (
    <Section
      title="Environment variables"
      aside={
        <a className="muted" href={href({ name: 'env' })}>
          {vars.length} read{flagged > 0 ? `, ${flagged} to check` : ''}
        </a>
      }
    >
      <CappedList
        className="list env-list"
        items={vars}
        render={(variable) => (
          <EnvVarRow key={variable.name} variable={variable} flags={envFlagsOn(variable, route.id)} />
        )}
      />
    </Section>
  )
}

/** One name: where its value comes from, the sides it is read on, its flags and the first read. */
export function EnvVarRow({ variable, flags }: { variable: EnvVar; flags: EnvFlag[] }) {
  const details = useShowDetails()
  const first = variable.reads[0]
  return (
    <li data-env={variable.name}>
      <div className="cache-row">
        <code>{variable.name}</code>
        {details &&
          sidesOf(variable).map((side) => (
            <Badge
              key={side}
              tone={side === 'client' ? 'client' : side === 'both' ? 'shared' : 'server'}
              term={['env', side]}
            >
              {ENV_SIDE_LABELS[side]}
            </Badge>
          ))}
        {flags.map((f) => (
          <Badge key={f.kind} tone="warn" term={['env', f.kind]}>
            {ENV_FLAG_LABELS[f.kind]}
          </Badge>
        ))}
        <span className={hasSource(variable) ? 'muted' : 'warn'}>
          <CodeText text={definedText(variable)} />
        </span>
        <span className="spacer" />
        {first && <SourceLink file={first.loc.file} line={first.loc.line} column={first.loc.column} />}
      </div>
      {flags.map((f) => (
        <div key={f.kind} className="muted">
          <CodeText text={envFlagText(variable, f.kind)} />
        </div>
      ))}
    </li>
  )
}

/** A read: its file and line, side, how it reads the name, and the pages it is on. */
export function EnvReadRow({ read }: { read: EnvRead }) {
  const { index } = useData()
  const details = useShowDetails()
  return (
    <li className="env-read">
      <SourceLink file={read.loc.file} line={read.loc.line} column={read.loc.column} />
      <Badge
        tone={read.side === 'client' ? 'client' : read.side === 'both' ? 'shared' : 'server'}
        term={['env', read.side]}
      >
        {ENV_SIDE_LABELS[read.side]}
      </Badge>
      {(details || read.access === 'destructured') && read.access !== 'direct' && (
        <Badge tone="muted" term={['env', read.access]}>
          {read.access}
        </Badge>
      )}
      {read.optional && <span className="muted">has a fallback</span>}
      {read.routeIds.length > 0 && (
        <span className="muted">
          on{' '}
          {read.routeIds.slice(0, 5).map((id, i) => {
            const route = index.routes.get(id)
            return (
              <span key={id}>
                {i > 0 && ', '}
                <a href={href({ name: 'page', routeId: id })}>
                  <code>{route?.path ?? id}</code>
                </a>
              </span>
            )
          })}
          {read.routeIds.length > 5 && ` +${read.routeIds.length - 5} more`}
        </span>
      )}
    </li>
  )
}
