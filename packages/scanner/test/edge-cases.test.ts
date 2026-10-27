// Patterns the fixture apps don't cover, scanned from an in-memory project.
import { type AppModel, AppModelSchema, type Component, formatModel } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { beforeAll, describe, expect, it } from 'vitest'
import { ScanError, scanProject } from '../src'

const FILES: Record<string, string> = {
  'package.json': JSON.stringify({ dependencies: { next: '^16.0.0' } }),
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      jsx: 'preserve',
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
      paths: { '@/*': ['./src/*'] },
    },
  }),

  // Barrel with a re-export chain and a namespace import.
  'src/ui/index.ts': `export * from './Button'\nexport { Shell } from './Shell'\n`,
  'src/ui/Button.tsx': `export function Button() { return <button /> }\n`,
  'src/ui/Shell.tsx': `export function Shell({ children }: { children: unknown }) { return <div>{children as never}</div> }\n`,

  'src/components/Lazy.tsx': `export default function LazyPanel() { return <p /> }\n`,
  'src/components/Named.tsx': `export function Named() { return <p /> }\n`,
  'src/components/wrapped.tsx': [
    `import { forwardRef, memo } from 'react'`,
    `export const Memoized = memo(function Memoized() { return <i /> })`,
    `export const Fwd = forwardRef<HTMLSpanElement>((_props, ref) => <span ref={ref} />)`,
    '',
  ].join('\n'),
  'src/components/Tree.tsx': [
    `export function Tree({ depth }: { depth: number }) {`,
    `  return <ul>{depth > 0 && <Tree depth={depth - 1} />}</ul>`,
    `}`,
    '',
  ].join('\n'),
  'src/components/Shared.tsx': `export function Shared() { return <hr /> }\n`,
  'src/components/ClientBox.tsx': [
    `'use client'`,
    `import { Shared } from './Shared'`,
    `import { Inner } from './Inner'`,
    `export function ClientBox() { return <section><Shared /><Inner /></section> }`,
    '',
  ].join('\n'),
  // No directive, but only rendered below a client boundary.
  'src/components/Inner.tsx': `export function Inner() { return <b /> }\n`,

  'src/app/layout.tsx': [
    `import { Shell } from '@/ui'`,
    `export default function RootLayout({ children }: { children: unknown }) {`,
    `  return <html><body><Shell>{children as never}</Shell></body></html>`,
    `}`,
    '',
  ].join('\n'),
  'src/app/page.tsx': [
    `import dynamic from 'next/dynamic'`,
    `import Image from 'next/image'`,
    `import { lazy } from 'react'`,
    `import * as UI from '@/ui'`,
    `import { Fwd, Memoized } from '@/components/wrapped'`,
    `import { Tree } from '@/components/Tree'`,
    `import { Shared } from '@/components/Shared'`,
    `import { ClientBox } from '@/components/ClientBox'`,
    `import { Missing } from './missing'`,
    `const LazyPanel = dynamic(() => import('@/components/Lazy'))`,
    `const NamedLazy = lazy(() => import('@/components/Named').then((m) => ({ default: m.Named })))`,
    `function Local() { return <em /> }`,
    `export default function Home({ flag }: { flag: boolean }) {`,
    `  return (`,
    `    <main>`,
    `      <UI.Button />`,
    `      {flag ? <Memoized /> : <Fwd />}`,
    `      {flag && <LazyPanel />}`,
    `      <NamedLazy />`,
    `      <Tree depth={2} />`,
    `      <Shared />`,
    `      <ClientBox />`,
    `      <Local />`,
    `      <Image src="/x.png" alt="" />`,
    `      <Missing />`,
    `      <Local />`,
    `    </main>`,
    `  )`,
    `}`,
    '',
  ].join('\n'),

  'src/app/_private/page.tsx': `export default function Hidden() { return null }\n`,
  'src/app/(shop)/shop/[...slug]/page.tsx': `export default function Shop() { return null }\n`,
  'src/app/docs/[[...path]]/page.tsx': `export default function Docs() { return null }\n`,
  'src/app/photo/[id]/page.tsx': `export default function Photo() { return null }\n`,
  'src/app/@modal/default.tsx': `export default function Default() { return null }\n`,
  'src/app/@modal/(.)photo/[id]/page.tsx': `export default function PhotoModal() { return null }\n`,
  'src/app/feed/page.tsx': `export default function Feed() { return null }\n`,
  'src/app/feed/(..)photo/[id]/page.tsx': `export default function FeedPhoto() { return null }\n`,
  'src/app/dashboard/layout.tsx': `export default function DashLayout({ children }: { children: unknown }) { return children }\n`,
  'src/app/dashboard/template.tsx': `export default function DashTemplate({ children }: { children: unknown }) { return children }\n`,
  'src/app/dashboard/page.tsx': `const Dash = () => null\nexport default Dash\n`,
  'src/app/memo/page.tsx': `import { memo } from 'react'\nexport default memo(function MemoPage() { return <div /> })\n`,
  'src/app/no-default/page.tsx': `export const nothing = 1\n`,
  'src/app/api/hello/route.ts': [
    `async function handler() { return new Response('hi') }`,
    `export { handler as GET }`,
    `export const POST = handler`,
    `export function helper() {}`,
    '',
  ].join('\n'),
}

