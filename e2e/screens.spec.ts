// M21: every overview card opens a screen, and the Components and Requests screens list, filter
// and show the same numbers as the cards.
import { expect, type Page, test } from '@playwright/test'
import { PORTS } from '../playwright.config'

const dashboard = `http://127.0.0.1:${PORTS.dashboard}`

/** The card's number, e.g. 8 for "8 Components". */
async function cardValue(page: Page, label: string): Promise<number> {
  const card = page.locator('.stats .stat', { has: page.locator('.stat-label', { hasText: label }) })
  return Number(await card.locator('.stat-value').textContent())
}

/** Clicks the card's main link (the whole card, or its number and label). */
async function openCard(page: Page, label: string) {
  await page.goto(`${dashboard}/#/`)
  const card = page.locator('.stats .stat', { has: page.locator('.stat-label', { hasText: label }) })
  const main = card.locator('a.stat-main')
  await ((await main.count()) > 0 ? main : card).click()
}

test('every overview card opens a screen', async ({ page }) => {
  const expected: [string, RegExp][] = [
    ['Pages', /#\/map$/],
    ['Route handlers', /#\/map\?view=handlers$/],
    ['Components', /#\/components$/],
    ['Types', /#\/types$/],
    ['Requests', /#\/requests$/],
    ['Flows', /#\/flows$/],
  ]
  for (const [label, url] of expected) {
    await openCard(page, label)
    await expect(page, label).toHaveURL(url)
  }
})

test('the Components screen lists, filters and shows components', async ({ page }) => {
  await page.goto(`${dashboard}/#/`)
  const total = await cardValue(page, 'Components')
  await openCard(page, 'Components')
  await expect(page.locator('.toolbar')).toContainText(`${total} of ${total}`)
  await expect(page.locator('.component-list > li')).toHaveCount(total)

  // The card's "client" part opens the list filtered to client components.
  await page.goto(`${dashboard}/#/`)
  const client = page.locator('.stat-detail a', { hasText: /client$/ })
  const clientCount = Number((await client.textContent())?.split(' ')[0])
  await client.click()
  await expect(page).toHaveURL(/#\/components\?kind=client$/)
  await expect(page.locator('.component-list > li')).toHaveCount(clientCount)

  // Search, then select: the component shows beside the list and the filters stay in the URL.
  await page.getByRole('searchbox', { name: 'Search components and files' }).fill('login')
  await expect(page.locator('.component-list > li')).toHaveCount(1)
  await page.locator('.component-list').getByRole('link', { name: 'LoginForm', exact: true }).click()
  await expect(page).toHaveURL(/#\/components\/cmp_[^?]+\?q=login&kind=client$/)
  await expect(page.locator('.split-side .panel-head h2')).toHaveText('LoginForm')
  await expect(page.locator('.split-side')).toContainText('/auth/login')
})

test('the Requests screen lists, filters and shows requests', async ({ page }) => {
  await page.goto(`${dashboard}/#/`)
  const total = await cardValue(page, 'Requests')
  await openCard(page, 'Requests')
  await expect(page.locator('.toolbar')).toContainText(`${total} of ${total}`)

  // "On events" from the card: the login and OTP forms.
  await page.goto(`${dashboard}/#/`)
  await page.locator('.stat-detail a', { hasText: 'on events' }).click()
  await expect(page).toHaveURL(/#\/requests\?when=event$/)
  await expect(page.getByRole('button', { name: /On events/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.request-list > li')).toHaveCount(2)

  await page.locator('.request-list a.row-link', { hasText: '/auth/login' }).click()
  await expect(page).toHaveURL(/#\/requests\/req_[^?]+\?when=event$/)
  const panel = page.locator('.split-side')
  await expect(panel.locator('.request-facts').first()).toContainText('Sent from')
  await expect(panel.locator('.request-facts').first()).toContainText('LoginForm')
  await expect(panel).toContainText('Call path')

  // Searching ignores word order and matches the component too.
  await page.getByRole('searchbox', { name: 'Search URL, component or file' }).fill('verifyotp post')
  await expect(page.locator('.request-list > li')).toHaveCount(1)
  await expect(page.locator('.request-list')).toContainText('/auth/verify-otp')
})
