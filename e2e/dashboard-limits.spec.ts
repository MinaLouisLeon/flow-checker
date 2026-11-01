// M23: the dashboard stays small and readable on a big app. A static export of next-intl gets a
// synthetic model (200 queries on one page and cache calls that hit all of them, a navigation in
// a shared hook, a catch-all route handler with many callers, generic types), then the page view
// is measured and the folded rows and scroll behaviour are checked.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, type Page, test } from '@playwright/test'
import { SYNTHETIC, syntheticModel } from '../packages/dashboard/test/synthetic'

const repo = resolve(import.meta.dirname, '..')
const PAGE_PATH = '/[locale]/dashboard'

let site: string
let pageId: string

test.beforeAll(() => {
  site = join(mkdtempSync(join(tmpdir(), 'fc-e2e-limits-')), 'site')
  const result = spawnSync(
    process.execPath,
    [
      join(repo, 'packages/flow-checker/dist/cli.js'),
      'export',
      '--root',
      'fixtures/next-intl',
      '--html',
      site,
    ],
    { cwd: repo, encoding: 'utf8' },
  )
  expect(result.status, result.stderr).toBe(0)
  const file = join(site, 'data.js')
  const text = readFileSync(file, 'utf8')
  const start = text.indexOf('{')
  const data = JSON.parse(text.slice(start, text.lastIndexOf('}') + 1))
  data.model = syntheticModel(data.model, { pagePath: PAGE_PATH })
  pageId = data.model.routes.find((r: { path: string }) => r.path === PAGE_PATH).id
  writeFileSync(file, `${text.slice(0, start)}${JSON.stringify(data).replace(/</g, '\\u003c')};\n`)
})

const open = (page: Page, hash: string) => page.goto(`${pathToFileURL(join(site, 'index.html')).href}${hash}`)

test('a page with 200 queries and cache calls that hit all of them stays under 5,000 DOM nodes', async ({
  page,
}) => {
  await open(page, `#/page/${pageId}`)
  const cache = page.locator('.section', { has: page.locator('h2', { hasText: 'Query cache' }) })
  await expect(cache).toBeVisible()
  // Five cache calls, then "+N more"; each shows five targets, then "+195 more".
  await expect(cache.locator('.query-links > li:not(.more-row)')).toHaveCount(5)
  await expect(cache.locator('.query-links > .more-row')).toHaveText('+4 more')
  await expect(cache.getByRole('button', { name: '+195 more' })).toHaveCount(5)

  const nodes = await page.evaluate(() => document.querySelectorAll('*').length)
  expect(nodes).toBeLessThan(5000)

  // Expanding works, and a call with no key reads "every query" instead of listing them.
  await cache.locator('.query-links > .more-row button').click()
  await expect(cache).toContainText('→ every query')
  await cache.getByRole('button', { name: '+195 more' }).first().click()
  await expect(cache.getByRole('button', { name: '+195 more' })).toHaveCount(7)

  // Page-load requests: the first rows, then "+N more".
  const load = page.locator('.section', { has: page.locator('h2', { hasText: 'Page-load requests' }) })
  await expect(load.locator('.requests > .more-row')).toContainText('more')
})

test('a navigation in a shared hook is one row', async ({ page }) => {
  await open(page, `#/page/${pageId}`)
  const leaves = page.locator('.section', { has: page.locator('h2', { hasText: 'Leaves this page' }) })
  const row = leaves.locator('.nav-list > li', { hasText: SYNTHETIC.hookFile })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('from 12 components')
})

test('a route handler lists what it sends first, then callers by URL, folded by line', async ({ page }) => {
  await open(page, '#/map?view=handlers')
  await page.locator('.handler-list a', { hasText: SYNTHETIC.handlerPath }).click()
  // allTextContents() doesn't wait: wait for the handler screen before reading its headings.
  await expect(page.locator('.section h2', { hasText: 'Called from' })).toBeVisible()
  const titles = await page.locator('.section h2').allTextContents()
  expect(titles.indexOf('Requests it sends')).toBeLessThan(titles.indexOf('Called from'))

  const groups = page.locator('.caller-group')
  await expect(groups).toHaveCount(2)
  await expect(groups.nth(0).locator('.caller-url')).toContainText('POST/api/auth/login')
  await expect(groups.nth(0).locator('.callers > li')).toHaveCount(1)
  await expect(groups.nth(0).locator('.callers > li')).toContainText('from 12 components')
  await expect(groups.nth(1).locator('.callers > li')).toHaveCount(2)

  await page.getByRole('searchbox', { name: 'Search callers by URL, component or file' }).fill('reviews')
  await expect(groups).toHaveCount(1)
})

test('generic instantiations fold under their generic, unused types behind a toggle', async ({ page }) => {
  await open(page, '#/types')
  const generic = page.locator('.type-group', { hasText: `${SYNTHETIC.generic}<…>` })
  await expect(generic).toContainText('2 instantiations')
  await expect(page.locator('.type-list')).not.toContainText('NeverUsed')
  await page.getByLabel(/Show unused/).check()
  await expect(page).toHaveURL(/#\/types\?all=1$/)
  await expect(generic).toContainText('3 instantiations')
  await expect(page.locator('.type-list')).toContainText('NeverUsed')
})

test('a new screen opens at the top; back returns to the scrolled position', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 600 })
  await open(page, '#/requests')
  await expect(page.locator('.request-list > li').first()).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 1500))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1500)

  await page.locator('.nav a', { hasText: 'Types' }).click()
  await expect(page).toHaveURL(/#\/types$/)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  await page.goBack()
  await expect(page).toHaveURL(/#\/requests$/)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1500)

  // A toggle (replaceScreen) keeps the position. Clicked from script: a pointer click would first
  // scroll the toolbar into view.
  await page.getByRole('button', { name: /On load/ }).evaluate((button: HTMLElement) => button.click())
  await expect(page).toHaveURL(/when=load/)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1500)
})
