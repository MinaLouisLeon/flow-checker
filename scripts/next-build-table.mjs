// Reads what `next build` produced, for render-check.mjs and next-matrix.mjs: the `Route (app)` table it
// prints (render modes, M38) and the client reference manifests it writes (client boundaries, M43).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { runInNewContext } from 'node:vm'

// ○ static, ● SSG (generateStaticParams), ◐ partial, ƒ dynamic (λ before Next 15).
const SYMBOLS = { '○': 'static', '●': 'static', '◐': 'partial', ƒ: 'dynamic', λ: 'dynamic' }

/** Route path -> `{ mode, symbol, revalidate? }`, from the `Route (app)` table of `next build`. */
export function readBuildTable(out) {
  const rows = new Map()
  const start = out.indexOf('Route (app)')
  if (start < 0) return rows
  for (const line of out.slice(start).split('\n').slice(1)) {
    // A page with `generateStaticParams` prints without a symbol, its prerendered params below it.
    // With Cache Components a page with params prints the same way, its own mode on the row below.
    const m = /^[┌├└│ ]+([○●◐ƒλ])?\s*(\/\S*)(.*)$/.exec(line)
    if (!m) {
      if (/^\s*$/.test(line)) break
      continue
    }
    const [, symbol, path, rest] = m
    const known = rows.get(path)
    if (path === '/_not-found' || (known && (known.symbol || !symbol))) continue
    // Next 15 also prints size columns (`3.46 kB`): the revalidate column is the first duration.
    // Next 13 and 14 print `(ISR: 60 Seconds)` instead.
    const isr = /\(ISR: (\d+) Seconds?\)/.exec(rest)
    const revalidate = isr ? `${isr[1]}s` : rest.split(/\s+/).find((cell) => /^\d+(s|m|h|d|w|y)$/.test(cell))
    rows.set(path, {
      mode: symbol ? SYMBOLS[symbol] : 'static',
      symbol: Boolean(symbol),
      ...(revalidate ? { revalidate } : {}),
    })
  }
  return rows
}

/**
 * Differences between the scanned render modes of a model's pages and a `next build` table.
 * ISR counts as static (Next prints both as ○); a revalidate time Next prints must be scanned too.
 */
export function compareRenderModes(model, built) {
  const problems = []
  for (const route of model.routes) {
    if (route.kind !== 'page' || route.slot || route.intercepting) continue
    const next = built.get(route.path)
    if (!next) continue
    const ours = route.render?.mode === 'isr' ? 'static' : route.render?.mode
    if (ours !== next.mode) problems.push(`${route.path}: scan ${route.render?.mode}, next ${next.mode}`)
    else if (next.revalidate && route.render?.revalidate === undefined)
      problems.push(`${route.path}: next revalidates ${next.revalidate}`)
  }
  return problems
}

/**
 * The project files `next build` sends to the browser as client references (`'use client'` files a
 * server component imports), across every page: the keys of each `*client-reference-manifest.js`'s
 * `clientModules`, as paths relative to the app with forward slashes. Webpack lists every page's
 * references in each manifest and Turbopack only the page's own, so only the union compares. Keys are
 * absolute paths (webpack) or `[project]/<path from the workspace root>` (Turbopack). Undefined when
 * the build wrote no manifest.
 */
export function readClientReferences(appDir) {
  const server = join(appDir, '.next', 'server')
  if (!existsSync(server)) return undefined
  const manifests = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/client-reference-manifest\.js(on)?$/.test(entry.name)) manifests.push(path)
    }
  }
  walk(server)
  if (manifests.length === 0) return undefined
  const files = new Set()
  for (const file of manifests) {
    const text = readFileSync(file, 'utf8')
    let entries
    if (file.endsWith('.json')) entries = [JSON.parse(text)]
    else {
      const sandbox = { globalThis: {}, self: {} }
      sandbox.globalThis = sandbox
      runInNewContext(text, sandbox)
      // Next 13.4 stores each page's manifest as a JSON string.
      entries = Object.values(sandbox.__RSC_MANIFEST ?? {}).map((m) =>
        typeof m === 'string' ? JSON.parse(m) : m,
      )
    }
    for (const manifest of entries) {
      for (const key of Object.keys(manifest.clientModules ?? {})) {
        const path = projectPath(appDir, key.split('#')[0])
        // Webpack also lists the CSS a layout imports.
        if (path && /\.[cm]?[jt]sx?$/.test(path)) files.add(path)
      }
    }
  }
  return files
}

/** A manifest key as a path relative to the app, or undefined for packages and Next's own files. */
function projectPath(appDir, key) {
  if (/[\\/]node_modules[\\/]/.test(key)) return undefined
  if (key.startsWith('[project]/')) {
    // The workspace root may sit above the app: keep the longest tail that is a file of the app.
    const parts = key.slice('[project]/'.length).split('/')
    for (let i = 0; i < parts.length; i++) {
      const tail = parts.slice(i).join('/')
      if (existsSync(join(appDir, tail))) return tail
    }
    return undefined
  }
  const rel = relative(appDir, key).replaceAll('\\', '/')
  return rel.startsWith('..') ? undefined : rel
}

/**
 * Differences between the files of a model's client boundaries (on every page) and the client
 * references `next build` wrote. `error` and `global-error` files are client files Next renders itself,
 * not boundaries a component renders, so they are left out.
 */
export function compareClientBoundaries(model, references) {
  const files = new Map(model.components.map((c) => [c.id, c.file]))
  const ours = new Set()
  for (const route of model.routes) {
    for (const edge of route.client?.boundaries ?? []) {
      const file = files.get(edge.componentId)
      if (file) ours.add(file)
    }
  }
  const special = (file) => /(^|\/)(global-)?error\.[jt]sx?$/.test(file)
  const problems = []
  for (const file of [...references].sort()) {
    if (!ours.has(file) && !special(file)) problems.push(`${file}: in the build, not a scanned boundary`)
  }
  for (const file of [...ours].sort()) {
    if (!references.has(file)) problems.push(`${file}: a scanned boundary, not in the build`)
  }
  return problems
}
