// `flow-checker init` (docs/PLAN.md 7.1): adds the capture hooks, a config file and .gitignore
// entries, after showing the changes and asking for confirmation.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE, PACKAGE_NAME } from '@flow-checker/shared'
import { findConfigFile } from './config'
import {
  detectPackageManager,
  ensureGitignore,
  findHook,
  hookDir,
  missingGitignoreEntries,
  nextVersion,
  readPackageJson,
} from './project'
import type { CliIO } from './run'

export interface InitCommandOptions {
  root?: string
  appDir?: string
  /** Apply without asking. */
  yes?: boolean
}

interface Change {
  file: string
  action: 'create' | 'append'
  content: string
}

const CLIENT_SNIPPET = `// flow-checker: captures requests while you test the app. It does nothing unless the app
// was started by \`flow-checker\`, and nothing in production builds.
import { installClientRuntime } from '${PACKAGE_NAME}/runtime/client'

installClientRuntime(process.env.NEXT_PUBLIC_FLOW_CHECKER)
`

const REGISTER_BODY = `  // flow-checker: captures server-side requests while you test. It does nothing unless FLOW_CHECKER=1.
  if (process.env.FLOW_CHECKER === '1' && process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerServerRuntime } = await import('${PACKAGE_NAME}/runtime/server')
    registerServerRuntime()
  }`

const SERVER_SNIPPET = `export async function register() {
${REGISTER_BODY}
}
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

const REGISTER_EXPORT =
  /export\s+(?:async\s+)?function\s+register\b|export\s+(?:const|let|var)\s+register\b|export\s*\{[^}]*\bregister\b/

export async function initCommand(options: InitCommandOptions, io: CliIO): Promise<number> {
  const root = resolve(options.root ?? process.cwd())
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

  // Server hook. An existing register() can't be merged safely, so the user adds two lines.
  const server = findHook(dir, 'instrumentation')
  if (!server) {
    changes.push({ file: join(dir, `instrumentation${ext}`), action: 'create', content: SERVER_SNIPPET })
  } else {
    const text = readFileSync(server, 'utf8')
    if (!text.includes(`${PACKAGE_NAME}/runtime/server`)) {
      if (REGISTER_EXPORT.test(text)) {
        manual.push(
          `${rel(server)} already exports register(). Add this at the start of it (register must be async):\n\n${REGISTER_BODY}\n`,
        )
      } else {
        changes.push({ file: server, action: 'append', content: `\n${SERVER_SNIPPET}` })
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

  if (changes.length === 0 && ignore.length === 0) {
    io.out('flow-checker is already set up in this project.')
    for (const note of manual) io.out(`\n${note}`)
    return 0
  }

  io.out('flow-checker init will make these changes:\n')
  for (const change of changes) {
    io.out(`  ${change.action === 'create' ? 'create' : 'update'}  ${rel(change.file)}`)
  }
  if (ignore.length > 0) io.out(`  update  .gitignore (${ignore.join(', ')})`)
  io.out('')

  if (!options.yes) {
    const ok = io.confirm ? await io.confirm('Apply these changes?') : false
    if (!ok) {
      io.err(io.confirm ? 'Nothing changed.' : 'Nothing changed. Run "flow-checker init --yes" to apply.')
      return 1
    }
  }

  for (const change of changes) {
    if (change.action === 'create') writeFileSync(change.file, change.content)
    else {
      const text = readFileSync(change.file, 'utf8')
      appendFileSync(change.file, `${text.endsWith('\n') ? '' : '\n'}${change.content}`)
    }
    io.out(`${change.action === 'create' ? 'Created' : 'Updated'} ${rel(change.file)}`)
  }
  if (ensureGitignore(root).length > 0) io.out('Updated .gitignore')

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
