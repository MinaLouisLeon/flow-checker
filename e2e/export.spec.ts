// M10: the static HTML export runs the dashboard read-only from embedded data, with no tool
// server, even when index.html is opened straight from disk. The export uses the captures that
// capture.spec.ts left in fixtures/next-intl/.flow-checker.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'
import { PORTS } from '../playwright.config'

const repo = resolve(import.meta.dirname, '..')

function exportSite(): string {
  const out = join(mkdtempSync(join(tmpdir(), 'fc-e2e-export-')), 'site')
  const result = spawnSync(
    process.execPath,
    [
      join(repo, 'packages/flow-checker/dist/cli.js'),
      'export',
      '--root',
      'fixtures/next-intl',
      '--html',
      out,
    ],
    { cwd: repo, encoding: 'utf8' },
  )
  expect(result.status, result.stderr).toBe(0)
  return out
}

test('the exported site opens from disk and shows the scan, captures and flows', async ({ page }) => {
  const site = exportSite()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) => errors.push(`${request.url()} ${request.failure()?.errorText}`))

  await page.goto(`${pathToFileURL(join(site, 'index.html')).href}#/`)
  await expect(page).toHaveTitle('next-intl · flow-checker')
  await expect(page.locator('.topbar')).toContainText('next-intl · exported')
  // Read-only: nothing that needs the tool server.
  await expect(page.getByRole('button', { name: 'Re-scan' })).toHaveCount(0)
  await expect(page.locator('.nav')).not.toContainText('Export')

  // Captures from the embedded data, with no assign or record controls.
  await page.locator('.nav a', { hasText: 'Captures' }).click()
  const row = page.locator('.capture-list li', { hasText: '/auth/login' }).first()
  await expect(row).toBeVisible()
  await expect(page.getByRole('button', { name: /Record/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Clear' })).toHaveCount(0)
  await row.locator('a.capture-link').click()
  const detail = page.locator('.capture-detail')
  await expect(detail).toContainText('"password": "[REDACTED:string]"')
  await expect(detail).toContainText('✓ matched')
  await expect(detail.locator('.match-assign')).toHaveCount(0)

  // The login flow was walked in the recorded sessions.
  await page.locator('.nav a', { hasText: 'Flows' }).click()
  await expect(page.locator('main')).toContainText('LoginForm submit')
  await expect(page.getByRole('button', { name: 'Rename' })).toHaveCount(0)

  expect(errors).toEqual([])
})

test('the Export screen writes the static site from the running dashboard', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${PORTS.dashboard}/#/export`)
  await expect(page.locator('main')).toContainText('.flow-checker/site')
  await page.getByRole('button', { name: 'Export Static HTML site' }).click()
  await expect(page.locator('.banner-ok')).toContainText('to .flow-checker/site (open index.html)')
  const html = readFileSync(join(repo, 'fixtures/next-intl/.flow-checker/site/index.html'), 'utf8')
  expect(html).toContain('<script src="./data.js"></script>')
})
