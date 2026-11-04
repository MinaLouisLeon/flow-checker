// Client boundaries (M43): where each page's browser part starts, what each boundary brings, the
// client-only code it uses, and boundaries that could move lower. The rules follow `next build`
// (16.4.3) on the client-boundaries fixture: the client reference manifest lists the `'use client'`
// files server components render; a server module can't import client-only React APIs (`useState`,
// `useRef`, `useContext`, `createContext`, `useTransition`) but can call `use`, `useMemo`,
// `useCallback`, `useId`, `useDebugValue`; a server component can't hand a function to a client one.
import { type AppModel, AppModelSchema, formatModel, type Route } from '@flow-checker/shared'
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
      lib: ['dom', 'esnext'],
      paths: { '@/*': ['./src/*'] },
    },
  }),
  'node_modules/react/package.json': JSON.stringify({ name: 'react', types: 'index.d.ts' }),
  'node_modules/react/index.d.ts': lines(
    'export function useState<T>(v: T): [T, (v: T) => void]',
    'export function useEffect(f: () => void, deps?: unknown[]): void',
    'export function useMemo<T>(f: () => T, deps: unknown[]): T',
    'export function useRef<T>(v: T): { current: T }',
    'export function use<T>(p: Promise<T>): T',
    'export function createContext<T>(v: T): { Provider: unknown }',
    'export class Component<P = {}> { props: P }',
    'export type ReactNode = unknown',
  ),
  'node_modules/next/package.json': JSON.stringify({ name: 'next' }),
  'node_modules/next/link.d.ts': lines(
    'export default function Link(p: { href: string; children?: unknown }): unknown',
  ),
  'node_modules/next/navigation.d.ts': lines('export function usePathname(): string'),
  'node_modules/next-intl/package.json': JSON.stringify({ name: 'next-intl', types: 'index.d.ts' }),
  'node_modules/next-intl/index.d.ts': lines(
    'export function useTranslations(ns?: string): (key: string) => string',
  ),
  // A package whose code starts with `'use client'`, and one whose code doesn't.
  'node_modules/ui-kit/package.json': JSON.stringify({
    name: 'ui-kit',
    types: 'index.d.ts',
    main: 'index.js',
  }),
  'node_modules/ui-kit/index.d.ts': lines('export function Dialog(p: { children?: unknown }): unknown'),
  'node_modules/ui-kit/index.js': lines('"use client";', 'export function Dialog() {}'),
  'node_modules/plain-ui/package.json': JSON.stringify({
    name: 'plain-ui',
    types: 'index.d.ts',
    main: 'index.js',
  }),
  'node_modules/plain-ui/index.d.ts': lines('export function Card(p: { children?: unknown }): unknown'),
  'node_modules/plain-ui/index.js': lines('export function Card() {}'),
  'node_modules/zod/package.json': JSON.stringify({ name: 'zod', types: 'index.d.ts' }),
  'node_modules/zod/index.d.ts': lines('export const z: { string(): unknown }'),
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

function page(model: AppModel, path = '/'): Route {
  const route = model.routes.find((r) => r.kind === 'page' && r.path === path)
  if (!route) throw new Error(`no page ${path}`)
  return route
}

const nameOf = (model: AppModel) => (id: string) => model.components.find((c) => c.id === id)?.name ?? id

/** Each edge as `Child < Parent (in) via file [lazy]`. */
const edges = (model: AppModel, path = '/') =>
  (page(model, path).client?.boundaries ?? []).map((e) => {
    const name = nameOf(model)
    return `${name(e.componentId)} < ${e.parentId ? name(e.parentId) : '-'} (${e.in})${e.via ? ` via ${e.via}` : ''}${e.dynamic ? ' [lazy]' : ''}`
  })

const boundary = (model: AppModel, componentName: string) => {
  const id = model.components.find((c) => c.name === componentName)?.id
  const found = model.clientBoundaries?.find((b) => b.componentId === id)
  if (!found) throw new Error(`${componentName} is not a boundary`)
  return found
}

/** `into: A, B / server: X, Y`, or `-` when it can't move. */
const lower = (model: AppModel, componentName: string) => {
  const b = boundary(model, componentName)
  const name = nameOf(model)
  return b.lower
    ? `into: ${b.lower.into.map(name).join(', ')} / server: ${b.lower.server.map(name).join(', ')}`
    : '-'
}

const usesOf = (model: AppModel, componentName: string) =>
  (model.components.find((c) => c.name === componentName)?.clientUses ?? []).map((u) => `${u.kind} ${u.name}`)

