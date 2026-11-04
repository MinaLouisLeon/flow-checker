// M46: the static export of the action-safety fixture has an Actions screen with the open actions first,
// page views label each action a page uses, the overview's To check links each flag to its page, and the
// glossary explains the words.
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
  const site = join(mkdtempSync(join(tmpdir(), 'fc-e2e-actions-')), 'site')
  const result = spawnSync(
    process.execPath,
    [
      join(repo, 'packages/flow-checker/dist/cli.js'),
      'export',
      '--root',
      'fixtures/action-safety',
      '--html',
      site,
    ],
    { cwd: repo, encoding: 'utf8' },
  )
  expect(result.status, result.stderr).toBe(0)
  const script = readFileSync(join(site, 'data.js'), 'utf8')
  const data = JSON.parse(script.slice(script.indexOf('{'), script.lastIndexOf('}') + 1))
  return { site, routes: data.model.routes }
}

test('the Actions screen and page views label server actions in the static export', async ({ page }) => {
  const { site, routes } = exportSite()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const base = pathToFileURL(join(site, 'index.html')).href
  const id = (path: string) => routes.find((r) => r.kind === 'page' && r.path === path)?.id ?? ''

  // The Actions screen, from the top bar.
  await page.goto(`${base}#/overview`)
  await page.getByRole('navigation').getByRole('link', { name: 'Actions', exact: true }).click()
  await expect(page).toHaveURL(/#\/actions$/)
  const main = page.locator('main')
  await expect(main.getByRole('heading', { name: 'Server actions', exact: true })).toBeVisible()
  await expect(main.locator('[data-section="to-check"] [data-action]')).toHaveCount(3)
  await expect(main.locator('[data-section="to-check"] [data-action="deletePost"]')).toContainText(
    'public POST endpoint',
  )

  // A page view labels each action the page uses.
  await page.goto(`${base}#/page/${encodeURIComponent(id('/posts/[id]'))}`)
  const section = page.locator('section', {
    has: page.getByRole('heading', { name: 'Server actions', exact: true }),
  })
  await expect(section.locator('[data-action]')).toHaveCount(3)
  await expect(section.locator('[data-action="deletePost"]')).toContainText('open to anyone')
  await expect(section.locator('[data-action="renamePost"]')).toContainText('auth checked')
  await expect(section.locator('[data-action="renamePost"]')).not.toContainText('open to anyone')

  // Each flag is on the overview's To check list, linked to its page.
  await page.goto(`${base}#/overview`)
  await page.locator('.note-group a', { hasText: 'resetLikes' }).click()
  await expect(page).toHaveURL(new RegExp(`#/page/${id('/admin')}$`))

  // The glossary explains the words.
  await page.goto(`${base}#/glossary`)
  await expect(main).toContainText('Server actions')
  await expect(main).toContainText('open to anyone')

  expect(errors).toEqual([])
})
