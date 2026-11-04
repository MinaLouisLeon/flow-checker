// Server action safety (M46): each server action labeled with its auth check, its input check and what
// it changes. Checked with `next build` + `next start` (16.4.3): a `POST` with an action's id runs it from
// any page with any arguments, and an action no code imports is left out of the build.
import { type AppModel, AppModelSchema, formatModel, type ServerAction } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { scanProject } from '../src'

const lines = (...l: string[]) => `${l.join('\n')}\n`

const BASE: Record<string, string> = {
  'package.json': JSON.stringify({ dependencies: { next: '^16.0.0' } }),
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      jsx: 'preserve',
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
      lib: ['dom', 'dom.iterable', 'esnext'],
      paths: { '@/*': ['./src/*'] },
    },
  }),
  'node_modules/react/package.json': JSON.stringify({ name: 'react', types: 'index.d.ts' }),
  'node_modules/react/index.d.ts': lines(
    'export function useState<T>(v: T): [T, (v: T) => void]',
    'export function useTransition(): [boolean, (f: () => void) => void]',
    'export function useActionState<S, P>(f: (s: S, p: P) => Promise<S>, s: S): [S, (p: P) => void, boolean]',
  ),
  'node_modules/next/package.json': JSON.stringify({ name: 'next' }),
  'node_modules/next/navigation.d.ts': lines(
    'export function redirect(url: string): never',
    'export function notFound(): never',
    'export function forbidden(): never',
  ),
  'node_modules/next/cache.d.ts': lines('export function revalidatePath(path: string): void'),
  'node_modules/next/headers.d.ts': lines(
    'export interface Cookies { get(n: string): { value: string } | undefined; set(n: string, v: string): void }',
    'export function cookies(): Promise<Cookies>',
  ),
  'node_modules/zod/package.json': JSON.stringify({ name: 'zod', types: 'index.d.ts' }),
  'node_modules/zod/index.d.ts': lines(
    'export interface ZodType<T> { parse(v: unknown): T; safeParse(v: unknown): { success: boolean; data: T } }',
    'export const z: { string(): ZodType<string>; object<T>(s: T): ZodType<{ title: string }> }',
  ),
  'node_modules/valibot/package.json': JSON.stringify({ name: 'valibot', types: 'index.d.ts' }),
  'node_modules/valibot/index.d.ts': lines(
    'export function string(): unknown',
    'export function parse<T>(schema: unknown, v: T): T',
  ),
  'node_modules/axios/package.json': JSON.stringify({ name: 'axios', types: 'index.d.ts' }),
  'node_modules/axios/index.d.ts': lines(
    'declare const axios: { post(u: string, d?: unknown): Promise<unknown>; get(u: string): Promise<unknown>; delete(u: string): Promise<unknown> }',
    'export default axios',
  ),
  'node_modules/guard-kit/package.json': JSON.stringify({ name: 'guard-kit', types: 'index.d.ts' }),
  'node_modules/guard-kit/index.d.ts': lines(
    'export function requireAuth(): Promise<void>',
    'export const auth: { (): Promise<{ userId: string | null }>; protect(): Promise<void> }',
  ),
  'node_modules/safe-action/package.json': JSON.stringify({ name: 'safe-action', types: 'index.d.ts' }),
  'node_modules/safe-action/index.d.ts': lines(
    'export interface Client {',
    '  use(m: (a: { next: () => Promise<unknown> }) => Promise<unknown>): Client',
    '  schema(s: unknown): Client',
    '  action<R>(f: (a: { parsedInput: { id: string } }) => Promise<R>): (input: { id: string }) => Promise<R>',
    '}',
    'export function createClient(): Client',
  ),
  'node_modules/@types/node/package.json': JSON.stringify({ name: '@types/node', types: 'index.d.ts' }),
  'node_modules/@types/node/index.d.ts': lines(
    "declare module 'fs/promises' { export function writeFile(p: string, d: string): Promise<void>; export function readFile(p: string): Promise<string> }",
  ),
  'src/lib/db.ts': lines(
    'export const db = {',
    '  post: {',
    '    findMany: async () => [] as { id: string }[],',
    '    create: async (d: object) => d,',
    '    update: async (id: string, d: object) => ({ id, ...d }),',
    '    delete: async (id: string) => { void id },',
    '  },',
    '  query: async (sql: string, args?: unknown[]) => { void sql; void args },',
    '}',
    'export function sql(parts: TemplateStringsArray, ...v: unknown[]) { void parts; void v }',
  ),
  'src/lib/auth.ts': lines(
    "import { cookies } from 'next/headers'",
    "import { redirect } from 'next/navigation'",
    'export async function auth(): Promise<{ userId: string; role: string } | null> {',
    "  const token = (await cookies()).get('session')?.value",
    '  if (!token) return null',
    "  return { userId: token, role: 'member' }",
    '}',
    'export async function requireUser() {',
    '  const session = await auth()',
    "  if (!session) redirect('/login')",
    '  return session',
    '}',
    '/** Returns the session too, but never stops the caller. */',
    'export async function loadAccount() {',
    '  const s = await auth()',
    '  return s',
    '}',
    'export function withAuth<A extends unknown[], R>(fn: (...a: A) => Promise<R>) {',
    '  return async (...a: A) => {',
    "    if (!(await auth())) throw new Error('Unauthorized')",
    '    return fn(...a)',
    '  }',
    '}',
    'export function logged<A extends unknown[], R>(fn: (...a: A) => Promise<R>) {',
    '  return async (...a: A) => fn(...a)',
    '}',
  ),
  'src/app/layout.tsx': lines(
    'export default function Root({ children }: { children: unknown }) {',
    '  return <html><body>{children as never}</body></html>',
    '}',
  ),
}

