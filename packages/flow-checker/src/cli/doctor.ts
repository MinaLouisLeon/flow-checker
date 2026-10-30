// `flow-checker doctor` (docs/PLAN.md 11): checks that a project is set up for flow-checker and
// explains what isn't supported. Exit code 1 when a check fails, warnings don't fail.
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, relative, resolve } from 'node:path'
import { DEFAULT_PORTS, type FlowCheckerConfig, PACKAGE_NAME } from '@flow-checker/shared'
import { ts } from 'ts-morph'
import { ConfigError, findConfigFile, loadConfig } from './config'
import { EDGE_BODY } from './init'
import { createProgress } from './progress'
import {
  defaultDevCommand,
  findHook,
  findMiddlewareFile,
  hookDir,
  middlewareOnEdge,
  missingGitignoreEntries,
  nextVersion,
  readPackageJson,
} from './project'
import type { CliIO } from './run'

export interface DoctorCommandOptions {
  root?: string
  appDir?: string
  config?: string
  port?: number
  appPort?: number
}

export type CheckStatus = 'ok' | 'warn' | 'fail'

export interface Check {
  name: string
  status: CheckStatus
  message: string
  /** What to do about it. */
  hint?: string
}

const NEXT_CONFIGS = [
  'next.config.ts',
  'next.config.mts',
  'next.config.js',
  'next.config.mjs',
  'next.config.cjs',
]
const ICONS: Record<CheckStatus, string> = { ok: '✓', warn: '!', fail: '✗' }
/** Checks in a typical run: the bar's total (a project can get a few more or fewer). */
const TYPICAL_CHECKS = 13

export async function doctorCommand(options: DoctorCommandOptions, io: CliIO): Promise<number> {
  const root = resolve(options.root ?? process.cwd())
  io.out(`flow-checker doctor: ${root}\n`)
  const progress = createProgress(io, [{ id: 'checks', weight: 1 }])
  progress.start('checks', 'Running checks…', TYPICAL_CHECKS)
  let done = 0
  // Each check's line is printed as soon as it runs; the live line shows how far along it is.
  const checks = await runDoctor({ ...options, root }, (check) => {
    io.out(`  ${ICONS[check.status]} ${check.name}: ${check.message}`)
    if (check.hint && check.status !== 'ok') {
      for (const line of check.hint.split('\n')) io.out(`      ${line}`)
    }
    done++
    progress.update(done, Math.max(done, TYPICAL_CHECKS))
  })
  progress.finish()
  const failed = checks.filter((c) => c.status === 'fail').length
  const warned = checks.filter((c) => c.status === 'warn').length
  io.out('')
  if (failed > 0) {
    io.err(
      `${failed} problem${failed === 1 ? '' : 's'} to fix${warned ? `, ${warned} warning${warned === 1 ? '' : 's'}` : ''}.`,
    )
    return 1
  }
  io.out(warned ? `Ready, with ${warned} warning${warned === 1 ? '' : 's'}.` : 'Everything looks good.')
  return 0
}

