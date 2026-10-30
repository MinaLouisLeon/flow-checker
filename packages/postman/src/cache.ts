// The imported collection is cached in `.flow-checker/postman/collection.json`, so scans don't
// need the network (cloud collections) and work without the config after a manual import.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PostmanCloudSource, PostmanConfig } from '@flow-checker/shared'
import { type PostmanImport, PostmanImportSchema } from './imported'
import { type ImportOptions, importPostman, PostmanError } from './load'

export const POSTMAN_DIR = join('.flow-checker', 'postman')
export const POSTMAN_CACHE_FILE = join(POSTMAN_DIR, 'collection.json')

export function readCache(root: string): PostmanImport | undefined {
  const file = join(root, POSTMAN_CACHE_FILE)
  if (!existsSync(file)) return undefined
  try {
    const parsed = PostmanImportSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

export function writeCache(root: string, imported: PostmanImport): string {
  const file = join(root, POSTMAN_CACHE_FILE)
  mkdirSync(join(root, POSTMAN_DIR), { recursive: true })
  writeFileSync(file, `${JSON.stringify(imported, null, 2)}\n`)
  return file
}

/** Uses Postman's cloud: needs the network and an API key. */
export function isCloud(config: PostmanConfig): boolean {
  const cloud = (s: string | PostmanCloudSource | undefined) => s !== undefined && typeof s !== 'string'
  return cloud(config.collection) || cloud(config.environment)
}

export interface LoadResult {
  imported?: PostmanImport
  /** `import`: read from the source now. `cache`: the last import. */
  from?: 'import' | 'cache'
  /** The source could not be read and the cache was used instead. */
  warning?: string
}

export interface LoadOptions extends Omit<ImportOptions, 'config'> {
  config: PostmanConfig | undefined
  /** Read cloud sources again (`dev` start, `postman import`). Local files are always read. */
  refresh?: boolean
  /** Update the cache after reading the source. Default: true (`export` writes nothing). */
  save?: boolean
}

/**
 * The collection a scan uses. With `postman` in the config, local files are read every time and
 * cloud ones when `refresh` is set (otherwise from the cache). Without it, the last
 * `flow-checker postman import` is used, if any. Throws `PostmanError` when nothing usable is found.
 */
export async function loadPostman(options: LoadOptions): Promise<LoadResult> {
  const { config, root } = options
  const cached = () => readCache(root)
  if (!config) {
    const imported = cached()
    return imported ? { imported, from: 'cache' } : {}
  }
  if (isCloud(config) && !options.refresh) {
    const imported = cached()
    if (imported) return { imported, from: 'cache' }
  }
  try {
    const imported = await importPostman({ ...options, config })
    if (options.save !== false) writeCache(root, imported)
    return { imported, from: 'import' }
  } catch (error) {
    const imported = cached()
    if (imported && error instanceof PostmanError) {
      return {
        imported,
        from: 'cache',
        warning: `${error.message} Using the last import (${imported.importedAt}).`,
      }
    }
    throw error
  }
}
