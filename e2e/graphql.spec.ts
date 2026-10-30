// M17: the dashboard lists GraphQL operations on the overview and shows the operation on each
// request that sends it. Uses the static export of the Apollo 4 fixture, so it needs no app.
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'

const repo = resolve(import.meta.dirname, '..')

function exportSite(): string {
  const site = join(mkdtempSync(join(tmpdir(), 'fc-e2e-graphql-')), 'site')
  const result = spawnSync(
    process.execPath,
    [
      join(repo, 'packages/flow-checker/dist/cli.js'),
      'export',
      '--root',
      'fixtures/graphql-apollo',
      '--html',
      site,
    ],
    { cwd: repo, encoding: 'utf8' },
  )
  expect(result.status, result.stderr).toBe(0)
  return site
}

test('the overview lists operations and requests show the one they send', async ({ page }) => {
  const site = exportSite()
  await page.goto(pathToFileURL(join(site, 'index.html')).href)

  const section = page.locator('section', {
    has: page.getByRole('heading', { name: 'GraphQL', exact: true }),
  })
  await expect(section).toContainText('/api/graphql')
  await expect(section).toContainText('apollo · batching')
  await expect(section).toContainText('7 of 7 operations sent by the code')
  await expect(section).toContainText('TodosQuery')
  await expect(section).toContainText('TodoItem')

  // From an operation to the component that sends it, then the request's facts.
  await section.getByRole('link', { name: 'AddTodoForm' }).click()
  const request = page.locator('details.request', { hasText: '/api/graphql' }).first()
  await request.evaluate((el) => {
    ;(el as HTMLDetailsElement).open = true
  })
  await expect(request).toContainText('AddTodo mutation')
  await expect(request).toContainText('types from codegen')
})
