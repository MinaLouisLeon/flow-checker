import type { FileSystemHost } from 'ts-morph'
import { findMiddleware } from './middleware'
import { resolveFrom } from './paths'

export class ScanError extends Error {
  override name = 'ScanError'
}

/** Absolute paths (forward slashes) of the things the scan needs. */
export interface Discovery {
  root: string
  appDir: string
  tsconfig?: string
  nextConfig?: string
  nextVersion?: string
  /** `middleware.*` or `proxy.*` next to the app directory (M14). */
  middleware?: string
}

const NEXT_CONFIGS = [
  'next.config.ts',
  'next.config.mts',
  'next.config.js',
  'next.config.mjs',
  'next.config.cjs',
]

/** Finds the app directory, tsconfig, next.config and Next version (docs/PLAN.md 6.1). */
export function discoverProject(fs: FileSystemHost, root: string, appDir?: string): Discovery {
  if (!fs.directoryExistsSync(root)) throw new ScanError(`Project root not found: ${root}`)

  const app = appDir
    ? resolveFrom(root, appDir)
    : [`${root}/src/app`, `${root}/app`].find((dir) => fs.directoryExistsSync(dir))
  if (!app || !fs.directoryExistsSync(app)) {
    throw new ScanError(
      appDir
        ? `App directory not found: ${app}`
        : `No App Router directory found in ${root} (looked for src/app and app). flow-checker supports the App Router only.`,
    )
  }

  const tsconfig = [`${root}/tsconfig.json`, `${root}/jsconfig.json`].find((f) => fs.fileExistsSync(f))
  const nextConfig = NEXT_CONFIGS.map((f) => `${root}/${f}`).find((f) => fs.fileExistsSync(f))

  const middleware = findMiddleware(fs, root, app)
  return {
    root,
    appDir: app,
    tsconfig,
    nextConfig,
    nextVersion: nextVersion(fs, root),
    ...(middleware ? { middleware } : {}),
  }
}

/** Installed version if available, otherwise the declared range from package.json. */
function nextVersion(fs: FileSystemHost, root: string): string | undefined {
  const installed = readJson(fs, `${root}/node_modules/next/package.json`)
  if (typeof installed?.version === 'string') return installed.version
  const pkg = readJson(fs, `${root}/package.json`)
  const declared = pkg?.dependencies?.next ?? pkg?.devDependencies?.next
  return typeof declared === 'string' ? declared : undefined
}

// biome-ignore lint/suspicious/noExplicitAny: untyped JSON
function readJson(fs: FileSystemHost, file: string): any {
  try {
    return fs.fileExistsSync(file) ? JSON.parse(fs.readFileSync(file)) : undefined
  } catch {
    return undefined
  }
}
