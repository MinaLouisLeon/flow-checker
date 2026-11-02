// `flow-checker impact`, `scan --diff` and `scan --fail-on` (M36), on copies of the fixtures.
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import type { Impact } from '@flow-checker/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { type CliIO, runCli } from '../src/cli/run'

const fixturesDir = resolve(import.meta.dirname, '../../../fixtures')
// The config imports `@integr8-media/flow-checker/config`, which only resolves after `pnpm build`.
const NOT_COPIED =
  /^(\.flow-checker|\.next|node_modules|AGENTS\.md|flow-checker\.config\.\w+|instrumentation(-client)?\.\w+)$/

function capture() {
  const out: string[] = []
  const err: string[] = []
  const io: CliIO = { out: (t) => out.push(t), err: (t) => err.push(t) }
  return { io, out, err }
}

function copy(fixture: string, dirs: string[]): string {
  const root = join(mkdtempSync(join(tmpdir(), 'flow-checker-impact-')), fixture)
  dirs.push(resolve(root, '..'))
  const from = join(fixturesDir, fixture)
  cpSync(from, root, { recursive: true, filter: (src) => !NOT_COPIED.test(basename(src)) })
  linkPackages(join(from, 'node_modules'), join(root, 'node_modules'))
  return root
}

/** Each package by its real path (see summary.test.ts: one junction for all fails on Windows CI). */
function linkPackages(from: string, to: string) {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.name === '.bin' || entry.name === '.pnpm' || entry.isFile()) continue
    const source = join(from, entry.name)
    if (entry.name.startsWith('@')) linkPackages(source, join(to, entry.name))
    else symlinkSync(realpathSync(source), join(to, entry.name), 'junction')
  }
}

