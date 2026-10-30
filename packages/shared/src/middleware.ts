// Middleware matchers and rewrites (M14): which paths `middleware.ts` / `proxy.ts` runs on, and the
// route that really answers a URL once its rewrites are applied. Shared by the scanner (matcher →
// routes), the tool server (captures → routes) and the dashboard.
import type { Middleware } from './model'

// --- Matcher patterns -----------------------------------------------------------------------
// Next compiles `config.matcher` sources with path-to-regexp v6 (`parse` + `tokensToRegexp`, with
// the default options: anchored at both ends, optional trailing slash, case-insensitive). This is
// the same grammar: `:name`, `:name(regex)`, `(regex)`, `{prefix:name suffix}`, the `?` `*` `+`
// modifiers and `\` escapes. Next's optional `/_next/data/...` prefix and `.rsc` / `.json`
// suffixes only add forms of the same page, so they are left out.

type LexKind = 'OPEN' | 'CLOSE' | 'PATTERN' | 'NAME' | 'CHAR' | 'ESCAPED_CHAR' | 'MODIFIER' | 'END'

interface LexToken {
  type: LexKind
  value: string
}

interface Key {
  prefix: string
  suffix: string
  pattern: string
  modifier: string
}

type Token = string | Key

const DELIMITER = '/#?'
const DEFAULT_PATTERN = `[^${escapeRegExp(DELIMITER)}]+?`

function lex(str: string): LexToken[] {
  const tokens: LexToken[] = []
  let i = 0
  while (i < str.length) {
    const char = str[i] as string
    if (char === '*' || char === '+' || char === '?') {
      tokens.push({ type: 'MODIFIER', value: char })
      i++
    } else if (char === '\\') {
      tokens.push({ type: 'ESCAPED_CHAR', value: str[i + 1] ?? '' })
      i += 2
    } else if (char === '{' || char === '}') {
      tokens.push({ type: char === '{' ? 'OPEN' : 'CLOSE', value: char })
      i++
    } else if (char === ':') {
      let name = ''
      let j = i + 1
      while (j < str.length && /[0-9A-Za-z_]/.test(str[j] as string)) name += str[j++]
      if (!name) throw new TypeError(`Missing parameter name at ${i}`)
      tokens.push({ type: 'NAME', value: name })
      i = j
    } else if (char === '(') {
      let count = 1
      let pattern = ''
      let j = i + 1
      if (str[j] === '?') throw new TypeError(`Pattern cannot start with "?" at ${j}`)
      while (j < str.length) {
        const c = str[j] as string
        if (c === '\\') {
          pattern += c + (str[j + 1] ?? '')
          j += 2
          continue
        }
        if (c === ')') {
          count--
          if (count === 0) {
            j++
            break
          }
        } else if (c === '(') {
          count++
          if (str[j + 1] !== '?') throw new TypeError(`Capturing groups are not allowed at ${j}`)
        }
        pattern += c
        j++
      }
      if (count) throw new TypeError(`Unbalanced pattern at ${i}`)
      if (!pattern) throw new TypeError(`Missing pattern at ${i}`)
      tokens.push({ type: 'PATTERN', value: pattern })
      i = j
    } else {
      tokens.push({ type: 'CHAR', value: char })
      i++
    }
  }
  tokens.push({ type: 'END', value: '' })
  return tokens
}

function parse(str: string): Token[] {
  const tokens = lex(str)
  const result: Token[] = []
  let i = 0
  let path = ''
  const tryConsume = (type: LexKind) => {
    if (i < tokens.length && tokens[i]?.type === type) return (tokens[i++] as LexToken).value
    return undefined
  }
  const mustConsume = (type: LexKind) => {
    const value = tryConsume(type)
    if (value !== undefined) return value
    throw new TypeError(`Unexpected ${tokens[i]?.type} at ${i}, expected ${type}`)
  }
  const consumeText = () => {
    let out = ''
    for (let v = tryConsume('CHAR') ?? tryConsume('ESCAPED_CHAR'); v !== undefined; ) {
      out += v
      v = tryConsume('CHAR') ?? tryConsume('ESCAPED_CHAR')
    }
    return out
  }

  while (i < tokens.length) {
    const char = tryConsume('CHAR')
    const name = tryConsume('NAME')
    const pattern = tryConsume('PATTERN')
    if (name !== undefined || pattern !== undefined) {
      let prefix = char ?? ''
      if (!'./'.includes(prefix) || prefix === '') {
        path += prefix
        prefix = ''
      }
      if (path) {
        result.push(path)
        path = ''
      }
      result.push({
        prefix,
        suffix: '',
        pattern: pattern ?? DEFAULT_PATTERN,
        modifier: tryConsume('MODIFIER') ?? '',
      })
      continue
    }
    const value = char ?? tryConsume('ESCAPED_CHAR')
    if (value !== undefined) {
      path += value
      continue
    }
    if (path) {
      result.push(path)
      path = ''
    }
    if (tryConsume('OPEN') !== undefined) {
      const prefix = consumeText()
      const groupName = tryConsume('NAME') ?? ''
      const groupPattern = tryConsume('PATTERN') ?? ''
      const suffix = consumeText()
      mustConsume('CLOSE')
      result.push({
        prefix,
        suffix,
        pattern: groupName && !groupPattern ? DEFAULT_PATTERN : groupPattern,
        modifier: tryConsume('MODIFIER') ?? '',
      })
      continue
    }
    mustConsume('END')
  }
  return result
}

