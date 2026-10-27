// Runs the user's dev command (e.g. `pnpm run dev`) with capture turned on, and stops the
// whole process tree on exit.
import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'

export interface AppProcessOptions {
  command: string
  cwd: string
  env: Record<string, string>
  /** Receives each output line of the app. */
  onLine: (line: string, stream: 'out' | 'err') => void
  onExit?: (code: number | null) => void
}

export interface AppProcess {
  pid?: number
  stop: () => Promise<void>
}

export function startApp(options: AppProcessOptions): AppProcess {
  const isWin = process.platform === 'win32'
  const child: ChildProcess = spawn(options.command, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Own process group on POSIX, so the whole tree can be signalled.
    detached: !isWin,
    windowsHide: true,
  })

  let exited = false
  const exitedPromise = new Promise<void>((resolve) => {
    child.once('exit', (code) => {
      exited = true
      options.onExit?.(code)
      resolve()
    })
    child.once('error', (error) => {
      options.onLine(`Could not start "${options.command}": ${error.message}`, 'err')
    })
  })

  for (const [stream, name] of [
    [child.stdout, 'out'],
    [child.stderr, 'err'],
  ] as const) {
    if (!stream) continue
    createInterface({ input: stream }).on('line', (line) => options.onLine(line, name))
  }

  return {
    pid: child.pid,
    stop: async () => {
      if (exited || child.pid === undefined) return
      killTree(child.pid)
      await Promise.race([exitedPromise, new Promise((r) => setTimeout(r, 5000))])
    },
  }
}

function killTree(pid: number) {
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    } else {
      process.kill(-pid, 'SIGTERM')
    }
  } catch {
    // Already gone.
  }
}
