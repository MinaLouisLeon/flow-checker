import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { type Check, runDoctor } from '../src/cli/doctor'
import { type CliIO, runCli } from '../src/cli/run'
import { EDGE_BODY, NODE_BODY } from '../src/cli/server-hook'

const dirs: string[] = []
const servers: Server[] = []
afterEach(async () => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))))
})

const CLIENT = "import { installClientRuntime } from '@integr8-media/flow-checker/runtime/client'\n"
const SERVER = `export async function register() {\n${NODE_BODY}\n}\n`

function project(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'flow-checker-doctor-'))
  dirs.push(dir)
  mkdirSync(join(dir, '.git'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

function installed(next: string) {
  return {
    'node_modules/next/package.json': JSON.stringify({ version: next }),
    'node_modules/@integr8-media/flow-checker/package.json': '{}',
  }
}

const byName = (checks: Check[]) => Object.fromEntries(checks.map((c) => [c.name, c]))

/** Free ports, so the port checks don't depend on what runs on this machine. */
async function freePorts() {
  const port = () =>
    new Promise<number>((done) => {
      const s = createServer().listen(0, '127.0.0.1', () => {
        const p = (s.address() as { port: number }).port
        s.close(() => done(p))
      })
    })
  return { port: await port(), appPort: await port() }
}

describe('flow-checker doctor', () => {
  it('passes for a set-up Next 16 project', async () => {
    const root = project({
      'package.json': JSON.stringify({
        scripts: { dev: 'next dev' },
        devDependencies: { '@integr8-media/flow-checker': '0.1.0' },
      }),
      'package-lock.json': '{}',
      'tsconfig.json': '{ // comments are fine\n "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
      '.gitignore': '.flow-checker/\n',
      'src/app/page.tsx': '',
      'src/instrumentation.ts': SERVER,
      'src/instrumentation-client.ts': CLIENT,
      ...installed('16.1.0'),
    })
    const checks = byName(await runDoctor({ root, ...(await freePorts()) }))
    expect(Object.values(checks).filter((c) => c.status !== 'ok' && c.name !== 'Node.js')).toEqual([])
    expect(checks.tsconfig?.message).toBe('tsconfig.json (1 path alias)')
    expect(checks['Dev command']?.message).toBe('npm run dev (next dev)')
    expect(checks['next.config']).toBeUndefined()

    const out: string[] = []
    const cli: CliIO = { out: (t) => out.push(t), err: (t) => out.push(t) }
    const ports = await freePorts()
    expect(
      await runCli(
        ['doctor', '--root', root, '--port', `${ports.port}`, '--app-port', `${ports.appPort}`],
        cli,
      ),
    ).toBe(0)
    expect(out.join('\n')).toContain('✓ Browser hook: src/instrumentation-client.ts')
  })

  it('fails without hooks or the package, and says how to fix it', async () => {
    const root = project({
      'package.json': JSON.stringify({ dependencies: { next: '^15.5.0' } }),
      'app/page.tsx': '',
      'pages/index.tsx': '',
    })
    const checks = byName(await runDoctor({ root, ...(await freePorts()) }))
    expect(checks['App Router']).toMatchObject({ status: 'warn', message: 'app (pages is not scanned)' })
    expect(checks['Next.js']).toMatchObject({ status: 'warn', message: '^15.5.0 (declared, not installed)' })
    expect(checks.Package).toMatchObject({ status: 'fail' })
    expect(checks['Server hook']).toMatchObject({
      status: 'fail',
      hint: 'Run "flow-checker init" to add it.',
    })
    expect(checks['Browser hook']?.status).toBe('fail')
    expect(checks.tsconfig?.status).toBe('warn')
    expect(checks['.gitignore']?.status).toBe('warn')

    const out: string[] = []
    const cli: CliIO = { out: (t) => out.push(t), err: (t) => out.push(t) }
    expect(await runCli(['doctor', '--root', root], cli)).toBe(1)
  })

  it('asks for withFlowChecker() before Next 15.3, and warns about Turbopack', async () => {
    const files = {
      'package.json': JSON.stringify({ scripts: { dev: 'next dev --turbo' } }),
      'tsconfig.json': '{}',
      'app/page.tsx': '',
      'instrumentation.ts': SERVER,
      'instrumentation-client.ts': CLIENT,
      'next.config.js': 'module.exports = {}\n',
      ...installed('14.2.3'),
    }
    let checks = byName(await runDoctor({ root: project(files), ...(await freePorts()) }))
    expect(checks['next.config']).toMatchObject({ status: 'fail' })
    expect(checks['next.config']?.hint).toContain(
      "import { withFlowChecker } from '@integr8-media/flow-checker/next'",
    )
    expect(checks['Dev command']?.status).toBe('warn')

    checks = byName(
      await runDoctor({
        root: project({
          ...files,
          'next.config.js':
            "const { withFlowChecker } = require('@integr8-media/flow-checker/next')\nmodule.exports = withFlowChecker({})\n",
        }),
        ...(await freePorts()),
      }),
    )
    expect(checks['next.config']).toMatchObject({
      status: 'ok',
      message: 'next.config.js uses withFlowChecker()',
    })
  })

  it('rejects Next before 13.4 and reports busy ports and a broken config', async () => {
    const root = project({
      'package.json': '{}',
      'tsconfig.json': '{ "compilerOptions": ',
      'app/page.tsx': '',
      'flow-checker.config.mjs': 'export default 42\n',
      ...installed('13.3.0'),
    })
    const busy = createServer()
    servers.push(busy)
    await new Promise<void>((r) => busy.listen(0, '127.0.0.1', r))
    const port = (busy.address() as { port: number }).port

    const checks = byName(await runDoctor({ root, port, appPort: (await freePorts()).appPort }))
    expect(checks['Next.js']).toMatchObject({ status: 'fail', message: '13.3.0 is too old' })
    expect(checks.Config?.status).toBe('fail')
    expect(checks.tsconfig?.status).toBe('fail')
    expect(checks['Dashboard port']).toMatchObject({ status: 'warn', message: `${port} is in use` })
  })
})

describe('flow-checker doctor: middleware (M14)', () => {
  const base = (next: string, files: Record<string, string>) =>
    project({
      'package.json': JSON.stringify({ scripts: { dev: 'next dev' } }),
      'src/app/page.tsx': '',
      'src/instrumentation-client.ts': CLIENT,
      ...installed(next),
      ...files,
    })
  const EDGE = `export async function register() {\n${NODE_BODY}\n${EDGE_BODY}\n}\n`

  it('has no middleware check without a middleware file', async () => {
    const root = base('16.1.0', { 'src/instrumentation.ts': SERVER })
    expect(byName(await runDoctor({ root, ...(await freePorts()) })).Middleware).toBeUndefined()
  })

  it('is fine with proxy.ts on Next 16 (Node.js runtime)', async () => {
    const root = base('16.1.0', {
      'src/instrumentation.ts': SERVER,
      'src/proxy.ts': 'export function proxy() {}\n',
    })
    const check = byName(await runDoctor({ root, ...(await freePorts()) })).Middleware
    expect(check?.status).toBe('ok')
    expect(check?.message).toContain('src/proxy.ts runs on Node.js')
  })

  it('warns about proxy.ts before Next 16', async () => {
    const root = base('15.5.0', {
      'src/instrumentation.ts': SERVER,
      'src/proxy.ts': 'export function proxy() {}\n',
    })
    const check = byName(await runDoctor({ root, ...(await freePorts()) })).Middleware
    expect(check?.status).toBe('warn')
    expect(check?.message).toBe("Next.js 15.5.0 doesn't run src/proxy.ts")
  })

  it('asks for the edge hook for middleware.ts on the edge runtime', async () => {
    const files = { 'src/middleware.ts': 'export function middleware() {}\n' }
    const missing = base('15.5.0', { ...files, 'src/instrumentation.ts': SERVER })
    const check = byName(await runDoctor({ root: missing, ...(await freePorts()) })).Middleware
    expect(check?.status).toBe('warn')
    expect(check?.hint).toContain('registerEdgeRuntime(process.env.FLOW_CHECKER_RUNTIME)')

    const wired = base('15.5.0', { ...files, 'src/instrumentation.ts': EDGE })
    expect(byName(await runDoctor({ root: wired, ...(await freePorts()) })).Middleware?.status).toBe('ok')

    const node = base('15.5.0', {
      'src/middleware.ts': "export function middleware() {}\nexport const config = { runtime: 'nodejs' }\n",
      'src/instrumentation.ts': SERVER,
    })
    const onNode = byName(await runDoctor({ root: node, ...(await freePorts()) })).Middleware
    expect(onNode?.status).toBe('ok')
    expect(onNode?.message).toContain('runs on Node.js')
  })
})
