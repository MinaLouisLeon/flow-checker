// Writes an export folder. A manifest lists the files written, so the next export replaces them
// (and removes pages that no longer exist) without touching anything else in the folder.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize, relative, sep } from 'node:path'

/** Path (forward slashes, relative to the output folder) → content. */
export type OutputFiles = Record<string, string | Uint8Array>

export const MANIFEST = '.flow-checker-export.json'

interface Manifest {
  version: 1
  format: string
  generatedAt: string
  files: string[]
}

export class ExportWriteError extends Error {
  override name = 'ExportWriteError'
}

export interface WriteOptions {
  /** `md` or `html`, recorded in the manifest. */
  format: string
  generatedAt: string
  /** Write into a folder that has other files and no manifest. */
  force?: boolean
  /** Called after each file is written (CLI progress output). */
  onFile?: (done: number, total: number) => void
}

/** Writes the files to `dir`, replacing the previous export there. Returns the paths written. */
export function writeExport(dir: string, files: OutputFiles, options: WriteOptions): string[] {
  const names = Object.keys(files).sort()
  for (const name of names) {
    if (!isInside(dir, name))
      throw new ExportWriteError(`Refusing to write outside the export folder: ${name}`)
  }

  const previous = readManifest(dir)
  if (!previous && !options.force && hasFiles(dir)) {
    throw new ExportWriteError(
      `${dir} already has files that flow-checker didn't write. Pick an empty folder, or pass --force to write into it anyway.`,
    )
  }

  // Files from the last export that this one doesn't write again (e.g. a page was removed).
  const next = new Set(names)
  for (const old of previous?.files ?? []) {
    if (next.has(old) || !isInside(dir, old)) continue
    rmSync(join(dir, old), { force: true })
    removeEmptyParents(dir, dirname(join(dir, old)))
  }

  let written = 0
  for (const name of names) {
    const file = join(dir, name)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, files[name] as string | Uint8Array)
    options.onFile?.(++written, names.length)
  }
  const manifest: Manifest = {
    version: 1,
    format: options.format,
    generatedAt: options.generatedAt,
    files: names,
  }
  writeFileSync(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)
  return names
}

function readManifest(dir: string): Manifest | undefined {
  try {
    const data = JSON.parse(readFileSync(join(dir, MANIFEST), 'utf8')) as Manifest
    if (data?.version === 1 && Array.isArray(data.files)) return data
  } catch {}
  return undefined
}

function hasFiles(dir: string): boolean {
  if (!existsSync(dir)) return false
  try {
    return readdirSync(dir).length > 0
  } catch {
    throw new ExportWriteError(`${dir} is not a folder.`)
  }
}

function isInside(dir: string, name: string): boolean {
  if (isAbsolute(name)) return false
  const rel = relative(dir, join(dir, normalize(name)))
  return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel)
}

function removeEmptyParents(root: string, dir: string) {
  let current = dir
  while (current.startsWith(root) && current !== root) {
    try {
      if (readdirSync(current).length > 0) return
      rmdirSync(current)
    } catch {
      return
    }
    current = dirname(current)
  }
}
