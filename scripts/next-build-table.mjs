// Reads the `Route (app)` table `next build` prints, for render-check.mjs and next-matrix.mjs.

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
