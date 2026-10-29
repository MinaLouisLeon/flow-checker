// Performance on a large repo (docs/PLAN.md M11). Generates a synthetic App Router project,
// then measures with the built CLI:
//
//   cold scan    `flow-checker scan`, wall time and peak memory as reported by the scan
//   re-scan      `flow-checker dev --no-app`, after editing one component (median of 5 edits)
//   responsive   the dashboard API's slowest answer while those re-scans run
//
// Run after `pnpm build`:
//   node scripts/perf/bench.mjs [features=200] [--json]
// Budgets (fails when exceeded): FLOW_CHECKER_BUDGET_SCAN_MS, _RESCAN_MS, _API_MS.
import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { generateApp } from './generate-app.mjs'

const repo = resolve(import.meta.dirname, '..', '..')
const cli = join(repo, 'packages', 'flow-checker', 'dist', 'cli.js')
const args = process.argv.slice(2)
const features = Number(args.find((a) => /^\d+$/.test(a)) ?? 200)
const json = args.includes('--json')
const isWin = process.platform === 'win32'

const dir = mkdtempSync(join(tmpdir(), 'flow-checker-perf-'))
const result = { features }
try {
  result.files = generateApp(dir, features)

  // Cold scan.
  const started = performance.now()
  const scan = spawnSync(process.execPath, [cli, 'scan', '--root', dir], { encoding: 'utf8' })
  result.coldScanMs = Math.round(performance.now() - started)
  if (scan.status !== 0) throw new Error(`scan failed:\n${scan.stdout}${scan.stderr}`)
  result.summary = scan.stdout.match(/Scanned .*/)?.[0]
  result.scanReportedMs = Number(scan.stdout.match(/in (\d+) ms/)?.[1])

  // Re-scans in dev.
  const port = await freePort()
  const dev = spawn(
    process.execPath,
    [cli, 'dev', '--root', dir, '--no-app', '--no-open', '--port', String(port)],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: !isWin,
    },
  )
  const lines = []
  const waiters = []
  for (const stream of [dev.stdout, dev.stderr]) {
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => {
      for (const line of chunk.split(/\r?\n/).filter(Boolean)) {
        lines.push(line)
        for (const w of waiters.splice(0)) w.test(line) ? w.done(line) : waiters.push(w)
      }
    })
  }
  const nextLine = (re, timeoutMs = 120_000) =>
    new Promise((done, fail) => {
      const timer = setTimeout(
        () => fail(new Error(`Timed out waiting for ${re}\n${lines.slice(-20).join('\n')}`)),
        timeoutMs,
      )
      waiters.push({
        test: (l) => re.test(l),
        done: (l) => {
          clearTimeout(timer)
          done(l)
        },
      })
    })

  try {
    const startedDev = performance.now()
    await nextLine(/Watching for file changes/)
    result.devStartMs = Math.round(performance.now() - startedDev)
    // Let the warm-up (first program rebuild) finish before editing.
    await sleep(Math.max(3000, result.scanReportedMs))

    // Poll the API while re-scanning to see how long it stays unanswered.
    let polling = true
    let slowestApiMs = 0
    const poll = (async () => {
      while (polling) {
        const t = performance.now()
        await fetch(`http://127.0.0.1:${port}/api/health`).catch(() => {})
        slowestApiMs = Math.max(slowestApiMs, performance.now() - t)
        await sleep(20)
      }
    })()

    const rescans = []
    const file = join(dir, 'src', 'features', 'f1', 'Feature1Form.tsx')
    for (let i = 0; i < 5; i++) {
      const done = nextLine(/Re-scanned in (\d+) ms/)
      appendFileSync(file, `\nexport const edit${i} = ${i}\n`)
      rescans.push(Number((await done).match(/in (\d+) ms/)[1]))
      await sleep(300)
    }
    polling = false
    await poll
    rescans.sort((a, b) => a - b)
    result.rescanMs = { median: rescans[2], max: rescans[4], all: rescans }
    result.slowestApiMs = Math.round(slowestApiMs)
  } finally {
    stop(dev)
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (json) console.log(JSON.stringify(result, null, 2))
else {
  console.log(`Synthetic app: ${features} features, ${result.files} files`)
  console.log(`  ${result.summary}`)
  console.log(`  cold scan (process):  ${result.coldScanMs} ms`)
  console.log(`  dev start to watching: ${result.devStartMs} ms`)
  console.log(`  re-scan after an edit: median ${result.rescanMs.median} ms, max ${result.rescanMs.max} ms`)
  console.log(`  slowest API answer during re-scans: ${result.slowestApiMs} ms`)
}

const budgets = [
  ['FLOW_CHECKER_BUDGET_SCAN_MS', result.scanReportedMs, 'scan'],
  ['FLOW_CHECKER_BUDGET_RESCAN_MS', result.rescanMs.median, 're-scan'],
  ['FLOW_CHECKER_BUDGET_API_MS', result.slowestApiMs, 'API answer'],
]
for (const [env, value, what] of budgets) {
  const budget = Number(process.env[env])
  if (budget && value > budget) {
    console.error(`✗ ${what} took ${value} ms, over the ${budget} ms budget (${env})`)
    process.exitCode = 1
  }
}

function stop(child) {
  if (child.exitCode !== null) return
  try {
    if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    else process.kill(-child.pid, 'SIGTERM')
  } catch {}
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function freePort() {
  return new Promise((done) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => done(port))
    })
  })
}
