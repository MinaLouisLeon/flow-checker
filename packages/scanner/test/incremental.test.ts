// M9: a warm scan session re-reads only the files that changed, and gives the same result as a
// fresh scan. Request sites carry a code hash that ignores formatting and line shifts.
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import type { AppModel, RequestSite } from '@flow-checker/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createScanSession, type ScanSession, scanProject } from '../src'

const fixture = join(import.meta.dirname, '..', '..', '..', 'fixtures', 'basic')

let root: string
let session: ScanSession

function copyFixture(): string {
  // Inside the fixture (gitignored), so its packages resolve as usual: package types (axios,
  // next) decide what counts as a request. A link to node_modules from the system temp folder
  // does not resolve on every OS (Windows CI has the repo and temp on different drives).
  const dir = mkdtempSync(join(fixture, '.test-copy-'))
  for (const entry of readdirSync(fixture)) {
    if (/^(node_modules|\.next|\.flow-checker|\.test-copy-.*)$/.test(entry)) continue
    cpSync(join(fixture, entry), join(dir, entry), { recursive: true })
  }
  return dir
}

function removeCopy(dir: string) {
  rmSync(dir, { recursive: true, force: true })
}

const file = (rel: string) => join(root, rel)
const read = (rel: string) => readFileSync(file(rel), 'utf8')
const write = (rel: string, text: string) => writeFileSync(file(rel), text)

/** A request site by the callee chain on its call stack, e.g. `getUsers > fetch`. */
function site(model: AppModel, path: string): RequestSite {
  const found = model.requests.filter((s) => s.callStack.map((f) => f.callee).join(' > ') === path)
  expect(found, `one site for ${path}`).toHaveLength(1)
  return found[0] as RequestSite
}

/** The session result equals a fresh scan of the same files. */
function expectFresh(model: AppModel) {
  expect(model).toEqual(scanProject({ root }))
}

describe('scan session', () => {
  beforeAll(() => {
    root = copyFixture()
    session = createScanSession({ root })
  })
  afterAll(() => root && removeCopy(root))

  it('starts with the same model as a fresh scan', () => {
    expectFresh(session.model)
    expect(session.model.requests.every((s) => typeof s.hash === 'string')).toBe(true)
  })

  it('ignores formatting and comments in the hash, but not in the id when lines move', () => {
    const before = site(session.model, 'getUsers > fetch')
    // Extra spaces in getUsers, after a template literal (`/users`) where they must not count.
    const spaced = read('lib/api.ts').replace(
      "/users`, { cache: 'no-store' })\n  if (!res.ok) throw new Error('Failed to load users')",
      "/users`,   {  cache:  'no-store'  }  )\n  if (!res.ok)   throw new Error('Failed to load users')",
    )
    expect(spaced).not.toBe(read('lib/api.ts'))
    write('lib/api.ts', `// A comment that moves every line down.\n\n${spaced}`)
    const model = session.update({ changed: ['lib/api.ts'] })
    const after = site(model, 'getUsers > fetch')
    expect(after.hash).toBe(before.hash)
    expect(after.id).not.toBe(before.id)
    expectFresh(model)
  })

  it('changes the hash when the code that sends the request changes', () => {
    const before = site(session.model, 'getUsers > fetch')
    const other = site(session.model, 'getUser > fetch')
    const edited = read('lib/api.ts').replace("cache:  'no-store'", "cache:  'force-cache'")
    expect(edited).not.toBe(read('lib/api.ts'))
    write('lib/api.ts', edited)
    const model = session.update({ changed: ['lib/api.ts'] })
    expect(site(model, 'getUsers > fetch').hash).not.toBe(before.hash)
    // Same file, different function: unchanged.
    expect(site(model, 'getUser > fetch').hash).toBe(other.hash)
    expectFresh(model)
  })

  it('keeps the hash of an event handler when only the JSX around it changes', () => {
    const path = 'deleteUser > api.delete'
    const before = site(session.model, path)
    const text = read('components/DeleteUserButton.tsx')
    expect(text).toContain('<button')
    write('components/DeleteUserButton.tsx', text.replace('<button', '<button data-test="delete"'))
    const model = session.update({ changed: ['components/DeleteUserButton.tsx'] })
    expect(site(model, path).hash).toBe(before.hash)
    expectFresh(model)
  })

  it('picks up added and removed pages', () => {
    mkdirSync(file('app/settings'), { recursive: true })
    write('app/settings/page.tsx', 'export default function Settings() { return <main>Settings</main> }\n')
    let model = session.update({ added: ['app/settings/page.tsx'] })
    expect(model.routes.map((r) => r.path)).toContain('/settings')
    expectFresh(model)

    unlinkSync(file('app/settings/page.tsx'))
    model = session.update({ removed: ['app/settings/page.tsx'] })
    expect(model.routes.map((r) => r.path)).not.toContain('/settings')
    expectFresh(model)
  })

  it('follows a type change into the request types', () => {
    write(
      'types/user.ts',
      read('types/user.ts').replace(/export (interface|type) User\b/, '/** Edited. */\nexport $1 User'),
    )
    const text = read('types/user.ts')
    write('types/user.ts', text.replace(/(export interface User \{)/, '$1\n  nickname?: string'))
    const model = session.update({ changed: ['types/user.ts'] })
    expectFresh(model)
  })

  it('starts over when tsconfig changes', () => {
    const model = session.update({ changed: ['tsconfig.json'] })
    expectFresh(model)
  })

  it('re-scans an edit in well under a second', () => {
    write('lib/api.ts', `${read('lib/api.ts')}\n// touched\n`)
    const started = performance.now()
    session.update({ changed: ['lib/api.ts'] })
    expect(performance.now() - started).toBeLessThan(1000)
  })
})
