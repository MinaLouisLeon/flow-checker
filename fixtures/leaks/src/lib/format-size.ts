import { freeSpace } from './disk'

export function formatSize(bytes: number): string {
  const kb = bytes / 1024
  return `${kb.toFixed(1)} KB (${freeSpace()} free)`
}
