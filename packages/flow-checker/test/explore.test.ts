// `flow-checker explore` (M28): a fresh copy of a project (no config, no hooks, no .flow-checker/)
// gets a working dashboard and stays exactly as it was.
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'
import type { ServerMeta } from '@flow-checker/server'
import type { AppModel } from '@flow-checker/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { startDev } from '../src/cli/dev'
import { enableCaptureCommands, exploreDataDir, projectSetup } from '../src/cli/explore'
import { type CliIO, runCli } from '../src/cli/run'

const fixturesDir = resolve(import.meta.dirname, '../../../fixtures')
// Every Next.js fixture (mock-api is a plain server).
const FIXTURES = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(fixturesDir, d.name, 'next.config.ts')))
  .map((d) => d.name)

// What a fresh clone doesn't have: flow-checker's own files and build output.
const NOT_IN_CLONE =
  /^(\.flow-checker|\.next|node_modules|AGENTS\.md|flow-checker\.config\.\w+|instrumentation(-client)?\.\w+)$/

function capture() {
  const out: string[] = []
  const err: string[] = []
  const io: CliIO = { out: (t) => out.push(t), err: (t) => err.push(t) }
  return { io, out, err }
}

/** Copies a fixture as a fresh clone would have it, linking node_modules instead of copying it. */
function freshCopy(fixture: string, dirs: string[]): string {
  const root = join(mkdtempSync(join(tmpdir(), 'flow-checker-explore-')), fixture)
  dirs.push(resolve(root, '..'))
  const from = join(fixturesDir, fixture)
  cpSync(from, root, { recursive: true, filter: (src) => !NOT_IN_CLONE.test(basename(src)) })
  symlinkSync(join(from, 'node_modules'), join(root, 'node_modules'), 'junction')
  return root
}

/** Path → content hash and mtime of every file, without node_modules. */
function snapshot(root: string): Record<string, string> {
  const files: Record<string, string> = {}
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.name === 'node_modules') continue
      if (entry.isDirectory()) walk(path)
      else {
        const hash = createHash('sha1').update(readFileSync(path)).digest('hex')
        files[relative(root, path).replaceAll('\\', '/')] = `${hash} ${statSync(path).mtimeMs}`
      }
    }
  }
  walk(root)
  return files
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  expect(res.status).toBe(200)
  return (await res.json()) as T
}

describe('explore without a setup', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it.each(FIXTURES)('serves %s and leaves the copy untouched', { timeout: 60_000 }, async (fixture) => {
    const root = freshCopy(fixture, dirs)
    expect(projectSetup(root, undefined)).toEqual({ config: false, hooks: false, data: false })
    const before = snapshot(root)

    const { io, out } = capture()
    const session = await startDev({ root, port: 0, open: false, explore: true, watch: false }, io)
    if (typeof session === 'number') throw new Error(`explore failed with ${session}`)
    const dataDir = session.dataDir
    if (dataDir) dirs.push(dataDir)
    try {
      expect(dataDir).toBe(exploreDataDir(root))
      expect(existsSync(join(dataDir ?? '', 'model.json'))).toBe(true)
      expect(session.appEnv).toEqual({})

      const model = await getJson<AppModel>(`${session.url}/api/model`)
      expect(model.routes.length).toBeGreaterThan(0)
      const meta = await getJson<ServerMeta>(`${session.url}/api/meta`)
      expect(meta.capture).toBeUndefined()
      expect(meta.explore).toMatchObject({ setup: false, dataDir })
      expect(meta.explore?.enableCapture.at(-1)).toBe('npx flow-checker')
      // The dashboard's export goes outside the project too.
      expect(meta.export?.md.startsWith(dataDir ?? '?')).toBe(true)
      // No ingest endpoint: nothing can write captures.
      expect((await fetch(`${session.url}/api/captures`)).status).toBe(404)
      const res = await fetch(`${session.url}/`)
      expect(res.status).toBe(200)

      const text = out.join('\n')
      expect(text).toContain('Capture is off. To turn it on, run:')
      expect(text.split('\n').at(-1)).toBe(`Next: open ${session.url} in your browser.`)
    } finally {
      await session.close()
    }
    expect(snapshot(root)).toEqual(before)
  })

  it('watches and re-scans without writing into the project', { timeout: 60_000 }, async () => {
    const root = freshCopy('basic', dirs)
    const { io } = capture()
    const rescans: string[][] = []
    const session = await startDev(
      { root, port: 0, open: false, explore: true, onRescan: (_, files) => rescans.push(files) },
      io,
    )
    if (typeof session === 'number') throw new Error(`explore failed with ${session}`)
    if (session.dataDir) dirs.push(session.dataDir)
    try {
      mkdirSync(join(root, 'app', 'explore-added'))
      writeFileSync(
        join(root, 'app', 'explore-added', 'page.tsx'),
        'export default function Added() { return null }',
      )
      const deadline = Date.now() + 30_000
      while (rescans.length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100))
      const model = await getJson<AppModel>(`${session.url}/api/model`)
      expect(model.routes.map((r) => r.path)).toContain('/explore-added')
      const saved = JSON.parse(readFileSync(join(session.dataDir ?? '', 'model.json'), 'utf8')) as AppModel
      expect(saved.routes.map((r) => r.path)).toContain('/explore-added')
    } finally {
      await session.close()
    }
    expect(existsSync(join(root, '.flow-checker'))).toBe(false)
    expect(existsSync(join(root, '.gitignore'))).toBe(false)
  })
})

