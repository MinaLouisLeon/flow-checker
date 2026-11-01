// M25: components chosen at runtime: `const Comp = asChild ? Slot : 'button'`, nested ternaries,
// `cond && A`, and lookups in a constant record (`ICONS[name]`).
import { type AppModel, AppModelSchema, type Component } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { beforeAll, describe, expect, it } from 'vitest'
import { scanProject } from '../src'

const lines = (...l: string[]) => `${l.join('\n')}\n`

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
  'node_modules/@radix-ui/react-slot/package.json': JSON.stringify({
    name: '@radix-ui/react-slot',
    types: 'index.d.ts',
  }),
  'node_modules/@radix-ui/react-slot/index.d.ts': lines(
    'export declare const Slot: (props: { children?: unknown }) => unknown',
  ),
  'node_modules/icons/package.json': JSON.stringify({ name: 'icons', types: 'index.d.ts' }),
  'node_modules/icons/index.d.ts': lines(
    'export declare const Star: () => unknown',
    'export declare const Heart: () => unknown',
  ),

  'src/ui/panels.tsx': lines(
    `export function InfoPanel() { return <p /> }`,
    `export const WarningPanel = () => <p />`,
    `export function ErrorPanel() { return <p /> }`,
    `export function Spinner() { return <i /> }`,
  ),
  // A record of project components, in JavaScript and re-exported under another name.
  'src/ui/registry.js': lines(
    `import { InfoPanel, WarningPanel } from './panels'`,
    `export const PANELS = { info: InfoPanel, warning: WarningPanel }`,
  ),
  'src/ui/index.ts': lines(`export { PANELS as PANEL_BY_LEVEL } from './registry'`),
  'src/ui/Button.tsx': lines(
    `import { Slot } from '@radix-ui/react-slot'`,
    `export function Button({ asChild }: { asChild?: boolean }) {`,
    `  const Comp = asChild ? Slot : 'button'`,
    `  return <Comp />`,
    `}`,
  ),

  'src/app/layout.tsx': lines(
    `export default function RootLayout({ children }: { children: unknown }) {`,
    `  return <html><body>{children as never}</body></html>`,
    `}`,
  ),
  'src/app/page.tsx': lines(
    `import { Star, Heart } from 'icons'`,
    `import { Button } from '@/ui/Button'`,
    `import { ErrorPanel, InfoPanel, Spinner, WarningPanel } from '@/ui/panels'`,
    `import { PANEL_BY_LEVEL } from '@/ui'`,
    `const ICONS = { star: Star, heart: Heart } as const`,
    `const LOCAL = { info: InfoPanel, error: ErrorPanel } satisfies Record<string, () => unknown>`,
    `export default function Home({ level, icon, busy }: { level: 'info' | 'warning' | 'error'; icon: 'star' | 'heart'; busy: boolean }) {`,
    `  const Nested = level === 'info' ? InfoPanel : level === 'warning' ? WarningPanel : ErrorPanel`,
    `  const Maybe = busy && Spinner`,
    `  const Icon = ICONS[icon]`,
    `  const Local = LOCAL[level === 'error' ? 'error' : 'info']`,
    `  const Imported = PANEL_BY_LEVEL[level as 'info']`,
    `  return (`,
    `    <div>`,
    `      <Button />`,
    `      <Nested />`,
    `      {Maybe ? <Maybe /> : null}`,
    `      <Icon />`,
    `      <Local />`,
    `      <Imported />`,
    `    </div>`,
    `  )`,
    `}`,
  ),
}

function memoryProject(files: Record<string, string>): InMemoryFileSystemHost {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries(files)) fs.writeFileSync(`/proj/${path}`, text)
  return fs
}

let model: AppModel
const component = (name: string): Component => {
  const found = model.components.find((c) => c.name === name)
  if (!found) throw new Error(`no component ${name}`)
  return found
}
const refs = (parent: string, tag: string) =>
  component(parent)
    .children.filter((c) => c.name === tag)
    .map((c) => ({
      resolution: c.resolution,
      target: c.componentId ? model.components.find((x) => x.id === c.componentId)?.name : c.module,
      conditional: !!c.conditional,
    }))

beforeAll(() => {
  model = scanProject({ root: '/proj', fileSystem: memoryProject(FILES) })
})

describe('components chosen at runtime', () => {
  it('validates against the model schema', () => {
    expect(() => AppModelSchema.parse(model)).not.toThrow()
  })

  it('reads a library component or an intrinsic as one external ref', () => {
    expect(refs('Button', 'Comp')).toEqual([
      { resolution: 'external', target: '@radix-ui/react-slot', conditional: false },
    ])
  })

  it('gives each branch of a nested ternary a conditional ref', () => {
    expect(refs('Home', 'Nested')).toEqual([
      { resolution: 'project', target: 'InfoPanel', conditional: true },
      { resolution: 'project', target: 'WarningPanel', conditional: true },
      { resolution: 'project', target: 'ErrorPanel', conditional: true },
    ])
  })

  it('reads `cond && A`', () => {
    expect(refs('Home', 'Maybe')).toEqual([{ resolution: 'project', target: 'Spinner', conditional: true }])
  })

  it('reads lookups in constant records', () => {
    expect(refs('Home', 'Icon')).toEqual([{ resolution: 'external', target: 'icons', conditional: false }])
    expect(refs('Home', 'Local')).toEqual([
      { resolution: 'project', target: 'InfoPanel', conditional: true },
      { resolution: 'project', target: 'ErrorPanel', conditional: true },
    ])
    expect(refs('Home', 'Imported')).toEqual([
      { resolution: 'project', target: 'InfoPanel', conditional: true },
      { resolution: 'project', target: 'WarningPanel', conditional: true },
    ])
  })

  it('leaves nothing unresolved', () => {
    expect(model.components.flatMap((c) => c.children).filter((r) => r.resolution === 'unresolved')).toEqual(
      [],
    )
  })
})
