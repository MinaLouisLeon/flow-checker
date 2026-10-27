import { expect, test } from '@playwright/test'
import { PORTS } from '../playwright.config'

const app = `http://localhost:${PORTS.app}`
const dashboard = `http://127.0.0.1:${PORTS.dashboard}`

test('a login click shows up in the dashboard as a redacted capture', async ({ page }) => {
  await page.goto(`${app}/en/login`)
  await page.fill('input[name=email]', 'ada@example.com')
  await page.fill('input[name=password]', 'password')
  await page.click('button[type=submit]')
  await page.waitForURL(/\/verify\?challenge=/)

  await page.goto(`${dashboard}/#/live`)
  const row = page.locator('.capture-list li', { hasText: '/auth/login' }).first()
  await expect(row).toBeVisible()
  await expect(row).toContainText('POST')
  await expect(row).toContainText('LoginForm')
  await row.locator('a.capture-link').click()

  const detail = page.locator('.capture-detail')
  await expect(detail).toContainText('Started by')
  await expect(detail).toContainText('submit')
  await expect(detail).toContainText('request.body.password')

  const requestBody = detail
    .locator('.section', { has: page.locator('h2', { hasText: /^Request$/ }) })
    .locator('pre.body')
    .first()
  await expect(requestBody).toContainText('"password": "[REDACTED:string]"')
  await expect(requestBody).toContainText('"email": "ada@example.com"')
  await expect(requestBody).not.toContainText('"password": "password"')

  const responseBody = detail
    .locator('.section', { has: page.locator('h2', { hasText: /^Response$/ }) })
    .locator('pre.body')
    .first()
  await expect(responseBody).toContainText('"otpRequired": true')
})

test('the stored capture on disk is redacted too', async ({ request }) => {
  const list = (await (await request.get(`${dashboard}/api/captures`)).json()) as {
    id: string
    url: string
  }[]
  const login = list.find((c) => c.url.endsWith('/auth/login'))
  expect(login).toBeDefined()
  const detail = await (await request.get(`${dashboard}/api/captures/${login?.id}`)).json()
  expect(JSON.stringify(detail)).not.toContain('"password":"password"')
  expect(detail.capture.request.body.value.password).toBe('[REDACTED:string]')
})
