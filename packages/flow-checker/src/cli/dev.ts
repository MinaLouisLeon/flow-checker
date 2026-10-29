import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENV, type RuntimeConfig, resolveCaptureOptions } from '@flow-checker/runtime/options'
import { createScanSession, ScanError, type ScanSession } from '@flow-checker/scanner'
import {
  CaptureStore,
  type ProjectWatcher,
  ScanFeed,
  startServer,
  type WatchBatch,
  watchProject,
} from '@flow-checker/server'
import { type AppModel, DEFAULT_PORTS, type FlowCheckerConfig } from '@flow-checker/shared'
import { version } from '../../package.json'
import { type AppProcess, startApp } from './app-process'
import { ConfigError, loadConfig } from './config'
import { defaultDevCommand, ensureGitignore, hookStatus } from './project'
import type { CliIO } from './run'
import { summary, writeModel } from './scan'

export interface DevCommandOptions {
  root?: string
  appDir?: string
  /** Config file, relative to the root. Default: `flow-checker.config.*` in the root. */
  config?: string
  /** Dashboard port. */
  port?: number
  /** Port of the user's Next.js app. */
  appPort?: number
  /** Open the dashboard in the browser. Default: true. */
  open?: boolean
  /** Start the user's app with capture on. Default: false here, true from the CLI. */
  app?: boolean
  /** Command that starts the app. Default: the `dev` script, or `next dev`. */
  devCommand?: string
  /** Re-scan when source files change. Default: true. */
  watch?: boolean
  /** Called after each re-scan triggered by a file change (tests). */
  onRescan?: (model: AppModel, files: string[]) => void
}

export interface DevSession {
  url: string
  port: number
  /** Ingest endpoint the runtime posts to. */
  ingestUrl: string
  /** Env the app runs with (also handy to start it yourself). */
  appEnv: Record<string, string>
  close: () => Promise<void>
}

/**
 * `flow-checker dev`: scans, serves the dashboard and the ingest endpoint, and starts the app
 * with capture on. Returns the running session, or an exit code on failure.
 */
