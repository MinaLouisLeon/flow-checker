// M16: the dashboard lists the tRPC router's procedures on the overview and shows the procedure
// on each request that calls it. Uses the static export of the v11 fixture, so it needs no app.
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'

const repo = resolve(import.meta.dirname, '..')

function exportSite(): string {
  const site = join(mkdtempSync(join(tmpdir(), 'fc-e2e-trpc-')), 'site')
  const result = spawnSync(
    process.execPath,
    [join(repo, 'packages/flow-checker/dist/cli.js'), 'export', '--root', 'fixtures/trpc', '--html', site],
    { cwd: repo, encoding: 'utf8' },
  )
  expect(result.status, result.stderr).toBe(0)
  return site
}

test('the overview lists procedures and requests show the one they call', async ({ page }) => {
  const site = exportSite()
  await page.goto(`${pathToFileURL(join(site, 'index.html')).href}#/overview`)

  const section = page.locator('section', { has: page.getByRole('heading', { name: 'tRPC', exact: true }) })
  await expect(section).toContainText('/api/trpc')
  await expect(section).toContainText('7 of 7 procedures called by the code')
  await expect(section).toContainText('todo.byId')
  await expect(section).toContainText('{ id: number }')

  // From a procedure to the component that calls it, then the request's facts.
  await section.getByRole('link', { name: 'AddTodoForm' }).click()
  const request = page.locator('details.request', { hasText: '/api/trpc/todo.add' })
  await request.evaluate((el) => {
    ;(el as HTMLDetailsElement).open = true
  })
  await expect(request).toContainText('todo.add mutation')
  await expect(request).toContainText('{API_URL ?? http://localhost:4010}/todos')
})
