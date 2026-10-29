import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { CLI_NAME, PACKAGE_NAME } from '@flow-checker/shared'
import { version } from '../../package.json'
import { devCommand } from './dev'
import { initCommand } from './init'
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
  --root <dir>            Project root (default: current directory)
  --app-dir <dir>         App Router directory, relative to the root (default: src/app or app)
  --config <file>         Config file (default: flow-checker.config.* in the root)
  --port <n>              dev: dashboard port (default: 4400)
  --app-port <n>          dev: port your Next.js app runs on (default: 3000)
  --dev-command <cmd>     dev: command that starts your app (default: the "dev" script)
  --no-app                dev: don't start your app (start it yourself with the printed env)
  --no-open               dev: don't open the browser
  --no-watch              dev: don't re-scan when files change
  -y, --yes               init: apply the changes without asking
  --tree                  scan: also print the route and component trees
  --types                 scan: also print the resolved types
  --requests              scan: also print the request sites
  --flows                 scan: also print navigation and inferred flows
  -h, --help              Show help
  -v, --version           Show version
`

export interface CliIO {
  out: (text: string) => void
  err: (text: string) => void
  /** Asks a yes/no question. Absent when there is no terminal to ask in. */
  confirm?: (question: string) => Promise<boolean>
}

const defaultIO: CliIO = {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
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
      {
        root: values.root,
        appDir: values['app-dir'],
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

  if (command === 'init') {
    return initCommand({ root: values.root, appDir: values['app-dir'], yes: values.yes }, io)
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
