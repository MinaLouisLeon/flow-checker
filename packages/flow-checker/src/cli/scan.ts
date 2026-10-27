import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { ScanError, scanProject } from '@flow-checker/scanner'
import { type AppModel, formatModel, formatTypes } from '@flow-checker/shared'
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

  let model: AppModel
  try {
    model = scanProject({ root, appDir: options.appDir })
  } catch (error) {
    if (error instanceof ScanError) {
      io.err(error.message)
      return 1
    }
    throw error
  }

  const outFile = writeModel(root, model)

  if (options.tree) io.out(formatModel(model))
  if (options.types) io.out(formatTypes(model))

  io.out(summary(model, performance.now() - started))
  io.out(`Wrote ${relative(process.cwd(), outFile) || outFile}`)
  return 0
}

/** Writes `.flow-checker/model.json` and returns its path. */
export function writeModel(root: string, model: AppModel): string {
  const outDir = join(root, '.flow-checker')
  const outFile = join(outDir, 'model.json')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, `${JSON.stringify(model, null, 2)}\n`)
  return outFile
}

export function summary(model: AppModel, elapsedMs: number): string {
  const pages = model.routes.filter((r) => r.kind === 'page').length
  const handlers = model.routes.length - pages
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  return (
    `Scanned ${plural(pages, 'page')}, ${plural(handlers, 'route handler')}, ` +
    `${plural(model.components.length, 'component')} and ${plural(model.types.length, 'type')} ` +
    `in ${Math.round(elapsedMs)} ms.`
  )
}
