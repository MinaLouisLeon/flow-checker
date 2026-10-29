// Static HTML export (docs/PLAN.md 10): the dashboard build in read-only mode, with the snapshot
// embedded as `data.js` (`window.__FLOW_CHECKER__`). One folder, no tool server needed: host it
// anywhere, or open index.html from disk.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { ExportData } from '@flow-checker/shared'
import type { OutputFiles } from './write'

export const DATA_FILE = 'data.js'

export class HtmlExportError extends Error {
  override name = 'HtmlExportError'
}

/** The site's files: the dashboard build, its index.html pointing at `data.js`, and the data. */
export function renderHtmlSite(data: ExportData, dashboardDir: string): OutputFiles {
  let names: string[]
  try {
    names = listFiles(dashboardDir)
  } catch {
    throw new HtmlExportError(`The dashboard build was not found in ${dashboardDir}.`)
  }
  if (!names.includes('index.html')) {
    throw new HtmlExportError(`The dashboard build in ${dashboardDir} has no index.html.`)
  }
  const files: OutputFiles = {}
  for (const name of names) {
    if (name === DATA_FILE) continue
    files[name] = readFileSync(join(dashboardDir, name))
  }
  const scripts = names
    .filter((n) => n.endsWith('.js'))
    .map((n) => readFileSync(join(dashboardDir, n), 'utf8'))
  files['index.html'] = indexHtml(
    readFileSync(join(dashboardDir, 'index.html'), 'utf8'),
    data,
    scripts.every(isClassicScript),
  )
  files[DATA_FILE] = dataScript(data)
  return files
}

/** `window.__FLOW_CHECKER__ = {...}`. `<` is escaped so the JSON can't end a script tag. */
export function dataScript(data: ExportData): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return `// flow-checker export, ${data.generatedAt}\nwindow.__FLOW_CHECKER__ = ${json};\n`
}

/**
 * Loads `data.js` before the app and sets the title. Browsers block module scripts on file://
 * pages, so when the bundle has no imports it is loaded as a classic deferred script instead:
 * the site then also works when index.html is opened from disk.
 */
function indexHtml(html: string, data: ExportData, classic: boolean): string {
  let out = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(data.projectName)} · flow-checker</title>`,
  )
  if (classic) {
    out = out
      .replace(/<script type="module" crossorigin src=/g, '<script defer src=')
      .replace(/<script type="module" src=/g, '<script defer src=')
      .replace(/<link rel="stylesheet" crossorigin href=/g, '<link rel="stylesheet" href=')
  }
  const tag = `<script src="./${DATA_FILE}"></script>\n    `
  const at = out.indexOf('<script')
  return at < 0 ? out.replace('</head>', `${tag}</head>`) : `${out.slice(0, at)}${tag}${out.slice(at)}`
}

/** No `import`/`export` statements or `import.meta`: it runs the same as a classic script. */
function isClassicScript(source: string): boolean {
  return !/(^|[;\n}])\s*(import\s*[\w{*'"]|export\s)|import\.meta|\bimport\(/.test(source)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split('\\').join('/'))
    .sort()
}
