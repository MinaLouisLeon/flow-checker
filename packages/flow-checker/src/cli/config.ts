import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { FlowCheckerConfig } from '@flow-checker/shared'

export const CONFIG_FILES = [
  'flow-checker.config.ts',
  'flow-checker.config.mts',
  'flow-checker.config.js',
  'flow-checker.config.mjs',
]

export class ConfigError extends Error {
  override name = 'ConfigError'
}

/** Finds `flow-checker.config.*` in the project root. */
export function findConfigFile(root: string): string | undefined {
  return CONFIG_FILES.map((name) => join(root, name)).find((file) => existsSync(file))
}

/**
 * Loads the config file (default export). `.ts` files load through Node's built-in type
 * stripping (Node 22.18+). Returns an empty config when there is no file.
 */
export async function loadConfig(
  root: string,
  file?: string,
): Promise<{ config: FlowCheckerConfig; file?: string }> {
  const path = file ? resolve(root, file) : findConfigFile(root)
  if (!path) return { config: {} }
  if (!existsSync(path)) throw new ConfigError(`Config file not found: ${path}`)
  let mod: { default?: unknown }
  // Most Next.js projects have no `"type": "module"`, so Node warns that it re-parses the
  // config as ESM. That is expected here and only noise for the user.
  const emitWarning = process.emitWarning
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const code = typeof rest[0] === 'object' ? (rest[0] as { code?: string })?.code : rest[1]
    if (code === 'MODULE_TYPELESS_PACKAGE_JSON') return
    return (emitWarning as (...a: unknown[]) => void).call(process, warning, ...rest)
  }) as typeof process.emitWarning
  try {
    mod = (await import(`${pathToFileURL(path).href}?t=${Date.now()}`)) as { default?: unknown }
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    const hint =
      err.code === 'ERR_UNKNOWN_FILE_EXTENSION'
        ? ' Your Node.js version cannot load TypeScript config files: use Node 22.18+ or rename it to flow-checker.config.mjs.'
        : ''
    throw new ConfigError(`Could not load ${path}: ${err.message}${hint}`)
  } finally {
    process.emitWarning = emitWarning
  }
  const config = mod.default
  if (!config || typeof config !== 'object') {
    throw new ConfigError(
      `${path} must export a config object as default (export default defineConfig({ ... })).`,
    )
  }
  return { config: config as FlowCheckerConfig, file: path }
}
