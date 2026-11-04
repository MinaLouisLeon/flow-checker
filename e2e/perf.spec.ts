// M47: the static export of the perf fixture has a Perf screen with every finding, page views list the
// findings that slow each page down (steps behind the details switch), the overview's To check links
// each one to its page, and the glossary explains the words.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
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

function exportSite(): { site: string; routes: ExportedRoute[] } {
  const site = join(mkdtempSync(join(tmpdir(), 'fc-e2e-perf-')), 'site')
  const result = spawnSync(
    process.execPath,
    [join(repo, 'packages/flow-checker/dist/cli.js'), 'export', '--root', 'fixtures/perf', '--html', site],
    { cwd: repo, encoding: 'utf8' },
  )
  expect(result.status, result.stderr).toBe(0)
  const script = readFileSync(join(site, 'data.js'), 'utf8')
  const data = JSON.parse(script.slice(script.indexOf('{'), script.lastIndexOf('}') + 1))
  return { site, routes: data.model.routes }
}

test('the Perf screen and page views show request performance in the static export', async ({ page }) => {
  const { site, routes } = exportSite()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const base = pathToFileURL(join(site, 'index.html')).href
  const id = (path: string) => routes.find((r) => r.kind === 'page' && r.path === path)?.id ?? ''

  // The Perf screen, from the top bar.
  await page.goto(`${base}#/overview`)
  await page.getByRole('navigation').getByRole('link', { name: 'Perf', exact: true }).click()
  await expect(page).toHaveURL(/#\/perf$/)
  const main = page.locator('main')
  await expect(main.getByRole('heading', { name: 'Request performance', exact: true })).toBeVisible()
  await expect(main.locator('[data-perf]')).toHaveCount(5)
  await expect(main).toContainText('1 waterfall · 3 N+1 · 1 duplicate')
  // Timings come from the captures in `.flow-checker/`, when the fixture was run.
  await expect(main.getByRole('heading', { name: 'Slowest endpoints' })).toBeVisible()

  // A page view lists its finding; the steps show with details on.
  await page.goto(`${base}#/page/${encodeURIComponent(id('/'))}`)
  const section = page.locator('section', {
    has: page.getByRole('heading', { name: 'Request performance', exact: true }),
  })
  await expect(section.locator('[data-perf="waterfall"]')).toContainText('waits for getUser(1)')
  await expect(section).not.toContainText('await getUser(1)')
  await page
    .getByRole('button', { name: /details/i })
    .first()
    .click()
  await expect(section).toContainText('await getUser(1)')

  // Each finding is on the overview's To check list, linked to its page.
  await page.goto(`${base}#/overview`)
  await page.locator('.note-group a', { hasText: 'TodoRow' }).click()
  await expect(page).toHaveURL(new RegExp(`#/page/${id('/todos')}$`))

  // The glossary explains the words.
  await page.goto(`${base}#/glossary`)
  await expect(main).toContainText('Request performance')
  await expect(main).toContainText('N+1')

  expect(errors).toEqual([])
})