function memoryProject(files: Record<string, string>): InMemoryFileSystemHost {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries(files)) fs.writeFileSync(`/proj/${path}`, text)
  return fs
}

let model: AppModel
const route = (path: string, slot?: string) => {
  const found = model.routes.find((r) => r.path === path && r.slot === slot && !r.intercepting)
  if (!found) throw new Error(`no route ${path}`)
  return found
}
const component = (name: string): Component => {
  const found = model.components.find((c) => c.name === name)
  if (!found) throw new Error(`no component ${name}`)
  return found
}
const childNames = (name: string) => component(name).children.map((c) => c.name)

beforeAll(() => {
  model = scanProject({ root: '/proj', fileSystem: memoryProject(FILES) })
})

describe('routes', () => {
  it('validates against the model schema', () => {
    expect(() => AppModelSchema.parse(model)).not.toThrow()
  })

  it('maps directories to URL paths', () => {
    expect(model.routes.map((r) => `${r.path} ${r.kind}`)).toEqual([
      '/ page',
      '/api/hello route-handler',
      '/dashboard page',
      '/docs/[[...path]] page',
      '/feed page',
      '/memo page',
      '/no-default page',
      '/photo/[id] page',
      '/photo/[id] page',
      '/photo/[id] page',
      '/shop/[...slug] page',
    ])
  })

  it('skips private folders', () => {
    expect(model.routes.some((r) => r.file.includes('_private'))).toBe(false)
  })

  it('records segment kinds', () => {
    expect(route('/shop/[...slug]').segments.map((s) => s.kind)).toEqual(['group', 'static', 'catch-all'])
    expect(route('/docs/[[...path]]').segments.at(-1)).toEqual({
      raw: '[[...path]]',
      kind: 'optional-catch-all',
      name: 'path',
    })
  })

  it('handles parallel slots and intercepting routes', () => {
    const intercepts = model.routes.filter((r) => r.intercepting)
    expect(intercepts.map((r) => ({ path: r.path, slot: r.slot, ...r.intercepting }))).toEqual([
      { path: '/photo/[id]', slot: 'modal', marker: '(.)', from: '/' },
      { path: '/photo/[id]', slot: undefined, marker: '(..)', from: '/feed' },
    ])
    expect(model.routeTree.children.find((c) => c.segment.raw === '@modal')?.files).toEqual({
      default: 'src/app/@modal/default.tsx',
    })
  })

  it('builds the layout chain outermost first, with templates', () => {
    expect(route('/dashboard').layoutChain.map((l) => `${l.kind} ${l.file}`)).toEqual([
      'layout src/app/layout.tsx',
      'layout src/app/dashboard/layout.tsx',
      'template src/app/dashboard/template.tsx',
    ])
  })

  it('lists exported HTTP methods of route handlers, including aliases', () => {
    expect(route('/api/hello')).toMatchObject({ methods: ['GET', 'POST'], layoutChain: [] })
  })

  it('resolves default exports through aliases and memo()', () => {
    expect(model.components.find((c) => c.id === route('/dashboard').componentId)?.name).toBe('Dash')
    expect(model.components.find((c) => c.id === route('/memo').componentId)?.name).toBe('MemoPage')
    expect(route('/no-default').componentId).toBeUndefined()
  })
})

