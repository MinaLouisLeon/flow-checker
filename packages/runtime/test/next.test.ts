import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { applyFlowChecker, findClientHook, prependEntry, withFlowChecker } from '../src/next'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  delete process.env.FLOW_CHECKER
})

function project(hook?: string) {
  const dir = mkdtempSync(join(tmpdir(), 'flow-checker-next-'))
  dirs.push(dir)
  if (hook) {
    mkdirSync(join(dir, hook, '..'), { recursive: true })
    writeFileSync(join(dir, hook), '')
  }
  return dir
}

const devClient = { isServer: false, dev: true }

async function clientEntry(config: Record<string, unknown>, entry: unknown, context = devClient) {
  const webpack = config.webpack as (c: unknown, ctx: unknown) => { entry: () => Promise<unknown> }
  const result = webpack({ entry: async () => entry }, context)
  return typeof result.entry === 'function' ? result.entry() : result.entry
}

describe('withFlowChecker', () => {
  it('returns the config untouched unless the app was started by flow-checker', () => {
    const config = { reactStrictMode: true }
    expect(withFlowChecker(config, { nextVersion: '14.2.0' })).toBe(config)
  })

  it('changes nothing on Next 15.3 and later', () => {
    const root = project('src/instrumentation-client.ts')
    const config = { reactStrictMode: true }
    expect(applyFlowChecker(config, { root, nextVersion: '15.3.0' })).toBe(config)
    expect(applyFlowChecker(config, { root, nextVersion: '16.0.1' })).toBe(config)
  })

  it('turns on the instrumentation hook before Next 15 and keeps other experimental flags', () => {
    const root = project()
    const out = applyFlowChecker({ experimental: { typedRoutes: true } }, { root, nextVersion: '14.2.3' })
    expect(out.experimental).toEqual({ typedRoutes: true, instrumentationHook: true })
    expect(
      applyFlowChecker<Record<string, unknown>>({}, { root, nextVersion: '15.1.0' }).experimental,
    ).toBeUndefined()
  })

  it('adds the browser hook to the client entry in dev, after the user webpack function', async () => {
    const root = project('src/instrumentation-client.ts')
    const hook = findClientHook(root)
    const calls: unknown[] = []
    const out = applyFlowChecker(
      {
        webpack: (config: unknown, ctx: unknown) => {
          calls.push(ctx)
          return config
        },
      },
      { root, nextVersion: '15.2.4' },
    )
    expect(await clientEntry(out, { 'main-app': ['next/app'], other: ['x'] })).toEqual({
      'main-app': [hook, 'next/app'],
      other: ['x'],
    })
    expect(calls).toHaveLength(1)

    // Server and production builds keep their entries.
    const entry = { 'main-app': ['next/app'] }
    const webpack = out.webpack as (c: unknown, ctx: unknown) => { entry: unknown }
    expect(webpack({ entry }, { isServer: true, dev: true }).entry).toBe(entry)
    expect(webpack({ entry }, { isServer: false, dev: false }).entry).toBe(entry)
  })

  it('wraps a config function (phase, context)', async () => {
    process.env.FLOW_CHECKER = '1'
    const root = project('instrumentation-client.js')
    const wrapped = withFlowChecker(() => ({ basePath: '/x' }), { root, nextVersion: '13.4.19' })
    expect(typeof wrapped).toBe('function')
    const out = await (wrapped as () => Promise<Record<string, unknown>>)()
    expect(out.basePath).toBe('/x')
    expect(out.experimental).toEqual({ instrumentationHook: true })
    expect(typeof out.webpack).toBe('function')
  })
})

describe('prependEntry', () => {
  it('handles string, array and descriptor entries, once', () => {
    expect(prependEntry({ 'main-app': 'a' }, 'h')).toEqual({ 'main-app': ['h', 'a'] })
    expect(prependEntry({ 'main-app': ['h', 'a'] }, 'h')).toEqual({ 'main-app': ['h', 'a'] })
    expect(prependEntry({ 'main-app': { import: 'a', dependOn: 'x' } }, 'h')).toEqual({
      'main-app': { import: ['h', 'a'], dependOn: 'x' },
    })
    expect(prependEntry({ main: ['a'] }, 'h')).toEqual({ main: ['a'] })
  })
})
