// M34: plain wording. Badges explain themselves, the page view shows fewer of them until "Show
// details" is on (remembered across reloads), and the Glossary screen works live and in the export.
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, type Page, test } from '@playwright/test'
import { PORTS } from '../playwright.config'

const repo = resolve(import.meta.dirname, '..')
const dashboard = `http://127.0.0.1:${PORTS.dashboard}`

async function openLoginPage(page: Page, start: string) {
  await page.goto(start)
  await expect(page.locator('main')).not.toContainText('Loading scan')
  await page.keyboard.press('ControlOrMeta+k')
  await page.keyboard.type('/[locale]/login')
  await expect(page.getByRole('option').first()).toContainText('/[locale]/login')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/page\/rt_/)
  await expect(page.locator('main')).toContainText('LoginForm')
}

async function checkWording(page: Page, start: string) {
  await openLoginPage(page, start)
  const toggle = page.getByRole('button', { name: /details/ })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  const badges = page.locator('main .badge')
  const fewer = await badges.count()

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => badges.count()).toBeGreaterThan(fewer)
  // A trigger badge says what it means.
  const trigger = page.locator('main [data-term^="trigger:"]').first()
  await expect(trigger).toHaveAttribute('title', /Sent/)

  // Remembered after a reload.
  await page.reload()
  await expect(page.locator('main')).toContainText('LoginForm')
  await expect(page.getByRole('button', { name: /details/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /details/ }).click()
  await expect(page.getByRole('button', { name: /details/ })).toHaveAttribute('aria-pressed', 'false')

  // The Glossary screen: from the top bar, searchable, and a link to one word highlights it.
  await page.getByRole('navigation').getByRole('link', { name: 'Glossary' }).click()
  await expect(page.getByRole('heading', { name: 'Glossary' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search words' }).fill('apiClients')
  await expect(page.locator('#flag-dynamic-url')).toContainText('What to do')
  await expect(page.locator('#flag-stale')).toHaveCount(0)
  await page.goto(`${start.replace(/#.*$/, '')}#/glossary?term=flag-stale`)
  await expect(page.locator('#flag-stale')).toHaveClass(/selected/)
}

test('badges explain themselves and the Glossary lists every word', async ({ page }) => {
  await checkWording(page, `${dashboard}/#/`)
})

test('plain wording works in the static export', async ({ page }) => {
  const site = join(mkdtempSync(join(tmpdir(), 'fc-e2e-glossary-')), 'site')
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
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await checkWording(page, `${pathToFileURL(join(site, 'index.html')).href}#/`)
  expect(errors).toEqual([])
})