/** Runs every check. Later checks are skipped when the project itself can't be found. */
export async function runDoctor(
  options: DoctorCommandOptions & { root: string },
  onCheck?: (check: Check) => void,
): Promise<Check[]> {
  let root = options.root
  const checks: Check[] = []
  const add = (check: Check) => {
    checks.push(check)
    onCheck?.(check)
  }

  add(checkNode())

  // Config first: it can move the project root, the app directory and the ports.
  let config: FlowCheckerConfig = {}
  try {
    const loaded = await loadConfig(root, options.config)
    config = loaded.config
    const moved = loaded.root !== root
    add({
      name: 'Config',
      status: 'ok',
      message: loaded.file
        ? `${rel(root, loaded.file)}${moved ? ` (project root: ${loaded.root})` : ''}`
        : 'none (defaults are used)',
    })
    root = loaded.root
  } catch (error) {
    add({
      name: 'Config',
      status: 'fail',
      message: error instanceof ConfigError ? error.message : String(error),
      hint: findConfigFile(root) ? undefined : 'Run "flow-checker init" to create one.',
    })
  }

  const pkg = readPackageJson(root)
  if (!pkg) {
    add({
      name: 'Project',
      status: 'fail',
      message: `no package.json in ${root}`,
      hint: 'Run flow-checker in the root of your Next.js app, pass --root <dir>, or set "root" in the config.',
    })
    return checks
  }

  // API clients given as packages must be installed for the scan to see their imports' types.
  for (const client of config.apiClients ?? []) {
    const isPackage = !/^[./~@]\//.test(client.module) && !client.module.startsWith('.')
    if (!isPackage || resolvesUp(root, packageName(client.module))) continue
    add({
      name: 'API client',
      status: 'warn',
      message: `${client.module} is not installed`,
      hint: 'Calls to it are still found by name, but install it so types resolve.',
    })
  }

  // App Router.
  const appDirOption = options.appDir ?? config.appDir
  const appDir = appDirOption
    ? resolve(root, appDirOption)
    : [join(root, 'src', 'app'), join(root, 'app')].find((dir) => existsSync(dir))
  if (!appDir || !existsSync(appDir)) {
    add({
      name: 'App Router',
      status: 'fail',
      message: appDirOption ? `${appDirOption} not found` : 'no app directory (looked for src/app and app)',
      hint: 'flow-checker supports the App Router only. Pass --app-dir if it lives elsewhere.',
    })
  } else {
    const pages = [join(root, 'src', 'pages'), join(root, 'pages')].find((dir) => existsSync(dir))
    add({
      name: 'App Router',
      status: pages ? 'warn' : 'ok',
      message: pages ? `${rel(root, appDir)} (${rel(root, pages)} is not scanned)` : rel(root, appDir),
      hint: pages ? 'The Pages Router is not supported. Its pages and requests are left out.' : undefined,
    })
  }

  // Next.js version and the capture path it takes.
  const next = nextVersion(root)
  const installed = existsSync(join(root, 'node_modules', 'next')) || resolvesUp(root, 'next')
  if (!next) {
    add({
      name: 'Next.js',
      status: 'fail',
      message: 'not found in package.json',
      hint: 'Install next 13.4 or later.',
    })
  } else if (next.major < 13 || (next.major === 13 && next.minor < 4)) {
    add({
      name: 'Next.js',
      status: 'fail',
      message: `${next.text} is too old`,
      hint: 'flow-checker needs the App Router with instrumentation: Next.js 13.4 or later.',
    })
  } else {
    add({
      name: 'Next.js',
      status: installed ? 'ok' : 'warn',
      message: `${next.text}${installed ? '' : ' (declared, not installed)'}`,
      hint: installed ? undefined : 'Install dependencies so the scan can resolve types from node_modules.',
    })
  }

  // tsconfig: path aliases come from here.
  add(checkTsconfig(root))

  // The package itself.
  const deps = { ...(pkg.dependencies as object), ...(pkg.devDependencies as object) }
  const declared = Object.hasOwn(deps, PACKAGE_NAME)
  const resolvable = resolvesUp(root, PACKAGE_NAME)
  add({
    name: 'Package',
    status: resolvable ? 'ok' : 'fail',
    message: resolvable
      ? `${PACKAGE_NAME} is installed`
      : declared
        ? `${PACKAGE_NAME} is in package.json but not installed`
        : `${PACKAGE_NAME} is not a dependency`,
    hint: resolvable
      ? undefined
      : `The capture hooks import it. Add it as a dev dependency (e.g. npm install -D ${PACKAGE_NAME}).`,
  })

  // Hooks.
  if (appDir && existsSync(appDir)) {
    for (const check of checkHooks(root, appDir, next)) add(check)
  }

  // Dev command.
  const devCommand = config.devCommand ?? defaultDevCommand(root)
  const scripts = (pkg.scripts ?? {}) as Record<string, string>
  const devScript = devCommand.endsWith('run dev') ? scripts.dev : devCommand
  const turbo = /--turbo(pack)?\b/.test(devScript ?? '')
  const legacy = next && (next.major < 15 || (next.major === 15 && next.minor < 3))
  add({
    name: 'Dev command',
    status: turbo && legacy ? 'warn' : 'ok',
    message: devScript && devScript !== devCommand ? `${devCommand} (${devScript})` : devCommand,
    hint:
      turbo && legacy
        ? `Turbopack on Next.js ${next?.text} ignores the webpack setup that loads the browser hook, so browser requests won't be captured. Use --dev-command "next dev" or upgrade to Next.js 15.3+.`
        : undefined,
  })

  // Ports.
  const ports = [
    ['Dashboard port', options.port ?? config.ports?.dashboard ?? DEFAULT_PORTS.dashboard, '--port'],
    ['App port', options.appPort ?? config.ports?.app ?? DEFAULT_PORTS.app, '--app-port'],
  ] as const
  for (const [name, port, flag] of ports) {
    const free = await portFree(port)
    add({
      name,
      status: free ? 'ok' : 'warn',
      message: free ? `${port} is free` : `${port} is in use`,
      hint: free
        ? undefined
        : `Stop what is using it, or pick another with ${flag} <n>${name === 'App port' ? ' (or start the app yourself with --no-app)' : ''}.`,
    })
  }

  // Captured data stays out of git.
  const missing = missingGitignoreEntries(root)
  add({
    name: '.gitignore',
    status: missing.length ? 'warn' : 'ok',
    message: missing.length ? `missing ${missing.join(', ')}` : 'capture data is ignored',
    hint: missing.length
      ? 'They are added on the next "flow-checker" or "flow-checker init" run.'
      : undefined,
  })

  if (config.capture?.storeRaw) {
    add({
      name: 'Redaction',
      status: 'warn',
      message: 'capture.storeRaw is on: requests are saved unmasked',
      hint: 'Turn it off unless you are debugging locally. Exports still redact unless --raw.',
    })
  }

  return checks
}

