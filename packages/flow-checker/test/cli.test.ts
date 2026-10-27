import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }
import { type CliIO, runCli } from '../src/cli/run'

function capture() {
  const out: string[] = []
  const err: string[] = []
  const io: CliIO = { out: (t) => out.push(t), err: (t) => err.push(t) }
  return { io, out, err }
}

describe('cli', () => {
  it('prints the version', async () => {
    const { io, out } = capture()
    expect(await runCli(['--version'], io)).toBe(0)
    expect(out).toEqual([pkg.version])
  })

  it('prints help listing every command', async () => {
    const { io, out } = capture()
    expect(await runCli(['--help'], io)).toBe(0)
    for (const command of ['dev', 'scan', 'init', 'export', 'doctor']) {
      expect(out.join('\n')).toContain(command)
    }
  })

  it('rejects unknown commands', async () => {
    const { io, err } = capture()
    expect(await runCli(['nope'], io)).toBe(1)
    expect(err[0]).toContain('Unknown command "nope"')
  })

  it('rejects unknown options', async () => {
    const { io, err } = capture()
    expect(await runCli(['--nope'], io)).toBe(1)
    expect(err.join('\n')).toContain('--help')
  })
})
