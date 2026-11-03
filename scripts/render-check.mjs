// Compares each fixture's scanned render mode (M38) with what `next build` prints for its pages.
// Run after `pnpm build`: node scripts/render-check.mjs [fixture ...]  (default: every fixture)
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareRenderModes, readBuildTable } from './next-build-table.mjs'

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
  const built = readBuildTable(out)
  const scan = spawnSync(
    process.execPath,
    [join(repo, 'packages/flow-checker/dist/cli.js'), 'scan', '--quiet', '--root', dir],
    { encoding: 'utf8' },
  )
  if (scan.status !== 0) throw new Error(`scan failed on ${name}: ${scan.stderr}`)
  const model = JSON.parse(readFileSync(join(dir, '.flow-checker/model.json'), 'utf8'))
  const problems = compareRenderModes(model, built)
  if (problems.length > 0) failed++
  console.log(
    `${problems.length > 0 ? '✗' : '✓'} ${name}: ${built.size} pages${problems.map((p) => `\n    ${p}`).join('')}`,
  )
}
process.exit(failed > 0 ? 1 : 0)