function scan(files: Record<string, string>): AppModel {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries({ ...BASE, ...files })) fs.writeFileSync(`/p/${path}`, text)
  const model = scanProject({ root: '/p', fileSystem: fs })
  expect(() => AppModelSchema.parse(model)).not.toThrow()
  return model
}

/** A `'use server'` file with these lines, and a client page that calls every action named in `calls`. */
function actionsFile(calls: string[], ...body: string[]) {
  return {
    'src/actions/a.ts': lines("'use server'", ...body),
    'src/app/page.tsx': lines(
      "'use client'",
      `import { ${calls.join(', ')} } from '@/actions/a'`,
      'export default function Home() {',
      `  return <div>${calls.map((c) => `<button onClick={() => ${c}(${'"x" as never'})} />`).join('')}</div>`,
      '}',
    ),
  }
}

const byName = (model: AppModel, name: string): ServerAction => {
  const action = model.actions?.find((a) => a.name === name)
  if (!action) throw new Error(`no action ${name}: ${model.actions?.map((a) => a.name).join(', ')}`)
  return action
}

const label = (a: ServerAction) =>
  `${a.auth.status} / ${a.input.status}${a.flags?.length ? ' [unprotected]' : ''}`

describe('auth checks', () => {
  it('finds an exit under a session check, a helper that redirects, a wrapper and a guarded block', () => {
    const model = scan(
      actionsFile(
        ['inlineCheck', 'helperCheck', 'wrapped', 'guardedBlock', 'roleCheck', 'none'],
        "import { auth, requireUser, withAuth } from '@/lib/auth'",
        "import { db } from '@/lib/db'",
        'export async function inlineCheck() {',
        '  const session = await auth()',
        "  if (!session) throw new Error('no')",
        '  await db.post.findMany()',
        "  await db.post.create({ id: '1' })",
        '}',
        'export async function helperCheck() {',
        '  await requireUser()',
        "  await db.post.delete('1')",
        '}',
        "export const wrapped = withAuth(async () => { await db.post.delete('1') })",
        'export async function guardedBlock() {',
        '  const s = await auth()',
        "  if (s) { await db.post.delete('1') }",
        '}',
        'export async function roleCheck() {',
        '  const { role } = (await auth()) ?? {}',
        "  if (role !== 'admin') return",
        "  await db.post.delete('1')",
        '}',
        "export async function none() { await db.post.delete('1') }",
      ),
    )
    expect(byName(model, 'inlineCheck').auth.checks).toEqual([
      expect.objectContaining({ kind: 'condition', text: '!session' }),
    ])
    expect(byName(model, 'helperCheck').auth.checks).toEqual([
      expect.objectContaining({ kind: 'helper', text: 'requireUser()' }),
    ])
    expect(byName(model, 'wrapped')).toMatchObject({
      wrappedIn: { name: 'withAuth' },
      auth: { status: 'checked', checks: [expect.objectContaining({ kind: 'wrapper', text: 'withAuth' })] },
    })
    expect(byName(model, 'guardedBlock').auth.status).toBe('checked')
    expect(byName(model, 'roleCheck').auth.checks[0]).toMatchObject({ text: "role !== 'admin'" })
    expect(byName(model, 'none').auth.status).toBe('none')
  })

  it("doesn't count a check after the change, a helper that only returns the session, or a wrapper that checks nothing", () => {
    const model = scan(
      actionsFile(
        ['late', 'returnsOnly', 'readsOnly', 'loggedOnly'],
        "import { auth, loadAccount, logged } from '@/lib/auth'",
        "import { db } from '@/lib/db'",
        'export async function late() {',
        "  await db.post.delete('1')",
        '  const s = await auth()',
        "  if (!s) throw new Error('no')",
        '}',
        'export async function returnsOnly() {',
        // `auth()` returns null when signed out: calling it isn't a check.
        '  await auth()',
        '  await loadAccount()',
        "  await db.post.delete('1')",
        '}',
        // A helper that returns the session counts once the action checks what it returned.
        'export async function readsOnly() {',
        '  const account = await loadAccount()',
        '  if (!account) return',
        "  await db.post.delete('1')",
        '}',
        "export const loggedOnly = logged(async () => { await db.post.delete('1') })",
      ),
    )
    expect(byName(model, 'late').auth).toMatchObject({
      status: 'none',
      late: [expect.objectContaining({ text: '!s' })],
    })
    expect(byName(model, 'returnsOnly').auth.status).toBe('none')
    expect(byName(model, 'readsOnly').auth.checks[0]).toMatchObject({ kind: 'condition', text: '!account' })
    expect(byName(model, 'loggedOnly')).toMatchObject({
      wrappedIn: { name: 'logged' },
      auth: { status: 'none' },
    })
  })

  it('counts package guards and reads package wrappers as unclear unless a middleware checks', () => {
    const model = scan(
      actionsFile(
        ['guarded', 'protectedCall', 'viaClient', 'viaChecked'],
        "import { auth, requireAuth } from 'guard-kit'",
        "import { createClient } from 'safe-action'",
        "import { auth as session } from '@/lib/auth'",
        "import { db } from '@/lib/db'",
        "export async function guarded() { await requireAuth(); await db.post.delete('1') }",
        "export async function protectedCall() { await auth.protect(); await db.post.delete('1') }",
        'const client = createClient()',
        'const checked = createClient().use(async ({ next }) => {',
        "  if (!(await session())) throw new Error('no')",
        '  return next()',
        '})',
        'export const viaClient = client.schema({}).action(async ({ parsedInput }) => {',
        '  await db.post.delete(parsedInput.id)',
        '})',
        'export const viaChecked = checked.action(async ({ parsedInput }) => {',
        '  await db.post.delete(parsedInput.id)',
        '})',
      ),
    )
    expect(byName(model, 'guarded').auth.checks[0]).toMatchObject({ kind: 'package', text: 'requireAuth()' })
    expect(byName(model, 'protectedCall').auth.checks[0]).toMatchObject({
      kind: 'package',
      text: 'auth.protect()',
    })
    const viaClient = byName(model, 'viaClient')
    expect(viaClient.wrappedIn).toEqual({ name: 'action', module: 'safe-action' })
    expect(viaClient.auth.status).toBe('unclear')
    expect(viaClient.auth.reason).toContain('`safe-action`')
    // `.schema()` in the chain checks the input.
    expect(viaClient.input).toMatchObject({
      status: 'checked',
      params: [{ name: 'parsedInput', checked: true }],
    })
    expect(viaClient.flags).toBeUndefined()
    // `checked` doesn't have the input schema, so the input is unclear; the middleware checks auth.
    expect(byName(model, 'viaChecked').auth.status).toBe('checked')
    expect(byName(model, 'viaChecked').input.status).toBe('unclear')
  })

  it("is unclear when the action calls an import that doesn't resolve", () => {
    const model = scan(
      actionsFile(
        ['missing'],
        "import { check } from '@/lib/missing'",
        "import { db } from '@/lib/db'",
        "export async function missing() { await check(); await db.post.delete('1') }",
      ),
    )
    expect(byName(model, 'missing').auth).toMatchObject({ status: 'unclear' })
    expect(byName(model, 'missing').flags).toBeUndefined()
  })
})