const COUNTER = lines(
  "'use client'",
  "import { useState } from 'react'",
  'export function Counter() {',
  '  const [n, setN] = useState(0)',
  '  return <button onClick={() => setN(n + 1)}>{n}</button>',
  '}',
)
const PLAIN = (name: string, body = '<p>x</p>') =>
  lines(`export function ${name}() {`, `  return ${body}`, '}')
const homePage = (imports: string, jsx: string) =>
  lines(imports, 'export default function Home() {', `  return <main>${jsx}</main>`, '}')

describe('where client boundaries start', () => {
  it('finds a direct boundary, one through a barrel and a lazy one, but not client components below them', () => {
    const model = scan({
      'src/components/counter.tsx': COUNTER,
      'src/components/like.tsx': lines(
        "'use client'",
        "import { Counter } from './counter'",
        'export function Like() {',
        '  return <button onClick={() => {}}><Counter /></button>',
        '}',
      ),
      'src/components/index.ts': lines(
        "export { Like } from './like'",
        "export { Heading } from './heading'",
      ),
      'src/components/heading.tsx': PLAIN('Heading', '<h1>x</h1>'),
      'src/components/chart.tsx': lines(
        "'use client'",
        "import { useRef } from 'react'",
        'export default function Chart() {',
        '  const r = useRef(null)',
        '  return <canvas ref={r as never} />',
        '}',
      ),
      'src/app/page.tsx': homePage(
        [
          "import dynamic from 'next/dynamic'",
          "import { Counter } from '@/components/counter'",
          "import { Like, Heading } from '@/components'",
          "const Chart = dynamic(() => import('@/components/chart'))",
        ].join('\n'),
        '<Heading /><Counter /><Like /><Chart />',
      ),
      'node_modules/next/dynamic.d.ts': lines('export default function dynamic<T>(f: () => Promise<T>): any'),
    })
    expect(edges(model)).toEqual([
      'Counter < Home (page)',
      'Like < Home (page) via src/components/index.ts',
      'Chart < Home (page) [lazy]',
    ])
    // `Counter` is a boundary from the page and part of `Like`'s browser code.
    expect(boundary(model, 'Like').componentIds.map(nameOf(model))).toEqual(['Like', 'Counter'])
    expect(model.clientBoundaries?.map((b) => b.file)).toEqual([
      'src/components/chart.tsx',
      'src/components/counter.tsx',
      'src/components/like.tsx',
    ])
    expect(page(model).client).toMatchObject({ components: 3, modules: 3 })
  })

  it('starts at the page or the layout when the file itself is a client component', () => {
    const model = scan({
      'src/app/layout.tsx': lines(
        "'use client'",
        "import { usePathname } from 'next/navigation'",
        'export default function Root({ children }: { children: unknown }) {',
        '  const path = usePathname()',
        '  return <html><body data-path={path}>{children as never}</body></html>',
        '}',
      ),
      'src/app/settings/page.tsx': lines(
        "'use client'",
        "import { useState } from 'react'",
        'export default function Settings() {',
        '  const [on, setOn] = useState(false)',
        '  return <input type="checkbox" checked={on} onChange={() => setOn(!on)} />',
        '}',
      ),
    })
    expect(edges(model, '/settings')).toEqual(['Root < - (layout)', 'Settings < - (page)'])
    expect(usesOf(model, 'Settings')).toEqual(['hook useState', 'event onChange'])
  })

  it('counts a component rendered on both sides once on the page, and marks it shared', () => {
    const model = scan({
      'src/components/price.tsx': PLAIN('Price', '<span>$1</span>'),
      'src/components/cart.tsx': lines(
        "'use client'",
        "import { useState } from 'react'",
        "import { Price } from './price'",
        'export function Cart() {',
        '  const [n] = useState(1)',
        '  return <div>{n}<Price /></div>',
        '}',
      ),
      'src/app/page.tsx': homePage(
        "import { Cart } from '@/components/cart'\nimport { Price } from '@/components/price'",
        '<Price /><Cart />',
      ),
    })
    expect(edges(model)).toEqual(['Cart < Home (page)'])
    expect(model.components.find((c) => c.name === 'Price')?.kind).toBe('shared')
    expect(boundary(model, 'Cart').componentIds.map(nameOf(model))).toEqual(['Cart', 'Price'])
    expect(boundary(model, 'Cart').modules).toEqual(['src/components/cart.tsx', 'src/components/price.tsx'])
  })

  it('says a page with no client component renders all on the server', () => {
    const model = scan({ 'src/app/page.tsx': homePage('', '<p>hi</p>') })
    expect(page(model).client).toEqual({ boundaries: [], components: 0, modules: 0, bytes: 0, packages: [] })
    expect(model.clientBoundaries).toBeUndefined()
  })
})

