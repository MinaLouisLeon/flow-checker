import { expect, test } from '@playwright/test'
import { PORTS } from '../playwright.config'

// M35 "done when": following the walk-through checklist on the auth fixture (login → OTP →
// dashboard) confirms the flow, and its coverage reaches 100%, while the dashboard stays open.
const app = `http://localhost:${PORTS.app}`
const dashboard = `http://127.0.0.1:${PORTS.dashboard}`

test('following the checklist confirms login → OTP → dashboard', async ({ page, context, request }) => {
  // Start from no captures, so earlier specs' walks don't count.
  await request.delete(`${dashboard}/api/captures`)

  await page.goto(`${dashboard}/#/walk`)
  await expect(page.locator('h1')).toHaveText('Walk the app')
  const item = page.getByTestId('walk-item').filter({ hasText: 'LoginForm submit' })
  await expect(item).toContainText('not walked yet')
  await expect(item.getByTestId('walk-percent')).toHaveText('0%')
  await expect(item.locator('[data-done]')).toHaveCount(0)
  await expect(item).toContainText('Submit the form in LoginForm on /[locale]/login')
  await expect(page.getByTestId('coverage-flows')).toContainText('0%')
  await expect(page.getByLabel('Value for [locale]')).toHaveValue('en')

  // "Open in app" opens the start page, with the locale filled in, in a new tab.
  const open = item.getByRole('link', { name: /Open in app/ })
  await expect(open).toHaveAttribute('href', `${app}/en/login`)
  const [appPage] = await Promise.all([context.waitForEvent('page'), open.click()])
  await appPage.waitForURL(/\/en\/login/)

  await appPage.fill('input[name=email]', 'ada@example.com')
  await appPage.fill('input[name=password]', 'password')
  await appPage.click('button[type=submit]')
  await appPage.waitForURL(/\/verify\?challenge=/)

  // The first steps tick live, before the flow is finished.
  await expect(item.locator('[data-done]')).toHaveCount(3)
  await expect(item).toContainText('partial')

  await appPage.fill('input[name=code]', '123456')
  await appPage.click('button[type=submit]')
  await appPage.waitForURL(/\/dashboard/)
  await expect(appPage.locator('h1')).toBeVisible()

  // Back on the dashboard tab, with no reload: every step ticked, the flow confirmed.
  await expect(item).toContainText('✓ confirmed')
  await expect(item.locator('[data-done]')).toHaveCount(7)
  await expect(item.getByTestId('walk-percent')).toHaveText('100%')
  await expect(page.getByTestId('coverage-flows')).toContainText('100%')
  await expect(page.getByText('Every flow was walked end to end.')).toBeVisible()

  // Start here and the overview show the same coverage.
  for (const screen of ['#/', '#/overview']) {
    await page.goto(`${dashboard}/${screen}`)
    await expect(page.getByTestId('coverage-flows')).toContainText('100%')
    await expect(page.getByTestId('coverage-requests').getByRole('progressbar')).not.toHaveAttribute(
      'aria-valuenow',
      '0',
    )
  }
})

test('a remembered value for a dynamic segment fills the app links', async ({ page }) => {
  await page.goto(`${dashboard}/#/walk`)
  const field = page.getByLabel('Value for [locale]')
  await field.fill('ar')
  const open = page
    .getByTestId('walk-item')
    .first()
    .getByRole('link', { name: /Open in app/ })
  await expect(open).toHaveAttribute('href', `${app}/ar/login`)

  await page.reload()
  await expect(page.getByLabel('Value for [locale]')).toHaveValue('ar')
  await field.fill('en')
})
