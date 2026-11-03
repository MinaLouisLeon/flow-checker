// Compares each fixture's scanned render mode (M38) with what `next build` prints for its pages.
// Run after `pnpm build`: node scripts/render-check.mjs [fixture ...]  (default: every fixture)
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(fileURLToPath(import.meta.url), '../..')
const fixtures = join(repo, 'fixtures')
const names =
  process.argv.length > 2
    ? process.argv.slice(2)
    : readdirSync(fixtures).filter(
        // Only the Next.js apps (`mock-api` is a plain server the fixtures call).
        (n) =>
          statSync(join(fixtures, n)).isDirectory() && existsSync(join(fixtures, n, 'node_modules/next')),
      )

// `next build` symbols: ○ static, ● SSG (generateStaticParams), ◐ partial, ƒ dynamic.
const SYMBOLS = { '○': 'static', '●': 'static', '◐': 'partial', ƒ: 'dynamic' }

let failed = 0
for (const name of names) {
  const dir = join(fixtures, name)
  const build = spawnSync(process.execPath, [join(dir, 'node_modules/next/dist/bin/next'), 'build'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', FLOW_CHECKER: '' },
  })
  const out = `${build.stdout}\n${build.stderr}`
  if (build.status !== 0) {
    console.log(`? ${name}: next build failed\n${out.split('\n').slice(-15).join('\n')}`)
    failed++
    continue
  }
  const built = readTable(out)
  const scan = spawnSync(
    process.execPath,
    [join(repo, 'packages/flow-checker/dist/cli.js'), 'scan', '--quiet', '--root', dir],
    { encoding: 'utf8' },
  )
  if (scan.status !== 0) throw new Error(`scan failed on ${name}: ${scan.stderr}`)
  const model = JSON.parse(readFileSync(join(dir, '.flow-checker/model.json'), 'utf8'))
  const problems = []
  for (const route of model.routes) {
    if (route.kind !== 'page' || route.slot || route.intercepting) continue
    const next = built.get(route.path)
    if (!next) continue
    const ours = route.render?.mode === 'isr' ? 'static' : route.render?.mode
    const time = route.render?.revalidate
    if (ours !== next.mode) problems.push(`${route.path}: scan ${route.render?.mode}, next ${next.mode}`)
    else if (next.revalidate && time === undefined)
      problems.push(`${route.path}: next revalidates ${next.revalidate}`)
  }
  if (problems.length > 0) failed++
  console.log(
    `${problems.length > 0 ? '✗' : '✓'} ${name}: ${built.size} pages${problems.map((p) => `\n    ${p}`).join('')}`,
  )
}
process.exit(failed > 0 ? 1 : 0)

/** Route path -> mode and revalidate column, from the `Route (app)` table. */
function readTable(out) {
  const rows = new Map()
  const start = out.indexOf('Route (app)')
  for (const line of out.slice(start).split('\n').slice(1)) {
    // A page with `generateStaticParams` prints without a symbol, its prerendered params below it.
    // With Cache Components a page with params prints the same way, its own mode on the row below.
    const m = /^[┌├└│ ]+([○●◐ƒ])?\s*(\/\S*)(.*)$/.exec(line)
    if (!m) {
      if (/^\s*$/.test(line)) break
      continue
    }
    const [, symbol, path, rest] = m
    const known = rows.get(path)
    if (path === '/_not-found' || (known && (known.symbol || !symbol))) continue
    // Next 15 also prints size columns (`3.46 kB`): the revalidate column is the first duration.
    const revalidate = rest.split(/\s+/).find((cell) => /^\d+(s|m|h|d|w|y)$/.test(cell))
    rows.set(path, {
      mode: symbol ? SYMBOLS[symbol] : 'static',
      symbol: Boolean(symbol),
      ...(revalidate ? { revalidate } : {}),
    })
  }
  return rows
}
