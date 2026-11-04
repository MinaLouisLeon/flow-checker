// Environment variables (M45): every `process.env` name the code reads, on which side, which `.env`
// files define it, and the flags. The rules follow `next build` (16.4.3, Turbopack and webpack):
// private names are left out of client bundles, `process.env.X`, `process.env['X']` and reads through
// a variable holding `process.env` are inlined, destructuring is not. `.env` files are parsed with
// Next's own line rule, for names only.
import { type AppModel, AppModelSchema, type EnvVar } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { createScanSession, scanProject } from '../src'
import { envFileLoads, envFileNames } from '../src/env'

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
  'node_modules/@types/node/package.json': JSON.stringify({ name: '@types/node', types: 'index.d.ts' }),
  'node_modules/@types/node/index.d.ts': lines(
    'declare var process: { env: Record<string, string | undefined> }',
  ),
  'src/app/layout.tsx': lines(
    'export default function Root({ children }: { children: unknown }) {',
    '  return <html><body>{children as never}</body></html>',
    '}',
  ),
}

function files(extra: Record<string, string>): InMemoryFileSystemHost {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries({ ...BASE, ...extra })) fs.writeFileSync(`/p/${path}`, text)
  return fs
}

function scan(extra: Record<string, string>): AppModel {
  const model = scanProject({ root: '/p', fileSystem: files(extra) })
  expect(() => AppModelSchema.parse(model)).not.toThrow()
  return model
}

const variable = (model: AppModel, name: string): EnvVar => {
  const found = model.env?.vars.find((v) => v.name === name)
  if (!found) throw new Error(`no ${name}: ${model.env?.vars.map((v) => v.name).join(', ')}`)
  return found
}
const reads = (model: AppModel, name: string) =>
  variable(model, name).reads.map(
    (r) => `${r.loc.file}:${r.loc.line} ${r.side} ${r.access}${r.optional ? ' optional' : ''}`,
  )
const flags = (model: AppModel) =>
  (model.env?.vars ?? []).flatMap((v) =>
    (v.flags ?? []).map((f) => `${v.name} ${f.kind} ${f.loc.file}:${f.loc.line}`),
  )

/** A server page that renders a client component; `server` and `client` are their bodies' first lines. */
const page = (server: string[], client: string[], clientHead: string[] = []) => ({
  'src/app/page.tsx': lines(
    "import { Widget } from '@/components/widget'",
    'export default function Home() {',
    ...server,
    '  return <Widget />',
    '}',
  ),
  'src/components/widget.tsx': lines(
    "'use client'",
    ...clientHead,
    'export function Widget() {',
    ...client,
    '  return <p />',
    '}',
  ),
})

describe('.env files', () => {
  it('reads names with Next’s line rule and never keeps a value', () => {
    expect(
      envFileNames(
        [
          '# comment',
          'A=1',
          'export B="two"',
          "C='three' # trailing",
          'D: four',
          'E="multi',
          'NOT_A_NAME=inside the quoted value',
          'end"',
          'F=',
          'A=again',
          '  G = spaced',
        ].join('\r\n'),
      ),
    ).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
  })

  it('knows which files Next loads for which NODE_ENV', () => {
    expect(envFileLoads('.env')).toEqual(['development', 'production', 'test'])
    expect(envFileLoads('.env.local')).toEqual(['development', 'production'])
    expect(envFileLoads('.env.development')).toEqual(['development'])
    expect(envFileLoads('.env.test.local')).toEqual(['test'])
    expect(envFileLoads('.env.example')).toEqual([])
    expect(envFileLoads('.env.staging')).toEqual([])
  })

  it('lists the files in Next’s order, with what defines and what only lists each name', () => {
    const model = scan({
      '.env.example': lines('SECRET=', 'LISTED='),
      '.env.production': lines('CDN=prod-value-1'),
      '.env.local': lines('SECRET=local-value-2'),
      '.env': lines('SECRET=base-value-3', 'UNUSED=base-value-4'),
      'src/app/page.tsx': lines(
        'export default function Home() {',
        '  return <p>{process.env.SECRET}{process.env.LISTED}</p>',
        '}',
      ),
    })
    expect(model.env?.files).toEqual([
      { file: '.env', loads: ['development', 'production', 'test'], names: 2 },
      { file: '.env.local', loads: ['development', 'production'], names: 1 },
      { file: '.env.production', loads: ['production'], names: 1 },
      { file: '.env.example', loads: [], names: 2 },
    ])
    expect(variable(model, 'SECRET').definedIn).toEqual(['.env', '.env.local'])
    expect(variable(model, 'SECRET').listedIn).toEqual(['.env.example'])
    expect(variable(model, 'LISTED').definedIn).toEqual([])
    expect(variable(model, 'UNUSED').reads).toEqual([])
    // Values never reach the model.
    expect(JSON.stringify(model)).not.toMatch(/-value-\d/)
  })

  it('has no env map for an app with neither reads nor files', () => {
    expect(scan({}).env).toBeUndefined()
  })
})