describe('components', () => {
  it('follows barrels, namespace imports and path aliases', () => {
    expect(childNames('RootLayout')).toEqual(['Shell'])
    const button = component('Home').children.find((c) => c.name === 'UI.Button')
    expect(button).toMatchObject({
      resolution: 'project',
      module: '@/ui',
      componentId: component('Button').id,
    })
  })

  it('lists each distinct child once, in source order', () => {
    expect(childNames('Home')).toEqual([
      'UI.Button',
      'Memoized',
      'Fwd',
      'LazyPanel',
      'NamedLazy',
      'Tree',
      'Shared',
      'ClientBox',
      'Local',
      'Image',
      'Missing',
    ])
  })

  it('marks conditional and dynamic children', () => {
    const refs = new Map(component('Home').children.map((c) => [c.name, c]))
    expect(refs.get('Memoized')?.conditional).toBe(true)
    expect(refs.get('Fwd')?.conditional).toBe(true)
    expect(refs.get('LazyPanel')).toMatchObject({ conditional: true, dynamic: true, resolution: 'project' })
    expect(refs.get('NamedLazy')).toMatchObject({ dynamic: true, componentId: component('Named').id })
    expect(refs.get('Tree')?.conditional).toBeUndefined()
  })

  it('unwraps memo() and forwardRef()', () => {
    expect(component('Memoized').file).toBe('src/components/wrapped.tsx')
    expect(component('Fwd').file).toBe('src/components/wrapped.tsx')
  })

  it('separates external packages from unresolved imports', () => {
    const refs = new Map(component('Home').children.map((c) => [c.name, c]))
    expect(refs.get('Image')).toMatchObject({ resolution: 'external', module: 'next/image' })
    expect(refs.get('Missing')).toMatchObject({ resolution: 'unresolved', module: './missing' })
  })

  it('terminates on recursive components', () => {
    expect(component('Tree').children).toMatchObject([
      { name: 'Tree', componentId: component('Tree').id, conditional: true },
    ])
  })

  it('classifies server, client and shared components', () => {
    expect(component('Home').kind).toBe('server')
    expect(component('ClientBox')).toMatchObject({ kind: 'client', clientBoundary: true })
    expect(component('Inner')).toMatchObject({ kind: 'client', clientBoundary: false })
    expect(component('Shared').kind).toBe('shared')
  })

  it('gives every component a unique, stable id', () => {
    const ids = model.components.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    const again = scanProject({ root: '/proj', fileSystem: memoryProject(FILES) })
    expect(again.components.map((c) => c.id)).toEqual(ids)
  })

  it('matches the tree snapshot', async () => {
    await expect(formatModel(model)).toMatchFileSnapshot('__snapshots__/edge-cases.tree.txt')
  })
})

describe('discovery', () => {
  it('rejects projects without an App Router directory', () => {
    const fs = memoryProject({ 'package.json': '{}', 'pages/index.tsx': 'export default () => null' })
    expect(() => scanProject({ root: '/proj', fileSystem: fs })).toThrow(ScanError)
  })

  it('honours an explicit appDir and works without a tsconfig', () => {
    const fs = memoryProject({ 'web/app/page.jsx': 'export default function P() { return <div /> }' })
    const m = scanProject({ root: '/proj', appDir: 'web/app', fileSystem: fs })
    expect(m.project).toEqual({ appDir: 'web/app' })
    expect(m.routes.map((r) => r.path)).toEqual(['/'])
    expect(m.components.map((c) => c.name)).toEqual(['P'])
  })
})
