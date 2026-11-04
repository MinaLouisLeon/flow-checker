// biome-ignore lint/style/useNodejsImportProtocol: planted leak; Turbopack crashes on `node:fs` in client code instead of reporting it
import { statfsSync } from 'fs'

export function freeSpace(): number {
  const stats = statfsSync('.')
  return stats.bavail * stats.bsize
}