function checkNode(): Check {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number)
  const at = (a: number, b: number) => major > a || (major === a && minor >= b)
  if (!at(22, 12)) {
    return {
      name: 'Node.js',
      status: 'fail',
      message: `${process.versions.node} is too old`,
      hint: 'flow-checker needs Node.js 22.12 or later.',
    }
  }
  return {
    name: 'Node.js',
    status: at(22, 18) ? 'ok' : 'warn',
    message: process.versions.node,
    hint: at(22, 18)
      ? undefined
      : 'flow-checker.config.ts needs Node.js 22.18+ (use a .mjs config file before that).',
  }
}

function checkTsconfig(root: string): Check {
  const file = ['tsconfig.json', 'jsconfig.json'].map((f) => join(root, f)).find((f) => existsSync(f))
  if (!file) {
    return {
      name: 'tsconfig',
      status: 'warn',
      message: 'no tsconfig.json or jsconfig.json',
      hint: 'Path aliases (e.g. @/components) can only be resolved with one.',
    }
  }
  // The compiler expects forward slashes, also on Windows.
  const parsed = ts.parseConfigFileTextToJson(file.replaceAll('\\', '/'), readFileSync(file, 'utf8'))
  if (parsed.error) {
    return {
      name: 'tsconfig',
      status: 'fail',
      message: `${rel(root, file)} can't be parsed: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, ' ')}`,
    }
  }
  const paths = parsed.config?.compilerOptions?.paths
  const aliases = paths && typeof paths === 'object' ? Object.keys(paths).length : 0
  return {
    name: 'tsconfig',
    status: 'ok',
    message: `${rel(root, file)}${aliases ? ` (${aliases} path alias${aliases === 1 ? '' : 'es'})` : ''}`,
  }
}

