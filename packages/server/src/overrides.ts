// `.flow-checker/overrides.json`: your decisions (manual matches, flow names, named recordings).
// One instance is shared by everything that changes it, so writes never overwrite each other.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { type Overrides, OverridesSchema } from '@flow-checker/shared'

export class OverridesFile {
  readonly file: string
  #data: Overrides

  constructor(root: string) {
    this.file = join(root, '.flow-checker', 'overrides.json')
    this.#data = read(this.file)
  }

  get(): Overrides {
    return this.#data
  }

  /** Applies a change and saves the file. */
  update(change: (current: Overrides) => Overrides): Overrides {
    this.#data = change(this.#data)
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, `${JSON.stringify(this.#data, null, 2)}\n`)
    return this.#data
  }
}

function read(file: string): Overrides {
  try {
    const parsed = OverridesSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
    if (parsed.success) return parsed.data
  } catch {}
  return OverridesSchema.parse({ version: 1 })
}
