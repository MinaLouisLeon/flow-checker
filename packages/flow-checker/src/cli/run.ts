import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { CLI_NAME, PACKAGE_NAME } from '@flow-checker/shared'
import { version } from '../../package.json'
import { devCommand } from './dev'
import { doctorCommand } from './doctor'
import { exploreCommand } from './explore'
import { exportCommand } from './export'
import { initCommand } from './init'
import { postmanCommand } from './postman'
import { isLiveTerminal, type ProgressDisplay, terminalDisplay } from './progress'
import { scanCommand } from './scan'

const COMMANDS = {
  dev: 'Scan, watch, open the dashboard and run your app with capture (default)',
  explore: 'Scan, watch and open the dashboard only: no app, no setup, project files untouched',
  scan: 'Scan only and write .flow-checker/model.json',
  init: 'Add instrumentation hooks, config file and .gitignore entries',
  export: 'Export Markdown docs and a static HTML site (--md <dir>, --html <dir>)',
  doctor: 'Check Next.js version, hooks, ports and tsconfig',
  postman: 'postman import: read a Postman collection to check the code against',
} as const

type Command = keyof typeof COMMANDS

const HELP = `${CLI_NAME} v${version} (${PACKAGE_NAME})

Usage: ${CLI_NAME} [command] [options]

Commands:
${Object.entries(COMMANDS)
  .map(([name, desc]) => `  ${name.padEnd(8)} ${desc}`)
  .join('\n')}

Options:
  --root <dir>            Project root (default: current directory)
  --app-dir <dir>         App Router directory, relative to the root (default: src/app or app)
  --config <file>         Config file (default: flow-checker.config.* in the root)
  --port <n>              dev, explore: dashboard port (default: 4400)
  --app-port <n>          dev, explore: port your Next.js app runs on (default: 3000)
  --dev-command <cmd>     dev: command that starts your app (default: the "dev" script)
  --no-app                dev: don't start your app (start it yourself with the printed env)
  --no-open               dev, explore: don't open the browser
  --no-watch              dev, explore: don't re-scan when files change
  -y, --yes               init: apply the changes without asking
  --tree                  scan: also print the route and component trees
  --types                 scan: also print the resolved types
  --requests              scan: also print the request sites
  --flows                 scan: also print navigation and inferred flows
  --md <dir>              export: write Markdown docs to this folder
  --html <dir>            export: write the static HTML site to this folder
                          (neither: both, to the config's export folders or docs/flow and .flow-checker/site)
  --collection <src>      postman import: v2.1 JSON file, v3 YAML folder or cloud collection id
                          (default: "postman.collection" in the config)
  --environment <src>     postman import: environment file or cloud id for {{variables}}
  --api-key-env <name>    postman import: env variable with the Postman API key (default: POSTMAN_API_KEY)
  --raw                   export: keep captures as saved, without redacting them again
  --force                 export: write into a folder that has other files
  --verbose               Show more detail: timings, the resolved config, the scan worker
  -q, --quiet             No progress output, only results, warnings and errors
  -h, --help              Show help
  -v, --version           Show version
`

export interface CliIO {
  out: (text: string) => void
  err: (text: string) => void
  /** Asks a yes/no question. Absent when there is no terminal to ask in. */
  confirm?: (question: string) => Promise<boolean>
  /** Where progress is shown (see progress.ts). Absent: no progress output (tests, --quiet). */
  display?: ProgressDisplay
  /** --verbose: timings, the resolved config and other details. */
  verbose?: boolean
}

/** stdout / stderr, with progress on stderr: a live line in a terminal, plain lines otherwise. */
function terminalIO(): CliIO {
  const { display, around } = terminalDisplay(process.stderr, isLiveTerminal(process.stderr))
  return {
    out: (text) => around(() => process.stdout.write(`${text}\n`)),
    err: (text) => around(() => process.stderr.write(`${text}\n`)),
    confirm: process.stdin.isTTY
      ? async (question) => {
          const rl = createInterface({ input: process.stdin, output: process.stdout })
          try {
            return /^y(es)?$/i.test((await rl.question(`${question} [y/N] `)).trim())
          } finally {
            rl.close()
          }
        }
      : undefined,
    display,
  }
}

