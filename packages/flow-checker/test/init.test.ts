import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/cli/config'
import { startDev } from '../src/cli/dev'
import { defaultDevCommand, ensureGitignore, hookStatus, missingGitignoreEntries } from '../src/cli/project'
import { type CliIO, runCli } from '../src/cli/run'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function project(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'flow-checker-init-'))
  dirs.push(dir)
  // Stops .gitignore and lockfile lookups from walking into the real repo.
  mkdirSync(join(dir, '.git'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

function io(answer?: boolean) {
  const out: string[] = []
  const err: string[] = []
  const cli: CliIO = {
    out: (t) => out.push(t),
    err: (t) => err.push(t),
    confirm: answer === undefined ? undefined : async () => answer,
  }
  return { cli, out, err }
}

const read = (root: string, file: string) => readFileSync(join(root, file), 'utf8')

describe('flow-checker init', () => {
  it('creates both hooks next to src/app, a config file and .gitignore entries', async () => {
    const root = project({
      'src/app/page.tsx': '',
      'tsconfig.json': '{}',
      'package.json': '{}',
      'package-lock.json': '{}',
    })
    const { cli, out } = io()
    expect(await runCli(['init', '--root', root, '--yes'], cli)).toBe(0)

    expect(read(root, 'src/instrumentation-client.ts')).toContain(
      "import { installClientRuntime } from '@integr8-media/flow-checker/runtime/client'",
    )
    expect(read(root, 'src/instrumentation.ts')).toContain("process.env.NEXT_RUNTIME === 'nodejs'")
    expect(read(root, 'flow-checker.config.ts')).toContain('storeRaw: false')
    expect(read(root, '.gitignore')).toContain('.flow-checker/captures/')
    expect(hookStatus(root, join(root, 'src', 'app'))).toEqual({ client: true, server: true })
    expect(out.join('\n')).toContain('Add it to the project: npm install -D @integr8-media/flow-checker')

    // Running it again changes nothing.
    const again = io()
    expect(await runCli(['init', '--root', root, '--yes'], again.cli)).toBe(0)
    expect(again.out.join('\n')).toContain('already set up')
  })

  it('appends to existing hooks and puts the blocks into an existing register()', async () => {
    const root = project({
      'app/page.tsx': '',
      'instrumentation-client.js': "console.log('mine')",
      'instrumentation.js': 'export function register() {}\n',
      'flow-checker.config.mjs': 'export default {}',
    })
    const { cli, out } = io()
    expect(await runCli(['init', '--root', root, '--yes'], cli)).toBe(0)
    const client = read(root, 'instrumentation-client.js')
    expect(client.startsWith("console.log('mine')\n")).toBe(true)
    expect(client).toContain('installClientRuntime(process.env.NEXT_PUBLIC_FLOW_CHECKER)')
    const server = read(root, 'instrumentation.js')
    expect(server.startsWith('export async function register() {\n  // flow-checker:')).toBe(true)
    expect(out.join('\n')).toContain('update  instrumentation.js (adds the flow-checker blocks')
    expect(existsSync(join(root, 'flow-checker.config.ts'))).toBe(false)
  })

  it('does nothing without confirmation', async () => {
    const root = project({ 'app/page.tsx': '' })
    const declined = io(false)
    expect(await runCli(['init', '--root', root], declined.cli)).toBe(1)
    expect(existsSync(join(root, 'instrumentation.js'))).toBe(false)

    const noTerminal = io()
    expect(await runCli(['init', '--root', root], noTerminal.cli)).toBe(1)
    expect(noTerminal.err.join('\n')).toContain('--yes')

    const accepted = io(true)
    expect(await runCli(['init', '--root', root], accepted.cli)).toBe(0)
    expect(existsSync(join(root, 'instrumentation.js'))).toBe(true)
  })

  it('fails without an app directory', async () => {
    const root = project({ 'pages/index.tsx': '' })
    const { cli, err } = io()
    expect(await runCli(['init', '--root', root, '--yes'], cli)).toBe(1)
    expect(err.join('\n')).toContain('App Router')
  })
})

describe('project helpers', () => {
  it('only adds the .gitignore entries that are missing', () => {
    const root = project({ '.gitignore': 'node_modules\n.flow-checker/captures/' })
    expect(missingGitignoreEntries(root)).toEqual([
      '.flow-checker/sessions/',
      '.flow-checker/cache/',
      '.flow-checker/postman/',
    ])
    expect(ensureGitignore(root)).toEqual([
      '.flow-checker/sessions/',
      '.flow-checker/cache/',
      '.flow-checker/postman/',
    ])
    expect(missingGitignoreEntries(root)).toEqual([])

    const whole = project({ '.gitignore': '/.flow-checker/\n' })
    expect(missingGitignoreEntries(whole)).toEqual([])
  })

  it('picks the dev command from package.json and the lockfile', () => {
    const pnpm = project({ 'package.json': '{"scripts":{"dev":"next dev"}}', 'pnpm-lock.yaml': '' })
    expect(defaultDevCommand(pnpm)).toBe('pnpm run dev')
    const npm = project({ 'package.json': '{}', 'package-lock.json': '{}' })
    expect(defaultDevCommand(npm)).toBe('npx next dev')
  })

  it('loads TypeScript and JavaScript config files', async () => {
    const ts = project({
      'flow-checker.config.ts': 'const port: number = 4500\nexport default { ports: { dashboard: port } }\n',
    })
    expect((await loadConfig(ts)).config).toEqual({ ports: { dashboard: 4500 } })
    const js = project({ 'flow-checker.config.mjs': 'export default { capture: { storeRaw: true } }' })
    expect((await loadConfig(js)).config).toEqual({ capture: { storeRaw: true } })
    expect((await loadConfig(project({}))).config).toEqual({})
    await expect(loadConfig(project({ 'flow-checker.config.mjs': 'export const x = 1' }))).rejects.toThrow(
      'must export a config object',
    )
  })
})

describe('flow-checker dev capture', () => {
  it('serves ingest and passes the runtime config to the app env', async () => {
    const root = project({ 'app/page.tsx': 'export default function Home() { return <main /> }' })
    const { cli, out } = io()
    // No watcher: this test is about ingest and the app env.
    const session = await startDev({ root, port: 0, open: false, watch: false }, cli)
    if (typeof session === 'number') throw new Error(`startDev failed with ${session}`)
    try {
      const runtime = JSON.parse(session.appEnv.NEXT_PUBLIC_FLOW_CHECKER ?? '{}')
      expect(runtime.ingest).toBe(session.ingestUrl)
      expect(session.appEnv.FLOW_CHECKER).toBe('1')
      expect(session.appEnv.PORT).toBe('3000')
      expect(out.join('\n')).toContain('to .gitignore')

      const res = await fetch(session.ingestUrl, {
        method: 'POST',
        body: JSON.stringify({ token: runtime.token, captures: [], events: [] }),
      })
      expect(res.status).toBe(204)
      expect((await fetch(`${session.url}/api/captures`)).status).toBe(200)
    } finally {
      await session.close()
    }
    // A full dev start (scan + server) takes about a second alone, but several times that while
    // the whole suite compiles TypeScript in parallel.
  }, 20_000)

  it('warns once when route handlers are hit but no server capture arrives (M22)', async () => {
    const root = project({
      'app/page.tsx': 'export default function Home() { return <main /> }',
      'app/api/login/route.ts':
        "export async function POST() {\n  const res = await fetch('https://upstream.example/login')\n  return Response.json(await res.json())\n}\n",
    })
    const { cli, err } = io()
    const session = await startDev({ root, port: 0, open: false, watch: false, serverCaptureWaitMs: 50 }, cli)
    if (typeof session === 'number') throw new Error(`startDev failed with ${session}`)
    try {
      const runtime = JSON.parse(session.appEnv.NEXT_PUBLIC_FLOW_CHECKER ?? '{}')
      const browser = {
        id: 'cap_1',
        sessionId: 'ses_1',
        origin: 'browser',
        transport: 'fetch',
        timestamp: new Date().toISOString(),
        durationMs: 5,
        pageUrl: 'http://localhost:3000/',
        request: {
          method: 'POST',
          url: 'http://localhost:3000/api/login',
          headers: {},
          body: { kind: 'none' },
        },
        response: { status: 200, headers: {}, body: { kind: 'none' } },
        stack: [],
        redacted: true,
        redactedPaths: [],
      }
      const send = (captures: unknown[]) =>
        fetch(session.ingestUrl, {
          method: 'POST',
          body: JSON.stringify({ token: runtime.token, captures, events: [] }),
        })
      expect((await send([browser])).status).toBe(204)
      expect((await send([{ ...browser, id: 'cap_2' }])).status).toBe(204)
      await new Promise((r) => setTimeout(r, 300))
      const warnings = err.filter((line) => line.includes("server capture isn't running"))
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('POST /api/login')
      expect(warnings[0]).toContain('flow-checker doctor')
      expect(await (await fetch(`${session.url}/api/server-capture`)).json()).toEqual({
        state: 'missing',
        request: 'POST /api/login',
      })
    } finally {
      await session.close()
    }
  }, 20_000)
})
