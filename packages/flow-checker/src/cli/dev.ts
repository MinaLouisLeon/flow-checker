import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ScanError, scanProject } from '@flow-checker/scanner'
import { type RunningServer, startServer } from '@flow-checker/server'
import { DEFAULT_PORTS } from '@flow-checker/shared'
import { version } from '../../package.json'
import type { CliIO } from './run'
import { summary, writeModel } from './scan'

export interface DevCommandOptions {
  root?: string
  appDir?: string
  /** Dashboard port. */
  port?: number
  /** Port of the user's Next.js app, for "open in app" links. */
  appPort?: number
  /** Open the dashboard in the browser. Default: true. */
  open?: boolean
}

/**
 * `flow-checker dev`: scans, writes the model, serves the dashboard and opens it.
 * Running the app with capture comes with M5. Returns the server, or an exit code on failure.
 */
export async function startDev(options: DevCommandOptions, io: CliIO): Promise<RunningServer | number> {
  const root = resolve(options.root ?? process.cwd())
  const scan = () => {
    const started = performance.now()
    const model = scanProject({ root, appDir: options.appDir })
    writeModel(root, model)
    io.out(summary(model, performance.now() - started))
    return model
  }

  let model: ReturnType<typeof scanProject>
  try {
    model = scan()
  } catch (error) {
    if (error instanceof ScanError) {
      io.err(error.message)
      return 1
    }
    throw error
  }

  const dashboardDir = findDashboardDir()
  if (!dashboardDir) io.err('Dashboard build not found. The API still works, but there is no UI to show.')

  const server = await startServer({
    root,
    model,
    rescan: scan,
    dashboardDir,
    appPort: options.appPort ?? DEFAULT_PORTS.app,
    version,
    port: options.port ?? DEFAULT_PORTS.dashboard,
  })
  io.out(`Dashboard: ${server.url}`)
  if (options.open !== false) openBrowser(server.url)
  return server
}

/** CLI entry: starts the dashboard and keeps running until Ctrl+C. */
export async function devCommand(options: DevCommandOptions, io: CliIO): Promise<number> {
  const result = await startDev(options, io)
  if (typeof result === 'number') return result
  const stop = () => {
    void result.close().finally(() => process.exit(0))
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  io.out('Press Ctrl+C to stop.')
  return 0
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