describe('what a boundary brings to the browser', () => {
  it('follows value imports through every file, leaves out type-only ones and lists packages', () => {
    const model = scan({
      'src/lib/types.ts': 'export interface Item { id: string }\n',
      'src/lib/schema.ts': "import { z } from 'zod'\nexport const id = z.string()\n",
      'src/lib/format.ts':
        "import { id } from './schema'\nexport const fmt = (s: string) => String(id) + s\n",
      'src/lib/lazy.ts': 'export const later = 1\n',
      'src/components/list.tsx': lines(
        "'use client'",
        "import { useState, type ReactNode } from 'react'",
        "import type { Item } from '@/lib/types'",
        "import { type Item as Same } from '@/lib/types'",
        "import { fmt } from '@/lib/format'",
        "import Link from 'next/link'",
        'export function List({ items }: { items: Item[] }) {',
        '  const [x] = useState<Same | null>(null)',
        "  void import('@/lib/lazy')",
        '  return <ul>{items.map((i) => <li key={i.id}><Link href="/">{fmt(i.id)}</Link></li>)}{x as ReactNode}</ul>',
        '}',
      ),
      'src/app/page.tsx': homePage("import { List } from '@/components/list'", '<List items={[]} />'),
    })
    const b = boundary(model, 'List')
    expect(b.modules).toEqual([
      'src/components/list.tsx',
      'src/lib/format.ts',
      'src/lib/lazy.ts',
      'src/lib/schema.ts',
    ])
    // `react` and `next` ship with every app; `zod` comes with this boundary.
    expect(b.packages).toEqual(['zod'])
    expect(b.bytes).toBeGreaterThan(400)
    expect(page(model).client?.packages).toEqual(['zod'])
  })

  it('follows a hook into the project file that defines it', () => {
    const model = scan({
      'src/lib/use-likes.ts': lines(
        "import { useEffect, useState } from 'react'",
        'export function useLikes() {',
        '  const [n, setN] = useState(0)',
        '  useEffect(() => setN(Number(window.localStorage.getItem("n"))), [])',
        '  return n',
        '}',
      ),
      'src/components/like.tsx': lines(
        "'use client'",
        "import { useLikes } from '@/lib/use-likes'",
        'export function Like() {',
        '  return <span>{useLikes()}</span>',
        '}',
      ),
      'src/app/page.tsx': homePage("import { Like } from '@/components/like'", '<Like />'),
    })
    expect(usesOf(model, 'Like')).toEqual(['hook useLikes'])
    expect(boundary(model, 'Like').uses.map((u) => `${u.name} ${u.loc.file}`)).toEqual([
      'useLikes src/components/like.tsx',
      'useState src/lib/use-likes.ts',
      'useEffect src/lib/use-likes.ts',
    ])
  })

  it('survives import cycles', () => {
    const model = scan({
      'src/lib/a.ts': "import { b } from './b'\nexport const a = () => b\n",
      'src/lib/b.ts': "import { a } from './a'\nexport const b = () => a\n",
      'src/components/x.tsx': lines(
        "'use client'",
        "import { a } from '@/lib/a'",
        PLAIN('X', '<p>{String(a)}</p>'),
      ),
      'src/app/page.tsx': homePage("import { X } from '@/components/x'", '<X />'),
    })
    expect(boundary(model, 'X').modules).toEqual(['src/components/x.tsx', 'src/lib/a.ts', 'src/lib/b.ts'])
    expect(lower(model, 'X')).toBe('into:  / server: X')
  })
})

