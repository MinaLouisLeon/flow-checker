// Small Markdown and Mermaid helpers. Output must be stable: same input, same bytes.
import { posix } from 'node:path'

/** Inline code. Uses a longer fence when the text has backticks. */
export function code(text: string): string {
  const clean = text.replace(/\s*\n\s*/g, ' ')
  const longest = Math.max(0, ...[...clean.matchAll(/`+/g)].map((m) => m[0].length))
  const fence = '`'.repeat(longest + 1)
  const pad = clean.startsWith('`') || clean.endsWith('`') ? ' ' : ''
  return `${fence}${pad}${clean}${pad}${fence}`
}

/**
 * Plain text for Markdown: no HTML, no accidental emphasis or links. `_` inside words is left
 * alone (GFM doesn't emphasize there), so names like `NEXT_PUBLIC_API_URL` stay readable.
 */
export function text(value: string): string {
  return value
    .replace(/\s*\n\s*/g, ' ')
    .replace(/([\\`*[\]<>|#])/g, '\\$1')
    .replace(/(^|\W)_|_(?=\W|$)/g, (m) => m.replace('_', '\\_'))
}

/** A fenced code block. */
export function block(lang: string, body: string): string {
  const longest = Math.max(2, ...[...body.matchAll(/`{3,}/g)].map((m) => m[0].length))
  const fence = '`'.repeat(longest + 1)
  return `${fence}${lang}\n${body.replace(/\n+$/, '')}\n${fence}`
}

/** A table. Cells are already Markdown; pipes and newlines are escaped. */
export function table(head: string[], rows: string[][], align?: ('left' | 'right')[]): string {
  const cell = (c: string) => c.replace(/\r?\n/g, ' ').replace(/(?<!\\)\|/g, '\\|')
  const sep = head.map((_, i) => (align?.[i] === 'right' ? '---:' : '---'))
  return [head, sep, ...rows].map((r) => `| ${r.map(cell).join(' | ')} |`).join('\n')
}

/** Key/value table. Rows with an empty value are left out. */
export function facts(rows: [string, string | undefined][]): string {
  const kept = rows.filter((r): r is [string, string] => Boolean(r[1]))
  return kept.length === 0 ? '' : table(['', ''], kept)
}

/** Relative link from one generated file to another, with an optional anchor. */
export function link(label: string, from: string, to: string, anchor?: string): string {
  const target = to === from ? '' : posix.relative(posix.dirname(from), to)
  const url = target
    .split('/')
    .map((part) => (part === '..' ? part : encodeURIComponent(part)))
    .join('/')
  return `[${label}](${url}${anchor ? `#${anchor}` : ''})`
}

/** An HTML anchor other files can link to. Ids are generated and safe. */
export function anchor(id: string): string {
  return `<a id="${id.replace(/[^\w-]/g, '_')}"></a>`
}

export function anchorId(id: string): string {
  return id.replace(/[^\w-]/g, '_')
}

/** Text inside a Mermaid label or message: characters Mermaid treats specially become entities. */
export function mermaid(value: string): string {
  return value.replace(/\s*\n\s*/g, ' ').replace(/[#;"<>{}|]/g, (c) => `#${c.charCodeAt(0)};`)
}

export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`
}

/** `2026-10-28 10:55 UTC`. */
export function time(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

/** Joins sections with one blank line, skipping empty ones. Ends with a newline. */
export function doc(parts: (string | undefined | false)[]): string {
  return `${parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').join('\n\n')}\n`
}
