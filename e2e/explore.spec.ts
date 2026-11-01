// M28: `flow-checker explore` on a fresh copy of a fixture (no config, no hooks, no
// .flow-checker/) opens a working dashboard whose Live screen explains how to turn capture on,
// and the copy stays untouched.
import { type ChildProcess, spawn } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const repo = resolve(import.meta.dirname, '..')
const NOT_IN_CLONE =
  /^(\.flow-checker|\.next|node_modules|AGENTS\.md|flow-checker\.config\.\w+|instrumentation(-client)?\.\w+)$/

/**
 * Links each installed package by its real path, not the whole `node_modules` folder. pnpm links
 * packages with relative symlinks on GitHub's Windows runners, and Windows resolves a relative link
 * reached through a junction from the junction's side, so through one folder link no package
 * (axios, next) resolved from the copy there. Same as `flow-checker/test/summary.test.ts`.
 */
function linkPackages(from: string, to: string) {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.name === '.bin' || entry.name === '.pnpm' || entry.isFile()) continue
    const source = join(from, entry.name)
    if (entry.name.startsWith('@')) linkPackages(source, join(to, entry.name))
    else symlinkSync(realpathSync(source), join(to, entry.name), 'junction')
  }
}

let child: ChildProcess | undefined
/** Removed after each test: the fixture copy and explore's data folder. */
const cleanup: string[] = []

test.afterEach(async () => {
  const running = child
  child = undefined
  if (running && running.exitCode === null) {
    const exited = new Promise((done) => running.once('exit', done))
    running.kill()
    await exited
  }
  for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Starts the built CLI's explore on a fresh copy and resolves with the dashboard URL. */
function explore(root: string): Promise<{ url: string; output: () => string }> {
  let output = ''
  const cli = join(repo, 'packages/flow-checker/dist/cli.js')
  child = spawn(process.execPath, [cli, 'explore', '--root', root, '--no-open', '--port', '0'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error(`explore didn't start:\n${output}`)), 90_000)
    const read = (chunk: Buffer) => {
      output += chunk.toString()
      const url = /Next: open (http:\/\/127\.0\.0\.1:\d+) in your browser. Start here/.exec(output)?.[1]
      if (url) {
        clearTimeout(timer)
        done({ url, output: () => output })
      }
    }
    child?.stdout?.on('data', read)
    child?.stderr?.on('data', read)
    child?.once('exit', (code) => fail(new Error(`explore exited with ${code}:\n${output}`)))
  })
}

test('explore opens the dashboard on a project with no setup', async ({ page }) => {
  const tmp = mkdtempSync(join(tmpdir(), 'flow-checker-explore-e2e-'))
  cleanup.push(tmp)
  const from = join(repo, 'fixtures/basic')
  const root = join(tmp, 'basic')
  cpSync(from, root, { recursive: true, filter: (src) => !NOT_IN_CLONE.test(basename(src)) })
  linkPackages(join(from, 'node_modules'), join(root, 'node_modules'))
  const before = readdirSync(root).sort()

  const { url, output } = await explore(root)
  const dataDir = /the scan is kept in (.+), outside the project\./.exec(output())?.[1]
  expect(dataDir).toBeTruthy()
  if (dataDir) cleanup.push(dataDir)

  // Start here (M32) is the first screen, with the capture hint since capture is off.
  await page.goto(`${url}/#/`)
  await expect(page.getByTestId('start-stack')).toContainText('Next.js')
  await expect(page.getByTestId('capture-hint')).toBeVisible()
  await page.locator('.nav').getByRole('link', { name: 'Overview' }).click()
  await expect(page.locator('.stats .stat').first()).toBeVisible()
  await page.locator('.nav').getByRole('link', { name: 'Map' }).click()
  await expect(page).toHaveURL(/#\/map/)

  await page.locator('.nav').getByRole('link', { name: 'Live' }).click()
  const hint = page.getByTestId('capture-hint')
  await expect(hint).toContainText('Capture is off')
  await expect(hint.locator('code').last()).toHaveText('npx flow-checker')
  await expect(hint).toContainText('outside the project')

  // Walk the app (M35) is a reading guide here: the steps, how to turn capture on, no app links.
  await page.locator('.nav').getByRole('link', { name: 'Walk the app' }).click()
  await expect(page.getByTestId('capture-hint')).toContainText('Capture is off')
  const walk = page.getByTestId('walk-item').filter({ hasText: 'DeleteUserButton click' })
  await expect(walk).toContainText('Click in DeleteUserButton on /users/[id]')
  await expect(walk.locator('[data-done]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Open in app/ })).toHaveCount(0)

  expect(readdirSync(root).sort()).toEqual(before)
  expect(existsSync(join(root, '.flow-checker'))).toBe(false)
})