export async function startDev(options: DevCommandOptions, io: CliIO): Promise<DevSession | number> {
  const root = resolve(options.root ?? process.cwd())

  let config: FlowCheckerConfig
  try {
    const loaded = await loadConfig(root, options.config)
    config = loaded.config
    if (loaded.file) io.out(`Config: ${loaded.file}`)
  } catch (error) {
    if (error instanceof ConfigError) {
      io.err(error.message)
      return 1
    }
    throw error
  }

  const appDir = options.appDir ?? config.appDir
  // The scan stays warm, so a file change only re-reads that file (docs/PLAN.md 6.7).
  let session: ScanSession | undefined
  const scan = () => {
    const started = performance.now()
    session = createScanSession({ root, appDir })
    writeModel(root, session.model)
    io.out(summary(session.model, performance.now() - started))
    return session.model
  }

  let model: AppModel
  try {
    model = scan()
  } catch (error) {
    if (error instanceof ScanError) {
      io.err(error.message)
      return 1
    }
    throw error
  }

  const captureOptions = resolveCaptureOptions(config.capture)
  if (captureOptions.storeRaw) {
    io.err(
      'Warning: capture.storeRaw is on. Captured requests are saved WITHOUT masking passwords and tokens.',
    )
  }
  const added = ensureGitignore(root)
  if (added.length > 0) io.out(`Added ${added.join(', ')} to .gitignore`)

  const store = new CaptureStore({ root }).load()
  const token = ingestToken(root)
  const appPort = options.appPort ?? config.ports?.app ?? DEFAULT_PORTS.app

  const dashboardDir = findDashboardDir()
  if (!dashboardDir) io.err('Dashboard build not found. The API still works, but there is no UI to show.')

  const watching = options.watch !== false
  const scans = watching ? new ScanFeed() : undefined
  const server = await startServer({
    root,
    model,
    rescan: scan,
    scans,
    dashboardDir,
    appPort,
    version,
    port: options.port ?? config.ports?.dashboard ?? DEFAULT_PORTS.dashboard,
    capture: { store, token, options: captureOptions },
  })
  io.out(`Dashboard: ${server.url}`)

  let watcher: ProjectWatcher | undefined
  let warmTimer: ReturnType<typeof setTimeout> | undefined
  if (scans) {
    const onChange = (batch: WatchBatch) => {
      const files = [...batch.changed, ...batch.added, ...batch.removed].map((f) =>
        relative(root, f).replaceAll('\\', '/'),
      )
      const started = performance.now()
      try {
        // A failed scan leaves no session: start over.
        const next = session ? session.update(batch) : scan()
        const durationMs = performance.now() - started
        writeModel(root, next)
        scans.publish({ model: next, durationMs, files })
        io.out(`Re-scanned in ${Math.round(durationMs)} ms (${describeFiles(files)} changed).`)
        options.onRescan?.(next, files)
      } catch (error) {
        session = undefined
        io.err(`Re-scan failed after ${describeFiles(files)} changed: ${(error as Error).message}`)
      }
    }
    try {
      watcher = await watchProject({ root, onChange })
      io.out('Watching for file changes.')
      // The first re-scan is the slow one: pay for it now, after startup, not on the first edit.
      warmTimer = setTimeout(() => {
        try {
          session?.warm()
        } catch {}
      }, 0)
    } catch (error) {
      io.err(`Could not watch files, so changes need a manual re-scan: ${(error as Error).message}`)
    }
  }

  const ingestUrl = `${server.url}/ingest`
  const runtimeConfig: RuntimeConfig = { ingest: ingestUrl, token, capture: captureOptions }
  const json = JSON.stringify(runtimeConfig)
  const appEnv: Record<string, string> = {
    [ENV.enabled]: '1',
    [ENV.server]: json,
    [ENV.client]: json,
    PORT: String(appPort),
  }

  let app: AppProcess | undefined
  if (options.app) {
    const hooks = hookStatus(root, model.project.appDir ? resolve(root, model.project.appDir) : root)
    if (!hooks.client || !hooks.server) {
      const missing = [!hooks.client && 'browser', !hooks.server && 'server'].filter(Boolean).join(' and ')
      io.err(
        `The ${missing} capture hook is missing, so those requests won't be captured. Run "flow-checker init".`,
      )
    }
    const command = options.devCommand ?? config.devCommand ?? defaultDevCommand(root)
    io.out(`Starting your app: ${command} (port ${appPort})`)
    app = startApp({
      command,
      cwd: root,
      env: appEnv,
      onLine: (line, stream) => (stream === 'err' ? io.err : io.out)(`[app] ${line}`),
      onExit: (code) => {
        if (code !== null && code !== 0) io.err(`[app] exited with code ${code}`)
      },
    })
  }

  if (options.open !== false) openBrowser(server.url)

  return {
    url: server.url,
    port: server.port,
    ingestUrl,
    appEnv,
    close: async () => {
      clearTimeout(warmTimer)
      await watcher?.close()
      await app?.stop()
      store.writeSessions()
      await server.close()
    },
  }
}

function describeFiles(files: string[]): string {
  if (files.length === 1) return files[0] ?? ''
  return `${files[0]} and ${files.length - 1} more`
}

/** CLI entry: runs until Ctrl+C. */
export async function devCommand(options: DevCommandOptions, io: CliIO): Promise<number> {
  const result = await startDev({ app: true, ...options }, io)
  if (typeof result === 'number') return result
  let closing = false
  const stop = () => {
    if (closing) return
    closing = true
    void result.close().finally(() => process.exit(0))
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  io.out('Press Ctrl+C to stop.')
  return 0
}

/**
 * Secret the runtime sends with each batch, so other local pages can't write captures.
 * Kept per project (gitignored), so Next's compile cache stays valid across runs.
 */
function ingestToken(root: string): string {
  const file = join(root, '.flow-checker', 'cache', 'ingest-token')
  try {
    const existing = readFileSync(file, 'utf8').trim()
    if (/^[a-f0-9]{32}$/.test(existing)) return existing
  } catch {}
  const token = randomBytes(16).toString('hex')
  mkdirSync(join(root, '.flow-checker', 'cache'), { recursive: true })
  writeFileSync(file, token)
  return token
}

/** The built dashboard: next to the bundled CLI, or in the workspace when run from source. */
function findDashboardDir(): string | undefined {
  const here = fileURLToPath(new URL('.', import.meta.url))
  const candidates = [
    join(here, 'dashboard'), // dist/cli.js → dist/dashboard
    join(here, '..', '..', '..', 'dashboard', 'dist'), // src/cli/dev.ts → packages/dashboard/dist
  ]
  return candidates.find((dir) => existsSync(join(dir, 'index.html')))
}

function openBrowser(url: string) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]]
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true })
    child.on('error', () => {})
    child.unref()
  } catch {
    // No browser available (CI, SSH). The URL is printed above.
  }
}