describe('reading process.env', () => {
  it('reads each form of access', () => {
    const model = scan({
      'src/app/page.tsx': lines(
        "const KEY = 'CONSTANT'",
        'const env = process.env',
        'export default function Home({ name }: { name: string }) {',
        '  const a = process.env.DIRECT',
        "  const b = process.env['LITERAL']",
        '  const c = process.env[KEY]',
        '  const d = env.ALIASED',
        '  const local = process.env',
        '  const e = local.IN_FUNCTION',
        '  const { DESTRUCTURED, RENAMED: r, DEFAULTED = "x" } = process.env',
        '  const { FROM_ALIAS } = env',
        '  const f = process.env[`FEATURE_${name}`]',
        '  return <p>{a}{b}{c}{d}{e}{f}{r}{DESTRUCTURED}{DEFAULTED}{FROM_ALIAS}</p>',
        '}',
      ),
    })
    const all = (model.env?.vars ?? []).map(
      (v) => `${v.name} ${v.reads.map((r) => `${r.access}${r.optional ? '?' : ''}`).join(',')}`,
    )
    expect(all).toEqual([
      'ALIASED alias',
      'CONSTANT constant',
      'DEFAULTED destructured?',
      'DESTRUCTURED destructured',
      'DIRECT direct',
      'FROM_ALIAS destructured',
      'IN_FUNCTION alias',
      'LITERAL literal',
      'RENAMED destructured',
    ])
    expect(model.env?.unknown.map((r) => `${r.key} ${r.side}`)).toEqual(['`FEATURE_${name}` server'])
  })

  it('leaves out writes, a whole process.env handed on, and an unrelated variable with an alias’s name', () => {
    const model = scan({
      'src/lib/setup.ts': lines(
        'declare function parse(e: unknown): unknown',
        "process.env.WRITTEN = '1'",
        'delete process.env.DELETED',
        'export const parsed = parse(process.env)',
        'export function other() {',
        '  const env = { OTHER: 1 }',
        '  return env.OTHER',
        '}',
        'const env = process.env',
        'export const used = env.REAL',
      ),
      'src/app/page.tsx': lines(
        "import { parsed, other, used } from '@/lib/setup'",
        'export default function Home() {',
        '  return <p>{String(parsed)}{other()}{used}</p>',
        '}',
      ),
    })
    expect(model.env?.vars.map((v) => v.name)).toEqual(['REAL'])
  })

  it('marks reads a fallback or a check handles as optional', () => {
    const model = scan({
      'src/app/page.tsx': lines(
        'export default function Home() {',
        "  const a = process.env.A ?? 'x'",
        "  const b = process.env.B || 'x'",
        '  const c = process.env.C && 1',
        '  if (process.env.D) console.log(1)',
        '  const e = process.env.E ? 1 : 2',
        '  const f = !process.env.F',
        "  const g = process.env.G === 'on'",
        '  const h = Boolean(process.env.H)',
        "  const i = (process.env.I as string) ?? 'x'",
        '  const j = process.env.J!',
        '  const k = process.env.K as string',
        '  const l = `${process.env.L}/x`',
        '  return <p>{a}{b}{c}{e}{String(f)}{String(g)}{String(h)}{i}{j}{k}{l}</p>',
        '}',
      ),
    })
    const optional = (model.env?.vars ?? []).filter((v) => v.reads[0]?.optional).map((v) => v.name)
    expect(optional).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])
  })
})

