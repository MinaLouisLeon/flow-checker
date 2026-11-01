// `flow-checker init` (docs/PLAN.md 7.1): adds the capture hooks, a config file and .gitignore
// entries, after showing the changes and asking for confirmation.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE, PACKAGE_NAME } from '@flow-checker/shared'
import { findConfigFile } from './config'
import { createProgress, type Progress } from './progress'
import {
  detectPackageManager,
  ensureGitignore,
  findHook,
  findMiddlewareFile,
  hookDir,
  middlewareOnEdge,
  missingGitignoreEntries,
  nextVersion,
  readPackageJson,
} from './project'
import type { CliIO } from './run'
import { EDGE_BODY, editServerHook, SERVER_SNIPPET } from './server-hook'

export interface InitCommandOptions {
  root?: string
  appDir?: string
  /** Apply without asking. */
  yes?: boolean
}

interface Change {
  file: string
  /** `replace` writes `content` as the whole new file. */
  action: 'create' | 'append' | 'replace'
  content: string
  /** What an edit does, shown in the list of changes. */
  detail?: string
}

const CLIENT_SNIPPET = `// flow-checker: captures requests while you test the app. It does nothing unless the app
// was started by \`flow-checker\`, and nothing in production builds.
import { installClientRuntime } from '${PACKAGE_NAME}/runtime/client'

installClientRuntime(process.env.NEXT_PUBLIC_FLOW_CHECKER)
`

const CONFIG_SNIPPET = `import { defineConfig } from '${PACKAGE_NAME}/config'

export default defineConfig({
  // Project root, relative to this file.
  root: '.',
  // Files the scan reads and skips: globs relative to the root.
  include: ${JSON.stringify(DEFAULT_INCLUDE).replaceAll('"', "'")},
  exclude: [
${DEFAULT_EXCLUDE.map((glob) => `    '${glob}',`).join('\n')}
  ],
  // Modules whose calls are requests (HTTP libraries or API clients the scan can't follow), e.g.
  // { module: 'ky', methods: ['default', 'get', 'post'] } or { module: '@acme/api', methods: ['listOrders'] }
  apiClients: [],
  capture: {
    // Sensitive values (passwords, tokens, auth headers...) are masked before they are saved.
    // Set to true only for local debugging.
    storeRaw: false,
  },
})
`

const WRAPPER_SNIPPET = `  import { withFlowChecker } from '${PACKAGE_NAME}/next'
  export default withFlowChecker(nextConfig)
`

const NEXT_CONFIGS = [
  'next.config.ts',
  'next.config.mts',
  'next.config.js',
  'next.config.mjs',
  'next.config.cjs',
]

export async function initCommand(options: InitCommandOptions, io: CliIO): Promise<number> {
  const progress = createProgress(io, [
    { id: 'check', weight: 30 },
    { id: 'apply', weight: 70 },
  ])
  try {
    return await init(options, io, progress)
  } finally {
    progress.finish()
  }
}

