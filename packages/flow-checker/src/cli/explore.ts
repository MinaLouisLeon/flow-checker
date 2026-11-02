// `flow-checker explore` (M28): scan + watch + dashboard with no app, no hooks and no config.
// It never starts the app and never edits project files. Without a flow-checker setup, the scan
// and exports go to a folder outside the project, so a fresh clone stays clean.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { CLI_NAME, PACKAGE_NAME } from '@flow-checker/shared'
import { type DevCommandOptions, runUntilStopped, startDev } from './dev'
import { detectPackageManager, findHook, readPackageJson } from './project'
import type { CliIO } from './run'

export type ExploreCommandOptions = Omit<DevCommandOptions, 'app' | 'devCommand' | 'explore'>

/** What explore found of a flow-checker setup in the project. */
export interface ProjectSetup {
  config: boolean
  hooks: boolean
  data: boolean
}

/**
 * The flow-checker files the project already has: a config, a hook that loads the runtime (in the
 * root or `src/`), or a `.flow-checker/` folder. Hooks are looked up before the scan knows the app
 * directory, so both places count.
 */
export function projectSetup(root: string, configFile: string | undefined): ProjectSetup {
  const hooks = [root, join(root, 'src')].some((dir) =>
    (['instrumentation', 'instrumentation-client'] as const).some((name) => {
      const file = findHook(dir, name)
      return Boolean(file && mentionsRuntime(file))
    }),
  )
  return { config: Boolean(configFile), hooks, data: existsSync(join(root, '.flow-checker')) }
}

export function hasSetup(setup: ProjectSetup): boolean {
  return setup.config || setup.hooks || setup.data
}

function mentionsRuntime(file: string): boolean {
  try {
    return /flow-checker\/runtime\//.test(readFileSync(file, 'utf8'))
  } catch {
    return false
  }
}

/**
 * The folder outside the project that holds explore's data when there is no setup: the OS temp
 * folder, keyed by the project path so two projects with the same name don't share it.
 */
export function exploreDataDir(root: string): string {
  const key = process.platform === 'win32' ? root.toLowerCase() : root
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 12)
  const name = basename(root).replace(/[^\w.-]+/g, '-') || 'project'
  return join(tmpdir(), CLI_NAME, `${name}-${hash}`)
}

/** The commands that turn capture on, in order: install (when missing), `init`, then `flow-checker`. */
export function enableCaptureCommands(root: string, setup: ProjectSetup): string[] {
  const commands: string[] = []
  const pkg = readPackageJson(root)
  const deps = { ...(pkg?.devDependencies as object), ...(pkg?.dependencies as object) }
  if (!Object.hasOwn(deps, PACKAGE_NAME)) {
    const pm = detectPackageManager(root)
    commands.push(`${pm === 'npm' ? 'npm install -D' : `${pm} add -D`} ${PACKAGE_NAME}`)
  }
  if (!setup.hooks) commands.push(`npx ${CLI_NAME} init`)
  commands.push(`npx ${CLI_NAME}`)
  return commands
}

/** CLI entry: runs until Ctrl+C. */
export async function exploreCommand(options: ExploreCommandOptions, io: CliIO): Promise<number> {
  const result = await startDev({ ...options, app: false, explore: true }, io)
  if (typeof result === 'number') return result
  return runUntilStopped(result, io)
}