describe('sides and pages', () => {
  it('tells server, client and shared modules apart', () => {
    const model = scan({
      ...page(
        ['  const s = process.env.ON_SERVER'],
        ['  const c = process.env.NEXT_PUBLIC_ON_CLIENT'],
        [
          "import { shared } from '@/lib/shared'",
          "import type { Only } from '@/lib/types-only'",
          "import { save } from '@/actions/save'",
        ],
      ),
      'src/lib/shared.ts': lines('export const shared = process.env.NEXT_PUBLIC_SHARED'),
      'src/lib/types-only.ts': lines('export type Only = string', 'export const x = process.env.TYPE_IMPORT'),
      'src/actions/save.ts': lines(
        "'use server'",
        'export async function save() {',
        '  return process.env.ACTION_SECRET',
        '}',
      ),
      'src/app/api/hook/route.ts': lines(
        "import { shared } from '@/lib/shared'",
        'export async function POST() {',
        '  return Response.json({ a: process.env.HANDLER, shared })',
        '}',
      ),
    })
    expect(reads(model, 'ON_SERVER')).toEqual(['src/app/page.tsx:3 server direct'])
    expect(reads(model, 'NEXT_PUBLIC_ON_CLIENT')).toEqual(['src/components/widget.tsx:6 client direct'])
    expect(reads(model, 'NEXT_PUBLIC_SHARED')).toEqual(['src/lib/shared.ts:1 both direct'])
    // A `'use server'` file runs on the server even when client code imports it.
    expect(reads(model, 'ACTION_SECRET')).toEqual(['src/actions/save.ts:3 server direct'])
    expect(reads(model, 'HANDLER')).toEqual(['src/app/api/hook/route.ts:3 server direct'])
    // A type-only import brings no code.
    expect(model.env?.vars.some((v) => v.name === 'TYPE_IMPORT')).toBe(false)

    const path = (id: string) => model.routes.find((r) => r.id === id)?.path
    const pages = (name: string) => variable(model, name).reads[0]?.routeIds.map(path)
    expect(pages('NEXT_PUBLIC_SHARED')).toEqual(['/', '/api/hook'])
    // Only the page's client component reaches it in client code; the route handler runs it on the server.
    expect(variable(model, 'NEXT_PUBLIC_SHARED').reads[0]?.clientRouteIds?.map(path)).toEqual(['/'])
    expect(variable(model, 'ON_SERVER').reads[0]?.clientRouteIds).toBeUndefined()
    expect(pages('ACTION_SECRET')).toEqual(['/'])
  })

  it('places layouts, special files, middleware, instrumentation and next.config', () => {
    const model = scan({
      'src/app/layout.tsx': lines(
        'export default function Root({ children }: { children: unknown }) {',
        '  return <html lang={process.env.LANG_CODE}><body>{children as never}</body></html>',
        '}',
      ),
      'src/app/page.tsx': lines('export default function Home() {', '  return <p />', '}'),
      'src/app/shop/page.tsx': lines('export default function Shop() {', '  return <p />', '}'),
      'src/app/shop/loading.tsx': lines(
        'export default function Loading() {',
        '  return <p>{process.env.SPINNER}</p>',
        '}',
      ),
      'src/middleware.ts': lines(
        'export function middleware() {',
        '  return process.env.GATE ? undefined : undefined',
        '}',
        "export const config = { matcher: '/shop' }",
      ),
      'src/instrumentation.ts': lines('export function register() {', '  console.log(process.env.BOOT)', '}'),
      'src/instrumentation-client.ts': lines('console.log(process.env.NEXT_PUBLIC_BOOT)'),
      'next.config.ts': lines(
        'export default {',
        "  env: { BUILD_ID: 'x', 'QUOTED': 'y' },",
        '  output: process.env.OUTPUT,',
        '}',
      ),
    })
    const path = (id: string) => model.routes.find((r) => r.id === id)?.path
    const pages = (name: string) => variable(model, name).reads[0]?.routeIds.map(path)
    expect(pages('LANG_CODE')).toEqual(['/', '/shop'])
    expect(pages('SPINNER')).toEqual(['/shop'])
    expect(pages('GATE')).toEqual(['/shop'])
    expect(reads(model, 'BOOT')).toEqual(['src/instrumentation.ts:2 server direct'])
    expect(reads(model, 'NEXT_PUBLIC_BOOT')).toEqual(['src/instrumentation-client.ts:1 client direct'])
    expect(reads(model, 'OUTPUT')).toEqual(['next.config.ts:3 config direct'])
    expect(variable(model, 'BUILD_ID').definedIn).toEqual(['next.config.ts'])
    expect(variable(model, 'QUOTED').definedIn).toEqual(['next.config.ts'])
  })
})

