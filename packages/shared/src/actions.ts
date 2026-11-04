// Server action safety (M46): wording shared by the CLI text, the dashboard, the export and the notes.
import type {
  ActionAuth,
  ActionChange,
  ActionFlagKind,
  ActionInput,
  ActionInputCheck,
  AppModel,
  ServerAction,
} from './model'

/** Short labels for the auth status. */
export const ACTION_AUTH_LABELS: Record<ActionAuth['status'], string> = {
  checked: 'auth checked',
  none: 'no auth check',
  unclear: 'auth unclear',
}

/** Short labels for the input status. */
export const ACTION_INPUT_LABELS: Record<ActionInput['status'], string> = {
  checked: 'input checked',
  partial: 'input partly checked',
  none: 'input not checked',
  'no-input': 'no input',
  unclear: 'input unclear',
}

/** Short labels for what an action changes. */
export const ACTION_CHANGE_LABELS: Record<ActionChange['kind'], string> = {
  database: 'database',
  request: 'request',
  file: 'file',
  cache: 'cache',
}

export const ACTION_FLAG_LABELS: Record<ActionFlagKind, string> = {
  unprotected: 'open to anyone',
}

export function actionsOf(model: Pick<AppModel, 'actions'>): ServerAction[] {
  return model.actions ?? []
}

/** The actions a page's components call or hand on. */
export function actionsOn(model: Pick<AppModel, 'actions'>, routeId: string): ServerAction[] {
  return actionsOf(model).filter((a) => a.routeIds.includes(routeId))
}

/** Changes that count as changing data: everything but cache refreshes. */
export function dataChanges(action: Pick<ServerAction, 'changes'>): ActionChange[] {
  return action.changes.filter((c) => c.kind !== 'cache')
}

/** What it changes, in a few words: "the database and a request", "only the cache", "nothing". */
export function changesText(action: Pick<ServerAction, 'changes'>): string {
  const kinds = [...new Set(dataChanges(action).map((c) => c.kind))]
  if (kinds.length === 0) return action.changes.length > 0 ? 'only refreshes the cache' : 'changes nothing'
  const words: Record<ActionChange['kind'], string> = {
    database: 'the database',
    request: 'data through a request',
    file: 'files',
    cache: 'the cache',
  }
  return `changes ${joinAnd(kinds.map((k) => words[k]))}`
}

/** One change, as written, with the helpers it goes through: "`db.post.delete` through `removePost`". */
export function changeText(change: ActionChange): string {
  const via = change.via?.length ? ` through ${change.via.map((v) => `\`${v}\``).join(' → ')}` : ''
  return `\`${change.text}\`${via}`
}

/** The auth check in a sentence. */
export function authText(action: Pick<ServerAction, 'auth'>): string {
  const { auth } = action
  if (auth.status === 'unclear') return `Auth unclear: ${auth.reason ?? "it calls code the scan can't read"}.`
  if (auth.status === 'none') {
    const late = auth.late?.[0]
    return late
      ? `No auth check before it changes data (\`${late.text}\` only comes after).`
      : 'No auth check: it runs for anyone who sends the request.'
  }
  return `Auth checked by ${auth.checks.map(authCheckText).join(', ')}.`
}

function authCheckText(check: ActionAuth['checks'][number]): string {
  switch (check.kind) {
    case 'condition':
      return `\`${check.text}\``
    case 'helper':
      return `\`${check.text}\``
    case 'wrapper':
      return `its wrapper \`${check.text}\``
    case 'package':
      return `\`${check.text}\``
  }
}

/** The input check in a sentence. */
export function inputText(action: Pick<ServerAction, 'input'>): string {
  const { input } = action
  const names = (list: { name: string }[]) => list.map((p) => `\`${p.name}\``).join(', ')
  switch (input.status) {
    case 'no-input':
      return 'Takes no input.'
    case 'unclear':
      return `Input unclear: ${input.reason ?? "it is wrapped in code the scan can't read"}.`
    case 'none':
      return `Input not checked: ${names(input.params)} ${input.params.length === 1 ? 'is' : 'are'} used as sent.`
    case 'partial':
      return `Input partly checked: ${names(input.params.filter((p) => !p.checked))} ${
        input.params.filter((p) => !p.checked).length === 1 ? 'is' : 'are'
      } used as sent; ${inputChecksText(input.checks)}.`
    case 'checked':
      return `Input checked by ${inputChecksText(input.checks)}.`
  }
}

function inputChecksText(checks: ActionInputCheck[]): string {
  return checks
    .map((c) => {
      if (c.kind === 'schema') return `\`${c.text}\`${c.library ? ` (${c.library})` : ''}`
      if (c.kind === 'wrapper') return `its wrapper \`${c.text}\``
      return `\`${c.text}\``
    })
    .join(', ')
}

/** The flag in one sentence (without the pages). */
export function actionFlagText(action: ServerAction): string {
  const what = dataChanges(action)[0]
  const change = what ? ` (${changeText(what)})` : ''
  const input = action.input.status === 'no-input' ? '' : ' and uses its input as sent'
  return `Server action \`${action.name}\` changes data${change} with no auth check${input}: a server action is a public \`POST\` endpoint, so anyone can call it with any arguments`
}

/** Every flagged action. */
export function flaggedActions(model: Pick<AppModel, 'actions'>): ServerAction[] {
  return actionsOf(model).filter((a) => (a.flags?.length ?? 0) > 0)
}

/** The CLI's `scan --tree` section: each action with its labels and what it changes. */
export function formatActions(model: Pick<AppModel, 'actions' | 'routes'>): string[] {
  const actions = model.actions
  if (!actions?.length) return []
  const paths = new Map(model.routes.map((r) => [r.id, r.path]))
  const out = ['# Server actions']
  for (const a of actions) {
    const flags = (a.flags ?? []).map((f) => ` [${f.kind}]`).join('')
    const wrapped = a.wrappedIn ? ` wrapped in ${a.wrappedIn.name}` : ''
    out.push(
      '',
      `${a.name} (${a.defined}${wrapped}) ${a.loc.file}:${a.loc.line}${a.unused ? ' unused' : ''}${flags}`,
    )
    out.push(
      `  ${ACTION_AUTH_LABELS[a.auth.status]}${a.auth.checks.length ? `: ${a.auth.checks.map((c) => c.text).join(', ')}` : ''}`,
    )
    const params = a.input.params.map((p) => `${p.name}${p.checked ? '' : '?'}`).join(', ')
    out.push(
      `  ${ACTION_INPUT_LABELS[a.input.status]}${params ? ` (${params})` : ''}${a.input.checks.length ? `: ${a.input.checks.map((c) => c.text).join(', ')}` : ''}`,
    )
    for (const c of a.changes) {
      out.push(
        `  ${c.kind} ${c.text}${c.via?.length ? ` via ${c.via.join(' > ')}` : ''}  ${c.loc.file}:${c.loc.line}`,
      )
    }
    const pages = a.routeIds.map((id) => paths.get(id) ?? '?').join(', ')
    if (pages) out.push(`  pages: ${pages}`)
  }
  return out
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}