function checkHooks(root: string, appDir: string, next: ReturnType<typeof nextVersion>): Check[] {
  const dir = hookDir(root, appDir)
  const checks: Check[] = []
  const hook = (name: 'instrumentation' | 'instrumentation-client', label: string, entry: string) => {
    const file = findHook(dir, name)
    const wired = file ? readFileSync(file, 'utf8').includes(`${PACKAGE_NAME}/runtime/${entry}`) : false
    checks.push({
      name: label,
      status: wired ? 'ok' : 'fail',
      message: wired
        ? rel(root, file as string)
        : file
          ? `${rel(root, file)} doesn't load ${PACKAGE_NAME}/runtime/${entry}`
          : `no ${rel(root, join(dir, name))}.ts`,
      hint: wired ? undefined : 'Run "flow-checker init" to add it.',
    })
  }
  hook('instrumentation', 'Server hook', 'server')
  hook('instrumentation-client', 'Browser hook', 'client')
  const middleware = checkMiddleware(root, appDir, next)
  if (middleware) checks.push(middleware)

  // Before 15.3 the browser hook only runs through withFlowChecker() (and before 15, the server
  // hook needs experimental.instrumentationHook, which the wrapper sets).
  if (next && (next.major < 15 || (next.major === 15 && next.minor < 3))) {
    const config = NEXT_CONFIGS.map((f) => join(root, f)).find((f) => existsSync(f))
    const text = config ? readFileSync(config, 'utf8') : ''
    const wrapped = text.includes('withFlowChecker')
    const manualHook = /instrumentationHook\s*:\s*true/.test(text)
    checks.push({
      name: 'next.config',
      status: wrapped ? 'ok' : 'fail',
      message: wrapped
        ? `${rel(root, config as string)} uses withFlowChecker()`
        : `Next.js ${next.text} needs withFlowChecker() in next.config${manualHook ? ' (for the browser hook)' : ''}`,
      hint: wrapped
        ? undefined
        : `Next.js before 15.3 has no instrumentation-client file, so the browser hook is loaded by a config wrapper:\n\n  import { withFlowChecker } from '${PACKAGE_NAME}/next'\n  export default withFlowChecker(nextConfig)\n\nIt does nothing unless the app was started by flow-checker.`,
    })
  }
  return checks
}

/**
 * Middleware (M14): the file name Next expects, and whether its requests are captured. On
 * Node.js the server hook covers it; on the edge runtime it needs the edge hook.
 */
function checkMiddleware(
  root: string,
  appDir: string,
  next: ReturnType<typeof nextVersion>,
): Check | undefined {
  const file = findMiddlewareFile(root, appDir)
  if (!file) return undefined
  const name = rel(root, file)
  const proxy = /(^|\/)proxy\.[^/]+$/.test(name)
  if (proxy && next && next.major < 16) {
    return {
      name: 'Middleware',
      status: 'warn',
      message: `Next.js ${next.text} doesn't run ${name}`,
      hint: 'proxy.ts is the Next.js 16 name. Before 16 the file is middleware.ts.',
    }
  }
  if (!middlewareOnEdge(file, next)) {
    return {
      name: 'Middleware',
      status: 'ok',
      message: `${name} runs on Node.js: the server hook captures its requests`,
    }
  }
  const hook = findHook(hookDir(root, appDir), 'instrumentation')
  const wired = hook ? readFileSync(hook, 'utf8').includes(`${PACKAGE_NAME}/runtime/edge`) : false
  return {
    name: 'Middleware',
    status: wired ? 'ok' : 'warn',
    message: wired
      ? `${name} runs on the edge runtime: its fetch calls are captured (best effort)`
      : `${name} runs on the edge runtime, and the requests it sends won't be captured`,
    hint: wired
      ? undefined
      : `Add this to register() in ${hook ? rel(root, hook) : 'instrumentation.ts'}:\n\n${EDGE_BODY}`,
  }
}

/** Whether `name` can be found in node_modules from the root up (monorepos hoist packages). */
function resolvesUp(root: string, name: string): boolean {
  for (let dir = root; ; ) {
    if (existsSync(join(dir, 'node_modules', name, 'package.json'))) return true
    const parent = resolve(dir, '..')
    if (parent === dir) return false
    dir = parent
  }
}

/** Free on loopback and on all interfaces (`next dev` listens on all of them). */
async function portFree(port: number): Promise<boolean> {
  const tryListen = (host?: string) =>
    new Promise<boolean>((done) => {
      const server = createServer()
      server.once('error', () => done(false))
      server.listen({ port, host, exclusive: true }, () => server.close(() => done(true)))
    })
  return (await tryListen('127.0.0.1')) && (await tryListen())
}

function rel(root: string, file: string): string {
  return relative(root, file).replaceAll('\\', '/') || '.'
}

/** `ky` for `ky/distribution`, `@scope/pkg` for `@scope/pkg/sub`. */
function packageName(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier)
}
