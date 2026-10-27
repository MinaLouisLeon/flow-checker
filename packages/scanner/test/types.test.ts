// TypeShape resolution for patterns the fixture apps don't cover.
import { resolve } from 'node:path'
import { formatTypeShape, type TypeRef, TypeShapeSchema } from '@flow-checker/shared'
import { InMemoryFileSystemHost, Project, ts } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { TypeResolver } from '../src'

const TYPES = `
export interface User { id: number; name: string; manager?: User | null; tags: readonly string[] }
export type UserSummary = Pick<User, 'id' | 'name'>
export interface Team { lead: UserSummary; members: UserSummary[] }
export type Patch = Partial<Omit<User, 'id'>>
export type Scores = Record<string, number>
export enum Status { Active = 'active', Banned = 'banned' }
export const enum Level { Low = 1, High = 2 }
export interface Page<T> { items: T[]; total: number }
export type Pair = [id: number, label?: string, ...rest: boolean[]]
export type UserId = number & { readonly __brand: 'UserId' }
export interface Handlers { onSave(user: User, force?: boolean): Promise<void>; onClose: () => void }
export type Big = 10n
export type Mixed = string | number | boolean | null | undefined
export interface Tree { value: string; children: Tree[] }
export type Deep = { a: { b: { c: { d: { e: { f: { g: { h: string } } } } } } } }
export class Account { constructor(public id: number) {} readonly owner: string = '' }
export type When = Date
`

function setup(code: string) {
  const fs = new InMemoryFileSystemHost()
  const project = new Project({
    fileSystem: fs,
    compilerOptions: { strict: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts'] },
  })
  project.createSourceFile('/app/types.ts', TYPES)
  const file = project.createSourceFile('/app/probe.ts', `import type * as T from './types'\n${code}`)
  const resolver = new TypeResolver('/app')
  const probe = (name: string): TypeRef => resolver.fromNode(file.getVariableDeclarationOrThrow(name))
  // Named types are hoisted when first referenced, so resolve every probe up front.
  for (const decl of file.getVariableDeclarations()) probe(decl.getName())
  return { resolver, probe }
}

const fmt = (ref: TypeRef) => formatTypeShape(ref.shape)

describe('TypeResolver', () => {
  const { resolver, probe } = setup(
    [
      'declare const user: T.User',
      'declare const summary: T.UserSummary',
      'declare const team: T.Team',
      'declare const patch: T.Patch',
      'declare const scores: T.Scores',
      'declare const status: T.Status',
      'declare const level: T.Level',
      'declare const page: T.Page<T.User>',
      'declare const pair: T.Pair',
      'declare const id: T.UserId',
      'declare const handlers: T.Handlers',
      'declare const big: T.Big',
      'declare const mixed: T.Mixed',
      'declare const tree: T.Tree',
      'declare const deep: T.Deep',
      'declare const account: T.Account',
      'declare const when: T.When',
      'declare const inline: { a?: string; b: Array<number | null> }',
      'declare const fn: <X>(value: X) => X',
    ].join('\n'),
  )
  const named = (name: string) => {
    const t = resolver.types().find((n) => n.name === name)
    return t ? formatTypeShape(t.shape) : `(no named type ${name})`
  }

  it('hoists named types and references them', () => {
    expect(probe('user').shape).toMatchObject({ kind: 'ref', name: 'User' })
    expect(named('User')).toBe('{ id: number; name: string; manager?: User | null; tags: readonly string[] }')
  })

  it('keeps alias names that the checker reports as their utility type', () => {
    expect(fmt(probe('summary'))).toBe('UserSummary')
    expect(named('UserSummary')).toBe('{ id: number; name: string }')
    expect(named('Team')).toBe('{ lead: UserSummary; members: UserSummary[] }')
  })

  it('expands mapped utility types', () => {
    expect(named('Patch')).toBe('{ name?: string; manager?: User | null; tags?: readonly string[] }')
    expect(named('Scores')).toBe('{ [key: string]: number }')
  })

  it('resolves enums to literal unions', () => {
    expect(named('Status')).toBe('"active" | "banned"')
    expect(named('Level')).toBe('1 | 2')
  })

  it('names generic instantiations with their arguments', () => {
    expect(fmt(probe('page'))).toBe('Page<T.User>')
    expect(named('Page<T.User>')).toBe('{ items: User[]; total: number }')
  })

  it('handles tuples, brands, functions and bigint literals', () => {
    expect(named('Pair')).toBe('[id: number, label?: string, ...rest: boolean[]]')
    expect(named('UserId')).toBe('number & { readonly __brand: "UserId" }')
    expect(named('Handlers')).toBe(
      '{ onSave: (user: User, force?: boolean) => Promise<void>; onClose: () => void }',
    )
    expect(named('Big')).toBe('10n')
  })

  it('merges true | false back into boolean and lists null/undefined last', () => {
    expect(named('Mixed')).toBe('string | number | boolean | null | undefined')
  })

  it('terminates on recursive types', () => {
    expect(named('Tree')).toBe('{ value: string; children: Tree[] }')
  })

  it('stops expanding anonymous types at the depth limit', () => {
    expect(named('Deep')).toContain('/* not expanded: { h: string; } */')
  })

  it('handles classes and lib types', () => {
    expect(named('Account')).toBe('{ id: number; readonly owner: string }')
    expect(named('When')).toMatch(/^Date$/)
  })

  it('inlines anonymous types and drops undefined from optional properties', () => {
    expect(fmt(probe('inline'))).toBe('{ a?: string; b: (number | null)[] }')
  })

  it('keeps unbound type parameters', () => {
    expect(fmt(probe('fn'))).toBe('(value: X) => X')
  })

  it('produces schema-valid shapes with source locations', () => {
    for (const t of resolver.types()) {
      expect(() => TypeShapeSchema.parse(t.shape)).not.toThrow()
      expect(t.definedAt.file).toBe('types.ts')
    }
    expect(resolver.types().find((t) => t.name === 'User')?.definedAt).toEqual({
      file: 'types.ts',
      line: 2,
      column: 18,
    })
  })
})

describe('TypeResolver.fromZodSchema', () => {
  // Uses the bff fixture so the real zod 4 typings are loaded.
  const root = resolve(import.meta.dirname, '../../../fixtures/bff')
  const project = new Project({
    tsConfigFilePath: resolve(root, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  })
  const file = project.addSourceFileAtPath(resolve(root, 'src/lib/schemas.ts'))
  project.resolveSourceFileDependencies()
  const resolver = new TypeResolver(root.replaceAll('\\', '/'))
  const schema = (name: string) => file.getVariableDeclarationOrThrow(name).getNameNode()

  it('resolves the parsed (output) shape of a schema value', () => {
    const ref = resolver.fromZodSchema(schema('CreateProductSchema'))
    expect(ref?.text).toBe('z.output<typeof CreateProductSchema>')
    expect(ref && fmt(ref)).toBe('{ name: string; price: number; stock: number }')
  })

  it('resolves the accepted (input) shape, where defaults are optional', () => {
    const ref = resolver.fromZodSchema(schema('CreateProductSchema'), 'input')
    expect(ref && fmt(ref)).toBe('{ name: string; price: number; stock?: number }')
  })

  it('returns undefined for values that are not zod schemas', () => {
    const other = project.createSourceFile(resolve(root, 'src/probe.ts'), 'export const x = { _output: 1 }')
    expect(resolver.fromZodSchema(other.getVariableDeclarationOrThrow('x').getNameNode())).toBeUndefined()
  })
})
