// Server Action ids → the file and export they belong to, from Next's
// `server-reference-manifest.json` (written by `next dev` and `next build`).
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface ServerActionInfo {
  /** As Next wrote it: relative to the workspace root, which can be above the project. */
  filename: string
  exportedName: string
}

interface ManifestEntry {
  filename?: string
  exportedName?: string
}

interface Manifest {
  node?: Record<string, ManifestEntry>
  edge?: Record<string, ManifestEntry>
}

/** Reads the manifests again when they change, so actions added during `next dev` resolve. */
export class ServerActionResolver {
  private readonly files: string[]
  private cache = new Map<string, ServerActionInfo>()
  private stamp = ''

  constructor(root: string) {
    // Next 16 keeps dev output in `.next/dev`. Older versions, and builds, use `.next`.
    this.files = [
      join(root, '.next', 'dev', 'server', 'server-reference-manifest.json'),
      join(root, '.next', 'server', 'server-reference-manifest.json'),
    ]
  }

  resolve(id: string): ServerActionInfo | undefined {
    this.refresh()
    return this.cache.get(id)
  }

  private refresh() {
    const stamps = this.files.map((file) => {
      try {
        return String(statSync(file).mtimeMs)
      } catch {
        return '-'
      }
    })
    const stamp = stamps.join('|')
    if (stamp === this.stamp) return
    this.stamp = stamp
    const cache = new Map<string, ServerActionInfo>()
    // The dev manifest is listed first, so it wins over an older build's.
    for (const file of [...this.files].reverse()) {
      let manifest: Manifest
      try {
        manifest = JSON.parse(readFileSync(file, 'utf8')) as Manifest
      } catch {
        continue
      }
      for (const entries of [manifest.node, manifest.edge]) {
        for (const [id, entry] of Object.entries(entries ?? {})) {
          if (entry.filename && entry.exportedName) {
            cache.set(id, {
              filename: entry.filename.replaceAll('\\', '/'),
              exportedName: entry.exportedName,
            })
          }
        }
      }
    }
    this.cache = cache
  }
}

/** True when the manifest's filename is the project file (it may carry a workspace prefix). */
export function sameSourceFile(manifestFile: string, projectFile: string): boolean {
  const a = manifestFile.replace(/^\.\//, '')
  return a === projectFile || a.endsWith(`/${projectFile}`)
}
