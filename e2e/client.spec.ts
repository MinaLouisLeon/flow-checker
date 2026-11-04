// M43: the static export of the client-boundaries fixture shows, on each page, where its browser part
// starts and what each boundary brings; the planted boundary that could move lower is on the To check
// list; the tree marks the boundaries and the glossary explains the words. No running app needed.
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
  const site = join(mkdtempSync(join(tmpdir(), 'fc-e2e-client-')), 'site')
  const result = spawnSync(
    process.execPath,
    [
      join(repo, 'packages/flow-checker/dist/cli.js'),
      'export',
      '--root',
      'fixtures/client-boundaries',
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

test('page views show client boundaries in the static export', async ({ page }) => {
  const { site, routes } = exportSite()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const base = pathToFileURL(join(site, 'index.html')).href
  const id = (path: string) => routes.find((r) => r.kind === 'page' && r.path === path)?.id ?? ''
  const open = (path: string) => page.goto(`${base}#/page/${encodeURIComponent(id(path))}`)
  const section = page.locator('section', {
    has: page.getByRole('heading', { name: 'Client boundaries', exact: true }),
  })

  await open('/')
  await expect(section).toContainText("6 'use client' boundaries bring 9 components")
  await expect(section.locator('[data-client="LikeButton"]')).toContainText('src/components/index.ts')
  await expect(section.locator('[data-client="Nav"]')).toContainText('RootLayout')
  const shell = section.locator('[data-client="Shell"]')
  await expect(shell).toContainText('could move lower')
  await expect(shell).toContainText('could move down to Menu')
  // The tree marks where the browser part starts.
  await expect(page.locator('.component-tree .tree-row', { hasText: 'Shell' })).toContainText(
    'client boundary',
  )
  await expect(page.locator('.component-tree .tree-row', { hasText: 'Tabs' })).not.toContainText(
    'client boundary',
  )

  await open('/cart')
  await expect(section.locator('[data-client="Cart"]')).toContainText('zod')
  await open('/about')
  await expect(section.locator('[data-client]')).toHaveCount(1)

  // The planted boundary is on the overview's To check list, linked to the page.
  await page.goto(`${base}#/overview`)
  await page.locator('.note-group a', { hasText: 'could move down to' }).click()
  await expect(page).toHaveURL(new RegExp(`#/page/${id('/')}$`))

  // The glossary explains the words.
  await page.goto(`${base}#/glossary`)
  await expect(page.locator('main')).toContainText('Client boundaries')
  await expect(page.locator('main')).toContainText('could move lower')

  expect(errors).toEqual([])
})
