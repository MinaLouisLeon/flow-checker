// Environment variables (M45): the wording every surface shares, the To check notes, the tree text and
// older models. Only names ever appear: the model holds no values.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  type AppModel,
  AppModelSchema,
  buildIndex,
  buildSummary,
  definedText,
  type EnvRead,
  type EnvVar,
  envFlagsOn,
  envFlagText,
  envOn,
  flagRouteIds,
  formatModel,
  isDefined,
  sidesOf,
  unknownText,
} from '../src'

const snapshots = new URL('../../scanner/test/__snapshots__/', import.meta.url)
const load = (fixture: string): AppModel =>
  AppModelSchema.parse(JSON.parse(readFileSync(new URL(`${fixture}.model.json`, snapshots), 'utf8')))

const read = (over: Partial<EnvRead> = {}): EnvRead => ({
  loc: { file: 'src/components/pay.tsx', line: 3, column: 9 },
  side: 'client',
  access: 'direct',
  routeIds: ['r1'],
  ...over,
})
const variable = (over: Partial<EnvVar> = {}): EnvVar => ({
  name: 'SECRET',
  definedIn: ['.env'],
  reads: [read()],
  ...over,
})

describe('env wording', () => {
  it('explains each flag in one sentence', () => {
    expect(envFlagText(variable(), 'private-in-client')).toBe(
      '`SECRET` has no `NEXT_PUBLIC_` prefix but is read in client code (`src/components/pay.tsx`), so it is undefined in the browser',
    )
    expect(
      envFlagText(
        variable({ reads: [read({ side: 'both', loc: { file: 'src/lib/config.ts', line: 1, column: 1 } })] }),
        'private-in-client',
      ),
    ).toBe(
      '`SECRET` has no `NEXT_PUBLIC_` prefix but is read in `src/lib/config.ts`, which server and client code both import, so it is undefined in the browser',
    )
    expect(envFlagText(variable({ name: 'NEXT_PUBLIC_X' }), 'not-inlined')).toBe(
      '`NEXT_PUBLIC_X` is destructured from `process.env` in client code; Next only inlines `process.env.NEXT_PUBLIC_X`, so it is undefined in the browser',
    )
    expect(envFlagText(variable({ definedIn: [] }), 'not-defined')).toBe(
      '`SECRET` is read without a fallback, but no `.env` file defines it',
    )
  })

  it('says where a value comes from', () => {
    expect(definedText(variable({ definedIn: ['.env', '.env.local'] }))).toBe('`.env`, `.env.local`')
    expect(definedText(variable({ definedIn: [], setBy: 'next' }))).toBe('set by Next')
    expect(definedText(variable({ definedIn: [], listedIn: ['.env.example'] }))).toBe(
      'only listed in `.env.example`',
    )
    expect(definedText(variable({ definedIn: [] }))).toBe('not defined')
    expect(isDefined(variable({ definedIn: [], listedIn: ['.env.example'] }))).toBe(false)
  })

  it('says why a name built at run time matters only in client code', () => {
    const at = { loc: read().loc, routeIds: [], key: 'name' }
    expect(unknownText({ ...at, side: 'server' })).toBe(
      "`process.env[name]` reads a name built at run time, so the scan can't tell which variable it is",
    )
    expect(unknownText({ ...at, side: 'client' })).toContain('undefined in the browser')
  })

  it('shows a page only its own reads and the flags they cause', () => {
    const v = variable({
      definedIn: [],
      reads: [read({ routeIds: ['r1'] }), read({ side: 'server', routeIds: ['r2'], optional: true })],
      flags: [
        { kind: 'private-in-client', loc: read().loc },
        { kind: 'not-defined', loc: read().loc },
      ],
    })
    const model = { env: { files: [], vars: [v], unknown: [] } }
    expect(envOn(model, 'r2')[0]?.reads).toHaveLength(1)
    expect(envFlagsOn(v, 'r1').map((f) => f.kind)).toEqual(['private-in-client', 'not-defined'])
    // The server read on r2 has a fallback: neither flag is about it.
    expect(envFlagsOn(v, 'r2')).toEqual([])
    expect(flagRouteIds(v, 'not-defined')).toEqual(['r1'])
    expect(sidesOf(v)).toEqual(['server', 'client'])
  })
})

describe('env in the fixture', () => {
  it('puts one note per flag under To check, right after leaks', () => {
    const index = buildIndex(load('env'))
    const notes = index.notes.filter((n) => n.kind === 'env')
    expect(notes.map((n) => `${n.file}:${n.line}`)).toEqual([
      'src/lib/config.ts:2',
      'src/lib/db.ts:2',
      'src/components/site-name.tsx:5',
      'src/components/checkout-button.tsx:6',
    ])
    expect(notes.every((n) => n.routeId)).toBe(true)
    // The shared module is read on `/` and `/products`, but only `/products` reads it in client code.
    const path = (id: string | undefined) => index.routes.get(id ?? '')?.path
    expect(path(notes[0]?.routeId)).toBe('/products')
    expect(notes[0]?.message).not.toContain('pages)')
    const check = buildSummary(index).sections.find((s) => s.id === 'check')
    expect(check?.items[0]?.label).toBe('Env')
  })

  it('lists the names in the tree text, on each page and at the end, with no values', () => {
    const text = formatModel(load('env'))
    expect(text).toContain('env: NEXT_PUBLIC_ANALYTICS_ID, STRIPE_SECRET_KEY [private-in-client]')
    expect(text).toContain('# Environment variables')
    expect(text).toContain(
      'files: .env (9), .env.development (1), .env.production (1), .env.example (1, not loaded)',
    )
    expect(text).toContain('SENTRY_DSN: only listed in .env.example')
    expect(text).toContain('  client destructured  src/components/site-name.tsx:5  /about')
    expect(text).not.toContain('fixture-value-')
  })

  it('loads models written before M45 with no env', () => {
    const model = JSON.parse(readFileSync(new URL('leaks.model.json', snapshots), 'utf8'))
    model.version = 17
    delete model.env
    const parsed = AppModelSchema.parse(model)
    expect(parsed.env).toBeUndefined()
    expect(buildIndex(parsed).notes.filter((n) => n.kind === 'env')).toEqual([])
    expect(formatModel(parsed)).not.toContain('# Environment variables')
  })
})