async function init(options: InitCommandOptions, io: CliIO, progress: Progress): Promise<number> {
  const root = resolve(options.root ?? process.cwd())
  progress.start('check', 'Checking the project…')
  const appDir = options.appDir
    ? resolve(root, options.appDir)
    : [join(root, 'src', 'app'), join(root, 'app')].find((dir) => existsSync(dir))
  if (!appDir || !existsSync(appDir)) {
    io.err(`No App Router directory found in ${root} (looked for src/app and app).`)
    return 1
  }

  const dir = hookDir(root, appDir)
  const ts = existsSync(join(root, 'tsconfig.json'))
  const ext = ts ? '.ts' : '.js'
  const rel = (file: string) => relative(root, file).replaceAll('\\', '/')
  const changes: Change[] = []
  const manual: string[] = []

  // Browser hook. It runs as a side-effect module, so appending is safe.
  const client = findHook(dir, 'instrumentation-client')
  if (!client) {
    changes.push({
      file: join(dir, `instrumentation-client${ext}`),
      action: 'create',
      content: CLIENT_SNIPPET,
    })
  } else if (!readFileSync(client, 'utf8').includes(`${PACKAGE_NAME}/runtime/client`)) {
    changes.push({ file: client, action: 'append', content: `\n${CLIENT_SNIPPET}` })
  }

  // Server hook: the blocks go first in register(), outside any condition (M22). An existing
  // register() is edited in place; shapes that can't be edited are left to the user.
  const server = findHook(dir, 'instrumentation')
  if (!server) {
    changes.push({ file: join(dir, `instrumentation${ext}`), action: 'create', content: SERVER_SNIPPET })
  } else {
    const edit = editServerHook(server, root)
    if (edit.kind === 'append') changes.push({ file: server, action: 'append', content: edit.text })
    else if (edit.kind === 'edit') {
      changes.push({ file: server, action: 'replace', content: edit.text, detail: edit.what })
    } else if (edit.kind === 'manual') manual.push(edit.note)
    else if (!readFileSync(server, 'utf8').includes(`${PACKAGE_NAME}/runtime/edge`)) {
      // Hooks from v0.1 don't capture middleware on the edge runtime.
      const middleware = findMiddlewareFile(root, appDir)
      if (middleware && middlewareOnEdge(middleware, nextVersion(root))) {
        manual.push(
          `${rel(middleware)} runs on the edge runtime. To capture the requests it sends, add this to register() in ${rel(server)}:\n\n${EDGE_BODY}\n`,
        )
      }
    }
  }

  if (!findConfigFile(root)) {
    changes.push({
      file: join(root, `flow-checker.config${ts ? '.ts' : '.mjs'}`),
      action: 'create',
      content: CONFIG_SNIPPET,
    })
  }

  const ignore = missingGitignoreEntries(root)

  const version = nextVersion(root)
  if (version && (version.major < 15 || (version.major === 15 && version.minor < 3))) {
    const nextConfig = NEXT_CONFIGS.map((f) => join(root, f)).find((f) => existsSync(f))
    if (!nextConfig || !readFileSync(nextConfig, 'utf8').includes('withFlowChecker')) {
      manual.push(
        `Next.js ${version.text} has no instrumentation-client file (added in 15.3)${version.major < 15 ? ' and runs instrumentation.ts only with experimental.instrumentationHook' : ''}. Wrap your config in ${nextConfig ? rel(nextConfig) : 'next.config.mjs'} so both hooks run:

${WRAPPER_SNIPPET}
It does nothing unless the app was started by flow-checker. Browser capture needs webpack on these versions (next dev without --turbo).`,
      )
    }
  }

  progress.done()
  if (changes.length === 0 && ignore.length === 0) {
    io.out('flow-checker is already set up in this project.')
    for (const note of manual) io.out(`\n${note}`)
    return 0
  }

  io.out('flow-checker init will make these changes:\n')
  for (const change of changes) {
    io.out(
      `  ${change.action === 'create' ? 'create' : 'update'}  ${rel(change.file)}${change.detail ? ` (${change.detail})` : ''}`,
    )
  }
  if (ignore.length > 0) io.out(`  update  .gitignore (${ignore.join(', ')})`)
  io.out('')

  if (!options.yes) {
    // No live line while the question waits for an answer.
    progress.pause()
    const ok = io.confirm ? await io.confirm('Apply these changes?') : false
    progress.resume()
    if (!ok) {
      io.err(io.confirm ? 'Nothing changed.' : 'Nothing changed. Run "flow-checker init --yes" to apply.')
      return 1
    }
  }

  const steps = changes.length + (ignore.length > 0 ? 1 : 0)
  progress.start('apply', 'Applying changes…', steps)
  for (const [index, change] of changes.entries()) {
    if (change.action === 'create' || change.action === 'replace') writeFileSync(change.file, change.content)
    else {
      const text = readFileSync(change.file, 'utf8')
      appendFileSync(change.file, `${text.endsWith('\n') ? '' : '\n'}${change.content}`)
    }
    io.out(`${change.action === 'create' ? 'Created' : 'Updated'} ${rel(change.file)}`)
    progress.update(index + 1)
  }
  if (ensureGitignore(root).length > 0) io.out('Updated .gitignore')
  progress.done()

  for (const note of manual) io.out(`\nTo do: ${note}`)

  const pkg = readPackageJson(root)
  const deps = { ...(pkg?.dependencies as object), ...(pkg?.devDependencies as object) }
  if (!Object.hasOwn(deps, PACKAGE_NAME)) {
    const pm = detectPackageManager(root)
    const add = pm === 'npm' ? 'npm install -D' : `${pm} add -D`
    io.out(`\nThe hooks import ${PACKAGE_NAME}. Add it to the project: ${add} ${PACKAGE_NAME}`)
  }
  io.out('\nDone. Run "flow-checker" to start the dashboard and your app with capture on.')
  return 0
}
