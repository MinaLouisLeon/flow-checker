// Server/client leaks (M44): the wording every surface shares, the To check notes, the tree text
// and older models.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  type AppModel,
  AppModelSchema,
  buildIndex,
  buildSummary,
  formatModel,
  leakKind,
  leaksOfComponent,
  leaksOn,
  leakText,
  leakWhy,
  type ModuleLeak,
  type PropLeak,
} from '../src'

const snapshots = new URL('../../scanner/test/__snapshots__/', import.meta.url)
const load = (fixture: string): AppModel =>
  AppModelSchema.parse(JSON.parse(readFileSync(new URL(`${fixture}.model.json`, snapshots), 'utf8')))

const loc = { file: 'src/lib/db.ts', line: 1, column: 1 }
const moduleLeak = (over: Partial<ModuleLeak> = {}): ModuleLeak => ({
  kind: 'module',
  module: 'pg',
  category: 'database',
  file: 'src/lib/db.ts',
  loc,
  boundaries: ['c1'],
  chain: ['src/components/card.tsx', 'src/lib/stats.ts', 'src/lib/db.ts'],
  routeIds: ['r1'],
  ...over,
})
const propLeak = (over: Partial<PropLeak> = {}): PropLeak => ({
  kind: 'prop',
  value: 'function',
  prop: 'onSelect',
  name: 'Picker',
  componentId: 'c2',
  parentId: 'c3',
  loc: { file: 'src/app/page.tsx', line: 5, column: 7 },
  routeIds: ['r1'],
  ...over,
})
const names: Record<string, string> = { c1: 'Card', c2: 'Picker', c3: 'ProductsPage' }
const name = (id: string) => names[id] ?? '?'

describe('leak wording', () => {
  it('says what a module leak imports and how client code reaches it', () => {
    expect(leakText(moduleLeak(), name)).toBe(
      '`src/lib/db.ts` imports `pg` (a database client), and client code imports it: `src/components/card.tsx` → `src/lib/stats.ts` → `src/lib/db.ts`',
    )
    expect(
      leakText(
        moduleLeak({
          module: 'next/cache',
          category: 'next-server',
          names: ['revalidatePath'],
          file: 'src/components/refresh.tsx',
          chain: ['src/components/refresh.tsx'],
        }),
        name,
      ),
    ).toBe(
      'client code in `src/components/refresh.tsx` imports `revalidatePath` from `next/cache` (a Next.js server API)',
    )
  })

  it('says which server component hands what to which client component', () => {
    expect(leakText(propLeak(), name)).toBe(
      '`ProductsPage` hands `onSelect` (a function) to the client component `Picker`',
    )
    expect(
      leakText(
        propLeak({
          value: 'class-instance',
          type: 'Money',
          prop: 'total',
          componentId: undefined,
          module: 'ui-kit',
        }),
        name,
      ),
    ).toBe('`ProductsPage` hands `total` (a `Money` instance) to the client component `Picker` from `ui-kit`')
  })

  it('explains why each kind breaks the page', () => {
    expect(leakWhy(propLeak())).toContain('Only server actions and plain data cross')
    expect(leakWhy(propLeak({ value: 'class-instance' }))).toContain('Only plain objects')
    expect(leakWhy(moduleLeak({ category: 'server-only' }))).toContain('build fails')
    expect(leakWhy(moduleLeak())).toContain('database connection')
    expect(leakKind(moduleLeak())).toBe('database')
    expect(leakKind(propLeak())).toBe('function')
  })

  it('finds the leaks of a page and of a component', () => {
    const model = { leaks: [moduleLeak(), propLeak({ routeIds: ['r2'] })] } as unknown as AppModel
    expect(leaksOn(model, 'r1')).toHaveLength(1)
    expect(leaksOfComponent(model, 'c1')).toHaveLength(1)
    // A prop leak belongs to the server component that hands it and to the client one.
    expect(leaksOfComponent(model, 'c2')).toHaveLength(1)
    expect(leaksOfComponent(model, 'c3')).toHaveLength(1)
  })
})

describe('leaks in the fixture', () => {
  it('puts one note per leak under To check, first after type mismatches', () => {
    const index = buildIndex(load('leaks'))
    const notes = index.notes.filter((n) => n.kind === 'leak')
    expect(notes).toHaveLength(9)
    expect(notes.every((n) => n.routeId)).toBe(true)
    const check = buildSummary(index).sections.find((s) => s.id === 'check')
    expect(check?.items[0]?.label).toBe('Leak')
  })

  it('lists the leaks in the tree text, on each page and at the end', () => {
    const text = formatModel(load('leaks'))
    expect(text).toContain('leaks: 1\n  module fs in src/lib/disk.ts:2')
    expect(text).toContain('prop total: class-instance Money, from ReceiptPage to ReceiptTotal')
    expect(text).toContain('chain: src/components/file-badge.tsx > src/lib/format-size.ts > src/lib/disk.ts')
  })

  it('loads models written before M44 with no leaks', () => {
    const model = JSON.parse(readFileSync(new URL('client-boundaries.model.json', snapshots), 'utf8'))
    model.version = 16
    const parsed = AppModelSchema.parse(model)
    expect(parsed.leaks).toBeUndefined()
    expect(buildIndex(parsed).notes.filter((n) => n.kind === 'leak')).toEqual([])
  })
})
