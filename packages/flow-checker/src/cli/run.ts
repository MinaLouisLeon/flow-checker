import { parseArgs } from 'node:util'
import { CLI_NAME, PACKAGE_NAME } from '@flow-checker/shared'
import { version } from '../../package.json'
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
  --tree            scan: also print the route and component trees
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
    return scanCommand({ root: values.root, appDir: values['app-dir'], tree: values.tree }, io)
  }

  io.err(`"${command}" is not implemented yet.`)
  return 1
}

function parse(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      root: { type: 'string' },
      'app-dir': { type: 'string' },
      tree: { type: 'boolean' },
    },
  })
}

function isCommand(value: string): value is Command {
  return Object.hasOwn(COMMANDS, value)
}
