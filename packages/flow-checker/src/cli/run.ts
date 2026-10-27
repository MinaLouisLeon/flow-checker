import { parseArgs } from 'node:util'
import { CLI_NAME, PACKAGE_NAME } from '@flow-checker/shared'
import { version } from '../../package.json'
import { devCommand } from './dev'
import { scanCommand } from './scan'

const COMMANDS = {
  dev: 'Scan, watch, open the dashboard and run your app with capture (default)',
  scan: 'Scan only and write .flow-checker/model.json',
  init: 'Add instrumentation hooks, config file and .gitignore entries',
  export: 'Export documentation (--md <dir> | --html <dir>)',
  doctor: 'Check Next.js version, hooks, ports and tsconfig',
} as const

type Command = keyof typeof COMMANDS

const HELP = `${CLI_NAME} v${version} (${PACKAGE_NAME})

Usage: ${CLI_NAME} [command] [options]

Commands:
${Object.entries(COMMANDS)
  .map(([name, desc]) => `  ${name.padEnd(8)} ${desc}`)
  .join('\n')}

Options:
  --root <dir>      Project root (default: current directory)
  --app-dir <dir>   App Router directory, relative to the root (default: src/app or app)
  --port <n>        dev: dashboard port (default: 4400)
  --app-port <n>    dev: port your Next.js app runs on (default: 3000)
  --no-open         dev: don't open the browser
  --tree            scan: also print the route and component trees
  --types           scan: also print the resolved types
  -h, --help        Show help
  -v, --version     Show version
`

export interface CliIO {
  out: (text: string) => void
  err: (text: string) => void
}

const defaultIO: CliIO = {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
}

/** Runs the CLI and returns the exit code. */
export async function runCli(argv: string[], io: CliIO = defaultIO): Promise<number> {
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(argv)
  } catch (error) {
    io.err((error as Error).message)
    io.err(`Run "${CLI_NAME} --help" for usage.`)
    return 1
  }

  const { values, positionals } = parsed
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
      { root: values.root, appDir: values['app-dir'], tree: values.tree, types: values.types },
      io,
    )
  }

  if (command === 'dev') {
    const port = toPort(values.port, '--port', io)
    const appPort = toPort(values['app-port'], '--app-port', io)
    if (port === null || appPort === null) return 1
    return devCommand({ root: values.root, appDir: values['app-dir'], port, appPort, open: values.open }, io)
  }

  io.err(`"${command}" is not implemented yet.`)
  return 1
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
      port: { type: 'string' },
      'app-port': { type: 'string' },
      open: { type: 'boolean', default: true },
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
