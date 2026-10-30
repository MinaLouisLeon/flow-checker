// Progress output for every command (docs/PLAN.md M12). In a terminal, one live line on stderr
// shows a spinner, a bar for the whole command, the current step and its time; each finished
// step leaves a ✓ line. Elsewhere (CI, pipes, NO_COLOR, TERM=dumb) only the finished steps are
// printed, as plain lines. Without a display (tests, --quiet) nothing is shown.
import type { ScanPhase, ScanProgress } from '@flow-checker/scanner'
import type { CliIO } from './run'

/** Where progress is drawn. */
export interface ProgressDisplay {
  /** `live`: one line redrawn in place. `plain`: finished steps only, one line each. */
  readonly mode: 'live' | 'plain'
  /** Terminal width in columns. */
  columns(): number
  /** Replaces the live line. */
  draw(line: string): void
  /** Removes the live line. */
  clear(): void
  /** Writes a line that stays (above the live line). */
  line(text: string): void
}

export interface StepPlan {
  id: string
  /** Share of the whole command. Weights are relative to each other. */
  weight: number
}

export interface Progress {
  /** Starts a step. A running step is finished first, without a line. */
  start(id: string, label: string, total?: number): void
  /** Updates the running step's count (and optionally its label). */
  update(done: number, total?: number, label?: string): void
  /** Finishes the running step. With `text`, leaves a `✓ text (time)` line. */
  done(text?: string): void
  /** Counts a step as finished without running it (e.g. a skipped check). */
  skip(id: string): void
  /** Prints a lasting line above the live line. */
  line(text: string): void
  /** With --verbose only: prints a detail line. */
  detail(text: string): void
  /** Hides the live line, e.g. while a question waits for an answer. */
  pause(): void
  resume(): void
  /** Removes the live line and stops the spinner. Safe to call more than once. */
  finish(): void
  /** Fraction of the command done, 0..1 (tests). */
  readonly fraction: number
  /** True until `finish()`: another progress shouldn't draw on the same display meanwhile. */
  readonly active: boolean
}

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const FRAME_MS = 80
/** Below this width the bar is dropped and only the spinner and text are shown. */
const MIN_BAR_COLUMNS = 60
const BAR_WIDTH = 20

const ansi = {
  green: (s: string) => `\x1b[32m${s}\x1b[39m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[39m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[22m`,
}
const plainStyle = { green: (s: string) => s, cyan: (s: string) => s, dim: (s: string) => s }

