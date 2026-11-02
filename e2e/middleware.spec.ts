// M14: the dashboard shows the middleware (proxy.ts) on the pages it runs on: its matcher, the
// redirects that can send the page elsewhere, rewrites and its requests. Uses the static export
// of the middleware fixture, so it needs no running app.
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
}

function exportSite(): { site: string; routes: ExportedRoute[] } {
  const site = join(mkdtempSync(join(tmpdir(), 'fc-e2e-middleware-')), 'site')
  const result = spawnSync(
    process.execPath,
    [
      join(repo, 'packages/flow-checker/dist/cli.js'),
      'export',
      '--root',
      'fixtures/middleware',
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

test('pages show the middleware that runs on them', async ({ page }) => {
  const { site, routes } = exportSite()
  const id = (path: string) => routes.find((r) => r.path === path)?.id ?? ''
  const open = (path: string) =>
    page.goto(`${pathToFileURL(join(site, 'index.html')).href}#/page/${encodeURIComponent(id(path))}`)

  await open('/dashboard')
  const section = page.locator('section', {
    has: page.getByRole('heading', { name: 'Middleware', exact: true }),
  })
  await expect(section).toContainText('proxy.ts')
  await expect(section).toContainText('runs here')
  await expect(section).toContainText('/dashboard/:path*')
  await expect(section).toContainText('if !token')
  await expect(section).toContainText('if token && !user')
  await expect(section).toContainText('/me')

  // Only with a session cookie (`has`), so it may or may not run.
  await open('/login')
  await expect(
    page.locator('section', { has: page.getByRole('heading', { name: 'Middleware', exact: true }) }),
  ).toContainText('may run')

  // The products page answers /shop through a rewrite; the middleware doesn't run on it.
  await open('/products')
  const products = page.locator('section', {
    has: page.getByRole('heading', { name: 'Middleware', exact: true }),
  })
  await expect(products).toContainText('/shop/*')
  await expect(products).not.toContainText('runs here')

  // The home page has no middleware section at all.
  await open('/')
  await expect(page.getByRole('heading', { name: 'Middleware', exact: true })).toHaveCount(0)
})

// M31: each page says whether something can stop it, and the Map filters by it.
test('pages show their access, and the Map filters guarded and open pages', async ({ page }) => {
  const { site, routes } = exportSite()
  const base = pathToFileURL(join(site, 'index.html')).href
  const id = (path: string) => routes.find((r) => r.path === path)?.id ?? ''
  const access = () =>
    page.locator('section', { has: page.getByRole('heading', { name: 'Access', exact: true }) })

  await page.goto(`${base}#/page/${encodeURIComponent(id('/dashboard'))}`)
  await expect(page.locator('.page-head .badge', { hasText: 'guarded' })).toBeVisible()
  await expect(access()).toContainText('redirects to /login when !token')
  await expect(access()).toContainText('when token && !user')
  await expect(access()).toContainText('proxy.ts:23')
  // The target is a link to the login page.
  await access().getByRole('link', { name: '/login', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`#/page/${id('/login')}$`))
  await expect(access()).toContainText('cookie session is set')

  await page.goto(`${base}#/page/${encodeURIComponent(id('/products'))}`)
  await expect(page.locator('.page-head .badge', { hasText: 'open' })).toBeVisible()
  await expect(access()).toContainText('Nothing in the middleware')

  // Map: three guarded pages stand out, the others are dimmed.
  await page.goto(`${base}#/map`)
  await page.getByRole('button', { name: 'guarded 3' }).click()
  await expect(page).toHaveURL(/#\/map\?access=guarded$/)
  await expect(page.locator('.route-node:not(.dimmed)')).toHaveCount(3)
  await expect(page.locator('.route-node:not(.dimmed) .badge', { hasText: 'guarded' })).toHaveCount(3)
  await page.getByRole('button', { name: 'open 2' }).click()
  await expect(page.locator('.route-node:not(.dimmed)')).toHaveCount(2)
  await page.getByRole('button', { name: 'All pages' }).click()
  await expect(page).toHaveURL(/#\/map$/)
})
