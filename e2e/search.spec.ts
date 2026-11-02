// M33: global search finds and opens one item of each kind with the keyboard only, on the running
// dashboard and in the static export.
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, type Page, test } from '@playwright/test'
import { PORTS } from '../playwright.config'

const repo = resolve(import.meta.dirname, '..')
const dashboard = `http://127.0.0.1:${PORTS.dashboard}`

/** Query, the kind and label of the result to open, the URL it leads to and text the screen shows. */
const ITEMS: [string, string, string, RegExp, string][] = [
  ['/[locale]/login', 'page', '/[locale]/login', /#\/page\/rt_/, 'LoginForm'],
  ['loginform', 'component', 'LoginForm', /#\/component\/cmp_/, 'LoginForm'],
  ['/auth/login', 'request', 'POST', /#\/requests\/req_/, 'LoginForm'],
  ['/auth/login', 'endpoint', 'POST /auth/login', /#\/endpoints\/ep_/, 'LoginForm'],
  ['user', 'type', 'User', /#\/types\/typ_/, 'src/types/auth.ts'],
  ['login submit', 'flow', 'LoginForm submit', /#\/flows\/flw_/, 'LoginForm submit'],
  ['verify', 'area', 'verify', /#\/areas\/ar_/, 'VerifyOtpForm'],
]

/** Opens the box with the shortcut, types, moves to the result with the arrows and presses Enter. */
async function openWithKeyboard(page: Page, query: string, kind: string, label: string) {
  await page.keyboard.press('ControlOrMeta+k')
  const box = page.getByRole('dialog').getByRole('combobox')
  await expect(box).toBeFocused()
  await page.keyboard.type(query)
  const wanted = page.getByRole('option').filter({ hasText: kind }).filter({ hasText: label }).first()
  await expect(wanted).toBeVisible()
  for (let i = 0; i < 50 && (await wanted.getAttribute('aria-selected')) !== 'true'; i++) {
    await page.keyboard.press('ArrowDown')
  }
  await expect(wanted).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Search the app' })).toHaveCount(0)
}

async function findEachKind(page: Page, start: string) {
  for (const [query, kind, label, url, text] of ITEMS) {
    await page.goto(start)
    await expect(page.locator('main')).not.toContainText('Loading scan')
    await openWithKeyboard(page, query, kind, label)
    await expect(page, `${kind} ${label}`).toHaveURL(url)
    await expect(page.locator('main'), `${kind} ${label}`).toContainText(text)
    await expect(page.locator('main')).not.toContainText('not in the current scan')
  }
}

test('global search opens one item of each kind with the keyboard', async ({ page }) => {
  await findEachKind(page, `${dashboard}/#/`)

  // `/` opens it too (not while typing in a field), Escape closes it and nothing changes.
  await page.goto(`${dashboard}/#/components`)
  await page.locator('main').click()
  await page.keyboard.press('/')
  await expect(page.getByRole('dialog').getByRole('combobox')).toBeFocused()
  await page.keyboard.type('nothing-like-this')
  await expect(page.getByRole('dialog')).toContainText('Nothing matches.')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/components$/)

  const listSearch = page.getByRole('searchbox', { name: 'Search components and files' })
  await listSearch.click()
  await page.keyboard.type('a/b')
  await expect(listSearch).toHaveValue('a/b')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('global search works in the static export', async ({ page }) => {
  const site = join(mkdtempSync(join(tmpdir(), 'fc-e2e-search-')), 'site')
  const result = spawnSync(
    process.execPath,
    [
      join(repo, 'packages/flow-checker/dist/cli.js'),
      'export',
      '--root',
      'fixtures/next-intl',
      '--html',
      site,
    ],
    { cwd: repo, encoding: 'utf8' },
  )
  expect(result.status, result.stderr).toBe(0)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await findEachKind(page, `${pathToFileURL(join(site, 'index.html')).href}#/`)
  expect(errors).toEqual([])
})
