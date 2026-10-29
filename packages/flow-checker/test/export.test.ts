// `flow-checker export` (M10): writes the Markdown docs and the static site from a fresh scan and
// the captures saved in `.flow-checker/`.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { exportCommand } from '../src/cli/export'
import { type CliIO, runCli } from '../src/cli/run'

function capture() {
  const out: string[] = []
  const err: string[] = []
  const io: CliIO = { out: (t) => out.push(t), err: (t) => err.push(t) }
  return { io, out, err }
}

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'flow-checker-export-'))
  dirs.push(dir)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

const APP = {
  'app/layout.tsx': 'export default function Root({ children }) { return <html>{children}</html> }',
  'app/page.tsx': [
    'interface Item { id: number; name: string }',
    'async function getItems(): Promise<Item[]> { const res = await fetch("https://api.test/items"); return res.json() }',
    'export default async function Home() { const items = await getItems(); return <main>{items.length}</main> }',
  ].join('\n'),
}

/** A stand-in for the dashboard build. */
function dashboard(): string {
  const dir = project({
    'index.html': '<html><head><title>x</title><script type="module" src="./app.js"></script></head></html>',
    'app.js': 'document.title = "ok"',
  })
  return dir
}

describe('cli export', () => {
  it('writes Markdown and the static site to the given folders', async () => {
    const root = project(APP)
    const { io, out, err } = capture()
    const code = await exportCommand(
      { root, md: join(root, 'docs'), html: join(root, 'site'), dashboardDir: dashboard() },
      io,
    )
    expect(err).toEqual([])
    expect(code).toBe(0)
    const output = out.join('\n')
    expect(output).toContain('no captures yet')
    expect(output).toContain('Wrote Markdown docs to')
    expect(output).toContain('Wrote the static site to')

    const readme = readFileSync(join(root, 'docs', 'README.md'), 'utf8')
    expect(readme).toContain('No captures yet')
    expect(readme).toContain('[`/`](pages/index.md)')
    expect(readFileSync(join(root, 'docs', 'pages', 'index.md'), 'utf8')).toContain(
      '`GET https://api.test/items`',
    )
    expect(readFileSync(join(root, 'docs', 'types.md'), 'utf8')).toContain('interface Item')

    const html = readFileSync(join(root, 'site', 'index.html'), 'utf8')
    expect(html).toContain('<script src="./data.js"></script>')
    const data = readFileSync(join(root, 'site', 'data.js'), 'utf8')
    expect(data).toContain('window.__FLOW_CHECKER__ = ')
    expect(data).toContain('"path":"/"')
    // The export reads .flow-checker/ but writes nothing there.
    expect(existsSync(join(root, '.flow-checker'))).toBe(false)
  })

  it('uses the config folders when no format is given', async () => {
    const root = project({
      ...APP,
      'flow-checker.config.mjs': "export default { export: { md: 'out/md', html: 'out/html' } }",
    })
    const { io } = capture()
    expect(await exportCommand({ root, dashboardDir: dashboard() }, io)).toBe(0)
    expect(existsSync(join(root, 'out', 'md', 'README.md'))).toBe(true)
    expect(existsSync(join(root, 'out', 'html', 'index.html'))).toBe(true)
  })

  it('refuses to overwrite a folder it did not write', async () => {
    const root = project({ ...APP, 'docs/README.md': '# my docs' })
    const { io, err } = capture()
    expect(await exportCommand({ root, md: join(root, 'docs') }, io)).toBe(1)
    expect(err.join('\n')).toContain('--force')
    expect(readFileSync(join(root, 'docs', 'README.md'), 'utf8')).toBe('# my docs')
    expect(await exportCommand({ root, md: join(root, 'docs'), force: true }, capture().io)).toBe(0)
  })

  it('fails clearly when there is no dashboard build for --html', async () => {
    const root = project(APP)
    const { io, err } = capture()
    expect(
      await exportCommand({ root, html: join(root, 'site'), dashboardDir: join(root, 'missing') }, io),
    ).toBe(1)
    expect(err.join('\n')).toContain('dashboard build was not found')
  })

  it('is wired into the CLI', async () => {
    const root = project(APP)
    const { io, out } = capture()
    expect(await runCli(['export', '--root', root, '--md', join(root, 'docs')], io)).toBe(0)
    expect(out.join('\n')).toContain('Wrote Markdown docs')
  })
})
