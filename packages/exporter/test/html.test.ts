// Static HTML export: the embedded data of each fixture matches its golden copy, and the dashboard
// build is copied with index.html loading data.js first.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EXPORT_VERSION } from '@flow-checker/shared'
import { describe, expect, it } from 'vitest'
import { DATA_FILE, dataScript, HtmlExportError, renderHtmlSite } from '../src'
import { FIXTURES, fixtureSnapshot } from './helpers'

const golden = join(import.meta.dirname, 'golden')

/** A small stand-in for packages/dashboard/dist. */
function fakeDashboard(script: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'fc-dash-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(
    join(dir, 'index.html'),
    [
      '<!doctype html>',
      '<html lang="en">',
      '  <head>',
      '    <title>flow-checker</title>',
      '    <script type="module" crossorigin src="./assets/index-abc.js"></script>',
      '    <link rel="stylesheet" crossorigin href="./assets/index-abc.css">',
      '  </head>',
      '  <body><div id="root"></div></body>',
      '</html>',
      '',
    ].join('\n'),
  )
  writeFileSync(join(dir, 'assets', 'index-abc.js'), script)
  writeFileSync(join(dir, 'assets', 'index-abc.css'), 'body{}')
  return dir
}

describe.each(FIXTURES)('HTML export of %s', (fixture) => {
  it('embeds the same data as the golden copy', async () => {
    const data = fixtureSnapshot(fixture)
    await expect(`${JSON.stringify(data, null, 2)}\n`).toMatchFileSnapshot(
      join(golden, fixture, 'html', 'data.json'),
    )
  })
})

describe('renderHtmlSite', () => {
  const data = fixtureSnapshot('next-intl')

  it('copies the build and loads data.js before the app', () => {
    const files = renderHtmlSite(data, fakeDashboard('var a=1;console.log(a)'))
    expect(Object.keys(files).sort()).toEqual([
      'assets/index-abc.css',
      'assets/index-abc.js',
      DATA_FILE,
      'index.html',
    ])
    const html = String(files['index.html'])
    expect(html).toContain('<title>next-intl · flow-checker</title>')
    expect(html.indexOf(`<script src="./${DATA_FILE}">`)).toBeLessThan(html.indexOf('index-abc.js'))
    // No imports in the bundle: a classic script, so index.html also works from disk.
    expect(html).toContain('<script defer src="./assets/index-abc.js">')
    expect(html).not.toContain('type="module"')
    expect(html).not.toContain('crossorigin')
  })

  it('keeps a module script when the bundle imports', () => {
    const files = renderHtmlSite(data, fakeDashboard('import{a}from"./chunk.js";a()'))
    expect(String(files['index.html'])).toContain(
      '<script type="module" crossorigin src="./assets/index-abc.js">',
    )
  })

  it('embeds the snapshot as window.__FLOW_CHECKER__', () => {
    const script = dataScript({ ...data, projectName: '</script><b>x' })
    expect(script).not.toContain('</script>')
    const window: { __FLOW_CHECKER__?: unknown } = {}
    new Function('window', script)(window)
    expect(window.__FLOW_CHECKER__).toMatchObject({ version: EXPORT_VERSION, projectName: '</script><b>x' })
  })

  it('fails clearly without a dashboard build', () => {
    expect(() => renderHtmlSite(data, join(tmpdir(), 'fc-missing-dashboard'))).toThrow(HtmlExportError)
  })
})
