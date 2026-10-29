// Checks that the published package uses every config option (docs/config.md). Packs
// @integr8/flow-checker, installs it into an empty project, writes a config that sets every
// option to a non-default value, and checks each one's effect through the installed CLI.
// Run after `pnpm build`: node scripts/verify-config.mjs
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const repo = resolve(import.meta.dirname, '..')
const pkgDir = join(repo, 'packages', 'flow-checker')
const work = mkdtempSync(join(tmpdir(), 'flow-checker-config-'))
const isWin = process.platform === 'win32'
const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
}

function run(cmd, args, cwd) {
  const viaShell = isWin && cmd !== process.execPath
  const argv = viaShell ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args
  return execFileSync(cmd, argv, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: viaShell,
  })
}

function write(base, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(base, path)), { recursive: true })
    writeFileSync(join(base, path), text)
  }
}

const lines = (...l) => `${l.join('\n')}\n`

try {
  run('pnpm', ['pack', '--pack-destination', work], pkgDir)
  const tarball = join(
    work,
    readdirSync(work).find((f) => f.endsWith('.tgz')),
  )

  // The workspace: the package is installed at the top, the Next.js app lives in web/, and the
  // config lives in tools/ (so `root` is needed to find the app).
  const top = join(work, 'workspace')
  write(top, { 'package.json': JSON.stringify({ name: 'workspace', private: true, type: 'module' }) })
  mkdirSync(join(top, '.git'))
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', tarball], top)

  const [dashboardPort, appPort] = [await freePort(), await freePort()]
  write(top, {
    'tools/flow-checker.config.ts': lines(
      `import { defineConfig } from '@integr8/flow-checker/config'`,
      `export default defineConfig({`,
      `  root: '../web',`,
      `  appDir: 'src/application',`,
      `  devCommand: 'node start-app.js',`,
      `  ports: { dashboard: ${dashboardPort}, app: ${appPort} },`,
      `  include: ['src/**'],`,
      `  exclude: ['**/*.stories.*', 'src/application/admin/**'],`,
      `  apiClients: [{ module: 'ky', methods: ['get', 'post'] }],`,
      `  capture: {`,
      `    storeRaw: false,`,
      `    redact: { keys: ['iban'], headers: ['x-session'], patterns: [/SECRET-\\d+/g] },`,
      `    maxBodyBytes: 1234,`,
      `    ignore: ['*/health'],`,
      `  },`,
      `  types: { maxDepth: 1 },`,
      `  export: { md: 'out/docs', html: 'out/site' },`,
      `})`,
    ),
    'web/package.json': JSON.stringify({ name: 'web', private: true, dependencies: { next: '16.0.0' } }),
    'web/tsconfig.json': JSON.stringify({
      compilerOptions: { jsx: 'preserve', strict: true, module: 'esnext', moduleResolution: 'bundler' },
    }),
    'web/node_modules/ky/package.json': JSON.stringify({ name: 'ky', types: 'index.d.ts' }),
    'web/node_modules/ky/index.d.ts': lines(
      'declare const ky: { get<T>(url: string): Promise<T>; post<T>(url: string, o?: { json?: unknown }): Promise<T> }',
      'export default ky',
    ),
    'web/src/application/layout.tsx':
      'export default function Layout({ children }: { children: React.ReactNode }) { return <html><body>{children}</body></html> }\n',
    'web/src/application/page.tsx': lines(
      `'use client'`,
      `import ky from 'ky'`,
      `import { Card } from './Card.stories'`,
      `interface Deep { a: { b: { c: { d: string } } } }`,
      `export default function Home() {`,
      `  async function onClick() {`,
      `    await ky.post('/api/notes', { json: { text: 'x' } })`,
      `    const deep = (await (await fetch('/api/deep')).json()) as Deep`,
      `    return deep`,
      `  }`,
      `  return <main><button onClick={onClick}>go</button><Card /></main>`,
      `}`,
    ),
    'web/src/application/Card.stories.tsx':
      "export function Card() { return <button onClick={() => fetch('/api/story')}>s</button> }\n",
    'web/src/application/admin/page.tsx':
      "export default async function Admin() { await fetch('https://api.test/admin'); return null }\n",
    'web/start-app.js': '',
  })

  const cli = join(top, 'node_modules', '@integr8', 'flow-checker', 'dist', 'cli.js')
  const config = ['--config', 'tools/flow-checker.config.ts']
  const fc = (...a) => run(process.execPath, [cli, ...a, ...config], top)

  // --- scan: root, appDir, include/exclude, apiClients, types.maxDepth -----------------------
  fc('scan')
  const modelFile = join(top, 'web', '.flow-checker', 'model.json')
  check('root: .flow-checker/ is written in the configured root', existsSync(modelFile))
  const model = JSON.parse(readFileSync(modelFile, 'utf8'))
  check(
    'appDir: routes come from src/application',
    model.project.appDir === 'src/application',
    model.project.appDir,
  )
  const paths = model.routes.map((r) => r.path)
  check(
    'exclude: the excluded admin page is dropped',
    !paths.includes('/admin') && paths.includes('/'),
    paths.join(', '),
  )
  const home = model.components.find((c) => c.name === 'Home')
  const card = home?.children.find((c) => c.name === 'Card')
  check(
    'exclude: the stories component is marked excluded',
    card?.resolution === 'excluded',
    card?.resolution,
  )
  const urls = model.requests.map((s) => `${s.transport} ${s.method} ${s.url?.path ?? '?'}`)
  check(
    'exclude: requests in excluded files are not listed',
    !urls.some((u) => u.includes('/api/story') || u.includes('admin')),
    urls.join(', '),
  )
  check('apiClients: ky.post is a request', urls.includes('api-client POST /api/notes'), urls.join(', '))
  // Named types are stored once in model.types; requests point to them.
  const deep = model.types.find((t) => t.name === 'Deep')
  check(
    'types.maxDepth: deep types stop at depth 1',
    JSON.stringify(deep ?? {}).includes('"reason":"depth"'),
    JSON.stringify(deep?.shape ?? deep),
  )

  // --- doctor: root, devCommand, ports -------------------------------------------------------
  const doctor = spawnSync(process.execPath, [cli, 'doctor', ...config], { cwd: top, encoding: 'utf8' })
  const out = doctor.stdout + doctor.stderr
  check('doctor: reports the configured project root', out.includes(`project root: ${join(top, 'web')}`))
  check('devCommand: doctor shows the configured command', out.includes('Dev command: node start-app.js'))
  check(
    'ports: doctor checks the configured ports',
    out.includes(`${dashboardPort} is free`) && out.includes(`${appPort} is free`),
  )

  // --- export: export.md / export.html, relative to the root ---------------------------------
  fc('export')
  check(
    'export.md: Markdown is written to web/out/docs',
    existsSync(join(top, 'web', 'out', 'docs', 'README.md')),
  )
  check(
    'export.html: the site is written to web/out/site',
    existsSync(join(top, 'web', 'out', 'site', 'index.html')),
  )

  // --- dev: ports, capture options passed to the runtime, server-side redaction --------------
  const dev = spawn(process.execPath, [cli, 'dev', '--no-app', '--no-open', '--no-watch', ...config], {
    cwd: top,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !isWin,
  })
  let devOut = ''
  dev.stdout.setEncoding('utf8').on('data', (d) => {
    devOut += d
  })
  dev.stderr.setEncoding('utf8').on('data', (d) => {
    devOut += d
  })
  try {
    const dashboard = `http://127.0.0.1:${dashboardPort}`
    await waitFor(
      async () => (await fetch(`${dashboard}/api/health`)).ok && /FLOW_CHECKER_RUNTIME=/.test(devOut),
    )
    check('ports.dashboard: the dashboard listens on the configured port', true)

    const runtimeLine = devOut.split(/\r?\n/).find((l) => l.includes('FLOW_CHECKER_RUNTIME='))
    const runtime = JSON.parse(runtimeLine.slice(runtimeLine.indexOf('=') + 1).replace(/^'|'$/g, ''))
    const capture = runtime.capture
    check('ports.app: the app gets PORT', devOut.includes(`PORT=${appPort}`))
    check(
      'capture.redact.keys reaches the runtime (added to the defaults)',
      capture.redact.keys.includes('iban') && capture.redact.keys.includes('password'),
    )
    check('capture.redact.headers reaches the runtime', capture.redact.headers.includes('x-session'))
    check(
      'capture.redact.patterns reaches the runtime',
      capture.redact.patterns.some((p) => p.source === 'SECRET-\\d+'),
    )
    check('capture.maxBodyBytes reaches the runtime', capture.maxBodyBytes === 1234)
    check('capture.ignore reaches the runtime', capture.ignore.includes('*/health'))
    check('capture.storeRaw reaches the runtime', capture.storeRaw === false)

    // The tool server redacts again on arrival with the same rules.
    const res = await fetch(`${dashboard}/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({
        token: runtime.token,
        sessionId: 'ses_verify',
        events: [],
        captures: [
          {
            id: 'cap_verify',
            sessionId: 'ses_verify',
            origin: 'browser',
            transport: 'fetch',
            timestamp: new Date().toISOString(),
            durationMs: 1,
            pageUrl: `http://localhost:${appPort}/`,
            request: {
              method: 'POST',
              url: `http://localhost:${appPort}/api/notes`,
              headers: { 'x-session': 'abc' },
              body: { kind: 'json', value: { iban: 'DE89370400440532013000', text: 'SECRET-42 here' } },
            },
            response: { status: 200, headers: {}, body: { kind: 'json', value: {} } },
            stack: [],
            redacted: false,
            redactedPaths: [],
          },
        ],
      }),
    })
    check('ingest accepts the runtime token', res.status === 204, String(res.status))
    const saved = (await (await fetch(`${dashboard}/api/captures/cap_verify`)).json()).capture
    const body = saved?.request?.body?.value ?? {}
    check('capture.redact.keys: iban is masked on arrival', body.iban === '[REDACTED:string]', body.iban)
    check(
      'capture.redact.patterns: matching text is masked',
      !String(body.text).includes('SECRET-42'),
      body.text,
    )
    check('capture.redact.headers: x-session is masked', saved?.request?.headers?.['x-session'] !== 'abc')
  } finally {
    stopTree(dev)
  }
} catch (error) {
  check('run', false, error.stderr || error.stdout || error.message)
} finally {
  rmSync(work, { recursive: true, force: true })
}

for (const r of results)
  console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok || !r.detail ? '' : `\n    ${r.detail}`}`)
if (results.some((r) => !r.ok)) process.exitCode = 1
else console.log(`\nEvery config option is used by the published package (${results.length} checks).`)

function stopTree(child) {
  if (child.exitCode !== null) return
  try {
    if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    else process.kill(-child.pid, 'SIGTERM')
  } catch {}
}

async function waitFor(fn, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    try {
      if (await fn()) return
    } catch {}
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('Timed out waiting for flow-checker dev')
}

function freePort() {
  return new Promise((done) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => done(port))
    })
  })
}
