// M45: the static export of the env fixture has an Env screen with every name, its reads and flags,
// page views list the names each page reads, the overview's To check links each flag to its page,
// and no value from the fixture's `.env` files is anywhere in the export.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'

const repo = resolve(import.meta.dirname, '..')

interface ExportedRoute {
  id: string
  path: string
  kind: string
}

function exportSite(): { site: string; routes: ExportedRoute[]; output: string } {
  const site = join(mkdtempSync(join(tmpdir(), 'fc-e2e-env-')), 'site')
  const result = spawnSync(
    process.execPath,
    [join(repo, 'packages/flow-checker/dist/cli.js'), 'export', '--root', 'fixtures/env', '--html', site],
    { cwd: repo, encoding: 'utf8' },
  )
  expect(result.status, result.stderr).toBe(0)
  const script = readFileSync(join(site, 'data.js'), 'utf8')
  const data = JSON.parse(script.slice(script.indexOf('{'), script.lastIndexOf('}') + 1))
  return { site, routes: data.model.routes, output: `${result.stdout}\n${result.stderr}` }
}

function allText(dir: string): string {
  return readdirSync(dir)
    .map((name) => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? allText(path) : readFileSync(path, 'utf8')
    })
    .join('\n')
}

test('the Env screen and page views show environment variables in the static export', async ({ page }) => {
  const { site, routes, output } = exportSite()
  expect(`${output}\n${allText(site)}`).not.toContain('fixture-value-')

  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const base = pathToFileURL(join(site, 'index.html')).href
  const id = (path: string) => routes.find((r) => r.kind === 'page' && r.path === path)?.id ?? ''

  // The Env screen, from the top bar.
  await page.goto(`${base}#/overview`)
  await page.getByRole('navigation').getByRole('link', { name: 'Env', exact: true }).click()
  await expect(page).toHaveURL(/#\/env$/)
  const main = page.locator('main')
  await expect(main.getByRole('heading', { name: 'Environment variables', exact: true })).toBeVisible()
  await expect(main.locator('[data-section="to-check"] [data-env-flag]')).toHaveCount(4)
  await expect(main.locator('[data-env-file=".env.example"]')).toContainText("never (Next doesn't load it)")

  // A page view lists the names its code reads, with the flag that is about it.
  await page.goto(`${base}#/page/${encodeURIComponent(id('/checkout'))}`)
  const section = page.locator('section', {
    has: page.getByRole('heading', { name: 'Environment variables', exact: true }),
  })
  await expect(section.locator('[data-env="STRIPE_SECRET_KEY"]')).toContainText('private name in client code')
  await page.goto(`${base}#/page/${encodeURIComponent(id('/'))}`)
  await expect(section.locator('[data-env="API_URL"]')).toBeVisible()
  await expect(section).not.toContainText('private name in client code')

  // Each flag is on the overview's To check list, linked to its page.
  await page.goto(`${base}#/overview`)
  await page.locator('.note-group a', { hasText: 'is destructured from' }).click()
  await expect(page).toHaveURL(new RegExp(`#/page/${id('/about')}$`))

  // The glossary explains the words.
  await page.goto(`${base}#/glossary`)
  await expect(main).toContainText('Environment variables')
  await expect(main).toContainText('private name in client code')

  expect(errors).toEqual([])
})
