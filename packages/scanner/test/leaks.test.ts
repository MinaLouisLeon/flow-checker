// Server/client leaks (M44): server-only modules client code imports, and props a server component
// hands to a client component that can't cross. The rules follow `next dev` (16.4.3, React 19.3), one
// page per case: `server-only`, `next/headers`, `revalidatePath`, `fs`, `node:fs` and `child_process`
// fail in client code (also through a plain file), `path` and `crypto` don't, and a `'use server'`
// file or a type-only import doesn't pass its imports on; functions, class instances, `Symbol()`,
// `Object.create(null)`, `RegExp` and `WeakMap` can't cross, while `Date`, `Map`, `Set`, `URL`,
// `Error`, classes with `toJSON` or an iterator, server actions and client references can.
import {
  type AppModel,
  AppModelSchema,
  formatModel,
  type ModuleLeak,
  type PropLeak,
} from '@flow-checker/shared'
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
      allowJs: true,
      lib: ['dom', 'dom.iterable', 'esnext'],
      paths: { '@/*': ['./src/*'] },
    },
  }),
  'node_modules/react/package.json': JSON.stringify({ name: 'react', types: 'index.d.ts' }),
  'node_modules/react/index.d.ts': lines(
    'export function useState<T>(v: T): [T, (v: T) => void]',
    'export type ReactNode = string | number | boolean | null | undefined | ReactElement | Iterable<ReactNode>',
    'export interface ReactElement { type: unknown; props: unknown; key: string | null }',
    'export interface ForwardRefExoticComponent<P> { (props: P): ReactNode; displayName?: string }',
  ),
  'node_modules/next/package.json': JSON.stringify({ name: 'next' }),
  'node_modules/next/link.d.ts': lines(
    'export default function Link(p: { href: string; onClick?: () => void; children?: unknown }): unknown',
  ),
  'node_modules/next/headers.d.ts': lines('export function cookies(): Promise<unknown>'),
  'node_modules/next/cache.d.ts': lines(
    'export function revalidatePath(path: string): void',
    'export function unstable_noStore(): void',
  ),
  'node_modules/next/server.d.ts': lines(
    'export function after(f: () => void): void',
    'export class NextResponse {}',
  ),
  // A package whose code starts with `'use client'`, and one whose code doesn't.
  'node_modules/ui-kit/package.json': JSON.stringify({
    name: 'ui-kit',
    types: 'index.d.ts',
    main: 'index.js',
  }),
  'node_modules/ui-kit/index.d.ts': lines(
    'export function Dialog(p: { onClose?: () => void; children?: unknown }): unknown',
  ),
  'node_modules/ui-kit/index.js': lines('"use client";', 'export function Dialog() {}'),
  'node_modules/plain-ui/package.json': JSON.stringify({
    name: 'plain-ui',
    types: 'index.d.ts',
    main: 'index.js',
  }),
  'node_modules/plain-ui/index.d.ts': lines('export function Card(p: { onPick?: () => void }): unknown'),
  'node_modules/plain-ui/index.js': lines('export function Card() {}'),
  'node_modules/@types/node/package.json': JSON.stringify({ name: '@types/node', types: 'index.d.ts' }),
  'node_modules/@types/node/index.d.ts': lines(
    "declare module 'fs' { export function readFileSync(p: string): string }",
    "declare module 'node:fs' { export * from 'fs' }",
    "declare module 'fs/promises' { export function readFile(p: string): Promise<string> }",
    "declare module 'path' { export function join(...p: string[]): string }",
    "declare module 'node:path' { export * from 'path' }",
    "declare module 'crypto' { export function randomUUID(): string }",
    "declare module 'child_process' { export function exec(c: string): void }",
  ),
  'node_modules/pg/package.json': JSON.stringify({ name: 'pg', types: 'index.d.ts' }),
  'node_modules/pg/index.d.ts': lines('export class Pool { query(q: string): Promise<unknown> }'),
  'node_modules/drizzle-orm/package.json': JSON.stringify({ name: 'drizzle-orm' }),
  'node_modules/drizzle-orm/node-postgres.d.ts': lines('export function drizzle(p: unknown): unknown'),
  'node_modules/drizzle-orm/pg-core.d.ts': lines('export function pgTable(n: string, c: unknown): unknown'),
  'node_modules/bcrypt/package.json': JSON.stringify({ name: 'bcrypt', types: 'index.d.ts' }),
  'node_modules/bcrypt/index.d.ts': lines('export function hash(s: string): Promise<string>'),
  'node_modules/server-only/package.json': JSON.stringify({ name: 'server-only', types: 'index.d.ts' }),
  'node_modules/server-only/index.d.ts': lines('export {}'),
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

