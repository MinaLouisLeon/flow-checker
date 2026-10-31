import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { ENV, type RuntimeConfig, resolveCaptureOptions } from '@flow-checker/runtime/options'
import { ScanError } from '@flow-checker/scanner'
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
import { ConfigError, configDetails, loadConfig, scanSettings } from './config'
import { configExportDirs, writeFormat } from './export'
import { graphqlForScan } from './graphql'
import { appOrigins, contractSummary, postmanForScan } from './postman'
import { createProgress, scanReporter, scanSteps } from './progress'
import { defaultDevCommand, ensureGitignore, findDashboardDir, hookStatus } from './project'
import type { CliIO } from './run'
import { summary } from './scan'
import { createScanRunner } from './scan-runner'

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
  let root = resolve(options.root ?? process.cwd())
  const progress = createProgress(io, [
    { id: 'config', weight: 1 },
    ...scanSteps(69),
    { id: 'dashboard', weight: 3 },
    { id: 'app', weight: 27 },
  ])

  let config: FlowCheckerConfig
  progress.start('config', 'Loading config…')
  try {
    const loaded = await loadConfig(root, options.config)
    config = loaded.config
    progress.done()
    if (loaded.file) io.out(`Config: ${loaded.file}`)
    if (loaded.root !== root) io.out(`Project root: ${loaded.root}`)
    root = loaded.root
    for (const line of configDetails(root, loaded.file, config)) progress.detail(line)
  } catch (error) {
    progress.finish()
    if (error instanceof ConfigError) {
      io.err(error.message)
      return 1
    }
    throw error
  }

  const appDir = options.appDir ?? config.appDir
  const appPort = options.appPort ?? config.ports?.app ?? DEFAULT_PORTS.app
  // A cloud collection is fetched again on each start (local files on every scan).
  const postman = await postmanForScan(root, config, io, progress, { refresh: true })
  // Live introspection is asked again on each start (M17).
  const graphql = await graphqlForScan(root, config, io, progress, { refresh: true })
  // The scan stays warm, so a file change only re-reads that file (docs/PLAN.md 6.7). From the
  // build it runs in a worker thread, so the server keeps answering during large re-scans.
  const scanner = createScanRunner({
    root,
    appDir,
    ...scanSettings(config),
    graphql,
    postman,
    appOrigins: appOrigins(config, appPort),
  })
  progress.detail(`scan runs ${scanner.inWorker ? 'in a worker thread' : 'in this thread'}`)
  // One scan at a time: a change that arrives during a scan waits for it.
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task)
    queue = next.catch(() => {})
    return next
  }
  // The first scan shows each phase; a full re-scan from the dashboard shows the live line only.
  // Re-scans show a live line too, once the start-up steps are done (one live line at a time).
  const rescanProgress = () =>
    createProgress(progress.active ? { ...io, display: undefined } : io, scanSteps(100))
  let firstScan = true
  const scan = () =>
    serial(async () => {
      const shown = firstScan ? progress : rescanProgress()
      const lines = firstScan
      firstScan = false
      try {
        // A full re-scan (dashboard) reads the collection's local files again.
        if (!lines && config.postman) {
          await scanner.setPostman(await postmanForScan(root, config, io, undefined))
        }
        const { model, durationMs } = await scanner.scan(scanReporter(shown, { lines }))
        if (!lines) shown.finish()
        io.out(summary(model, durationMs))
        const contract = contractSummary(model)
        if (contract) io.out(contract)
        return model
      } catch (error) {
        shown.finish()
        throw error
      }
    })

  let model: AppModel
  try {
    model = await scan()
  } catch (error) {
    await scanner.close()
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

  const dashboardDir = findDashboardDir()
  if (!dashboardDir) io.err('Dashboard build not found. The API still works, but there is no UI to show.')

  progress.start('dashboard', 'Starting the dashboard…')
  const exportDirs = configExportDirs(root, config)
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
    exporter: {
      dirs: { md: shownPath(root, exportDirs.md), html: shownPath(root, exportDirs.html) },
      write: (format, data, { force }) => {
        const files = writeFormat(format, data, exportDirs[format], { force, dashboardDir })
        io.out(
          `Exported ${format === 'md' ? 'Markdown docs' : 'the static site'} to ${shownPath(root, exportDirs[format])}.`,
        )
        return { dir: shownPath(root, exportDirs[format]), files: files.length }
      },
    },
  })
  progress.done()
  io.out(`Dashboard: ${server.url}`)

  let watcher: ProjectWatcher | undefined
  let warmTimer: ReturnType<typeof setTimeout> | undefined
  if (scans) {
    const onChange = (batch: WatchBatch) => {
      const files = [...batch.changed, ...batch.added, ...batch.removed].map((f) =>
        relative(root, f).replaceAll('\\', '/'),
      )
      return serial(async () => {
        const rescan = rescanProgress()
        try {
          const { model: next, durationMs } = await scanner.update(
            batch,
            scanReporter(rescan, { lines: false }),
          )
          rescan.finish()
          scans.publish({ model: next, durationMs, files, changedAt: batch.at })
          io.out(`Re-scanned in ${Math.round(durationMs)} ms (${describeFiles(files)} changed).`)
          options.onRescan?.(next, files)
        } catch (error) {
          rescan.finish()
          io.err(`Re-scan failed after ${describeFiles(files)} changed: ${(error as Error).message}`)
        }
      })
    }
    try {
      watcher = await watchProject({ root, onChange })
      io.out('Watching for file changes.')
      // The first re-scan is the slow one: pay for it now, after startup, not on the first edit.
      warmTimer = setTimeout(() => {
        void serial(() => scanner.warm()).catch(() => {})
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
  let stopped = false
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
    progress.start('app', `Starting your app… waiting for port ${appPort}`)
    let appExited = false
    app = startApp({
      command,
      cwd: root,
      env: appEnv,
      onLine: (line, stream) => (stream === 'err' ? io.err : io.out)(`[app] ${line}`),
      onExit: (code) => {
        appExited = true
        progress.finish()
        if (code !== null && code !== 0) io.err(`[app] exited with code ${code}`)
      },
    })
    // Only with progress output: tests and --quiet don't wait for the port.
    if (io.display) {
      void waitForPort(appPort, () => appExited || stopped).then((ready) => {
        if (ready) progress.done(`App ready on port ${appPort}`)
        progress.finish()
      })
    } else {
      progress.finish()
    }
  } else {
    progress.finish()
    // Without --app the user starts it (Docker, a task runner...) and needs this env.
    io.out('Start your app with capture on using this environment:')
    for (const [name, value] of Object.entries(appEnv)) io.out(`  ${name}=${shellQuote(value)}`)
  }

  if (options.open !== false) openBrowser(server.url)

  return {
    url: server.url,
    port: server.port,
    ingestUrl,
    appEnv,
    close: async () => {
      stopped = true
      progress.finish()
      clearTimeout(warmTimer)
      await watcher?.close()
      await app?.stop()
      store.writeSessions()
      await server.close()
      await scanner.close()
    },
  }
}

/**
 * Resolves when something listens on the port (true), or when `cancelled()` says to stop
 * waiting (false). Tries IPv4 and IPv6, since Next may listen on either.
 */
async function waitForPort(port: number, cancelled: () => boolean): Promise<boolean> {
  const tryConnect = (host: string) =>
    new Promise<boolean>((done) => {
      const socket = connect({ port, host })
      const finish = (ok: boolean) => {
        socket.destroy()
        done(ok)
      }
      socket.once('connect', () => finish(true))
      socket.once('error', () => finish(false))
      socket.setTimeout(1000, () => finish(false))
    })
  while (!cancelled()) {
    if ((await tryConnect('127.0.0.1')) || (await tryConnect('::1'))) return !cancelled()
    await new Promise((r) => setTimeout(r, 250).unref())
  }
  return false
}

/** A folder relative to the project root (forward slashes), or absolute when outside it. */
function shownPath(root: string, dir: string): string {
  const rel = relative(root, dir)
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel.split('\\').join('/') : dir
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

/** Single-quoted for POSIX shells when the value has characters a shell would interpret. */
function shellQuote(value: string): string {
  return /^[\w./:-]*$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`
}
