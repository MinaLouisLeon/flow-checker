// M25: what starts a request when the handler doesn't sit right in a JSX event prop: handlers
// passed through calls (form libraries, debounce, project wrappers), callbacks handed to hooks,
// `on*` entries in object configs, functions shared through a context, hooks that return several
// mutations, and local functions used as a query or mutation function.
import { type AppModel, AppModelSchema, type RequestSite } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { beforeAll, describe, expect, it } from 'vitest'
import { scanProject } from '../src'

const lines = (...l: string[]) => `${l.join('\n')}\n`

const lib = (name: string, ...dts: string[]) => ({
  [`node_modules/${name}/package.json`]: JSON.stringify({ name, types: 'index.d.ts' }),
  [`node_modules/${name}/index.d.ts`]: lines(...dts),
})

const FILES: Record<string, string> = {
  'package.json': JSON.stringify({ dependencies: { next: '^16.0.0' } }),
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      jsx: 'preserve',
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
      allowJs: true,
      lib: ['dom', 'esnext'],
      paths: { '@/*': ['./src/*'] },
    },
  }),
  ...lib(
    'react',
    'export function useCallback<T>(fn: T, deps: unknown[]): T',
    'export function useMemo<T>(fn: () => T, deps: unknown[]): T',
    'export function useEffect(fn: () => void, deps?: unknown[]): void',
    'export interface Context<T> { Provider: (props: { value: T; children?: unknown }) => unknown }',
    'export function createContext<T>(value: T): Context<T>',
    'export function useContext<T>(context: Context<T>): T',
  ),
  ...lib(
    '@tanstack/react-query',
    'export function useQuery<T = unknown>(...args: unknown[]): { data?: T }',
    'export function useMutation<T = unknown, V = void>(options: { mutationFn: (v: V) => Promise<T> }): {',
    '  mutate(v: V): void',
    '  mutateAsync(v: V): Promise<T>',
    '}',
  ),
  ...lib(
    'react-hook-form',
    'export interface UseForm<T> {',
    '  handleSubmit(onValid: (data: T) => unknown): (event?: unknown) => Promise<void>',
    '}',
    'export function useForm<T>(): UseForm<T>',
  ),
  ...lib(
    'formik',
    'export function useFormik<T>(options: { initialValues: T; onSubmit: (values: T) => unknown }): {',
    '  handleSubmit(event?: unknown): void',
    '}',
  ),
  ...lib('lodash', 'export function debounce<T>(fn: T, wait?: number): T'),

  // One endpoint per case, so each test finds its own site.
  'src/api/items.ts': lines(
    `export async function createItem(body: { name: string }) {`,
    `  return fetch('/api/items', { method: 'POST', body: JSON.stringify(body) })`,
    `}`,
    `export const updateItem = (body: { name: string }) =>`,
    `  fetch('/api/items/1', { method: 'PUT', body: JSON.stringify(body) })`,
    `export const searchItems = (q: string) => fetch(\`/api/search?q=\${q}\`)`,
    `export const verifyCode = (code: string) => fetch('/api/verify', { method: 'POST', body: code })`,
    `export function logout() {`,
    `  return fetch('/api/logout', { method: 'POST' })`,
    `}`,
    `export const remember = (data: unknown) => fetch('/api/remember', { method: 'POST', body: String(data) })`,
    `export const loadItems = () => fetch('/api/loaded')`,
  ),
  // Re-exported, one name aliased.
  'src/api/index.ts': lines(`export * from './items'`, `export { createItem as addItem } from './items'`),
  // A project wrapper written in JavaScript.
  'src/lib/guard.js': lines(
    `export function withGuard(fn) {`,
    `  return (...args) => (window.confirm('Sure?') ? fn(...args) : undefined)`,
    `}`,
  ),
  'src/hooks/useSubmit.ts': lines(
    `export function useSubmit<T>(options: { onSubmit: (value: T) => Promise<unknown> }) {`,
    `  const submit = async (value: T) => {`,
    `    await options.onSubmit(value)`,
    `  }`,
    `  return { submit }`,
    `}`,
  ),

  'src/app/layout.tsx': lines(
    `export default function RootLayout({ children }: { children: unknown }) {`,
    `  return <html><body>{children as never}</body></html>`,
    `}`,
  ),

  // react-hook-form: arrow and function declaration handlers, a variable holding the result,
  // an inline handler and an imported function passed straight in.
  'src/app/rhf/page.tsx': lines(
    `'use client'`,
    `import { useForm } from 'react-hook-form'`,
    `import { addItem, updateItem, verifyCode } from '@/api'`,
    `export default function RhfPage() {`,
    `  const form = useForm<{ name: string }>()`,
    `  const { handleSubmit } = useForm<{ name: string }>()`,
    `  const onSubmit = async (data: { name: string }) => {`,
    `    await addItem(data)`,
    `  }`,
    `  async function onEdit(data: { name: string }) {`,
    `    await updateItem(data)`,
    `  }`,
    `  const submitEdit = handleSubmit(onEdit)`,
    `  return (`,
    `    <div>`,
    `      <form onSubmit={form.handleSubmit(onSubmit)} />`,
    `      <form onSubmit={submitEdit} />`,
    `      <form`,
    `        onSubmit={handleSubmit(async (d) => {`,
    `          await fetch('/api/inline', { method: 'POST', body: JSON.stringify(d) })`,
    `        })}`,
    `      />`,
    `      <form onReset={handleSubmit(verifyCode as never)} />`,
    `    </div>`,
    `  )`,
    `}`,
  ),

  // Formik: the handler is an option of the hook; the hook's result goes to the form.
  'src/app/formik/page.tsx': lines(
    `'use client'`,
    `import { useFormik } from 'formik'`,
    `import { logout } from '@/api/items'`,
    `export default function FormikPage() {`,
    `  const formik = useFormik({ initialValues: { a: '' }, onSubmit: (v) => fetch('/api/formik', { method: 'POST', body: v.a }) })`,
    `  const second = useFormik({ initialValues: {}, onSubmit: logout })`,
    `  return (`,
    `    <div>`,
    `      <form onSubmit={formik.handleSubmit} />`,
    `      <form onSubmit={(e) => second.handleSubmit(e)} />`,
    `    </div>`,
    `  )`,
    `}`,
  ),

  // A library debounce held in a variable, and a project wrapper (.js) around a local handler.
  'src/app/search/page.tsx': lines(
    `'use client'`,
    `import { debounce } from 'lodash'`,
    `import { withGuard } from '@/lib/guard'`,
    `import { searchItems, remember } from '@/api'`,
    `export default function SearchPage() {`,
    `  const search = debounce((q: string) => searchItems(q), 300)`,
    `  function keep() {`,
    `    return remember(1)`,
    `  }`,
    `  return (`,
    `    <div>`,
    `      <input onChange={(e) => search(e.target.value)} />`,
    `      <button onClick={withGuard(keep)} />`,
    `    </div>`,
    `  )`,
    `}`,
  ),

  // A callback handed to a project hook, inline-declared and imported.
  'src/app/verify/page.tsx': lines(
    `'use client'`,
    `import { useSubmit } from '@/hooks/useSubmit'`,
    `import { verifyCode, logout } from '@/api'`,
    `export default function VerifyPage() {`,
    `  const verify = async (code: string) => {`,
    `    await verifyCode(code)`,
    `  }`,
    `  const { submit } = useSubmit({ onSubmit: verify })`,
    `  const out = useSubmit({ onSubmit: logout })`,
    `  return (`,
    `    <div>`,
    `      <button onClick={() => submit('1')} />`,
    `      <button onDoubleClick={() => out.submit(undefined)} />`,
    `    </div>`,
    `  )`,
    `}`,
  ),

  // `on*` entries in object configs: a menu definition handed to a component.
  'src/ui/Menu.tsx': lines(
    `export function Menu({ items }: { items: { label: string; onSelect: () => void }[] }) {`,
    `  return <ul>{items.map((i) => <li key={i.label} onClick={i.onSelect}>{i.label}</li>)}</ul>`,
    `}`,
  ),
  'src/app/menu/page.tsx': lines(
    `'use client'`,
    `import { Menu } from '@/ui/Menu'`,
    `import { logout } from '@/api'`,
    `export default function MenuPage() {`,
    `  function exportAll() {`,
    `    void fetch('/api/export', { method: 'POST' })`,
    `  }`,
    `  const items = [`,
    `    { label: 'Download', onSelect: () => fetch('/api/download') },`,
    `    { label: 'Export', onSelect: exportAll },`,
    `    { label: 'Log out', onSelect: logout },`,
    `  ]`,
    `  return <Menu items={items} />`,
    `}`,
  ),

  // A context provider hands a mutation to consumers.
  'src/context/items.tsx': lines(
    `'use client'`,
    `import { createContext, useContext, useMemo } from 'react'`,
    `import { useMutation } from '@tanstack/react-query'`,
    `const ItemsContext = createContext<{ remove: (id: string) => void } | null>(null)`,
    `export function ItemsProvider({ children }: { children?: unknown }) {`,
    `  const removal = useMutation({ mutationFn: (id: string) => fetch(\`/api/ctx/\${id}\`, { method: 'DELETE' }) })`,
    `  const value = useMemo(() => ({ remove: removal.mutate }), [removal.mutate])`,
    `  return <ItemsContext.Provider value={value}>{children as never}</ItemsContext.Provider>`,
    `}`,
    `export const useItems = () => useContext(ItemsContext)!`,
  ),
  'src/context/session.tsx': lines(
    `'use client'`,
    `import { createContext } from 'react'`,
    `import { useMutation } from '@tanstack/react-query'`,
    `export const SessionContext = createContext({ end: () => {} })`,
    `export function SessionProvider({ children }: { children?: unknown }) {`,
    `  const { mutate } = useMutation({ mutationFn: () => fetch('/api/session', { method: 'DELETE' }) })`,
    `  return <SessionContext.Provider value={{ end: () => mutate() }}>{children as never}</SessionContext.Provider>`,
    `}`,
  ),
  'src/components/ItemRow.tsx': lines(
    `'use client'`,
    `import { useContext } from 'react'`,
    `import { useItems } from '@/context/items'`,
    `import { SessionContext } from '@/context/session'`,
    `export function ItemRow() {`,
    `  const { remove } = useItems()`,
    `  const session = useContext(SessionContext)`,
    `  return (`,
    `    <div>`,
    `      <button onClick={() => remove('1')} />`,
    `      <button onKeyDown={session.end} />`,
    `    </div>`,
    `  )`,
    `}`,
  ),
  'src/app/context/page.tsx': lines(
    `import { ItemsProvider } from '@/context/items'`,
    `import { SessionProvider } from '@/context/session'`,
    `import { ItemRow } from '@/components/ItemRow'`,
    `export default function ContextPage() {`,
    `  return <SessionProvider><ItemsProvider><ItemRow /></ItemsProvider></SessionProvider>`,
    `}`,
  ),

  // A hook that returns several mutations; each caller uses some of them.
  'src/hooks/useItemMutations.ts': lines(
    `import { useMutation } from '@tanstack/react-query'`,
    `export function useItemMutations() {`,
    `  const add = useMutation({ mutationFn: () => fetch('/api/many', { method: 'POST' }) })`,
    `  const update = useMutation({ mutationFn: () => fetch('/api/many', { method: 'PUT' }) })`,
    `  const remove = useMutation({ mutationFn: () => fetch('/api/many', { method: 'DELETE' }) })`,
    `  return { add: add.mutate, update: update.mutate, remove: remove.mutate }`,
    `}`,
  ),
  'src/hooks/useAliased.js': lines(
    `import { useItemMutations } from './useItemMutations'`,
    `export const useAliased = () => useItemMutations()`,
  ),
  'src/app/many/page.tsx': lines(
    `'use client'`,
    `import { useItemMutations } from '@/hooks/useItemMutations'`,
    `import { useAliased } from '@/hooks/useAliased'`,
    `function Destructured() {`,
    `  const { remove } = useItemMutations()`,
    `  return <button onClick={() => remove()} />`,
    `}`,
    `const Member = () => {`,
    `  const m = useAliased()`,
    `  return <button onClick={() => m.add()} />`,
    `}`,
    `function PassedOn({ show }: { show: (m: unknown) => unknown }) {`,
    `  const all = useItemMutations()`,
    `  return <div>{show(all) as never}</div>`,
    `}`,
    `export default function ManyPage() {`,
    `  return <div><Destructured /><Member /><PassedOn show={String} /></div>`,
    `}`,
  ),

  // Local functions used as a query or mutation function: one site each, through the hook.
  'src/app/local/page.tsx': lines(
    `'use client'`,
    `import { useMutation, useQuery } from '@tanstack/react-query'`,
    `export default function LocalPage() {`,
    `  const upload = async (p: string) => {`,
    `    await fetch('/api/upload', { method: 'POST', body: p })`,
    `  }`,
    `  async function loadAll() {`,
    `    return fetch('/api/all')`,
    `  }`,
    `  const m = useMutation({ mutationFn: upload })`,
    `  useQuery({ queryKey: ['all'], queryFn: loadAll })`,
    `  return <button onClick={() => m.mutate('x')} />`,
    `}`,
  ),

  // Effects: an imported function passed to useEffect.
  'src/app/effect/page.tsx': lines(
    `'use client'`,
    `import { useEffect } from 'react'`,
    `import { loadItems } from '@/api'`,
    `export default function EffectPage() {`,
    `  useEffect(loadItems as () => void, [])`,
    `  return null`,
    `}`,
  ),
}