const modules = (model: AppModel) => (model.leaks ?? []).filter((l): l is ModuleLeak => l.kind === 'module')
const props = (model: AppModel) => (model.leaks ?? []).filter((l): l is PropLeak => l.kind === 'prop')
const moduleNames = (model: AppModel) => modules(model).map((l) => `${l.file} ${l.module} (${l.category})`)
const propNames = (model: AppModel) =>
  props(model).map((l) => `${l.name}.${l.prop}: ${l.value}${l.type ? ` ${l.type}` : ''}`)

/** A client component whose file starts with `lines`, rendered by the home page. */
const clientImporting = (...head: string[]) => ({
  'src/app/page.tsx': lines(
    "import { Widget } from '@/components/widget'",
    'export default function Home() {',
    '  return <Widget />',
    '}',
  ),
  'src/components/widget.tsx': lines(
    "'use client'",
    ...head,
    'export function Widget() {',
    '  return <p />',
    '}',
  ),
})

describe('server-only modules client code imports', () => {
  it('flags the server-only marker, Node modules with no browser version and Next server APIs', () => {
    const model = scan(
      clientImporting(
        "import 'server-only'",
        "import { readFileSync } from 'fs'",
        "import { exec } from 'child_process'",
        "import { cookies } from 'next/headers'",
        "import { revalidatePath, unstable_noStore } from 'next/cache'",
        "import { after, NextResponse } from 'next/server'",
        'void readFileSync, exec, cookies, revalidatePath, unstable_noStore, after, NextResponse',
      ),
    )
    expect(moduleNames(model)).toEqual([
      'src/components/widget.tsx server-only (server-only)',
      'src/components/widget.tsx fs (node)',
      'src/components/widget.tsx child_process (node)',
      'src/components/widget.tsx next/headers (next-server)',
      'src/components/widget.tsx next/cache (next-server)',
      'src/components/widget.tsx next/server (next-server)',
    ])
    const cache = modules(model).find((l) => l.module === 'next/cache')
    expect(cache?.names).toEqual(['revalidatePath'])
    expect(modules(model).find((l) => l.module === 'next/server')?.names).toEqual(['after'])
    expect(cache?.loc.line).toBe(6)
    expect(cache?.routeIds).toHaveLength(1)
  })

  it('leaves out Node modules Next has a browser version of, but not their `node:` neighbours without one', () => {
    const model = scan(
      clientImporting(
        "import { join } from 'path'",
        "import { join as j2 } from 'node:path'",
        "import { randomUUID } from 'crypto'",
        "import { readFileSync } from 'node:fs'",
        "import { readFile } from 'fs/promises'",
        'void join, j2, randomUUID, readFileSync, readFile',
      ),
    )
    expect(moduleNames(model)).toEqual([
      'src/components/widget.tsx node:fs (node)',
      'src/components/widget.tsx fs/promises (node)',
    ])
  })

  it('flags database clients and Node-only packages, not schema builders', () => {
    const model = scan(
      clientImporting(
        "import { Pool } from 'pg'",
        "import { drizzle } from 'drizzle-orm/node-postgres'",
        "import { pgTable } from 'drizzle-orm/pg-core'",
        "import { hash } from 'bcrypt'",
        'void Pool, drizzle, pgTable, hash',
      ),
    )
    expect(moduleNames(model)).toEqual([
      'src/components/widget.tsx pg (database)',
      'src/components/widget.tsx drizzle-orm/node-postgres (database)',
      'src/components/widget.tsx bcrypt (node-package)',
    ])
  })

  it('follows plain files the client code imports, with the chain from the boundary', () => {
    const model = scan({
      ...clientImporting("import { total } from '@/lib/cart'", 'void total'),
      'src/lib/cart.ts': lines("import { query } from './db'", 'export const total = () => query()'),
      'src/lib/db.ts': lines("import { Pool } from 'pg'", 'export const query = () => new Pool().query("x")'),
    })
    const [leak] = modules(model)
    expect(moduleNames(model)).toEqual(['src/lib/db.ts pg (database)'])
    expect(leak?.chain).toEqual(['src/components/widget.tsx', 'src/lib/cart.ts', 'src/lib/db.ts'])
    expect(leak?.boundaries).toHaveLength(1)
  })

  it("stops at a `'use server'` file and at type-only imports, and ignores server code", () => {
    const model = scan({
      'src/app/page.tsx': lines(
        "import { readFileSync } from 'fs'",
        "import { Widget } from '@/components/widget'",
        'export default function Home() {',
        '  readFileSync("x")',
        '  return <Widget />',
        '}',
      ),
      'src/components/widget.tsx': lines(
        "'use client'",
        "import { save } from '@/actions/save'",
        "import type { Row } from '@/lib/db'",
        "import { type Pool } from 'pg'",
        'export function Widget() {',
        '  const row: Row | undefined = undefined',
        '  void row',
        '  return <form action={save} />',
        '}',
        'export type P = Pool',
      ),
      'src/actions/save.ts': lines(
        "'use server'",
        "import { readFileSync } from 'fs'",
        "import { revalidatePath } from 'next/cache'",
        'export async function save() {',
        '  readFileSync("x")',
        '  revalidatePath("/")',
        '}',
      ),
      'src/lib/db.ts': lines("import 'server-only'", 'export interface Row { id: number }'),
    })
    expect(model.leaks).toBeUndefined()
    // The action file isn't brought to the browser either (M43's module list).
    expect(model.clientBoundaries?.[0]?.modules).toEqual(['src/components/widget.tsx'])
  })

  it('lists a file reached from two boundaries once, with both boundaries and their pages', () => {
    const model = scan({
      'src/app/page.tsx': lines(
        "import { A } from '@/components/a'",
        'export default function Home() {',
        '  return <A />',
        '}',
      ),
      'src/app/other/page.tsx': lines(
        "import { B } from '@/components/b'",
        'export default function Other() {',
        '  return <B />',
        '}',
      ),
      'src/components/a.tsx': lines(
        "'use client'",
        "import { secret } from '@/lib/secret'",
        'export function A() { return <p>{secret}</p> }',
      ),
      'src/components/b.tsx': lines(
        "'use client'",
        "import { secret } from '@/lib/secret'",
        'export function B() { return <p>{secret}</p> }',
      ),
      'src/lib/secret.ts': lines("import 'server-only'", "export const secret = 'x'"),
    })
    const [leak] = modules(model)
    expect(modules(model)).toHaveLength(1)
    expect(leak?.boundaries).toHaveLength(2)
    expect(leak?.routeIds).toHaveLength(2)
  })
})

