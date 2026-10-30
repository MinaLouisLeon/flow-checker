// M15: `flow-checker postman import`, and the collection applied by scan, dev and doctor.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AppModel } from '@flow-checker/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { startDev } from '../src/cli/dev'
import { runDoctor } from '../src/cli/doctor'
import { type CliIO, runCli } from '../src/cli/run'

function capture() {
  const out: string[] = []
  const err: string[] = []
  const io: CliIO = { out: (t) => out.push(t), err: (t) => err.push(t) }
  return { io, out, err }
}

const collection = (paths: string[]) =>
  JSON.stringify({
    info: {
      name: 'Items API',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [{ key: 'baseUrl', value: 'https://api.test' }],
    item: paths.map((path) => ({
      name: `Get ${path}`,
      request: { method: 'GET', url: `{{baseUrl}}${path}` },
      response: [{ name: 'OK', code: 200, body: '[{"id":1,"name":"a"}]' }],
    })),
  })

const PAGE = [
  'export default async function Home() {',
  '  const items = await (await fetch("https://api.test/items")).json()',
  '  await fetch("https://api.test/other")',
  '  return <main>{items.length}</main>',
  '}',
].join('\n')

describe('postman', () => {
  const dirs: string[] = []
  const project = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-checker-postman-'))
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

  it('imports a collection given on the command line, and later scans use it', {
    timeout: 30_000,
  }, async () => {
    const root = project({ 'app/page.tsx': PAGE, 'api.json': collection(['/items', '/unused']) })
    const { io, out } = capture()
    expect(await runCli(['postman', 'import', '--root', root, '--collection', 'api.json'], io)).toBe(0)
    const text = out.join('\n')
    expect(text).toContain('Imported "Items API" from api.json: 2 requests, 2 saved examples.')
    expect(text).toContain('Saved to .flow-checker/postman/collection.json in the project.')
    expect(text).toContain(
      'Postman "Items API": 1 of 2 collection requests called, 1 request not in the collection, 0 type mismatches, 1 type from examples.',
    )
    expect(text).toContain('  unused: GET /unused (Get /unused)')
    expect(text).toContain('not-in-collection: The Postman collection "Items API" has no GET /other request.')
    expect(existsSync(join(root, '.flow-checker', 'postman', 'collection.json'))).toBe(true)

    const scan = capture()
    expect(await runCli(['scan', '--root', root], scan.io)).toBe(0)
    expect(scan.out.join('\n')).toContain('Postman "Items API": 1 of 2 collection requests called')
    const model = JSON.parse(readFileSync(join(root, '.flow-checker', 'model.json'), 'utf8')) as AppModel
    expect(model.postman?.collection.source).toEqual({ kind: 'file', path: 'api.json' })
    const items = model.requests.find((s) => s.url?.path === '/items')
    expect(items?.contract?.name).toBe('Get /items')
    expect(items?.responseType?.source).toBe('postman')
  })

  it('reads the configured collection on every scan, and goes on without a broken one', {
    timeout: 30_000,
  }, async () => {
    const root = project({
      'app/page.tsx': PAGE,
      'api.json': collection(['/items', '/other']),
      'flow-checker.config.mjs': 'export default { postman: { collection: "api.json" } }',
    })
    const first = capture()
    expect(await runCli(['scan', '--root', root], first.io)).toBe(0)
    expect(first.out.join('\n')).toContain(
      '2 of 2 collection requests called, 0 requests not in the collection',
    )

    writeFileSync(join(root, 'api.json'), '{ not json')
    const second = capture()
    expect(await runCli(['scan', '--root', root], second.io)).toBe(0)
    // The last good import is used, with a warning.
    expect(second.err.join('\n')).toMatch(/Warning: Could not read api\.json: .*Using the last import/)
    expect(second.out.join('\n')).toContain('2 of 2 collection requests called')

    const failed = capture()
    expect(await runCli(['postman', 'import', '--root', root], failed.io)).toBe(1)
    expect(failed.err.join('\n')).toContain('Could not read api.json')
  })

  it('explains a missing collection and unknown sub-commands', async () => {
    const root = project({ 'app/page.tsx': PAGE })
    const none = capture()
    expect(await runCli(['postman', 'import', '--root', root], none.io)).toBe(1)
    expect(none.err[0]).toContain('No Postman collection')
    const unknown = capture()
    expect(await runCli(['postman', 'export'], unknown.io)).toBe(1)
    expect(unknown.err.join('\n')).toContain('Unknown postman command "export"')
  })

  it('re-reads the collection on a full re-scan in dev', { timeout: 30_000 }, async () => {
    const root = project({
      'app/page.tsx': PAGE,
      'api.json': collection(['/items']),
      'flow-checker.config.mjs': 'export default { postman: { collection: "api.json" } }',
    })
    const { io } = capture()
    const server = await startDev({ root, port: 0, open: false, watch: false }, io)
    if (typeof server === 'number') throw new Error(`startDev failed with ${server}`)
    try {
      const model = (await (await fetch(`${server.url}/api/model`)).json()) as AppModel
      expect(model.postman?.requests.map((r) => r.name)).toEqual(['Get /items'])
      writeFileSync(join(root, 'api.json'), collection(['/items', '/other']))
      const rescanned = (await (await fetch(`${server.url}/api/scan`, { method: 'POST' })).json()) as AppModel
      expect(rescanned.postman?.requests.map((r) => r.name)).toEqual(['Get /items', 'Get /other'])
      expect(rescanned.requests.every((s) => s.contract)).toBe(true)
    } finally {
      await server.close()
    }
  })

  it('has a doctor check', async () => {
    const root = project({
      'package.json': '{}',
      'api.json': collection(['/items']),
      'flow-checker.config.mjs': 'export default { postman: { collection: "api.json" } }',
    })
    const checks = await runDoctor({ root })
    expect(checks.find((c) => c.name === 'Postman')).toEqual({
      name: 'Postman',
      status: 'ok',
      message: '"Items API" (1 requests)',
    })
    // Read only.
    expect(existsSync(join(root, '.flow-checker', 'postman'))).toBe(false)

    const cloud = project({
      'package.json': '{}',
      'flow-checker.config.mjs':
        'export default { postman: { collection: { id: "c-1", apiKeyEnv: "FC_TEST_NO_SUCH_KEY" } } }',
    })
    expect((await runDoctor({ root: cloud })).find((c) => c.name === 'Postman')).toMatchObject({
      status: 'fail',
      message: 'the API key variable FC_TEST_NO_SUCH_KEY is not set',
    })
  })
})
