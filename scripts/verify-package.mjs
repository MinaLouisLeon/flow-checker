// Packs @integr8-media/flow-checker, installs the tarball into an empty project, and checks
// that it works the way a user would get it: no private @flow-checker/* references,
// the bin runs, and the public entry points import and typecheck.
// Run after `pnpm build`: node scripts/verify-package.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repo = resolve(import.meta.dirname, '..')
const pkgDir = join(repo, 'packages', 'flow-checker')
const work = mkdtempSync(join(tmpdir(), 'flow-checker-verify-'))
const isWin = process.platform === 'win32'

function run(cmd, args, cwd) {
  // npm/pnpm/npx are .cmd shims on Windows and need a shell, which splits on spaces.
  const viaShell = isWin && cmd !== process.execPath
  const argv = viaShell ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args
  return execFileSync(cmd, argv, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: viaShell,
  })
}

function fail(message) {
  console.error(`✗ ${message}`)
  process.exitCode = 1
}

try {
  // 1. No private package references in the built output.
  // Only code files: the dashboard's assets folder also holds fonts and images.
  const dist = join(pkgDir, 'dist')
  for (const file of readdirSync(dist, { recursive: true })) {
    if (!/\.(m?js|d\.ts|html)$/.test(file)) continue
    const text = readFileSync(join(dist, file), 'utf8')
    if (text.includes('@flow-checker/')) fail(`dist/${file} references a private @flow-checker/* package`)
  }
  if (!existsSync(join(dist, 'dashboard', 'index.html'))) fail('dist/dashboard/index.html is missing')

  // 2. Pack and check the published manifest.
  run('pnpm', ['pack', '--pack-destination', work], pkgDir)
  const tarball = readdirSync(work).find((f) => f.endsWith('.tgz'))
  if (!tarball) throw new Error('pnpm pack produced no tarball')

  const app = join(work, 'app')
  mkdirSync(app)
  writeFileSync(
    join(app, 'package.json'),
    JSON.stringify({ name: 'verify-app', private: true, type: 'module' }),
  )
  run('npm', ['install', '--no-audit', '--no-fund', join(work, tarball), `typescript@${tsVersion()}`], app)

  const manifest = JSON.parse(
    readFileSync(join(app, 'node_modules', '@integr8-media', 'flow-checker', 'package.json'), 'utf8'),
  )
  if (
    manifest.dependencies &&
    Object.keys(manifest.dependencies).some((d) => d.startsWith('@flow-checker/'))
  ) {
    fail('published package.json depends on a private @flow-checker/* package')
  }

  // 3. The bin runs.
  const version = run('npx', ['--no-install', 'flow-checker', '--version'], app).trim()
  if (version !== manifest.version) fail(`bin printed "${version}", expected "${manifest.version}"`)

  // 4. Public entry points import at runtime and typecheck for a consumer.
  writeFileSync(
    join(app, 'flow-checker.config.ts'),
    [
      "import { defineConfig } from '@integr8-media/flow-checker/config'",
      "import { installClientRuntime } from '@integr8-media/flow-checker/runtime/client'",
      "import { registerServerRuntime } from '@integr8-media/flow-checker/runtime/server'",
      "import { withFlowChecker } from '@integr8-media/flow-checker/next'",
      'export const nextConfig = withFlowChecker({ reactStrictMode: true })',
      'installClientRuntime()',
      'registerServerRuntime()',
      "export default defineConfig({ root: '.', include: ['**'], exclude: ['**/*.test.*'], apiClients: [{ module: 'ky', methods: ['get'] }], capture: { storeRaw: false }, ports: { app: 3000 } })",
      '',
    ].join('\n'),
  )
  writeFileSync(
    join(app, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        types: [],
      },
      files: ['flow-checker.config.ts'],
    }),
  )
  run('npx', ['--no-install', 'tsc', '-p', '.'], app)
  run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "await import('@integr8-media/flow-checker'); await import('@integr8-media/flow-checker/config'); const { withFlowChecker } = await import('@integr8-media/flow-checker/next'); if (typeof withFlowChecker !== 'function') throw new Error('withFlowChecker missing')",
    ],
    app,
  )
  // next.config.js of older Next.js versions is CommonJS.
  run(
    process.execPath,
    [
      '-e',
      "const { withFlowChecker } = require('@integr8-media/flow-checker/next'); const c = { a: 1 }; if (withFlowChecker(c) !== c) throw new Error('withFlowChecker changed the config without FLOW_CHECKER=1')",
    ],
    app,
  )

  if (!process.exitCode) console.log(`✓ ${tarball} installs, runs and typechecks for consumers`)
} catch (error) {
  fail(error.stderr || error.stdout || error.message)
} finally {
  rmSync(work, { recursive: true, force: true })
}

function tsVersion() {
  return JSON.parse(readFileSync(join(repo, 'node_modules', 'typescript', 'package.json'), 'utf8')).version
}