function memoryProject(files: Record<string, string>): InMemoryFileSystemHost {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries(files)) fs.writeFileSync(`/proj/${path}`, text)
  return fs
}

let model: AppModel
const sitesTo = (path: string, method?: string): RequestSite[] =>
  model.requests.filter((s) => s.url?.path === path && (!method || s.method === method))
const only = (path: string, method?: string): RequestSite => {
  const found = sitesTo(path, method)
  expect(found, `${method ?? ''} ${path}`).toHaveLength(1)
  return found[0] as RequestSite
}
const componentOf = (site: RequestSite) => model.components.find((c) => c.id === site.componentId)?.name

beforeAll(() => {
  model = scanProject({ root: '/proj', fileSystem: memoryProject(FILES) })
})

describe('triggers through call arguments', () => {
  it('validates against the model schema', () => {
    expect(() => AppModelSchema.parse(model)).not.toThrow()
  })

  it('follows react-hook-form handlers to the form', () => {
    expect(only('/api/items').trigger).toMatchObject({ kind: 'event', event: 'onSubmit' })
    // Through `const submitEdit = handleSubmit(onEdit)`.
    expect(only('/api/items/1').trigger).toMatchObject({ kind: 'event', event: 'onSubmit' })
    expect(only('/api/inline').trigger).toMatchObject({ kind: 'event', event: 'onSubmit' })
  })

  it('walks an imported function passed straight into a call', () => {
    const site = sitesTo('/api/verify').find((s) => componentOf(s) === 'RhfPage')
    expect(site?.trigger).toMatchObject({ kind: 'event', event: 'onReset' })
  })

  it('follows a Formik handler through the hook result', () => {
    expect(only('/api/formik').trigger).toMatchObject({ kind: 'event', event: 'onSubmit' })
    const imported = sitesTo('/api/logout').find((s) => componentOf(s) === 'FormikPage')
    expect(imported?.trigger).toMatchObject({ kind: 'event', event: 'onSubmit' })
  })

  it('follows a debounced function and a project wrapper', () => {
    expect(only('/api/search').trigger).toMatchObject({ kind: 'event', event: 'onChange' })
    expect(only('/api/remember').trigger).toMatchObject({ kind: 'event', event: 'onClick' })
  })

  it('places a callback handed to a project hook where the hook result is used', () => {
    const verify = sitesTo('/api/verify').find((s) => componentOf(s) === 'VerifyPage')
    expect(verify?.trigger).toMatchObject({ kind: 'event', event: 'onClick' })
    const out = sitesTo('/api/logout').find((s) => componentOf(s) === 'VerifyPage')
    expect(out?.trigger).toMatchObject({ kind: 'event', event: 'onDoubleClick' })
  })

  it('passes an effect its function by reference', () => {
    expect(only('/api/loaded').trigger.kind).toBe('effect')
  })
})

