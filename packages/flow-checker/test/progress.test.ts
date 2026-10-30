// M12: progress output. A live line (spinner, bar, step, time) in a terminal, plain lines for
// finished steps elsewhere, nothing without a display (tests, --quiet).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createProgress,
  isLiveTerminal,
  type ProgressDisplay,
  scanReporter,
  scanSteps,
  seconds,
  terminalDisplay,
} from '../src/cli/progress'
import { type CliIO, runCli } from '../src/cli/run'

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes
const ANSI = /\x1b\[[0-9;?]*[a-zA-Z]/

/** A display that records what is drawn and printed. */
function fakeDisplay(mode: 'live' | 'plain', columns = 100) {
  const drawn: string[] = []
  const lines: string[] = []
  let clears = 0
  const display: ProgressDisplay = {
    mode,
    columns: () => columns,
    draw: (line) => drawn.push(line),
    clear: () => {
      clears++
    },
    line: (text) => lines.push(text),
  }
  return { display, drawn, lines, clears: () => clears }
}

function fakeIO(display?: ProgressDisplay, verbose = false) {
  const out: string[] = []
  const err: string[] = []
  const io: CliIO = { out: (t) => out.push(t), err: (t) => err.push(t), display, verbose }
  return { io, out, err }
}

/** A clock the test moves by hand. */
function clock() {
  let t = 0
  return { now: () => t, tick: (ms: number) => (t += ms) }
}

const strip = (s: string) => s.replace(new RegExp(ANSI.source, 'g'), '')

describe('progress', () => {
  it('weights steps and counts inside a step', () => {
    const { display } = fakeDisplay('live')
    const time = clock()
    const p = createProgress(
      fakeIO(display).io,
      [
        { id: 'a', weight: 1 },
        { id: 'b', weight: 3 },
      ],
      time.now,
    )
    expect(p.fraction).toBe(0)
    p.start('a', 'A…')
    p.done()
    expect(p.fraction).toBe(0.25)
    p.start('b', 'B…', 10)
    p.update(5)
    expect(p.fraction).toBeCloseTo(0.625)
    p.done()
    expect(p.fraction).toBe(1)
    p.finish()
  })

  it('never moves the bar back', () => {
    const { display } = fakeDisplay('live')
    const p = createProgress(fakeIO(display).io, [{ id: 'a', weight: 1 }], clock().now)
    p.start('a', 'A…', 10)
    p.update(8)
    const high = p.fraction
    // A phase that starts over (e.g. a re-scan) counts from 0 again.
    p.start('a', 'A…', 10)
    p.update(2)
    expect(p.fraction).toBeGreaterThanOrEqual(high)
    p.finish()
  })

  it('draws spinner, bar, percentage, step count and time on one line', () => {
    const { display, drawn, lines } = fakeDisplay('live', 100)
    const time = clock()
    const p = createProgress(fakeIO(display).io, [{ id: 'req', weight: 1 }], time.now)
    p.start('req', 'Finding requests…', 401)
    time.tick(4200)
    p.update(120)
    const last = strip(drawn.at(-1) ?? '')
    expect(last).toMatch(/^⠋ \[█+░+\] {2}29% {2}Finding requests… 120\/401 {2}4\.2 s$/)
    expect(last.length).toBeLessThan(100)

    time.tick(1000)
    p.done('Requests: 1,000 requests')
    expect(strip(lines.at(-1) ?? '')).toBe('✓ Requests: 1,000 requests (5.2 s)')
    p.finish()
  })

  it('drops the bar on narrow terminals and cuts the text, never the time', () => {
    const { display, drawn } = fakeDisplay('live', 40)
    const time = clock()
    const p = createProgress(fakeIO(display).io, [{ id: 'a', weight: 1 }], time.now)
    p.start('a', 'Loading files and resolving imports… with a very long label')
    const last = strip(drawn.at(-1) ?? '')
    expect(last).not.toContain('[')
    expect(last.length).toBeLessThan(40)
    expect(last).toMatch(/… {2}0\.0 s$/)
    p.finish()
  })

  it('prints only finished steps, without ANSI codes, in plain mode', () => {
    const { display, drawn, lines } = fakeDisplay('plain')
    const p = createProgress(fakeIO(display).io, [{ id: 'a', weight: 1 }], clock().now)
    p.start('a', 'A…', 3)
    p.update(1)
    p.done('A: 3 things')
    p.finish()
    expect(drawn).toEqual([])
    expect(lines).toEqual(['✓ A: 3 things (0.0 s)'])
    expect(lines.join('')).not.toMatch(ANSI)
  })

  it('shows nothing without a display', () => {
    const { io, out, err } = fakeIO(undefined)
    const p = createProgress(io, [{ id: 'a', weight: 1 }])
    p.start('a', 'A…')
    p.line('hello')
    p.detail('detail')
    p.done('A')
    p.finish()
    expect([...out, ...err]).toEqual([])
  })

  it('prints details only with --verbose', () => {
    const quiet = fakeDisplay('plain')
    createProgress(fakeIO(quiet.display, false).io, []).detail('config: x')
    expect(quiet.lines).toEqual([])
    const verbose = fakeDisplay('plain')
    createProgress(fakeIO(verbose.display, true).io, []).detail('config: x')
    expect(verbose.lines).toEqual(['  · config: x'])
  })

  it('hides the live line while paused', () => {
    const { display, drawn, clears } = fakeDisplay('live')
    const p = createProgress(fakeIO(display).io, [{ id: 'a', weight: 1 }], clock().now)
    p.start('a', 'A…', 2)
    p.pause()
    const before = drawn.length
    expect(clears()).toBeGreaterThan(0)
    p.update(1)
    expect(drawn).toHaveLength(before)
    p.resume()
    expect(drawn.length).toBeGreaterThan(before)
    p.finish()
    expect(p.active).toBe(false)
  })

  it('turns scan events into steps', () => {
    const { display, lines } = fakeDisplay('plain')
    const p = createProgress(fakeIO(display).io, scanSteps(100), clock().now)
    const report = scanReporter(p)
    report({ phase: 'load', done: 0 })
    report({ phase: 'load', done: 10, total: 10, finished: true, detail: '10 files' })
    report({ phase: 'components', done: 0, total: 4 })
    report({ phase: 'components', done: 2, total: 4 })
    expect(p.fraction).toBeGreaterThan(0.38)
    report({ phase: 'components', done: 4, total: 4, finished: true, detail: '7 components' })
    expect(lines).toEqual(['✓ Loaded: 10 files (0.0 s)', '✓ Components: 7 components (0.0 s)'])

    // Re-scans leave no lines.
    const rescan = fakeDisplay('plain')
    const report2 = scanReporter(createProgress(fakeIO(rescan.display).io, scanSteps(100)), { lines: false })
    report2({ phase: 'load', done: 0 })
    report2({ phase: 'load', done: 1, total: 1, finished: true, detail: '1 changed file' })
    expect(rescan.lines).toEqual([])
  })

  it('scan weights add up to the given total', () => {
    expect(scanSteps(70).reduce((sum, s) => sum + s.weight, 0)).toBeCloseTo(70)
  })

  it('formats times', () => {
    expect(seconds(250)).toBe('0.3 s')
    expect(seconds(12_400)).toBe('12 s')
    expect(seconds(125_000)).toBe('2 m 05 s')
  })
})

describe('terminal display', () => {
  const stream = (isTTY: boolean) => {
    const writes: string[] = []
    return { writes, s: { isTTY, columns: 80, write: (t: string) => writes.push(t) } }
  }

  it('is live only in a real, non-CI terminal with color', () => {
    expect(isLiveTerminal(stream(true).s, {})).toBe(true)
    expect(isLiveTerminal(stream(false).s, {})).toBe(false)
    expect(isLiveTerminal(stream(true).s, { NO_COLOR: '1' })).toBe(false)
    expect(isLiveTerminal(stream(true).s, { TERM: 'dumb' })).toBe(false)
    expect(isLiveTerminal(stream(true).s, { CI: 'true' })).toBe(false)
  })

  it('keeps the live line below other output', () => {
    const { s, writes } = stream(true)
    const { display, around } = terminalDisplay(s, true)
    display.draw('⠋ working')
    around(() => s.write('[app] ready\n'))
    // Cleared, the other output, then the live line again.
    expect(writes.slice(-3)).toEqual(['\r\x1b[2K', '[app] ready\n', '⠋ working'])
    display.clear()
    expect(writes.join('')).toContain('\x1b[?25h')
  })
})

describe('commands', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })
  const project = () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-checker-progress-'))
    dirs.push(dir)
    mkdirSync(join(dir, 'app'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), '{}')
    writeFileSync(join(dir, 'app', 'page.tsx'), 'export default function Home() { return null }\n')
    return dir
  }

  it('scan prints each phase in plain mode, and only results with --quiet', async () => {
    const root = project()
    const plain = fakeDisplay('plain')
    const io = fakeIO(plain.display)
    expect(await runCli(['scan', '--root', root], io.io)).toBe(0)
    expect(plain.lines.map((l) => l.replace(/ \(\d+\.\d s\)$/, ''))).toEqual([
      '✓ Project: app',
      '✓ Loaded: 1 file',
      '✓ Routes: 1 page, 0 route handlers',
      '✓ Components: 1 component',
      '✓ Requests: 0 requests',
      '✓ Flows: 0 flows, 0 types',
    ])
    expect(io.out.some((l) => l.startsWith('Scanned 1 page'))).toBe(true)

    const quiet = fakeDisplay('plain')
    const qio = fakeIO(quiet.display)
    expect(await runCli(['scan', '--root', root, '--quiet'], qio.io)).toBe(0)
    expect(quiet.lines).toEqual([])
    expect(qio.out.some((l) => l.startsWith('Scanned 1 page'))).toBe(true)
  }, 20_000)

  it('scan --verbose prints the resolved config', async () => {
    const root = project()
    const plain = fakeDisplay('plain')
    expect(await runCli(['scan', '--root', root, '--verbose'], fakeIO(plain.display).io)).toBe(0)
    expect(plain.lines).toContain('  · config: none (defaults)')
    expect(plain.lines.some((l) => l.startsWith('  · scan runs in'))).toBe(true)
  }, 20_000)

  it('live mode clears its line when the command ends', async () => {
    const root = project()
    const live = fakeDisplay('live')
    expect(await runCli(['scan', '--root', root], fakeIO(live.display).io)).toBe(0)
    expect(live.drawn.length).toBeGreaterThan(0)
    expect(live.clears()).toBeGreaterThan(0)
  }, 20_000)

  it('doctor streams each check and ends without a live line', async () => {
    const root = project()
    const live = fakeDisplay('live')
    const io = fakeIO(live.display)
    await runCli(['doctor', '--root', root, '--port', '0', '--app-port', '0'], io.io)
    expect(io.out[0]).toContain('flow-checker doctor:')
    expect(io.out.some((l) => /^ {2}[✓!✗] Node\.js/.test(l))).toBe(true)
    expect(live.drawn.some((l) => strip(l).includes('Running checks…'))).toBe(true)
  }, 20_000)
})