describe('input checks', () => {
  it('finds schema parses, checks by hand, an error object and a helper', () => {
    const model = scan(
      actionsFile(
        ['zodParse', 'valibotParse', 'byHand', 'errors', 'helper', 'partial', 'unchecked', 'unusedPrev'],
        "import * as v from 'valibot'",
        "import { z } from 'zod'",
        "import { db } from '@/lib/db'",
        'const Post = z.object({})',
        'function parsePost(fd: FormData) {',
        "  const title = fd.get('title')",
        "  if (typeof title !== 'string') return null",
        '  return { title }',
        '}',
        'export async function zodParse(fd: FormData) {',
        '  const data = Post.parse(Object.fromEntries(fd))',
        '  await db.post.create(data)',
        '}',
        'export async function valibotParse(id: string, title: string) {',
        '  const input = v.parse(v.string(), { id, title })',
        '  await db.post.update(input.id, input)',
        '}',
        'export async function byHand(id: unknown) {',
        "  if (typeof id !== 'string' || id.length > 40) throw new Error('bad id')",
        '  await db.post.delete(id)',
        '}',
        'export async function errors(fd: FormData) {',
        "  const name = String(fd.get('name') ?? '').trim()",
        '  const problems: string[] = []',
        "  if (!name) problems.push('name')",
        '  if (problems.length > 0) return { problems }',
        '  await db.post.create({ name })',
        '}',
        'export async function helper(fd: FormData) {',
        '  const post = parsePost(fd)',
        '  await db.post.create(post ?? {})',
        '}',
        'export async function partial({ id, title }: { id: string; title: string }) {',
        "  if (!title) throw new Error('no title')",
        '  await db.post.update(id, { title })',
        '}',
        'export async function unchecked(id: string) { await db.post.delete(id) }',
        'export async function unusedPrev(_prev: unknown, fd: FormData) {',
        "  const id = fd.get('id')",
        "  if (typeof id !== 'string') return",
        '  await db.post.delete(id)',
        '}',
      ),
    )
    expect(byName(model, 'zodParse').input).toMatchObject({
      status: 'checked',
      checks: [{ kind: 'schema', library: 'zod', text: 'Post.parse', params: ['fd'] }],
    })
    expect(byName(model, 'valibotParse').input).toMatchObject({
      status: 'checked',
      params: [
        { name: 'id', checked: true },
        { name: 'title', checked: true },
      ],
      checks: [{ kind: 'schema', library: 'valibot', text: 'v.parse' }],
    })
    expect(byName(model, 'byHand').input.checks[0]).toMatchObject({ kind: 'manual', params: ['id'] })
    expect(byName(model, 'errors').input.checks[0]).toMatchObject({
      kind: 'manual',
      text: 'problems.length > 0',
      params: ['fd'],
    })
    expect(byName(model, 'helper').input.checks[0]).toMatchObject({ kind: 'helper', text: 'parsePost()' })
    expect(byName(model, 'partial').input).toMatchObject({
      status: 'partial',
      params: [
        { name: 'id', checked: false },
        { name: 'title', checked: true },
      ],
    })
    expect(label(byName(model, 'unchecked'))).toBe('none / none [unprotected]')
    // The previous state of `useActionState` isn't read, so only the form data counts.
    expect(byName(model, 'unusedPrev').input).toMatchObject({ status: 'checked', params: [{ name: 'fd' }] })
  })

  it("doesn't take a request's response for the input it was sent", () => {
    const model = scan(
      actionsFile(
        ['send'],
        'async function save(input: { name: string }) {',
        "  const res = await fetch('/api/x', { method: 'POST', body: JSON.stringify(input) })",
        "  if (!res.ok) throw new Error('failed')",
        '}',
        'export async function send(name: string) { await save({ name }) }',
      ),
    )
    expect(byName(model, 'send').input.status).toBe('none')
    expect(byName(model, 'send').changes).toEqual([
      expect.objectContaining({ kind: 'request', text: 'fetch POST', via: ['save'] }),
    ])
  })
})