describe('explore with a setup', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('uses .flow-checker/, shows captures and never touches .gitignore', { timeout: 60_000 }, async () => {
    const root = freshCopy('basic', dirs)
    writeFileSync(join(root, 'flow-checker.config.ts'), 'export default {}\n')
    const { io, out } = capture()
    const session = await startDev({ root, port: 0, open: false, explore: true, watch: false }, io)
    if (typeof session === 'number') throw new Error(`explore failed with ${session}`)
    try {
      expect(session.dataDir).toBeUndefined()
      expect(existsSync(join(root, '.flow-checker', 'model.json'))).toBe(true)
      const meta = await getJson<ServerMeta>(`${session.url}/api/meta`)
      expect(meta.capture).toBeDefined()
      // The fixture already depends on the package but its hooks were left out of the copy.
      expect(meta.explore).toEqual({
        setup: true,
        enableCapture: ['npx flow-checker init', 'npx flow-checker'],
      })
      expect(await getJson<unknown[]>(`${session.url}/api/captures`)).toEqual([])
      expect(out.join('\n')).toContain("Your app isn't started here.")
      expect(out.join('\n')).not.toContain('FLOW_CHECKER=')
    } finally {
      await session.close()
    }
    expect(existsSync(join(root, '.gitignore'))).toBe(false)
    // The ingest token isn't kept: explore doesn't start the app.
    expect(existsSync(join(root, '.flow-checker', 'cache', 'ingest-token'))).toBe(false)
  })
})

describe('explore helpers', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })
  const project = (files: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'flow-checker-explore-'))
    dirs.push(root)
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(resolve(root, name, '..'), { recursive: true })
      writeFileSync(join(root, name), text)
    }
    return root
  }

  it('finds hooks in the root or src/, only when they load the runtime', () => {
    const hook = "import '@integr8-media/flow-checker/runtime/server'"
    expect(projectSetup(project({ 'instrumentation.ts': hook }), undefined).hooks).toBe(true)
    expect(projectSetup(project({ 'src/instrumentation-client.js': hook }), undefined).hooks).toBe(true)
    expect(
      projectSetup(project({ 'instrumentation.ts': 'export function register() {}' }), undefined).hooks,
    ).toBe(false)
    expect(projectSetup(project({ '.flow-checker/model.json': '{}' }), undefined).data).toBe(true)
  })

  it('lists install, init and start, skipping what is already done', () => {
    const pkg = (deps: object) => JSON.stringify({ devDependencies: deps })
    const none = { config: false, hooks: false, data: false }
    expect(enableCaptureCommands(project({ 'package.json': pkg({}), 'pnpm-lock.yaml': '' }), none)).toEqual([
      'pnpm add -D @integr8-media/flow-checker',
      'npx flow-checker init',
      'npx flow-checker',
    ])
    const installed = project({ 'package.json': pkg({ '@integr8-media/flow-checker': '^0.3.0' }) })
    expect(enableCaptureCommands(installed, none)).toEqual(['npx flow-checker init', 'npx flow-checker'])
    expect(enableCaptureCommands(installed, { ...none, hooks: true })).toEqual(['npx flow-checker'])
  })

  it('keys the data folder by the project path', () => {
    const a = exploreDataDir(join(tmpdir(), 'one', 'shop'))
    const b = exploreDataDir(join(tmpdir(), 'two', 'shop'))
    expect(a).not.toBe(b)
    expect(basename(a)).toMatch(/^shop-[0-9a-f]{12}$/)
    expect(exploreDataDir(join(tmpdir(), 'one', 'shop'))).toBe(a)
    expect(relative(tmpdir(), a).startsWith('..')).toBe(false)
  })

  it('is listed in help and checks its ports', async () => {
    const { io, out, err } = capture()
    expect(await runCli(['--help'], io)).toBe(0)
    expect(out.join('\n')).toMatch(/\n {2}explore +Scan, watch and open the dashboard only/)
    expect(await runCli(['explore', '--port', 'x'], io)).toBe(1)
    expect(err.join('\n')).toContain('--port must be a port number')
  })
})
