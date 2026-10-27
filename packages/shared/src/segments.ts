import type { Segment } from './model'

const INTERCEPT = /^((?:\(\.\.\))+|\(\.\.\.\)|\(\.\))(.+)$/

/** Parses one `app/` directory name into a route segment. */
export function parseSegment(raw: string): Segment {
  if (raw.startsWith('@')) return { raw, kind: 'slot', name: raw.slice(1) }

  const intercept = INTERCEPT.exec(raw)
  if (intercept) {
    const [, marker = '', rest = ''] = intercept
    return { ...parseSegment(rest), raw, intercept: marker }
  }

  if (/^\(.+\)$/.test(raw)) return { raw, kind: 'group', name: raw.slice(1, -1) }

  let match = /^\[\[\.\.\.(.+)\]\]$/.exec(raw)
  if (match?.[1]) return { raw, kind: 'optional-catch-all', name: match[1] }
  match = /^\[\.\.\.(.+)\]$/.exec(raw)
  if (match?.[1]) return { raw, kind: 'catch-all', name: match[1] }
  match = /^\[(.+)\]$/.exec(raw)
  if (match?.[1]) return { raw, kind: 'dynamic', name: match[1] }

  return { raw, kind: 'static', name: raw }
}

/** True for segments that appear in the URL (not route groups or parallel slots). */
export function isUrlSegment(segment: Segment): boolean {
  return segment.kind !== 'group' && segment.kind !== 'slot'
}

/** The URL part of a segment, without any interception marker: `(.)[id]` → `[id]`. */
export function urlPart(segment: Segment): string {
  return segment.intercept ? segment.raw.slice(segment.intercept.length) : segment.raw
}

/** Number of URL levels an interception marker goes up: `(.)` 0, `(..)` 1, `(..)(..)` 2, `(...)` to root. */
export function interceptLevels(marker: string): number | 'root' {
  if (marker === '(...)') return 'root'
  if (marker === '(.)') return 0
  return marker.length / 4
}

/** True for private folders (`_components`), which Next excludes from routing. */
export function isPrivateFolder(name: string): boolean {
  return name.startsWith('_')
}
