// Server action safety (M46): each server action a page uses, with its auth check, input check and
// what it changes. A server action is a public POST endpoint, so the badges say what stops a stranger.
import {
  ACTION_AUTH_LABELS,
  ACTION_CHANGE_LABELS,
  ACTION_FLAG_LABELS,
  ACTION_INPUT_LABELS,
  actionFlagText,
  actionsOn,
  authText,
  changesText,
  changeText,
  inputText,
  type Route,
  type ServerAction,
} from '@flow-checker/shared'
import { useData } from './context'
import { useShowDetails } from './details'
import { href } from './router'
import { Badge, CappedList, CodeText, Section, SourceLink } from './ui'

/** Shown when the page's components call or hand on server actions. */
export function ActionsSection({ route }: { route: Route }) {
  const { index } = useData()
  const actions = actionsOn(index.model, route.id)
  if (actions.length === 0) return null
  const flagged = actions.filter((a) => (a.flags?.length ?? 0) > 0).length
  return (
    <Section
      title="Server actions"
      aside={
        <a className="muted" href={href({ name: 'actions' })}>
          {actions.length} used{flagged > 0 ? `, ${flagged} to check` : ''}
        </a>
      }
    >
      <CappedList
        className="list action-list"
        items={actions}
        render={(action) => <ActionRow key={action.id} action={action} />}
      />
    </Section>
  )
}

const AUTH_TONES = { checked: 'ok', none: 'warn', unclear: 'muted' } as const
const INPUT_TONES = {
  checked: 'ok',
  partial: 'warn',
  none: 'warn',
  'no-input': 'muted',
  unclear: 'muted',
} as const

/** One action: its name and place, the two labels, what it changes, and with details on, how. */
export function ActionRow({ action }: { action: ServerAction }) {
  const { index } = useData()
  const details = useShowDetails()
  const flags = action.flags ?? []
  // Only a missing check is worth a warning on actions that change data.
  const writes = action.changes.some((c) => c.kind !== 'cache')
  const authTone = writes || action.auth.status !== 'none' ? AUTH_TONES[action.auth.status] : 'muted'
  const inputTone = writes || action.input.status === 'checked' ? INPUT_TONES[action.input.status] : 'muted'
  const component = action.componentId ? index.components.get(action.componentId) : undefined
  return (
    <li data-action={action.name}>
      <div className="cache-row">
        <code>{action.name}</code>
        {flags.map((f) => (
          <Badge key={f.kind} tone="warn" term={['action', f.kind]}>
            {ACTION_FLAG_LABELS[f.kind]}
          </Badge>
        ))}
        <Badge tone={authTone} term={['action', `auth-${action.auth.status}`]}>
          {ACTION_AUTH_LABELS[action.auth.status]}
        </Badge>
        <Badge tone={inputTone} term={['action', `input-${action.input.status}`]}>
          {ACTION_INPUT_LABELS[action.input.status]}
        </Badge>
        {details && action.wrappedIn && (
          <Badge tone="muted" term={['action', 'wrapped']}>
            wrapped in {action.wrappedIn.name}
          </Badge>
        )}
        {action.unused && (
          <Badge tone="muted" term={['action', 'unused']}>
            unused
          </Badge>
        )}
        <span className="spacer" />
        <SourceLink file={action.loc.file} line={action.loc.line} column={action.loc.column} />
      </div>
      <div className="muted">
        {changesText(action)}
        {component && (
          <>
            {' · inline in '}
            <a href={href({ name: 'component', componentId: component.id })}>
              <code>{component.name}</code>
            </a>
          </>
        )}
      </div>
      {flags.length > 0 && (
        <div className="muted">
          <CodeText text={actionFlagText(action)} />
        </div>
      )}
      {details && (
        <ul className="action-details">
          <li>
            <CodeText text={authText(action)} />
          </li>
          <li>
            <CodeText text={inputText(action)} />
          </li>
          {action.changes.map((c) => (
            <li key={`${c.loc.file}:${c.loc.line}:${c.loc.column}:${c.text}`} className="action-change">
              <Badge tone="muted" term={['action', `change-${c.kind}`]}>
                {ACTION_CHANGE_LABELS[c.kind]}
              </Badge>
              <CodeText text={changeText(c)} />
              <SourceLink file={c.loc.file} line={c.loc.line} column={c.loc.column} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