/** A server page rendering `<Widget v={expr} />`, with `head` above it. */
function propPage(expr: string, ...head: string[]): Record<string, string> {
  return {
    'src/app/page.tsx': lines(
      "import { Widget, clientFn } from '@/components/widget'",
      "import { save } from '@/actions/save'",
      "import { Thing, Json, Bag } from '@/lib/thing'",
      ...head,
      'export default async function Home() {',
      '  void clientFn, save, Thing, Json, Bag',
      `  return <Widget v={${expr}} />`,
      '}',
    ),
    'src/components/widget.tsx': lines(
      "'use client'",
      'export function Widget({ v }: { v: unknown; children?: unknown }) { return <p>{String(v)}</p> }',
      'export function clientFn() { return 1 }',
    ),
    'src/actions/save.ts': lines("'use server'", 'export async function save(id?: number) { void id }'),
    'src/lib/thing.ts': lines(
      'export class Thing { constructor(public n: number) {} }',
      'export class Json { n = 1; toJSON() { return { n: this.n } } }',
      'export class Bag { *[Symbol.iterator]() { yield 1 } }',
    ),
  }
}

const propsOf = (expr: string, ...head: string[]) => propNames(scan(propPage(expr, ...head)))

describe('props that cannot cross to a client component', () => {
  it('flags functions, but not server actions, bound actions or client references', () => {
    expect(propsOf('() => 1')).toEqual(['Widget.v: function'])
    expect(propsOf('function () { return 1 }')).toEqual(['Widget.v: function'])
    expect(propsOf('handler', 'function handler() { return 1 }')).toEqual(['Widget.v: function'])
    expect(propsOf('save')).toEqual([])
    expect(propsOf('save.bind(null, 1)')).toEqual([])
    expect(propsOf("async () => { 'use server'; return 1 }")).toEqual([])
    expect(propsOf('clientFn')).toEqual([])
  })

  it('flags class instances and built-ins made with `new` that React does not send', () => {
    expect(propsOf('new Thing(1)')).toEqual(['Widget.v: class-instance Thing'])
    expect(propsOf('/a/')).toEqual(['Widget.v: class-instance RegExp'])
    expect(propsOf('new WeakMap()')).toEqual(['Widget.v: class-instance WeakMap'])
    expect(propsOf('new Json()')).toEqual([])
    expect(propsOf('new Bag()')).toEqual([])
  })

  it('lets through what React 19 sends: dates, maps, sets, URLs, errors, promises', () => {
    for (const expr of [
      'new Date()',
      'new Map([[1, 2]])',
      'new Set([1])',
      "new URL('http://a.b')",
      "new Error('x')",
      'Promise.resolve(1)',
      'new Uint8Array(2)',
      "Symbol.for('x')",
      "{ a: 1, b: [1, 'x'], c: { d: null } }",
      '<p />',
    ]) {
      expect(propsOf(expr), expr).toEqual([])
    }
  })

  it('looks inside objects, arrays, maps and promises', () => {
    expect(propsOf('{ a: { onSave: () => 1 } }')).toEqual(['Widget.v.a.onSave: function'])
    expect(propsOf('{ a: 1, f() { return 1 } }')).toEqual(['Widget.v.f: function'])
    expect(propsOf('[() => 1]')).toEqual(['Widget.v[]: function'])
    expect(propsOf('{ save }')).toEqual([])
    expect(propsOf('new Map([[1, new Thing(1)]])')).toEqual(['Widget.v[]: class-instance Thing'])
    expect(propsOf('Promise.resolve(new Thing(1))')).toEqual(['Widget.v[]: class-instance Thing'])
  })

  it('reads values by their type when they come from elsewhere', () => {
    expect(
      propsOf(
        'config',
        'interface Config { title: string; onSave: (id: number) => void }',
        'declare function getConfig(): Config',
        'const config = getConfig()',
      ),
    ).toEqual(['Widget.v.onSave: function'])
    expect(
      propsOf('t', 'declare function getT(): Promise<(key: string) => string>', 'const t = await getT()'),
    ).toEqual(['Widget.v: function'])
    expect(propsOf('x', 'declare const x: string | (() => void)')).toEqual(['Widget.v: function'])
    expect(propsOf('x', 'declare const x: { id: number; name: string }[]')).toEqual([])
  })

  it('flags local symbols and objects without a prototype', () => {
    expect(propsOf("Symbol('x')")).toEqual(['Widget.v: symbol'])
    expect(propsOf('Object.create(null)')).toEqual(['Widget.v: null-prototype'])
  })

  it('checks spread props, render functions as children and components handed as props', () => {
    const model = scan({
      ...propPage('1'),
      'src/app/page.tsx': lines(
        "import { Widget } from '@/components/widget'",
        'function Icon() { return <svg /> }',
        'export default function Home() {',
        '  const rest = { v: 1, onPick: () => 1 }',
        '  return (',
        '    <>',
        '      <Widget {...rest} />',
        '      <Widget v={Icon}>{(n: number) => n}</Widget>',
        '    </>',
        '  )',
        '}',
      ),
    })
    expect(propNames(model)).toEqual([
      'Widget.onPick: function',
      'Widget.v: function',
      'Widget.children: function',
    ])
    expect(props(model).map((l) => l.loc.line)).toEqual([7, 8, 8])
  })

  it("checks package client components (marked `'use client'`, or Next's) but not other ones", () => {
    const model = scan({
      'src/app/page.tsx': lines(
        "import Link from 'next/link'",
        "import { Dialog } from 'ui-kit'",
        "import { Card } from 'plain-ui'",
        'export default function Home() {',
        '  return (',
        '    <>',
        '      <Link href="/" onClick={() => {}}>home</Link>',
        '      <Dialog onClose={() => {}} />',
        '      <Card onPick={() => {}} />',
        '    </>',
        '  )',
        '}',
      ),
    })
    expect(propNames(model)).toEqual(['Link.onClick: function', 'Dialog.onClose: function'])
    expect(props(model).map((l) => l.module)).toEqual(['next/link', 'ui-kit'])
  })

  it('follows a prop a server wrapper hands on back to what its callers pass', () => {
    const app = (passed: string, shell: string) =>
      scan({
        ...propPage('1'),
        'src/app/page.tsx': lines(
          "import { save } from '@/actions/save'",
          "import { Shell } from '@/components/shell'",
          'export default function Home() {',
          `  return <Shell ${passed} />`,
          '}',
        ),
        'src/components/shell.tsx': lines("import { Widget } from './widget'", shell),
      })
    const destructured =
      'export function Shell({ onSave }: { onSave: () => void }) { return <Widget v={onSave} /> }'
    const viaProps =
      'export function Shell(props: { onSave: () => void }) { return <Widget v={props.onSave} /> }'
    // A server action handed on stays fine, through a destructured prop or `props.x`.
    expect(propNames(app('onSave={save}', destructured))).toEqual([])
    expect(propNames(app('onSave={save}', viaProps))).toEqual([])
    // A plain function handed on is flagged where it crosses.
    const flagged = app('onSave={() => 1}', destructured)
    expect(propNames(flagged)).toEqual(['Widget.v: function'])
    expect(props(flagged)[0]?.loc.file).toBe('src/components/shell.tsx')
    // A spread hides what is passed: the type decides.
    expect(propNames(app('{...{ onSave: save }}', destructured))).toEqual(['Widget.v: function'])
  })

  it('only checks where a server component renders a client one', () => {
    const model = scan({
      'src/app/page.tsx': lines(
        "import { Outer } from '@/components/outer'",
        "import { Inner } from '@/components/inner'",
        'export default function Home() {',
        '  return <Outer><Inner label="x" /></Outer>',
        '}',
      ),
      'src/components/outer.tsx': lines(
        "'use client'",
        "import { Inner } from './inner'",
        'export function Outer({ children }: { children?: unknown }) {',
        '  return <div><Inner label="y" onPick={() => 1} />{children as never}</div>',
        '}',
      ),
      'src/components/inner.tsx': lines(
        "'use client'",
        'export function Inner(p: { label: string; onPick?: () => void }) { return <p>{p.label}</p> }',
      ),
    })
    expect(model.leaks).toBeUndefined()
  })

  it('names the server component and the pages, and shows leaks in the tree text', () => {
    const model = scan({
      ...propPage('() => 1'),
      'src/app/other/page.tsx': lines(
        "import { Panel } from '@/components/panel'",
        'export default function Other() {',
        '  return <Panel />',
        '}',
      ),
      'src/components/panel.tsx': lines(
        "import { Widget } from './widget'",
        'export function Panel() {',
        '  return <Widget v={() => 2} />',
        '}',
      ),
    })
    const [home, panel] = props(model)
    expect(home?.routeIds).toHaveLength(1)
    expect(model.components.find((c) => c.id === panel?.parentId)?.name).toBe('Panel')
    expect(formatModel(model)).toContain('# Server/client leaks')
  })
})
