// M41: the static export of the boundaries fixture shows, on each page, what Next shows while it
// loads, on an error and on `notFound()`, the gaps and the title; the Map links the parallel slot and
// intercepting pages, and the tree names the interception. No running app needed.
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
  slot?: string
  intercepting?: unknown
}

function exportSite(): { site: string; routes: ExportedRoute[] } {
  const site = join(mkdtempSync(join(tmpdir(), 'fc-e2e-boundaries-')), 'site')
  const result = spawnSync(
    process.execPath,
    [
      join(repo, 'packages/flow-checker/dist/cli.js'),
      'export',
      '--root',
      'fixtures/boundaries',
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

test('page views show boundaries, gaps and titles in the static export', async ({ page }) => {
  const { site, routes } = exportSite()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const base = pathToFileURL(join(site, 'index.html')).href
  const id = (path: string) =>
    routes.find((r) => r.kind === 'page' && r.path === path && !r.slot && !r.intercepting)?.id ?? ''
  const open = (path: string) => page.goto(`${base}#/page/${encodeURIComponent(id(path))}`)
  const section = (title: string) =>
    page.locator('section', { has: page.getByRole('heading', { name: title, exact: true }) })

  await open('/dashboard')
  await expect(section('Boundaries')).toContainText('While it loads')
  await expect(section('Boundaries')).toContainText('src/app/dashboard/loading.tsx')
  await expect(section('Boundaries')).toContainText('src/app/dashboard/error.tsx')
  await expect(section('Metadata')).toContainText('Dashboard | Boundaries')

  await open('/photos/[id]')
  const gap = section('Boundaries').locator('[data-gap="no-fallback"]')
  await expect(gap).toContainText('no loading state')
  await expect(gap).toContainText('src/lib/api.ts:17')
  await expect(section('Boundaries')).toContainText('src/app/photos/not-found.tsx')

  // The gap is also on the overview's To check list, linked to the page.
  await page.goto(`${base}#/overview`)
  await page.locator('.note-group a', { hasText: 'no loading state' }).click()
  await expect(page).toHaveURL(new RegExp(`#/page/${id('/photos/[id]')}$`))

  // The Map: slot and intercepting pages have their own edges and legend entries.
  await page.goto(`${base}#/map`)
  await expect(page.locator('.legend')).toContainText('slot')
  await expect(page.locator('.legend')).toContainText('intercepts')
  await expect(page.locator('.react-flow__edge.edge-intercepts')).toHaveCount(1)
  await expect(page.locator('.react-flow__edge.edge-slot')).toHaveCount(2)
  await expect(page.locator('.route-node', { hasText: 'intercepts (.)' })).toHaveCount(1)

  // The tree names the interception.
  await page.goto(`${base}#/map?view=tree`)
  await expect(page.locator('.tree-row', { hasText: '(.)[id]' })).toContainText('intercepts (.)')

  // The glossary explains the gap words.
  await page.goto(`${base}#/glossary`)
  await expect(page.locator('main')).toContainText('Boundaries')
  await expect(page.locator('main')).toContainText('no loading state')

  expect(errors).toEqual([])
})