describe('client-only code', () => {
  const component = (body: string, imports = '') =>
    lines("'use client'", imports, 'export function X(props: { go: () => void }) {', body, '}')
  const usesFor = (body: string, imports = '', extra: Record<string, string> = {}) => {
    const model = scan({
      'src/components/x.tsx': component(body, imports),
      'src/app/page.tsx': homePage("import { X } from '@/components/x'", '<X go={undefined as never} />'),
      ...extra,
    })
    return usesOf(model, 'X')
  }

  it('finds hooks a server component can call and ones it can not', () => {
    expect(
      usesFor(
        lines('  const v = useMemo(() => 1, [])', '  const r = useRef(v)', '  return <p>{r.current}</p>'),
        "import { useMemo, useRef } from 'react'",
      ),
    ).toEqual(['hook useRef'])
    expect(usesFor('  return <p>{use(Promise.resolve(1))}</p>', "import { use } from 'react'")).toEqual([])
    expect(
      usesFor("  return <p>{useTranslations()('t')}</p>", "import { useTranslations } from 'next-intl'"),
    ).toEqual([])
    expect(
      usesFor('  return <p>{usePathname()}</p>', "import { usePathname } from 'next/navigation'"),
    ).toEqual(['hook usePathname'])
    expect(
      usesFor('  return <p>{String(React.useState(1)[0])}</p>', "import * as React from 'react'"),
    ).toEqual(['hook useState'])
  })

  it('reads project hooks: only ones that call a client hook count', () => {
    const extra = {
      'src/lib/hooks.ts': lines(
        "import { useMemo, useState } from 'react'",
        'export const useDouble = (n: number) => useMemo(() => n * 2, [n])',
        'export function useToggle() { return useState(false) }',
      ),
    }
    expect(
      usesFor(
        '  const d = useDouble(2)\n  const [on] = useToggle()\n  return <p>{d}{String(on)}</p>',
        "import { useDouble, useToggle } from '@/lib/hooks'",
        extra,
      ),
    ).toEqual(['hook useToggle'])
  })

  it('finds event handlers on HTML elements and functions handed to components, not server actions', () => {
    const extra = {
      'src/components/tabs.tsx': lines(
        "'use client'",
        'export function Tabs(p: { onPick?: () => void; action?: () => Promise<void>; label?: string; children?: unknown }) {',
        '  return <div>{p.label}</div>',
        '}',
      ),
      'src/app/actions.ts': lines("'use server'", 'export async function save() {}'),
    }
    const imports = "import { Tabs } from './tabs'\nimport { save } from '@/app/actions'"
    expect(usesFor('  return <button onClick={props.go}>x</button>', imports, extra)).toEqual([
      'event onClick',
    ])
    expect(usesFor('  return <button onClick="x">x</button>', imports, extra)).toEqual([])
    expect(usesFor('  return <Tabs onPick={() => {}} />', imports, extra)).toEqual(['function-prop onPick'])
    expect(usesFor('  return <Tabs onPick={props.go} />', imports, extra)).toEqual(['function-prop onPick'])
    expect(usesFor('  return <Tabs label="a" action={save} />', imports, extra)).toEqual([])
    expect(usesFor("  return <Tabs action={async () => { 'use server' }} />", imports, extra)).toEqual([])
    expect(usesFor('  return <Tabs>{(() => null) as never}</Tabs>', imports, extra)).toEqual([])
    expect(usesFor('  return <Tabs>{() => null}</Tabs>', imports, extra)).toEqual(['function-prop children'])
  })

  it('finds browser globals read while rendering, not `typeof window` or props with the same name', () => {
    const extra = {
      'src/components/map.tsx': lines(
        "'use client'",
        'export function MapView(p: { location: string }) { return <p>{p.location}</p> }',
      ),
    }
    const imports = "import { MapView } from './map'"
    expect(usesFor('  return <p>{window.innerWidth}</p>', imports, extra)).toEqual(['browser-api window'])
    expect(usesFor("  return <p>{typeof window === 'undefined' ? 'a' : 'b'}</p>", imports, extra)).toEqual([])
    expect(usesFor('  return <MapView location="x" />', imports, extra)).toEqual([])
    expect(usesFor('  const location = 1\n  return <p>{location}</p>', imports, extra)).toEqual([])
  })

  it('finds class components and contexts', () => {
    const model = scan({
      'src/components/x.tsx': lines(
        "'use client'",
        "import { Component, createContext } from 'react'",
        'export const Theme = createContext("light")',
        'export class Catch extends Component<{ children?: unknown }> {',
        '  render() { return <div>{this.props.children as never}</div> }',
        '}',
      ),
      'src/app/page.tsx': homePage("import { Catch } from '@/components/x'", '<Catch />'),
    })
    expect(boundary(model, 'Catch').uses.map((u) => `${u.kind} ${u.name}`)).toEqual([
      'context createContext',
      'class-component Catch',
    ])
    expect(lower(model, 'Catch')).toBe('-')
  })
})

