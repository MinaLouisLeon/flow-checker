// `flow-checker summary` (M32): prints Start here for a project and leaves it untouched.
import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'
import type { Summary } from '@flow-checker/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { type CliIO, runCli } from '../src/cli/run'

const fixturesDir = resolve(import.meta.dirname, '../../../fixtures')
// flow-checker's own files and build output: the summary must work without them.
const NOT_IN_CLONE = /^(\.flow-checker|\.next|node_modules|AGENTS\.md|instrumentation(-client)?\.\w+)$/

function capture() {
  const out: string[] = []
  const err: string[] = []
  const io: CliIO = { out: (t) => out.push(t), err: (t) => err.push(t) }
  return { io, out, err }
}

function copy(fixture: string, dirs: string[]): string {
  const root = join(mkdtempSync(join(tmpdir(), 'flow-checker-summary-')), fixture)
  dirs.push(resolve(root, '..'))
  const from = join(fixturesDir, fixture)
  cpSync(from, root, { recursive: true, filter: (src) => !NOT_IN_CLONE.test(basename(src)) })
  symlinkSync(join(from, 'node_modules'), join(root, 'node_modules'), 'junction')
  return root
}

function files(root: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.name === 'node_modules') continue
      if (entry.isDirectory()) walk(path)
      else
        out[relative(root, path)] =
          `${createHash('sha1').update(readFileSync(path)).digest('hex')} ${statSync(path).mtimeMs}`
    }
  }
  walk(root)
  return out
}

/** The installed Next.js version varies; the golden text doesn't. */
const stable = (text: string) => text.replace(/(Next\.js\s+)\d+\.\d+\.\d+(-[\w.]+)?/g, '$1<next-version>')

describe('cli summary', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('is listed in the help', async () => {
    const { io, out } = capture()
    expect(await runCli(['--help'], io)).toBe(0)
    expect(out.join('\n')).toMatch(/summary\s+Print a short tour/)
  })

  it.each(['basic', 'next-intl'])(
    'prints Start here for %s and writes nothing',
    { timeout: 60_000 },
    async (fixture) => {
      const root = copy(fixture, dirs)
      const before = files(root)
      const { io, out, err } = capture()
      expect(await runCli(['summary', '--root', root], io), err.join('\n')).toBe(0)
      const text = out.join('\n')
      expect(text.split('\n').length).toBeLessThan(60)
      await expect(`${stable(text)}\n`).toMatchFileSnapshot(`__snapshots__/summary/${fixture}.txt`)
      expect(files(root)).toEqual(before)
    },
  )

  it('prints JSON with --json', { timeout: 60_000 }, async () => {
    const root = copy('basic', dirs)
    const { io, out } = capture()
    expect(await runCli(['summary', '--json', '--root', root], io)).toBe(0)
    const json = JSON.parse(out.join('\n')) as Summary & { project: string }
    expect(json.project).toBe('basic')
    expect(json.sections.map((s) => s.id)).toEqual([
      'stack',
      'areas',
      'entry',
      'flows',
      'backends',
      'places',
      'check',
    ])
    expect(json.sections[0]?.items[0]).toMatchObject({ label: 'Next.js', link: { to: 'map' } })
  })
})
