import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { ScanError, scanProject } from '@flow-checker/scanner'
import { formatModel, formatTypes } from '@flow-checker/shared'
import type { CliIO } from './run'

export interface ScanCommandOptions {
  root?: string
  appDir?: string
  tree?: boolean
  types?: boolean
}

/** `flow-checker scan`: scans the project and writes `.flow-checker/model.json`. */
export function scanCommand(options: ScanCommandOptions, io: CliIO): number {
  const root = resolve(options.root ?? process.cwd())
  const started = performance.now()

  let model: ReturnType<typeof scanProject>
  try {
    model = scanProject({ root, appDir: options.appDir })
  } catch (error) {
    if (error instanceof ScanError) {
      io.err(error.message)
      return 1
    }
    throw error
  }

  const outDir = join(root, '.flow-checker')
  const outFile = join(outDir, 'model.json')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, `${JSON.stringify(model, null, 2)}\n`)

  if (options.tree) io.out(formatModel(model))
  if (options.types) io.out(formatTypes(model))

  const pages = model.routes.filter((r) => r.kind === 'page').length
  const handlers = model.routes.length - pages
  const ms = Math.round(performance.now() - started)
  io.out(
    `Scanned ${pages} page${pages === 1 ? '' : 's'}, ${handlers} route handler${handlers === 1 ? '' : 's'}, ` +
      `${model.components.length} component${model.components.length === 1 ? '' : 's'} and ` +
      `${model.types.length} type${model.types.length === 1 ? '' : 's'} in ${ms} ms.`,
  )
  io.out(`Wrote ${relative(process.cwd(), outFile) || outFile}`)
  return 0
}
