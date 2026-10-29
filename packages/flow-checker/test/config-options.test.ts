import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AppModel } from '@flow-checker/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/cli/config'
import { runDoctor } from '../src/cli/doctor'
import { type CliIO, runCli } from '../src/cli/run'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function project(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'flow-checker-config-'))
  dirs.push(dir)
  mkdirSync(join(dir, '.git'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

const io = (): CliIO & { lines: string[] } => {
  const lines: string[] = []
  return { lines, out: (t) => lines.push(t), err: (t) => lines.push(t) }
}

const APP = {
  'web/package.json': '{}',
  'web/app/page.tsx': "export default async function Home() { await fetch('/api/home'); return null }\n",
  'web/app/admin/page.tsx':
    "export default async function Admin() { await fetch('/api/admin'); return null }\n",
}

describe('config root, include and exclude', () => {
  it('resolves root from the config file folder', async () => {
    const root = project({
      ...APP,
      'tools/flow-checker.config.mjs': "export default { root: '../web' }\n",
    })
    const loaded = await loadConfig(root, 'tools/flow-checker.config.mjs')
    expect(loaded.root).toBe(join(root, 'web'))
    // Without `root`, the root stays where the config was looked up.
    expect((await loadConfig(join(root, 'web'))).root).toBe(join(root, 'web'))
  })

  it('scan uses the config root and exclude', async () => {
    const root = project({
      ...APP,
      'tools/flow-checker.config.mjs': "export default { root: '../web', exclude: ['app/admin/**'] }\n",
    })
    const cli = io()
    expect(await runCli(['scan', '--root', root, '--config', 'tools/flow-checker.config.mjs'], cli)).toBe(0)
    const file = join(root, 'web', '.flow-checker', 'model.json')
    expect(existsSync(file)).toBe(true)
    const model = JSON.parse(readFileSync(file, 'utf8')) as AppModel
    expect(model.routes.map((r) => r.path)).toEqual(['/'])
    expect(model.requests.map((r) => r.url?.path)).toEqual(['/api/home'])
  })

  it('rejects a root that is not a path', async () => {
    const root = project({ ...APP, 'web/flow-checker.config.mjs': 'export default { root: 42 }\n' })
    await expect(loadConfig(join(root, 'web'))).rejects.toThrow('"root" must be a path')
  })

  it('doctor follows the config root and checks API client packages', async () => {
    const root = project({
      ...APP,
      'flow-checker.config.mjs':
        "export default { root: 'web', apiClients: [{ module: 'ky', methods: ['get'] }, { module: '@/lib/api', methods: ['get'] }] }\n",
    })
    const checks = await runDoctor({ root, port: 0, appPort: 0 })
    expect(checks.find((c) => c.name === 'Config')?.message).toContain(`project root: ${join(root, 'web')}`)
    expect(checks.find((c) => c.name === 'App Router')).toMatchObject({ status: 'ok', message: 'app' })
    const clients = checks.filter((c) => c.name === 'API client')
    expect(clients).toEqual([expect.objectContaining({ status: 'warn', message: 'ky is not installed' })])
  })
})