describe('flags', () => {
  it('flags a private name in client code, also through a module both sides import', () => {
    const model = scan({
      ...page(
        ['  const ok = process.env.SERVER_SECRET'],
        [
          '  const a = process.env.CLIENT_SECRET',
          '  const b = process.env.NEXT_PUBLIC_FINE',
          '  const c = process.env.NODE_ENV',
          '  const d = process.env.FROM_CONFIG',
        ],
        ["import { url } from '@/lib/config'"],
      ),
      'src/lib/config.ts': lines('export const url = process.env.API_URL'),
      '.env': lines('SERVER_SECRET=1', 'CLIENT_SECRET=2', 'NEXT_PUBLIC_FINE=3', 'API_URL=4'),
      'next.config.ts': lines("export default { env: { FROM_CONFIG: 'x' } }"),
    })
    expect(flags(model)).toEqual([
      'API_URL private-in-client src/lib/config.ts:1',
      'CLIENT_SECRET private-in-client src/components/widget.tsx:4',
    ])
  })

  it('flags NEXT_PUBLIC_ names destructured in client code, not other forms or server code', () => {
    const model = scan({
      ...page(
        ['  const { NEXT_PUBLIC_ON_SERVER } = process.env'],
        [
          '  const { NEXT_PUBLIC_A } = process.env',
          "  const b = process.env['NEXT_PUBLIC_B']",
          '  const c = env.NEXT_PUBLIC_C',
          '  const d = process.env[KEY]',
        ],
        ['const env = process.env', "const KEY = 'NEXT_PUBLIC_D'"],
      ),
      '.env': lines(
        'NEXT_PUBLIC_ON_SERVER=',
        'NEXT_PUBLIC_A=',
        'NEXT_PUBLIC_B=',
        'NEXT_PUBLIC_C=',
        'NEXT_PUBLIC_D=',
      ),
    })
    expect(flags(model)).toEqual(['NEXT_PUBLIC_A not-inlined src/components/widget.tsx:5'])
  })

  it('flags names nothing defines when a read has no fallback', () => {
    const model = scan({
      'src/app/page.tsx': lines(
        'export default function Home() {',
        "  const a = process.env.MISSING ?? 'x'",
        '  const b = process.env.MISSING_REQUIRED',
        '  const c = process.env.IN_DEV_ONLY',
        '  const d = process.env.ONLY_LISTED',
        '  const e = process.env.NODE_ENV + process.env.NEXT_RUNTIME',
        '  const f = process.env.FLOW_CHECKER_RUNTIME',
        '  const g = process.env.VERCEL_URL',
        '  return <p>{a}{b}{c}{d}{e}{f}{g}</p>',
        '}',
      ),
      '.env.development': lines('IN_DEV_ONLY=x'),
      '.env.example': lines('ONLY_LISTED='),
    })
    expect(flags(model)).toEqual(['MISSING_REQUIRED not-defined src/app/page.tsx:3'])
    expect(variable(model, 'NODE_ENV').setBy).toBe('next')
    expect(variable(model, 'FLOW_CHECKER_RUNTIME').setBy).toBe('flow-checker')
    expect(variable(model, 'VERCEL_URL').setBy).toBe('vercel')
  })

  it('keeps names built at run time in client code apart', () => {
    const model = scan(page([], ['  const v = process.env[`NEXT_PUBLIC_${String(Math.random())}`]']))
    expect(model.env?.unknown.map((r) => `${r.side} ${r.loc.file}:${r.loc.line}`)).toEqual([
      'client src/components/widget.tsx:3',
    ])
  })
})

describe('re-scans', () => {
  it('picks up an edited .env file', () => {
    const fs = files({
      'src/app/page.tsx': lines(
        'export default function Home() {',
        '  return <p>{process.env.TOKEN}</p>',
        '}',
      ),
    })
    const session = createScanSession({ root: '/p', fileSystem: fs })
    expect(flags(session.model)).toEqual(['TOKEN not-defined src/app/page.tsx:2'])
    fs.writeFileSync('/p/.env.local', lines('TOKEN=secret-value-5'))
    const next = session.update({ added: ['/p/.env.local'] })
    expect(flags(next)).toEqual([])
    expect(variable(next, 'TOKEN').definedIn).toEqual(['.env.local'])
    expect(JSON.stringify(next)).not.toContain('secret-value-5')
  })
})