/** Runs the CLI and returns the exit code. */
export async function runCli(argv: string[], baseIO?: CliIO): Promise<number> {
  let io = baseIO ?? terminalIO()
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(argv)
  } catch (error) {
    io.err((error as Error).message)
    io.err(`Run "${CLI_NAME} --help" for usage.`)
    return 1
  }

  const { values, positionals } = parsed
  if (values.quiet) io = { ...io, display: undefined, verbose: false }
  else if (values.verbose) io = { ...io, verbose: true }
  if (values.version) {
    io.out(version)
    return 0
  }
  if (values.help) {
    io.out(HELP)
    return 0
  }

  const command = positionals[0] ?? 'dev'
  if (!isCommand(command)) {
    io.err(`Unknown command "${command}".`)
    io.err(`Run "${CLI_NAME} --help" for usage.`)
    return 1
  }

  if (command === 'scan') {
    return scanCommand(
      {
        root: values.root,
        appDir: values['app-dir'],
        config: values.config,
        tree: values.tree,
        types: values.types,
        requests: values.requests,
        flows: values.flows,
      },
      io,
    )
  }

  if (command === 'dev') {
    const port = toPort(values.port, '--port', io)
    const appPort = toPort(values['app-port'], '--app-port', io)
    if (port === null || appPort === null) return 1
    return devCommand(
      {
        root: values.root,
        appDir: values['app-dir'],
        config: values.config,
        port,
        appPort,
        open: values.open,
        app: values.app,
        devCommand: values['dev-command'],
        watch: values.watch,
      },
      io,
    )
  }

  if (command === 'explore') {
    const port = toPort(values.port, '--port', io)
    const appPort = toPort(values['app-port'], '--app-port', io)
    if (port === null || appPort === null) return 1
    return exploreCommand(
      {
        root: values.root,
        appDir: values['app-dir'],
        config: values.config,
        port,
        appPort,
        open: values.open,
        watch: values.watch,
      },
      io,
    )
  }

  if (command === 'init') {
    return initCommand({ root: values.root, appDir: values['app-dir'], yes: values.yes }, io)
  }

  if (command === 'export') {
    return exportCommand(
      {
        root: values.root,
        appDir: values['app-dir'],
        config: values.config,
        md: values.md,
        html: values.html,
        raw: values.raw,
        force: values.force,
      },
      io,
    )
  }

  if (command === 'postman') {
    return postmanCommand(
      positionals[1],
      {
        root: values.root,
        appDir: values['app-dir'],
        config: values.config,
        collection: values.collection,
        environment: values.environment,
        apiKeyEnv: values['api-key-env'],
      },
      io,
    )
  }

  const port = toPort(values.port, '--port', io)
  const appPort = toPort(values['app-port'], '--app-port', io)
  if (port === null || appPort === null) return 1
  return doctorCommand(
    { root: values.root, appDir: values['app-dir'], config: values.config, port, appPort },
    io,
  )
}

function parse(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      root: { type: 'string' },
      'app-dir': { type: 'string' },
      tree: { type: 'boolean' },
      types: { type: 'boolean' },
      requests: { type: 'boolean' },
      flows: { type: 'boolean' },
      port: { type: 'string' },
      'app-port': { type: 'string' },
      config: { type: 'string' },
      'dev-command': { type: 'string' },
      app: { type: 'boolean', default: true },
      open: { type: 'boolean', default: true },
      watch: { type: 'boolean', default: true },
      yes: { type: 'boolean', short: 'y' },
      md: { type: 'string' },
      html: { type: 'string' },
      raw: { type: 'boolean' },
      force: { type: 'boolean' },
      collection: { type: 'string' },
      environment: { type: 'string' },
      'api-key-env': { type: 'string' },
      verbose: { type: 'boolean' },
      quiet: { type: 'boolean', short: 'q' },
    },
  })
}

/** Parses a port option. `undefined` when not given, `null` (after printing why) when invalid. */
function toPort(value: string | undefined, flag: string, io: CliIO): number | undefined | null {
  if (value === undefined) return undefined
  const port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    io.err(`${flag} must be a port number, got "${value}".`)
    return null
  }
  return port
}

function isCommand(value: string): value is Command {
  return Object.hasOwn(COMMANDS, value)
}
