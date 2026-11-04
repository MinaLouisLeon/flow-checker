// Server action safety (M46): every server action, the ones open to anyone first.
import { actionsOf, flaggedActions } from '@flow-checker/shared'
import { ActionRow } from '../ActionsView'
import { useData } from '../context'
import { href } from '../router'
import { CappedList, Empty, Section } from '../ui'

export function ActionsScreen() {
  const { index } = useData()
  const actions = actionsOf(index.model)
  const flagged = flaggedActions(index.model)
  const others = actions.filter((a) => !a.flags?.length)
  const unchecked = actions.filter((a) => a.auth.status !== 'checked' && !a.unused).length

  return (
    <div className="screen screen-narrow">
      <h1>Server actions</h1>
      <p className="muted">
        Every server action, with the auth check and the input check that run before it changes data. A server
        action is a public <code>POST</code> endpoint: once a page uses it, anyone can call it with any
        arguments, not only your forms. TypeScript types aren't checked when it runs.
      </p>
      {actions.length === 0 ? (
        <Empty>The scan found no server actions.</Empty>
      ) : (
        <>
          <p>
            {actions.length} action{actions.length === 1 ? '' : 's'} · {unchecked} without an auth check
            {flagged.length > 0 && <span className="warn"> · {flagged.length} open to anyone</span>}
          </p>
          {flagged.length > 0 && (
            <Section title="To check">
              <ul className="list action-list" data-section="to-check">
                {flagged.map((a) => (
                  <ActionRow key={a.id} action={a} />
                ))}
              </ul>
            </Section>
          )}
          <Section title={flagged.length > 0 ? 'Other actions' : 'Actions'}>
            {others.length === 0 ? (
              <Empty>Every action is listed above.</Empty>
            ) : (
              <CappedList
                className="list action-list"
                items={others}
                render={(a) => <ActionRow key={a.id} action={a} />}
              />
            )}
          </Section>
          <p className="muted">
            What each label means:{' '}
            <a href={href({ name: 'glossary', q: '', term: 'action-public' })}>glossary</a>.
          </p>
        </>
      )}
    </div>
  )
}
