import { isAbsolute, posix } from 'node:path'

/** Forward slashes everywhere, matching what ts-morph returns on every OS. */
export function toPosix(path: string): string {
  return path.replaceAll('\\', '/')
}

/** Joins `path` onto `base` unless it is already absolute (either `/x` or `C:/x`). */
export function resolveFrom(base: string, path: string): string {
  const p = toPosix(path)
  return isAbsolute(p) || p.startsWith('/') ? posix.normalize(p) : posix.join(base, p)
}

/** Project-relative path with forward slashes. */
export function relativeTo(root: string, path: string): string {
  return posix.relative(root, path)
}

/** Locale-independent string order, so output is identical on every machine. */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
