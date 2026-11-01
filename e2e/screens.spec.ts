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
  await page.goto(`${dashboard}/#/overview`)
  const card = page.locator('.stats .stat', { has: page.locator('.stat-label', { hasText: label }) })
  const main = card.locator('a.stat-main')
  await ((await main.count()) > 0 ? main : card).click()
}

test('every overview card opens a screen', async ({ page }) => {
  const expected: [string, RegExp][] = [
    ['Pages', /#\/map$/],
    ['Areas', /#\/areas$/],
    ['Route handlers', /#\/map\?view=handlers$/],
    ['Components', /#\/components$/],
    ['Types', /#\/types$/],
    ['Requests', /#\/requests$/],
    ['Endpoints', /#\/endpoints$/],
    ['Flows', /#\/flows$/],
  ]
  for (const [label, url] of expected) {
    await openCard(page, label)
    await expect(page, label).toHaveURL(url)
  }
})

test('the Components screen lists, filters and shows components', async ({ page }) => {
  await page.goto(`${dashboard}/#/overview`)
  const total = await cardValue(page, 'Components')
  await openCard(page, 'Components')
  await expect(page.locator('.toolbar')).toContainText(`${total} of ${total}`)
  await expect(page.locator('.component-list > li')).toHaveCount(total)

  // The card's "client" part opens the list filtered to client components.
  await page.goto(`${dashboard}/#/overview`)
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
  await page.goto(`${dashboard}/#/overview`)
  const total = await cardValue(page, 'Requests')
  await openCard(page, 'Requests')
  await expect(page.locator('.toolbar')).toContainText(`${total} of ${total}`)

  // "On events" from the card: the login and OTP forms.
  await page.goto(`${dashboard}/#/overview`)
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

test('the Endpoints screen lists endpoints by host and shows who calls them', async ({ page }) => {
  await page.goto(`${dashboard}/#/overview`)
  const total = await cardValue(page, 'Endpoints')
  await openCard(page, 'Endpoints')
  await expect(page.locator('.toolbar')).toContainText(`${total} of ${total}`)
  const rows = page.locator('.endpoint-list > li:not(.endpoint-host)')
  await expect(rows).toHaveCount(total)
  await expect(page.locator('.endpoint-list > li.endpoint-host')).toContainText('NEXT_PUBLIC_API_URL')

  // Callers are searchable: the endpoint behind the OTP form.
  await page.getByRole('searchbox', { name: 'Search URL, host, page or component' }).fill('verifyotp')
  await expect(rows).toHaveCount(1)
  await rows.locator('a.row-link').click()
  await expect(page).toHaveURL(/#\/endpoints\/ep_[^?]+\?q=verifyotp$/)
  const panel = page.locator('.split-side')
  await expect(panel.locator('.panel-head h2')).toContainText('/auth/verify-otp')
  await expect(panel).toContainText('Call sites')

  // A call site opens the request; the request links back to its endpoint.
  await panel.locator('.request-chain').getByRole('link', { name: 'VerifyOtpForm', exact: true }).click()
  await expect(page).toHaveURL(/#\/requests\/req_/)
  await page.locator('.split-side .request-facts a', { hasText: 'POST /auth/verify-otp' }).click()
  await expect(page).toHaveURL(/#\/endpoints\/ep_/)
})

test('the Areas screen shows one card per area and the Map frames them', async ({ page }) => {
  await page.goto(`${dashboard}/#/overview`)
  const total = await cardValue(page, 'Areas')
  await openCard(page, 'Areas')
  await expect(page.locator('.toolbar')).toContainText(`${total} of ${total}`)
  // One card per area, then the card for what they share (the locale layout).
  const cards = page.locator('.area-cards > li:not(.area-card-shared)')
  await expect(cards).toHaveCount(total)
  await expect(page.locator('.area-card-shared')).toBeVisible()

  await cards.filter({ hasText: 'login' }).locator('a').click()
  await expect(page).toHaveURL(/#\/areas\/ar_/)
  const panel = page.locator('.split-side')
  await expect(panel.locator('.panel-head h2')).toHaveText('login')
  await expect(panel).toContainText('LoginForm submit')
  await expect(panel).toContainText('/auth/login')

  // A page links back to its area.
  await panel.getByRole('link', { name: '/[locale]/login', exact: true }).click()
  await expect(page).toHaveURL(/#\/page\/rt_/)
  await page.locator('.page-file a[href^="#/areas"]').click()
  await expect(page).toHaveURL(/#\/areas\/ar_/)

  // The Map draws a frame per area; a frame opens its area.
  await page.goto(`${dashboard}/#/map`)
  await expect(page.locator('.area-frame')).toHaveCount(0)
  await page.getByLabel('Areas').check()
  await expect(page).toHaveURL(/#\/map\?areas=1$/)
  await expect(page.locator('.area-frame')).toHaveCount(total)
  // The name sits above the pages, where the frame isn't covered.
  await page.locator('.area-frame-name', { hasText: 'verify' }).click()
  await expect(page).toHaveURL(/#\/areas\/ar_/)
  await expect(page.locator('.split-side .panel-head h2')).toHaveText('verify')
})

test('Start here is the first screen and every item opens a screen', async ({ page }) => {
  await page.goto(`${dashboard}/`)
  await expect(page.locator('.nav a[aria-current=page]')).toHaveText('Start here')
  for (const id of ['stack', 'areas', 'entry', 'flows', 'backends', 'places', 'check']) {
    await expect(page.getByTestId(`start-${id}`)).toBeVisible()
  }
  await expect(page.getByTestId('start-stack')).toContainText('next-intl')

  // Each link leads somewhere real, not to the "Nothing here" screen.
  const links = await page.locator('.start-grid a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
  expect(links.length).toBeGreaterThan(10)
  for (const link of new Set(links)) {
    await page.goto(`${dashboard}/${link}`)
    await expect(page.locator('main'), String(link)).not.toContainText('Nothing here')
    await expect(page.locator('main'), String(link)).not.toContainText('not in the current scan')
  }

  // The overview moved to #/overview; the brand link goes back to Start here.
  await page.goto(`${dashboard}/#/overview`)
  await expect(page.locator('.stats .stat').first()).toBeVisible()
  await page.locator('.brand').click()
  await expect(page.getByTestId('start-stack')).toBeVisible()
})