describe('on* entries in object configs', () => {
  it('treats them as events, not page loads', () => {
    expect(only('/api/download').trigger).toMatchObject({ kind: 'event', event: 'onSelect' })
    expect(only('/api/export').trigger).toMatchObject({ kind: 'event', event: 'onSelect' })
    const out = sitesTo('/api/logout').find((s) => componentOf(s) === 'MenuPage')
    expect(out?.trigger).toMatchObject({ kind: 'event', event: 'onSelect' })
  })
})

describe('context providers', () => {
  it('places a mutation shared through a context at its consumers', () => {
    const site = only('/api/ctx/:id')
    expect(site.trigger).toMatchObject({ kind: 'event', event: 'onClick' })
    expect(site.trigger.loc?.file).toBe('src/components/ItemRow.tsx')
  })

  it('reads an inline provider value and a direct useContext', () => {
    expect(only('/api/session').trigger).toMatchObject({ kind: 'event', event: 'onKeyDown' })
  })
})

describe('hooks that return several mutations', () => {
  const byComponent = (name: string) =>
    sitesTo('/api/many')
      .filter((s) => componentOf(s) === name)
      .map((s) => `${s.method} ${s.trigger.kind}`)
      .sort()

  it('gives each caller only the mutations it uses', () => {
    expect(byComponent('Destructured')).toEqual(['DELETE event'])
    // Through another hook (.js) that returns the first one's result.
    expect(byComponent('Member')).toEqual(['POST event'])
  })

  it('keeps every mutation when the result is passed on', () => {
    expect(byComponent('PassedOn')).toEqual(['DELETE unknown', 'POST unknown', 'PUT unknown'])
  })
})

describe('local query and mutation functions', () => {
  it('walks them once, through the hook', () => {
    const upload = only('/api/upload')
    expect(upload.hook?.name).toBe('useMutation')
    expect(upload.trigger).toMatchObject({ kind: 'event', event: 'onClick' })
    const all = only('/api/all')
    expect(all.hook?.name).toBe('useQuery')
    expect(all.trigger.kind).toBe('page-load')
  })
})