/** Creates the progress for one command run. Without a display it does nothing. */
export function createProgress(
  io: CliIO,
  plan: StepPlan[],
  now: () => number = performance.now.bind(performance),
): Progress {
  const display = io.display
  const live = display?.mode === 'live'
  const style = live ? ansi : plainStyle
  const weights = new Map(plan.map((s) => [s.id, s.weight]))
  const totalWeight = plan.reduce((sum, s) => sum + s.weight, 0) || 1

  let finishedWeight = 0
  const finishedIds = new Set<string>()
  let current: { id: string; label: string; done: number; total?: number; started: number } | undefined
  let shown = 0
  let frame = 0
  let lastDraw = -Infinity
  let paused = false
  let finished = false
  let timer: ReturnType<typeof setInterval> | undefined

  const fraction = () => {
    let value = finishedWeight
    if (current?.total && !finishedIds.has(current.id)) {
      value += (weights.get(current.id) ?? 0) * Math.min(1, current.done / current.total)
    }
    // The bar never moves back, e.g. when a re-scan restarts a phase.
    shown = Math.max(shown, Math.min(1, value / totalWeight))
    return shown
  }

  const render = () => {
    if (!display || !live || paused || !current) return
    lastDraw = now()
    const columns = display.columns()
    const spinner = style.cyan(FRAMES[frame % FRAMES.length] ?? '')
    const pct = Math.floor(fraction() * 100)
    const count = current.total ? ` ${fmt(current.done)}/${fmt(current.total)}` : ''
    const time = seconds(now() - current.started)
    const text = `${current.label}${count}`
    let bar = ''
    if (columns >= MIN_BAR_COLUMNS) {
      const width = Math.max(10, Math.min(BAR_WIDTH, columns - text.length - time.length - 16))
      const filled = Math.round((pct / 100) * width)
      bar = `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${String(pct).padStart(3)}%  `
    }
    // Keep it on one line: cut the text, never the time.
    const room = columns - 1 - 2 - bar.length - time.length - 2
    const shownText = text.length > room ? `${text.slice(0, Math.max(0, room - 1))}…` : text
    display.draw(`${spinner} ${bar}${shownText}  ${style.dim(time)}`)
  }

  const startTimer = () => {
    if (!live || timer) return
    timer = setInterval(() => {
      frame++
      render()
    }, FRAME_MS)
    timer.unref?.()
  }
  const stopTimer = () => {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  const complete = (id: string) => {
    if (finishedIds.has(id)) return
    finishedIds.add(id)
    finishedWeight += weights.get(id) ?? 0
  }

  const progress: Progress = {
    get fraction() {
      return fraction()
    },
    get active() {
      return !finished
    },
    start(id, label, total) {
      if (finished) return
      if (current) complete(current.id)
      current = { id, label, done: 0, total, started: now() }
      if (!display) return
      startTimer()
      render()
    },
    update(done, total, label) {
      if (!current) return
      current.done = done
      if (total !== undefined) current.total = total
      if (label !== undefined) current.label = label
      // The timer redraws, but a long synchronous step blocks it: draw from here too.
      if (now() - lastDraw >= FRAME_MS) render()
    },
    done(text) {
      if (!current) return
      const started = current.started
      complete(current.id)
      current = undefined
      if (!display) return
      // Clear first, so the finished step's live line isn't drawn again under its ✓ line.
      if (live) display.clear()
      if (text) display.line(`${style.green('✓')} ${text} ${style.dim(`(${seconds(now() - started)})`)}`)
    },
    skip(id) {
      complete(id)
    },
    line(text) {
      display?.line(text)
      render()
    },
    detail(text) {
      if (io.verbose) progress.line(style.dim(`  · ${text}`))
    },
    pause() {
      paused = true
      if (live) display?.clear()
    },
    resume() {
      paused = false
      render()
    },
    finish() {
      if (finished) return
      finished = true
      stopTimer()
      if (current) complete(current.id)
      current = undefined
      if (live) display?.clear()
    },
  }
  return progress
}

// --- Scan steps --------------------------------------------------------------------------------

/** Share of a cold scan each phase takes (perf app, 1,808 files: 3.8 s / 2.6 s / 3.4 s for the big three). */
const SCAN_WEIGHTS: Record<ScanPhase, number> = {
  discover: 1,
  load: 38,
  routes: 2,
  components: 26,
  requests: 32,
  flows: 1,
}

/** `live` is shown while the phase runs (its count follows), `done` starts its ✓ line. */
const SCAN_LABELS: Record<ScanPhase, { live: string; done: string }> = {
  discover: { live: 'Finding the project…', done: 'Project' },
  load: { live: 'Loading files and resolving imports…', done: 'Loaded' },
  routes: { live: 'Reading routes…', done: 'Routes' },
  components: { live: 'Walking components… route', done: 'Components' },
  requests: { live: 'Finding requests…', done: 'Requests' },
  flows: { live: 'Inferring flows…', done: 'Flows' },
}

/** Scan steps for a command's plan, scaled to `weight` in total. */
export function scanSteps(weight: number): StepPlan[] {
  const sum = Object.values(SCAN_WEIGHTS).reduce((a, b) => a + b, 0)
  return (Object.keys(SCAN_WEIGHTS) as ScanPhase[]).map((phase) => ({
    id: `scan:${phase}`,
    weight: (SCAN_WEIGHTS[phase] / sum) * weight,
  }))
}

/**
 * Turns scanner events into steps. With `lines: false` (re-scans) finished phases leave no line.
 */
export function scanReporter(progress: Progress, options: { lines?: boolean } = {}) {
  const lines = options.lines !== false
  return (event: ScanProgress) => {
    const labels = SCAN_LABELS[event.phase]
    if (event.finished) {
      progress.done(lines ? `${labels.done}: ${event.detail ?? ''}`.replace(/: $/, '') : undefined)
    } else if (event.done === 0) {
      progress.start(`scan:${event.phase}`, labels.live, event.total)
    } else {
      progress.update(event.done, event.total)
    }
  }
}

// --- Terminal ----------------------------------------------------------------------------------

interface Stream {
  isTTY?: boolean
  columns?: number
  write(text: string): unknown
}

/** Whether a stream gets the live line: a terminal that is not dumb, outside CI, with color. */
export function isLiveTerminal(stream: Stream, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!stream.isTTY) return false
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false
  if (env.TERM === 'dumb') return false
  if (env.CI && env.CI !== 'false' && env.CI !== '0') return false
  return true
}

/**
 * The display for a real terminal. `out` and `err` writes go through `around`, so a live line is
 * removed before other output and drawn again after it.
 */
export function terminalDisplay(stream: Stream, live: boolean) {
  let current = ''
  let cursorHidden = false
  const restore = () => {
    if (current) stream.write('\r\x1b[2K')
    if (cursorHidden) stream.write('\x1b[?25h')
    current = ''
    cursorHidden = false
  }
  if (live) process.once('exit', restore)

  const display: ProgressDisplay = {
    mode: live ? 'live' : 'plain',
    columns: () => stream.columns || 80,
    draw(line) {
      if (!cursorHidden) {
        stream.write('\x1b[?25l')
        cursorHidden = true
      }
      stream.write(`\r\x1b[2K${line}`)
      current = line
    },
    clear() {
      restore()
    },
    line(text) {
      const redraw = current
      if (current) stream.write('\r\x1b[2K')
      stream.write(`${text}\n`)
      if (redraw) stream.write(redraw)
    },
  }

  /** Runs a write that isn't progress output, keeping the live line below it. */
  const around = (write: () => void) => {
    if (!current) return write()
    stream.write('\r\x1b[2K')
    write()
    stream.write(current)
  }
  return { display, around }
}

// --- Formatting --------------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

/** `0.3 s`, `12 s`, `2 m 05 s`. */
export function seconds(ms: number): string {
  const s = Math.max(0, ms) / 1000
  if (s < 10) return `${s.toFixed(1)} s`
  if (s < 60) return `${Math.round(s)} s`
  const m = Math.floor(s / 60)
  return `${m} m ${String(Math.round(s % 60)).padStart(2, '0')} s`
}
