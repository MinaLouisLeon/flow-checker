// Stable entity ids. Pure JS (no node:crypto) so the dashboard can use it too.

/** cyrb53: fast 53-bit string hash with good distribution. Not cryptographic. */
function hash53(input: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export type IdPrefix = 'rt' | 'cmp' | 'typ'

/**
 * Builds an id like `cmp_1x2y3z4w5v6u` from the parts that identify an entity
 * (e.g. project-relative file path + symbol name). The same parts always give the
 * same id, so captures stay linked across re-scans.
 */
export function makeId(prefix: IdPrefix, ...parts: string[]): string {
  return `${prefix}_${hash53(parts.join('\u0000')).toString(36).padStart(11, '0')}`
}
