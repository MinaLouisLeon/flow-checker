import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { PORTS } from '../playwright.config'

// M9 "done when": editing a fixture file updates the dashboard in under a second and marks the
// request whose code changed as needing a re-check. Using the app again verifies it again.
const app = `http://localhost:${PORTS.app}`
const dashboard = `http://127.0.0.1:${PORTS.dashboard}`
const loginForm = join(
  import.meta.dirname,
  '..',
  'fixtures',
  'next-intl',
  'src',
  'components',
  'LoginForm.tsx',
)

async function logIn(page: Page) {
  await page.goto(`${app}/en/login`)
  await page.fill('input[name=email]', 'ada@example.com')
  await page.fill('input[name=password]', 'password')
  await page.click('button[type=submit]')
  await page.waitForURL(/\/verify\?challenge=/)
}

test('editing the code behind a verified request asks for a re-check', async ({ page, request }) => {
  await logIn(page)

  const model = await (await request.get(`${dashboard}/api/model`)).json()
  const component = model.components.find((c: { name: string }) => c.name === 'LoginForm')
  await page.goto(`${dashboard}/#/component/${component.id}`)
  const login = page.locator('.request', { hasText: '/auth/login' })
  await expect(login).toContainText('✓ verified')

  const original = readFileSync(loginForm, 'utf8')
  try {
    const edited = original.replace(
      'event.preventDefault()',
      "event.preventDefault()\n    console.debug('flow-checker e2e: submit')",
    )
    expect(edited).not.toBe(original)
    const started = Date.now()
    writeFileSync(loginForm, edited)
    await expect(login).toContainText('↻ needs re-check', { timeout: 1_000 })
    test.info().annotations.push({ type: 'update time', description: `${Date.now() - started} ms` })
    await expect(page.locator('.banner-warn')).toContainText('changed')
    await expect(page.locator('.topbar-meta').first()).toContainText('LoginForm.tsx changed')

    // M36: what the change affects, from the header link.
    await page.getByRole('link', { name: 'what it affects' }).click()
    const panel = page.getByTestId('impact-panel')
    await expect(panel).toContainText('src/components/LoginForm.tsx')
    await expect(panel).toContainText('/[locale]/login')
    await expect(panel).toContainText('LoginForm submit')
    await expect(panel).toContainText(/POST .*\/auth\/login/)
    await page.goto(`${dashboard}/#/component/${component.id}`)
  } finally {
    writeFileSync(loginForm, original)
  }

  // Back to the original code, which still needs a capture from after the change.
  await expect(login).toContainText('↻ needs re-check')
  await logIn(page)
  await page.goto(`${dashboard}/#/component/${component.id}`)
  await expect(page.locator('.request', { hasText: '/auth/login' })).toContainText('✓ verified')
})
