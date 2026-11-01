// M25: library types are kept by name instead of being expanded down to `Window`, plain values
// are read at any depth, and a library type's arguments don't make a type "partly resolved".
import { type AppModel, buildIndex, type TypeShape } from '@flow-checker/shared'
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
      lib: ['dom', 'esnext'],
      paths: { '@/*': ['./src/*'] },
    },
  }),
  // A form library's control object, and a carousel's API: both object aliases of their own.
  'node_modules/form-lib/package.json': JSON.stringify({ name: 'form-lib', types: 'index.d.ts' }),
  'node_modules/form-lib/index.d.ts': lines(
    'export type Control<T> = { _values: T; _window: Window; register(name: keyof T): void }',
    'export type Mapped<T> = { [K in keyof T]: T[K] }',
  ),
  'node_modules/carousel/package.json': JSON.stringify({ name: 'carousel', types: 'index.d.ts' }),
  'node_modules/carousel/index.d.ts': lines(
    'type Engine = { root: HTMLElement; container: HTMLElement }',
    'export type CarouselApi = { engine(): Engine; scrollTo(index: number): void } & { plugins: Record<string, unknown> }',
  ),

  'src/types.ts': lines(
    `import type { Control, Mapped } from 'form-lib'`,
    `import type { CarouselApi } from 'carousel'`,
    `export interface FormValues { name: string; email: string }`,
    `export interface Deep { a: { b: { c: { d: { e: { f: { h: string; on: boolean; n?: number; s: 'x' | 'y' } } } } } } }`,
    `export interface FieldProps {`,
    `  control: Control<FormValues>`,
    `  api?: CarouselApi`,
    `  picked: Mapped<{ id: string }>`,
    `  deep: Deep`,
    `}`,
  ),
  'src/ui/Field.tsx': lines(
    `import type { FieldProps } from '@/types'`,
    `export function Field(props: FieldProps) { return <input name={String(props.picked.id)} /> }`,
  ),
  'src/app/layout.tsx': lines(
    `export default function RootLayout({ children }: { children: unknown }) {`,
    `  return <html><body>{children as never}</body></html>`,
    `}`,
  ),
  'src/app/page.tsx': lines(
    `import { Field } from '@/ui/Field'`,
    `export default function Home() { return <Field {...({} as never)} /> }`,
  ),
}

function memoryProject(files: Record<string, string>): InMemoryFileSystemHost {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries(files)) fs.writeFileSync(`/proj/${path}`, text)
  return fs
}

let model: AppModel
const named = (name: string) => {
  const found = model.types.find((t) => t.name === name)
  if (!found) throw new Error(`no type ${name}`)
  return found
}
const prop = (shape: TypeShape, name: string): TypeShape | undefined =>
  shape.kind === 'object' ? shape.properties.find((p) => p.name === name)?.type : undefined
const count = (shape: TypeShape, test: (s: TypeShape) => boolean): number => {
  let n = test(shape) ? 1 : 0
  if (shape.kind === 'object') for (const p of shape.properties) n += count(p.type, test)
  if (shape.kind === 'union' || shape.kind === 'intersection')
    for (const t of shape.types) n += count(t, test)
  if (shape.kind === 'array') n += count(shape.element, test)
  if (shape.kind === 'external') for (const t of shape.typeArguments ?? []) n += count(t, test)
  return n
}

beforeAll(() => {
  model = scanProject({ root: '/proj', fileSystem: memoryProject(FILES) })
})

describe('library types', () => {
  it('keeps a package object alias by name below the top level', () => {
    const shape = named('FieldProps').shape
    expect(prop(shape, 'control')).toMatchObject({ kind: 'external', name: 'Control', module: 'form-lib' })
    expect(prop(shape, 'api')).toMatchObject({ kind: 'external', name: 'CarouselApi', module: 'carousel' })
    // No DOM types anywhere.
    expect(JSON.stringify(shape)).not.toContain('HTMLElement')
  })

  it('still expands aliases that map the app types', () => {
    expect(prop(named('FieldProps').shape, 'picked')).toMatchObject({
      kind: 'object',
      properties: [{ name: 'id', type: { kind: 'primitive', name: 'string' } }],
    })
  })

  it('reads plain values past the depth limit', () => {
    const unresolved = count(named('Deep').shape, (s) => s.kind === 'unresolved')
    expect(unresolved).toBe(0)
  })

  it('raises no "partly resolved" note for them', () => {
    const notes = buildIndex(model).notes.filter((n) => n.kind === 'unresolved-type')
    expect(notes).toEqual([])
  })
})