function escapeRegExp(str: string): string {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, '\\$1')
}

function toRegExp(tokens: Token[]): RegExp {
  let route = '^'
  for (const token of tokens) {
    if (typeof token === 'string') {
      route += escapeRegExp(token)
      continue
    }
    const prefix = escapeRegExp(token.prefix)
    const suffix = escapeRegExp(token.suffix)
    const { pattern, modifier } = token
    if (pattern) {
      if (prefix || suffix) {
        if (modifier === '+' || modifier === '*') {
          const mod = modifier === '*' ? '?' : ''
          route += `(?:${prefix}((?:${pattern})(?:${suffix}${prefix}(?:${pattern}))*)${suffix})${mod}`
        } else {
          route += `(?:${prefix}(${pattern})${suffix})${modifier}`
        }
      } else if (modifier === '+' || modifier === '*') {
        route += `((?:${pattern})${modifier})`
      } else {
        route += `(${pattern})${modifier}`
      }
    } else {
      route += `(?:${prefix}${suffix})${modifier}`
    }
  }
  route += `[${escapeRegExp(DELIMITER)}]?$`
  return new RegExp(route, 'i')
}

const compiled = new Map<string, RegExp | undefined>()

/** The regular expression Next builds for a matcher source, or undefined when it is invalid. */
export function matcherRegExp(source: string): RegExp | undefined {
  if (!compiled.has(source)) {
    let re: RegExp | undefined
    try {
      re = source.startsWith('/') ? toRegExp(parse(source)) : undefined
    } catch {
      re = undefined
    }
    compiled.set(source, re)
  }
  return compiled.get(source)
}

/**
 * Whether the middleware runs for a request path: `yes`, `no`, or `conditional` when it depends on
 * headers, cookies or the query (`has` / `missing`), or when the matcher could not be read.
 */
export function middlewareRunsOn(middleware: Middleware, path: string): 'yes' | 'no' | 'conditional' {
  if (middleware.matcherText !== undefined) return 'conditional'
  if (middleware.matchers.length === 0) return 'yes'
  let result: 'no' | 'conditional' = 'no'
  for (const matcher of middleware.matchers) {
    if (!matcherRegExp(matcher.source)?.test(path)) continue
    if (!matcher.has?.length && !matcher.missing?.length) return 'yes'
    result = 'conditional'
  }
  return result
}

// --- Rewrites -------------------------------------------------------------------------------

/**
 * The paths the app may really serve for a requested path, most likely first: the targets of the
 * middleware's rewrites that apply to it, the next-intl default-locale path for a path without a
 * locale, then the path itself. Placeholders in rewrite targets become `x`, which is enough to
 * test them against route patterns.
 */
export function servedPaths(middleware: Middleware | undefined, path: string): string[] {
  if (!middleware || middlewareRunsOn(middleware, path) === 'no') return [path]
  const out: string[] = []
  for (const rewrite of middleware.rewrites) {
    const target = rewrite.href.path
    if (!rewrite.from || !target?.startsWith('/') || rewrite.href.base) continue
    const { kind, path: from } = rewrite.from
    const applies =
      kind === 'exact'
        ? trimSlash(path) === trimSlash(from)
        : path === from || path.startsWith(from.endsWith('/') ? from : `${from}/`)
    if (applies) out.push(target.replace(/:[^/]+/g, 'x'))
  }
  const i18n = middleware.i18n
  if (i18n?.defaultLocale && i18n.locales.length > 0) {
    const first = path.split('/')[1] ?? ''
    if (!i18n.locales.includes(first)) out.push(`/${i18n.defaultLocale}${path === '/' ? '' : path}`)
  }
  out.push(path)
  return [...new Set(out)]
}

function trimSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}