describe('what an action changes', () => {
  it('finds database writes, requests that send, SQL, file writes and cache refreshes', () => {
    const model = scan(
      actionsFile(
        ['all', 'reads', 'cacheOnly', 'cookieOnly'],
        "import { writeFile, readFile } from 'fs/promises'",
        "import axios from 'axios'",
        "import { revalidatePath } from 'next/cache'",
        "import { cookies } from 'next/headers'",
        "import { db, sql } from '@/lib/db'",
        'export async function all() {',
        "  await db.post.delete('1')",
        "  await fetch('/a', { method: 'put' })",
        "  await axios.post('/b')",
        "  await db.query('UPDATE posts SET x = 1')",
        '  await sql`DELETE FROM posts`',
        "  await writeFile('a.txt', 'x')",
        "  revalidatePath('/')",
        '}',
        'export async function reads() {',
        "  const seen = new Map<string, number>(); seen.set('a', 1)",
        "  await fetch('/a'); await axios.get('/b'); await db.query('select 1'); await readFile('a.txt')",
        '  return db.post.findMany()',
        '}',
        "export async function cacheOnly() { revalidatePath('/') }",
        "export async function cookieOnly() { (await cookies()).set('theme', 'dark') }",
      ),
    )
    expect(byName(model, 'all').changes.map((c) => `${c.kind} ${c.text}`)).toEqual([
      'database db.post.delete',
      'request fetch PUT',
      'request axios.post',
      'database db.query',
      'database sql',
      'file writeFile',
      'cache revalidatePath',
    ])
    expect(byName(model, 'reads').changes).toEqual([])
    expect(byName(model, 'cacheOnly').changes.map((c) => c.kind)).toEqual(['cache'])
    expect(byName(model, 'cookieOnly').changes).toEqual([])
    // Only changing data is flagged; refreshing the cache or a cookie isn't.
    expect(byName(model, 'all').flags).toEqual([{ kind: 'unprotected', loc: byName(model, 'all').loc }])
    for (const name of ['reads', 'cacheOnly', 'cookieOnly']) expect(byName(model, name).flags).toBeUndefined()
  })

  it("doesn't count Next's cookies as data, also through their real types and a helper", () => {
    // Next types `cookies()` as an intersection of its two cookie classes (16.4), which has no symbol.
    const model = scan({
      'node_modules/next/headers.d.ts': lines(
        "import type { RequestCookies, ResponseCookies } from './dist/compiled/@edge-runtime/cookies'",
        "export type ReadonlyRequestCookies = Omit<RequestCookies, 'set' | 'clear' | 'delete'> & Pick<ResponseCookies, 'set' | 'delete'>",
        'export function cookies(): Promise<ReadonlyRequestCookies>',
      ),
      'node_modules/next/dist/compiled/@edge-runtime/cookies/index.d.ts': lines(
        'export declare class RequestCookies { get(n: string): { value: string } | undefined; set(n: string, v: string): this; delete(n: string): boolean; clear(): this }',
        'export declare class ResponseCookies { set(n: string, v: string): this; delete(n: string): this }',
      ),
      'src/lib/auth-cookies.ts': lines(
        "import { cookies } from 'next/headers'",
        'async function withStore(mutate: (store: Awaited<ReturnType<typeof cookies>>) => void) {',
        '  mutate(await cookies())',
        '}',
        "export async function clearSession() { return withStore((store) => store.delete('token')) }",
      ),
      ...actionsFile(
        ['logout', 'remember'],
        "import { cookies } from 'next/headers'",
        "import { clearSession } from '@/lib/auth-cookies'",
        'export async function logout() { await clearSession() }',
        "export async function remember() { const store = await cookies(); store.set('theme', 'dark') }",
      ),
    })
    expect(byName(model, 'logout').changes).toEqual([])
    expect(byName(model, 'remember').changes).toEqual([])
  })
})

