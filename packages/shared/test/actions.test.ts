// Server action safety (M46): the wording every surface shares, the To check notes, the tree text and
// older models.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  type AppModel,
  AppModelSchema,
  actionFlagText,
  actionsOn,
  authText,
  buildIndex,
  buildSummary,
  changesText,
  changeText,
  formatModel,
  inputText,
  type ServerAction,
} from '../src'

const snapshots = new URL('../../scanner/test/__snapshots__/', import.meta.url)
const load = (fixture: string): AppModel =>
  AppModelSchema.parse(JSON.parse(readFileSync(new URL(`${fixture}.model.json`, snapshots), 'utf8')))

const loc = { file: 'src/actions/a.ts', line: 3, column: 23 }
const action = (over: Partial<ServerAction> = {}): ServerAction => ({
  id: 'sa_1',
  name: 'drop',
  loc,
  defined: 'file',
  siteIds: [],
  routeIds: ['r1'],
  auth: { status: 'none', checks: [] },
  input: { status: 'none', params: [{ name: 'id', checked: false }], checks: [] },
  changes: [{ kind: 'database', text: 'db.post.delete', loc }],
  ...over,
})

describe('server action wording', () => {
  it('says what an action changes', () => {
    expect(changesText(action())).toBe('changes the database')
    expect(
      changesText(
        action({
          changes: [
            { kind: 'request', text: 'fetch POST', loc },
            { kind: 'file', text: 'writeFile', loc },
            { kind: 'cache', text: 'revalidatePath', loc },
          ],
        }),
      ),
    ).toBe('changes data through a request and files')
    expect(changesText(action({ changes: [{ kind: 'cache', text: 'revalidatePath', loc }] }))).toBe(
      'only refreshes the cache',
    )
    expect(changesText(action({ changes: [] }))).toBe('changes nothing')
    expect(changeText({ kind: 'request', text: 'fetch DELETE', via: ['removeProduct'], loc })).toBe(
      '`fetch DELETE` through `removeProduct`',
    )
  })

  it('explains the auth check and the input check', () => {
    expect(authText(action())).toBe('No auth check: it runs for anyone who sends the request.')
    expect(
      authText(
        action({ auth: { status: 'none', checks: [], late: [{ kind: 'condition', text: '!s', loc }] } }),
      ),
    ).toBe('No auth check before it changes data (`!s` only comes after).')
    expect(
      authText(
        action({ auth: { status: 'checked', checks: [{ kind: 'wrapper', text: 'withAdmin', loc }] } }),
      ),
    ).toBe('Auth checked by its wrapper `withAdmin`.')
    expect(
      authText(action({ auth: { status: 'unclear', checks: [], reason: 'it is wrapped in `x`' } })),
    ).toBe('Auth unclear: it is wrapped in `x`.')
    expect(inputText(action())).toBe('Input not checked: `id` is used as sent.')
    expect(
      inputText(
        action({
          input: {
            status: 'partial',
            params: [
              { name: 'id', checked: false },
              { name: 'title', checked: true },
            ],
            checks: [{ kind: 'schema', library: 'zod', text: 'Title.parse', params: ['title'], loc }],
          },
        }),
      ),
    ).toBe('Input partly checked: `id` is used as sent; `Title.parse` (zod).')
    expect(inputText(action({ input: { status: 'no-input', params: [], checks: [] } }))).toBe(
      'Takes no input.',
    )
  })

  it('says in the flag that an action is a public POST endpoint', () => {
    expect(actionFlagText(action())).toBe(
      'Server action `drop` changes data (`db.post.delete`) with no auth check and uses its input as sent: a server action is a public `POST` endpoint, so anyone can call it with any arguments',
    )
    expect(actionFlagText(action({ input: { status: 'no-input', params: [], checks: [] } }))).not.toContain(
      'input',
    )
  })

  it('lists a page only the actions it uses', () => {
    const model = { actions: [action(), action({ id: 'sa_2', name: 'other', routeIds: ['r2'] })] }
    expect(actionsOn(model, 'r2').map((a) => a.name)).toEqual(['other'])
  })
})

describe('server actions in the fixture', () => {
  it('puts one note per open action under To check, right after leaks', () => {
    const index = buildIndex(load('action-safety'))
    const notes = index.notes.filter((n) => n.kind === 'action')
    expect(notes.map((n) => `${n.file}:${n.line}`)).toEqual([
      'src/actions/admin.ts:16',
      'src/actions/posts.ts:25',
      'src/app/page.tsx:20',
    ])
    expect(notes.every((n) => n.routeId)).toBe(true)
    // The inline action is linked to the component it is written in.
    expect(index.components.get(notes[2]?.componentId ?? '')?.name).toBe('HomePage')
    const check = buildSummary(index).sections.find((s) => s.id === 'check')
    expect(check?.items[0]?.label).toBe('Action')
  })

  it('lists the actions in the tree text, on each page and at the end', () => {
    const text = formatModel(load('action-safety'))
    expect(text).toContain(
      'actions: deletePost (no auth check, input not checked) [unprotected], renamePost (auth checked, input checked), likePost (no auth check, input checked)',
    )
    expect(text).toContain('# Server actions')
    expect(text).toContain('banUser (file wrapped in withAdmin) src/actions/admin.ts:9')
    expect(text).toContain('purgePosts (file) src/actions/posts.ts:52 unused')
    expect(text).toContain('  request fetch DELETE  src/app/page.tsx:22')
  })

  it('loads models written before M46 with no actions', () => {
    const model = JSON.parse(readFileSync(new URL('server-actions.model.json', snapshots), 'utf8'))
    model.version = 18
    delete model.actions
    const parsed = AppModelSchema.parse(model)
    expect(parsed.actions).toBeUndefined()
    expect(buildIndex(parsed).notes.filter((n) => n.kind === 'action')).toEqual([])
    expect(formatModel(parsed)).not.toContain('# Server actions')
  })
})
