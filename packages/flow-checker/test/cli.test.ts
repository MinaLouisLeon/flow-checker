import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AppModel } from '@flow-checker/shared'
import { afterEach, describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }
import { startDev } from '../src/cli/dev'
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
    for (const command of ['dev', 'scan', 'init', 'export', 'doctor', 'explain']) {
      expect(out.join('\n')).toContain(command)
    }
  })

  it('explains a word from the glossary (M34)', async () => {
    const one = capture()
    expect(await runCli(['explain', 'dynamic-url'], one.io)).toBe(0)
    expect(one.out.join('\n')).toContain('What to do:')
    expect(one.out.join('\n')).toContain('apiClients')

    // Several words, and the same word in two groups.
    const two = capture()
    expect(await runCli(['explain', 'needs', 're-check'], two.io)).toBe(0)
    expect(two.out.join('\n')).toContain('Request status')
    expect(two.out.join('\n')).toContain('Endpoint status')

    const all = capture()
    expect(await runCli(['explain'], all.io)).toBe(0)
    expect(all.out.join('\n')).toContain('What sends a request')

    const json = capture()
    expect(await runCli(['explain', 'stale', '--json'], json.io)).toBe(0)
    expect(JSON.parse(json.out.join('\n')).map((t: { group: string }) => t.group)).toEqual([
      'flag',
      'capture',
    ])

    const none = capture()
    expect(await runCli(['explain', 'zzz'], none.io)).toBe(1)
    expect(none.err[0]).toContain('not in the glossary')
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

describe('cli scan', () => {
  const dirs: string[] = []
  const project = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-checker-cli-'))
    dirs.push(dir)
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dir, path, '..'), { recursive: true })
      writeFileSync(join(dir, path), text)
    }
    return dir
  }
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('writes .flow-checker/model.json', async () => {
    const root = project({
      'app/layout.tsx': 'export default function Root({ children }) { return <html>{children}</html> }',
      'app/page.tsx': [
        'interface Props { params: Promise<{ id: string }> }',
        'export default async function Home(_: Props) { await fetch("https://api.test/items"); return <main /> }',
      ].join('\n'),
      'app/api/ping/route.ts': 'export function GET() { return new Response() }',
    })
    const { io, out } = capture()
    expect(await runCli(['scan', '--root', root, '--tree', '--types', '--requests'], io)).toBe(0)
    const output = out.join('\n')
    expect(output).toContain('Scanned 1 page, 1 route handler, 2 components, 1 type, 1 request and 0 flows')
    expect(output).toContain('GET https://api.test/items  fetch  server-render')
    expect(output).toContain('# Types')
    expect(output).toContain('Props  interface  app/page.tsx:1')
    expect(output).toContain('# Route tree')

    const modelFile = join(root, '.flow-checker', 'model.json')
    expect(existsSync(modelFile)).toBe(true)
    const model = JSON.parse(readFileSync(modelFile, 'utf8'))
    expect(model.routes.map((r: { path: string }) => r.path)).toEqual(['/', '/api/ping'])
  })

  it('fails with a clear message when there is no app directory', async () => {
    const root = project({ 'pages/index.tsx': 'export default () => null' })
    const { io, err } = capture()
    expect(await runCli(['scan', '--root', root], io)).toBe(1)
    expect(err.join('\n')).toContain('App Router')
  })
})

describe('cli dev', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('scans, serves the model and re-scans on request', { timeout: 30_000 }, async () => {
    const root = mkdtempSync(join(tmpdir(), 'flow-checker-dev-'))
    dirs.push(root)
    mkdirSync(join(root, 'app', 'about'), { recursive: true })
    writeFileSync(join(root, 'app', 'page.tsx'), 'export default function Home() { return <main /> }')

    const { io, out } = capture()
    const server = await startDev({ root, port: 0, open: false }, io)
    if (typeof server === 'number') throw new Error(`startDev failed with ${server}`)
    try {
      expect(out.join('\n')).toContain('Dashboard: http://127.0.0.1:')
      expect(existsSync(join(root, '.flow-checker', 'model.json'))).toBe(true)

      const model = (await (await fetch(`${server.url}/api/model`)).json()) as AppModel
      expect(model.routes.map((r) => r.path)).toEqual(['/'])

      writeFileSync(join(root, 'app', 'about', 'page.tsx'), 'export default function About() { return null }')
      const rescanned = (await (await fetch(`${server.url}/api/scan`, { method: 'POST' })).json()) as AppModel
      expect(rescanned.routes.map((r) => r.path)).toEqual(['/', '/about'])
    } finally {
      await server.close()
    }
  })

  it('rejects invalid ports', async () => {
    const { io, err } = capture()
    expect(await runCli(['dev', '--port', 'abc'], io)).toBe(1)
    expect(err.join('\n')).toContain('--port must be a port number')
  })

  it('fails like scan when there is no app directory', async () => {
    const root = mkdtempSync(join(tmpdir(), 'flow-checker-dev-'))
    dirs.push(root)
    const { io, err } = capture()
    expect(await startDev({ root, port: 0, open: false }, io)).toBe(1)
    expect(err.join('\n')).toContain('App Router')
  })
})
