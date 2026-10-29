// Path globs for the config's `include` / `exclude` (docs/config.md). Paths are relative to the
// project root, with forward slashes. `**` matches any number of folders, `*` anything inside one
// path segment, `?` one character, and `{a,b}` either alternative.

const SPECIAL = /[.+^$()|[\]\\]/g

function escapeText(text: string): string {
  return text.replace(SPECIAL, '\\$&')
}

export function globToRegExp(glob: string): RegExp {
  let source = ''
  const text = glob.replace(/^\.\//, '')
  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string
    if (char === '*') {
      if (text[i + 1] === '*') {
        // `**/` matches zero or more folders; a trailing `**` matches everything below.
        if (text[i + 2] === '/') {
          source += '(?:.*/)?'
          i += 2
        } else {
          source += '.*'
          i += 1
        }
      } else source += '[^/]*'
    } else if (char === '?') source += '[^/]'
    else if (char === '{') {
      const end = text.indexOf('}', i)
      if (end < 0) source += '\\{'
      else {
        const alternatives = text
          .slice(i + 1, end)
          .split(',')
          .map((alt) => escapeText(alt).replaceAll('*', '[^/]*'))
        source += `(?:${alternatives.join('|')})`
        i = end
      }
    } else source += escapeText(char)
  }
  return new RegExp(`^${source}$`)
}

/** Whether a project-relative path is scanned: matched by `include` and not by `exclude`. */
export function createPathFilter(
  include: readonly string[],
  exclude: readonly string[],
): (path: string) => boolean {
  const inc = include.map(globToRegExp)
  const exc = exclude.map(globToRegExp)
  return (path) => {
    const rel = path.replaceAll('\\', '/').replace(/^\.\//, '')
    return inc.some((re) => re.test(rel)) && !exc.some((re) => re.test(rel))
  }
}