describe('boundaries that could move lower', () => {
  const shell = (body: string, imports = '') =>
    lines(
      "'use client'",
      "import { Menu } from './menu'",
      "import { Heading } from './heading'",
      imports,
      'export function Shell({ children }: { children?: unknown }) {',
      body,
      '}',
    )
  const MENU = lines(
    "import { useState } from 'react'",
    'export function Menu() {',
    '  const [open, setOpen] = useState(false)',
    '  return <button onClick={() => setOpen(!open)}>menu</button>',
    '}',
  )
  const DEFAULT_BODY = '  return <section><Heading /><Menu />{children as never}</section>'
  const scanShell = (body = DEFAULT_BODY, imports = '', extra: Record<string, string> = {}) =>
    scan({
      'src/components/shell.tsx': shell(body, imports),
      'src/components/menu.tsx': MENU,
      'src/components/heading.tsx': PLAIN('Heading', '<h2>x</h2>'),
      'src/app/page.tsx': homePage("import { Shell } from '@/components/shell'", '<Shell><p>in</p></Shell>'),
      ...extra,
    })

  it('moves the directive down to the component that needs the browser', () => {
    const model = scanShell()
    expect(lower(model, 'Shell')).toBe('into: Menu / server: Shell, Heading')
  })

  it('says the directive can go when nothing below needs the browser', () => {
    const model = scanShell(DEFAULT_BODY, '', {
      'src/components/shell.tsx': lines(
        "'use client'",
        "import { Heading } from './heading'",
        'export function Shell({ children }: { children?: unknown }) {',
        '  return <section><Heading />{children as never}</section>',
        '}',
      ),
    })
    expect(lower(model, 'Shell')).toBe('into:  / server: Shell, Heading')
    // Still importing `./menu` (which calls `useState`) keeps it: Next checks the imports.
    expect(lower(scanShell('  return <section><Heading />{children as never}</section>'), 'Shell')).toBe('-')
  })

  it('keeps it where it is when the file itself needs the browser', () => {
    const cases: [string, string][] = [
      ['  const [x] = useState(1)\n  return <p>{x}</p>', "import { useState } from 'react'"],
      ['  return <button onClick={() => {}}><Menu /></button>', ''],
      ['  return <Menu2 onPick={() => {}} />', "import { Menu as Menu2 } from './menu'"],
      ['  return <p>{window.innerWidth}</p>', ''],
    ]
    for (const [body, imports] of cases) expect(lower(scanShell(body, imports), 'Shell'), body).toBe('-')
  })

  it("keeps it when the file imports one that uses client-only APIs, but not one that's `'use client'`", () => {
    const toggles = {
      'src/lib/toggle.ts':
        "import { useState } from 'react'\nexport const useToggle = () => useState(false)\nexport const n = 1\n",
      'src/lib/client-toggle.ts':
        "'use client'\nimport { useState } from 'react'\nexport const useToggle = () => useState(false)\nexport const n = 1\n",
      'src/lib/memo.ts':
        "import { useMemo } from 'react'\nexport const useOne = () => useMemo(() => 1, [])\nexport const n = 1\n",
    }
    const using = (module: string) =>
      lower(scanShell(`  return <p>{n}<Menu /></p>`, `import { n } from '${module}'`, toggles), 'Shell')
    expect(using('@/lib/toggle')).toBe('-')
    expect(using('@/lib/client-toggle')).toBe('into: Menu / server: Shell')
    expect(using('@/lib/memo')).toBe('into: Menu / server: Shell')
  })

  it("renders package components only when the package marks them `'use client'` (or is Next's)", () => {
    const withTag = (imports: string, tag: string) =>
      lower(scanShell(`  return <section>${tag}<Menu /></section>`, imports), 'Shell')
    expect(withTag("import { Dialog } from 'ui-kit'", '<Dialog />')).toBe('into: Menu / server: Shell')
    expect(withTag("import Link from 'next/link'", '<Link href="/">x</Link>')).toBe(
      'into: Menu / server: Shell',
    )
    // The scan can't tell whether `plain-ui` needs the browser, so the directive stays.
    expect(withTag("import { Card } from 'plain-ui'", '<Card />')).toBe('-')
  })

  it('moves it into a child below that renders an unmarked package component', () => {
    const model = scanShell(DEFAULT_BODY, '', {
      'src/components/heading.tsx': lines(
        "import { Card } from 'plain-ui'",
        'export function Heading() { return <Card /> }',
      ),
    })
    expect(lower(model, 'Shell')).toBe('into: Heading, Menu / server: Shell')
  })

  it('stops at a child with its own directive, which stays a boundary', () => {
    const model = scanShell(DEFAULT_BODY, '', { 'src/components/menu.tsx': `'use client'\n${MENU}` })
    expect(lower(model, 'Shell')).toBe('into: Menu / server: Shell, Heading')
  })

  it('shows the planted case in the tree text', () => {
    const text = formatModel(scanShell())
    expect(text).toContain('client: 1 boundary, 3 components, 3 modules')
    expect(text).toContain('could move lower: into Menu; on the server: Shell, Heading')
  })
})
