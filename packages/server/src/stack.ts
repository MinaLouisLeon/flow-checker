// Stack frames from captures, and mapping them back to project source files through the
// dev build's source maps (Turbopack and webpack both write `.map` files next to the chunks).
import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlattenMap, originalPositionFor, type TraceMap } from '@jridgewell/trace-mapping'

export interface StackFrame {
  /** Function name as V8 printed it, e.g. `ProductsTable.useEffect`, `async backend`. */
  fn?: string
  /** URL or file path of the script. */
  location: string
  line: number
  column: number
}

export interface SourceFrame {
  fn?: string
  /** Project-relative path with forward slashes. */
  file: string
  line: number
  column: number
}

const FRAME = /^at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/

/** Parses V8 stack lines like `at fn (url:line:col)` or `at url:line:col`. */
export function parseFrame(text: string): StackFrame | undefined {
  const m = FRAME.exec(text.trim())
  if (!m) return undefined
  const [, fn, location = '', line = '0', column = '0'] = m
  let name = fn?.replace(/^async\s+/, '').replace(/^new\s+/, '')
  if (name === '<anonymous>' || name === '') name = undefined
  return { fn: name, location, line: Number(line), column: Number(column) }
}

/** Last part of a function name: `Object.react_stack_bottom_frame` → `react_stack_bottom_frame`. */
export function shortName(fn: string): string {
  const parts = fn.split('.')
  return parts[parts.length - 1] ?? fn
}

const MAX_MAPS = 24
const MAX_FRAMES = 16

interface CachedMap {
  mtimeMs: number
  map: TraceMap | undefined
}

/**
 * Resolves stack frames to project files. Maps are read lazily and cached by file time,
 * so a rebuilt chunk is read again.
 */
export class SourceMapper {
  private readonly maps = new Map<string, CachedMap>()
  private readonly sources = new Map<string, string | undefined>()

  constructor(private readonly root: string) {}

  /** Project frames of a stack, innermost first. Frames in packages are left out. */
  resolve(stack: string[]): SourceFrame[] {
    const out: SourceFrame[] = []
    for (const line of stack.slice(0, MAX_FRAMES)) {
      const frame = parseFrame(line)
      if (!frame) continue
      try {
        const resolved = this.resolveFrame(frame)
        if (resolved) out.push(resolved)
      } catch {
        // A broken map only costs this signal.
      }
    }
    return out
  }

  private resolveFrame(frame: StackFrame): SourceFrame | undefined {
    // webpack dev: `webpack-internal:///(app-pages-browser)/./src/lib/api.ts` (eval source maps).
    const internal = /^webpack-internal:\/\/\/(?:\([^)]*\)\/)?\.\/(.+)$/.exec(frame.location)
    if (internal?.[1]) {
      const file = internal[1]
      return isProjectFile(file) ? { fn: frame.fn, file, line: frame.line, column: frame.column } : undefined
    }

    const script = this.scriptFile(frame.location)
    if (!script) return undefined
    // Code that runs straight from the project (no bundling).
    if (!script.endsWith('.js') || !script.includes(`${sep}.next${sep}`)) {
      const file = this.projectPath(script)
      return file ? { fn: frame.fn, file, line: frame.line, column: frame.column } : undefined
    }
    const map = this.mapFor(script)
    if (!map) return undefined
    const pos = originalPositionFor(map, { line: frame.line, column: Math.max(0, frame.column - 1) })
    if (!pos.source || pos.line === null) return undefined
    const file = this.sourcePath(pos.source)
    if (!file) return undefined
    return { fn: frame.fn, file, line: pos.line, column: (pos.column ?? 0) + 1 }
  }

  /** The chunk on disk for a frame location: a URL served by `next dev`, or a server file path. */
  private scriptFile(location: string): string | undefined {
    if (/^https?:\/\//.test(location)) {
      let url: URL
      try {
        url = new URL(location)
      } catch {
        return undefined
      }
      const path = decodeURIComponent(url.pathname)
      if (!path.startsWith('/_next/')) return undefined
      const rest = path.slice('/_next/'.length)
      // Next 16 keeps dev output in `.next/dev`, older versions in `.next`.
      for (const dir of [join(this.root, '.next', 'dev'), join(this.root, '.next')]) {
        const file = join(dir, rest)
        if (existsSync(file)) return file
      }
      return undefined
    }
    if (location.startsWith('file://')) {
      try {
        return fileURLToPath(location)
      } catch {
        return undefined
      }
    }
    if (isAbsolute(location) && !location.includes(`${sep}node_modules${sep}`)) return location
    return undefined
  }

  private mapFor(script: string): TraceMap | undefined {
    const mapFile = `${script}.map`
    let mtimeMs: number
    try {
      mtimeMs = statSync(mapFile).mtimeMs
    } catch {
      return undefined
    }
    const cached = this.maps.get(mapFile)
    if (cached && cached.mtimeMs === mtimeMs) return cached.map
    let map: TraceMap | undefined
    try {
      // `FlattenMap` also reads sectioned (index) maps, which Turbopack writes.
      map = new FlattenMap(readFileSync(mapFile, 'utf8'), mapFile)
    } catch {
      map = undefined
    }
    this.maps.delete(mapFile)
    this.maps.set(mapFile, { mtimeMs, map })
    while (this.maps.size > MAX_MAPS) {
      const oldest = this.maps.keys().next().value
      if (oldest === undefined) break
      this.maps.delete(oldest)
    }
    return map
  }

  /**
   * A map source as a project path. Sources look like `file:///C:/app/src/x.tsx`,
   * `turbopack:///[project]/apps/web/src/x.tsx` (relative to the workspace root, which may be
   * above the project) or `webpack://_N_E/./src/x.tsx`.
   */
  private sourcePath(source: string): string | undefined {
    if (this.sources.has(source)) return this.sources.get(source)
    let file: string | undefined
    if (source.startsWith('file://')) {
      try {
        file = this.projectPath(fileURLToPath(source))
      } catch {}
    } else {
      const path = source
        .replace(/^[a-z-]+:\/\/\/?/i, '')
        .replace(/^\[project\]\//, '')
        .replace(/^_N_E\//, '')
        .replace(/^\.\//, '')
        .split('?')[0]
      if (path && !path.includes('node_modules/') && !path.startsWith('[')) file = this.findSuffix(path)
    }
    this.sources.set(source, file)
    return file
  }

  /** The longest tail of `path` that exists in the project. */
  private findSuffix(path: string): string | undefined {
    const parts = path.split('/')
    for (let i = 0; i < parts.length; i++) {
      const candidate = parts.slice(i).join('/')
      if (candidate && existsSync(join(this.root, candidate))) return candidate
    }
    return undefined
  }

  private projectPath(absolute: string): string | undefined {
    const rel = relative(this.root, absolute)
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) return undefined
    const file = rel.split(sep).join('/')
    return isProjectFile(file) ? file : undefined
  }
}

function isProjectFile(file: string): boolean {
  return !file.includes('node_modules/') && !file.startsWith('.next/')
}