describe('where actions are and who uses them', () => {
  it('finds inline actions, default and re-exported ones, and links callers and pages', () => {
    const model = scan({
      'src/actions/a.ts': lines(
        "'use server'",
        "import { db } from '@/lib/db'",
        'async function hidden(id: string) { await db.post.delete(id) }',
        'export default async function main(id: string) { await db.post.delete(id) }',
        'export { hidden }',
      ),
      'src/app/page.tsx': lines(
        "import { db } from '@/lib/db'",
        "import { Buttons } from './buttons'",
        'export default function Home() {',
        '  async function add(fd: FormData) {',
        "    'use server'",
        "    const t = fd.get('t')",
        "    if (typeof t !== 'string') return",
        '    await db.post.create({ t })',
        '  }',
        '  return <form action={add}><Buttons /></form>',
        '}',
      ),
      'src/app/buttons.tsx': lines(
        "'use client'",
        "import main, { hidden } from '@/actions/a'",
        'export function Buttons() {',
        "  return <><button onClick={() => main('1')} /><button onClick={() => hidden('1')} /></>",
        '}',
      ),
    })
    expect(model.actions?.map((a) => `${a.name} ${a.defined}`)).toEqual([
      'hidden file',
      'main file',
      'add inline',
    ])
    const add = byName(model, 'add')
    const home = model.components.find((c) => c.name === 'Home')
    expect(add.componentId).toBe(home?.id)
    for (const a of model.actions ?? []) {
      expect(a.siteIds).toHaveLength(1)
      expect(a.routeIds).toEqual([model.routes.find((r) => r.path === '/')?.id])
    }
  })

  it('calls of a wrapped action are request sites', () => {
    const model = scan(
      actionsFile(
        ['wrapped'],
        "import { withAuth } from '@/lib/auth'",
        'export const wrapped = withAuth(async () => {})',
      ),
    )
    const site = model.requests.find((s) => s.transport === 'server-action')
    expect(site?.serverAction?.name).toBe('wrapped')
    expect(byName(model, 'wrapped').siteIds).toEqual([site?.id])
  })

  it("doesn't flag an action no code uses (Next leaves it out), but does one only handed on as a prop", () => {
    const model = scan({
      'src/actions/a.ts': lines(
        "'use server'",
        "import { db } from '@/lib/db'",
        'export async function unused(id: string) { await db.post.delete(id) }',
        'export async function handedOn(id: string) { await db.post.delete(id) }',
      ),
      'src/app/page.tsx': lines(
        "import { handedOn } from '@/actions/a'",
        "import type { unused } from '@/actions/a'",
        "import { List } from './list'",
        'type Unused = typeof unused',
        'export default function Home() {',
        '  return <List onRemove={handedOn} />',
        '}',
        'export type { Unused }',
      ),
      'src/app/list.tsx': lines(
        "'use client'",
        'export function List({ onRemove }: { onRemove: (id: string) => Promise<void> }) {',
        "  return <button onClick={() => onRemove('1')} />",
        '}',
      ),
    })
    expect(byName(model, 'unused')).toMatchObject({ unused: true, siteIds: [], routeIds: [] })
    expect(byName(model, 'unused').flags).toBeUndefined()
    const handedOn = byName(model, 'handedOn')
    expect(handedOn.unused).toBeUndefined()
    expect(handedOn.routeIds).toHaveLength(1)
    expect(handedOn.flags).toHaveLength(1)
  })

  it('has no actions when the app has none, and prints them in the tree text', () => {
    expect(
      scan({ 'src/app/page.tsx': 'export default function Home() { return <p /> }\n' }).actions,
    ).toBeUndefined()
    const text = formatModel(
      scan(
        actionsFile(
          ['drop'],
          "import { db } from '@/lib/db'",
          'export async function drop(id: string) { await db.post.delete(id) }',
        ),
      ),
    )
    expect(text).toContain('actions: drop (no auth check, input not checked) [unprotected]')
    expect(text).toContain('# Server actions')
    expect(text).toContain('  database db.post.delete  src/actions/a.ts:3')
  })
})