function git(root: string, ...args: string[]) {
  return execFileSync(
    'git',
    ['-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'core.autocrlf=false', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

function commitAll(root: string, message: string) {
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', message)
}

function initRepo(root: string) {
  writeFileSync(join(root, '.gitignore'), 'node_modules\n.flow-checker\n')
  git(root, 'init', '-q')
  commitAll(root, 'start')
}

function edit(root: string, file: string, change: (text: string) => string) {
  const path = join(root, file)
  writeFileSync(path, change(readFileSync(path, 'utf8')))
}

/** Pages, flows and requests by their labels, sorted. */
function summarize(impact: Impact) {
  return {
    pages: impact.pages.map((i) => i.label),
    handlers: impact.handlers.map((i) => i.label),
    flows: impact.flows.map((i) => i.label),
    requests: impact.requests.map((i) => i.label),
  }
}

async function impactOf(root: string, ...args: string[]): Promise<Impact> {
  const { io, out, err } = capture()
  expect(await runCli(['impact', '--json', '--root', root, ...args], io), err.join('\n')).toBe(0)
  return JSON.parse(out.join('\n')) as Impact
}

const API = '{NEXT_PUBLIC_API_URL ?? http://localhost:4010}'

describe('cli impact', { timeout: 60_000 }, () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('is listed in the help', async () => {
    const { io, out } = capture()
    expect(await runCli(['--help'], io)).toBe(0)
    const help = out.join('\n')
    expect(help).toMatch(/^ {2}impact /m)
    expect(help).toContain('--diff <ref>')
    expect(help).toContain('--fail-on <kinds>')
  })

  it('lists what a type, an API client and a constants file affect', async () => {
    const root = copy('basic', dirs)
    const everything = {
      pages: ['/', '/users/[id]'],
      handlers: [],
      flows: ['DeleteUserButton click'],
      requests: [
        `DELETE ${API}/users/:id`,
        `GET ${API}/todos?userId=:userId`,
        `GET ${API}/users`,
        `GET ${API}/users/:id`,
      ],
    }

    // A type file: what uses its types, directly or through other types (props types).
    const type = await impactOf(root, join(root, 'types/user.ts'))
    expect(type.files).toEqual([{ file: 'types/user.ts', found: 'code', facts: ['3 types'], via: [] }])
    expect(summarize(type)).toEqual({
      ...everything,
      requests: everything.requests.filter((r) => !r.startsWith('DELETE')),
    })
    expect(type.components.map((c) => c.label)).toEqual(['ProfileCard', 'UserList'])
    expect(type.requests.find((r) => r.label === `GET ${API}/users`)?.reason).toBe('its data type uses User')

    // The API client every request goes through.
    const client = await impactOf(root, join(root, 'lib/api.ts'))
    expect(summarize(client)).toEqual(everything)
    expect(client.requests.find((r) => r.label.startsWith('DELETE'))?.reason).toBe(
      'sent through lib/api.ts:9',
    )
    expect(client.pages.find((p) => p.label === '/')?.reason).toBe(`sends GET ${API}/users`)

    // A constants file nothing but the client imports: through the import graph.
    const constants = await impactOf(root, join(root, 'lib/config.ts'))
    expect(constants.files).toEqual([
      { file: 'lib/config.ts', found: 'imported', facts: [], via: ['lib/api.ts'] },
    ])
    expect(summarize(constants)).toEqual(everything)
    expect(constants.requests[0]?.reason).toBe('sent through lib/api.ts (imports lib/config.ts)')

    // Grouped by area: `home` first.
    expect(client.groups.map((g) => g.name)).toEqual(['home', 'users'])
  })

  it('narrows to the declaration around a line', async () => {
    const root = copy('basic', dirs)
    // Line 10 is inside `deleteUser`.
    const one = await impactOf(root, `${join(root, 'lib/api.ts')}:10`)
    expect(summarize(one)).toEqual({
      pages: ['/users/[id]'],
      handlers: [],
      flows: ['DeleteUserButton click'],
      requests: [`DELETE ${API}/users/:id`],
    })
    // The `api` instance (line 7) has no request of its own: the whole file is used, and it says so.
    const instance = await impactOf(root, `${join(root, 'lib/api.ts')}:7`)
    expect(instance.files[0]?.wholeFile).toBe(true)
    expect(instance.requests).toHaveLength(4)
  })

  it('lists what a hook affects', async () => {
    const root = copy('react-query', dirs)
    const hook = await impactOf(root, join(root, 'src/hooks/useApiQuery.ts'))
    expect(hook.files[0]).toMatchObject({ file: 'src/hooks/useApiQuery.ts', found: 'code' })
    expect(summarize(hook)).toEqual({
      pages: ['/settings'],
      handlers: [],
      flows: [],
      requests: [`GET ${API}/settings`, `GET ${API}/settings`],
    })
    expect(hook.groups.map((g) => g.name)).toEqual(['settings'])
  })

  it('follows route handlers to the pages that call them', async () => {
    const root = copy('bff', dirs)
    const handler = await impactOf(root, join(root, 'src/app/api/products/route.ts'))
    expect(handler.handlers.map((h) => h.label)).toEqual(['/api/products'])
    expect(handler.pages.map((p) => p.label)).toEqual(['/'])
    expect(handler.flows.map((f) => f.label)).toEqual(['CreateProductForm submit'])
    // Each caller leads to the upstream call of its own method.
    const post = handler.requests.find((r) => r.label === 'POST /api/products')
    expect(post?.reason).toBe('leads to POST {BACKEND_URL ?? http://localhost:4010}/products')
  })

  it('prints text grouped by area', async () => {
    const root = copy('basic', dirs)
    const { io, out } = capture()
    expect(await runCli(['impact', '--root', root, join(root, 'lib/config.ts')], io)).toBe(0)
    const text = out.join('\n')
    expect(text).toContain('lib/config.ts  nothing of its own; imported by lib/api.ts')
    expect(text).toContain('Affects 2 pages, 1 flow and 4 requests.')
    expect(text).toMatch(/^Area users$/m)
    expect(text).toMatch(/^ {2}flow {11}DeleteUserButton click/m)
  })

  it('fails on a missing file or no file', async () => {
    const root = copy('basic', dirs)
    const missing = capture()
    expect(await runCli(['impact', '--root', root, join(root, 'lib/nope.ts')], missing.io)).toBe(1)
    expect(missing.err.join('\n')).toContain('no such file')
    const none = capture()
    expect(await runCli(['impact', '--root', root], none.io)).toBe(1)
    expect(none.err.join('\n')).toContain('Name a file')
  })
})

describe('cli scan --diff', { timeout: 60_000 }, () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('lists what changed since a ref and what it affects', async () => {
    const root = copy('basic', dirs)
    initRepo(root)
    const start = git(root, 'rev-parse', 'HEAD').trim()

    const clean = capture()
    expect(await runCli(['scan', '--root', root, '--diff', 'HEAD'], clean.io)).toBe(0)
    expect(clean.out.join('\n')).toContain('No source files changed since HEAD')

    // Uncommitted edits, a new untracked file and a changed Markdown file.
    edit(root, 'lib/config.ts', (t) => `${t}export const TIMEOUT = 5000\n`)
    writeFileSync(join(root, 'lib/unused.ts'), 'export const X = 1\n')
    writeFileSync(join(root, 'NOTES.md'), '# notes\n')
    const { io, out, err } = capture()
    expect(await runCli(['scan', '--json', '--root', root, '--diff', 'HEAD'], io), err.join('\n')).toBe(0)
    const result = JSON.parse(out.join('\n'))
    expect(result.diff.files).toEqual(['lib/config.ts', 'lib/unused.ts'])
    expect(result.diff.other).toBe(1)
    expect(result.diff.impact.files.map((f: { found: string }) => f.found)).toEqual(['imported', 'none'])
    expect(summarize(result.diff.impact).pages).toEqual(['/', '/users/[id]'])

    // Against a commit: the edits are committed, and a page is removed after.
    commitAll(root, 'edit')
    rmSync(join(root, 'app/(marketing)/about/page.tsx'))
    const text = capture()
    expect(await runCli(['scan', '--root', root, '--diff', start], text.io), text.err.join('\n')).toBe(0)
    const printed = text.out.join('\n')
    expect(printed).toContain(`Changes since ${start}`)
    expect(printed).toContain('lib/config.ts')
    expect(printed).toContain(`Removed since ${start}: app/(marketing)/about/page.tsx`)
  })

  it('fails on a ref that is not a commit', async () => {
    const root = copy('basic', dirs)
    initRepo(root)
    const { io, err } = capture()
    expect(await runCli(['scan', '--root', root, '--diff', 'no-such-branch'], io)).toBe(1)
    expect(err.join('\n')).toContain('"no-such-branch" is not a commit')
  })
})

describe('cli scan --fail-on', { timeout: 60_000 }, () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  /** A component whose request URL comes from a prop: a `dynamic-url` note. */
  function addDynamicUrl(root: string) {
    writeFileSync(
      join(root, 'components/Reload.tsx'),
      [
        `'use client'`,
        '',
        'export function Reload({ url }: { url: string }) {',
        '  return <button onClick={() => fetch(url)}>Reload</button>',
        '}',
        '',
      ].join('\n'),
    )
    edit(
      root,
      'app/(marketing)/about/page.tsx',
      (t) =>
        `import { Reload } from '@/components/Reload'\n${t.replace('</main>', '<Reload url={String(Date.now())} /></main>')}`,
    )
  }

  it('exits 0 with nothing open, 1 with open notes and 2 when the check cannot run', async () => {
    const root = copy('basic', dirs)
    const clean = capture()
    expect(await runCli(['scan', '--root', root, '--fail-on', 'dynamic-url'], clean.io)).toBe(0)
    expect(clean.out.join('\n')).toContain('--fail-on dynamic-url: nothing open.')

    initRepo(root)
    addDynamicUrl(root)
    const open = capture()
    expect(await runCli(['scan', '--root', root, '--fail-on', 'dynamic-url,unknown-method'], open.io)).toBe(1)
    expect(open.out.join('\n')).toMatch(
      /--fail-on dynamic-url,unknown-method: 1 open\n {2}dynamic-url {2}GET \? url {2}components\/Reload\.tsx:4/,
    )

    const json = capture()
    expect(await runCli(['scan', '--json', '--root', root, '--fail-on', 'dynamic-url'], json.io)).toBe(1)
    const result = JSON.parse(json.out.join('\n'))
    expect(result.failOn).toMatchObject({ kinds: ['dynamic-url'], failed: true })
    expect(result.failOn.open[0]).toMatchObject({ kind: 'dynamic-url', file: 'components/Reload.tsx' })

    // Only kinds that are asked for count.
    expect(await runCli(['scan', '--root', root, '--fail-on', 'stale'], capture().io)).toBe(0)

    const unknown = capture()
    expect(await runCli(['scan', '--root', root, '--fail-on', 'dynamic-url,nope'], unknown.io)).toBe(2)
    expect(unknown.err.join('\n')).toContain('unknown flag kind nope')
    expect(
      await runCli(
        ['scan', '--root', root, '--diff', 'no-such-ref', '--fail-on', 'dynamic-url'],
        capture().io,
      ),
    ).toBe(2)
  })

  it('with --diff, only counts notes on the requests the changes affect', async () => {
    const root = copy('basic', dirs)
    initRepo(root)
    addDynamicUrl(root)
    // The new request is part of the diff: it counts.
    expect(
      await runCli(['scan', '--root', root, '--diff', 'HEAD', '--fail-on', 'dynamic-url'], capture().io),
    ).toBe(1)
    // Committed, then an unrelated change: it doesn't.
    commitAll(root, 'reload')
    edit(root, 'types/user.ts', (t) => `${t}export type Id = number\n`)
    const scoped = capture()
    expect(
      await runCli(['scan', '--root', root, '--diff', 'HEAD', '--fail-on', 'dynamic-url'], scoped.io),
    ).toBe(0)
    expect(scoped.out.join('\n')).toContain('nothing open on the changed requests')
  })
})
