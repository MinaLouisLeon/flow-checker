import { runCli } from './cli/run'

process.exitCode = await runCli(process.argv.slice(2))
