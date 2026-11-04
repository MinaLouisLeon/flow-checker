// M44: the static export of the leaks fixture shows each page's server/client leaks, links each one from
// the overview's To check list to its page, and the glossary explains the words. No running app needed
// (the fixture's planted pages fail `next dev` and `next build` on purpose).
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
  const site = join(mkdtempSync(join(tmpdir(), 'fc-e2e-leaks-')), 'site')
  const result = spawnSync(
    process.execPath,
    [join(repo, 'packages/flow-checker/dist/cli.js'), 'export', '--root', 'fixtures/leaks', '--html', site],
    { cwd: repo, encoding: 'utf8' },
  )
  expect(result.status, result.stderr).toBe(0)
  const script = readFileSync(join(site, 'data.js'), 'utf8')
  const data = JSON.parse(script.slice(script.indexOf('{'), script.lastIndexOf('}') + 1))
  return { site, routes: data.model.routes }
}

test('page views show server/client leaks in the static export', async ({ page }) => {
  const { site, routes } = exportSite()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const base = pathToFileURL(join(site, 'index.html')).href
  const id = (path: string) => routes.find((r) => r.kind === 'page' && r.path === path)?.id ?? ''
  const open = (path: string) => page.goto(`${base}#/page/${encodeURIComponent(id(path))}`)
  const section = page.locator('section', {
    has: page.getByRole('heading', { name: 'Server/client leaks', exact: true }),
  })

  await open('/files')
  await expect(section.locator('[data-leak="fs"]')).toContainText('src/components/file-badge.tsx')
  await expect(section).toContainText('The browser has no version of it')
  await open('/receipt')
  await expect(section.locator('[data-leak="total"]')).toContainText('a Money instance')
  await open('/help')
  await expect(section.locator('[data-leak="onClick"]')).toContainText('next/link')
  // The page with everything that crosses has no leaks section.
  await open('/')
  await expect(page.getByRole('heading', { name: 'Client boundaries', exact: true })).toBeVisible()
  await expect(section).toHaveCount(0)

  // Each leak is on the overview's To check list, linked to its page.
  await page.goto(`${base}#/overview`)
  await page.locator('.note-group a', { hasText: 'a database client' }).click()
  await expect(page).toHaveURL(new RegExp(`#/page/${id('/stats')}$`))

  // The glossary explains the words.
  await page.goto(`${base}#/glossary`)
  await expect(page.locator('main')).toContainText('Server/client leaks')
  await expect(page.locator('main')).toContainText("prop that can't cross")

  expect(errors).toEqual([])
})
