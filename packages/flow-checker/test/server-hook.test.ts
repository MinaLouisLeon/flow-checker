// M22: where the flow-checker blocks sit in register(). Each shape is written from scratch here.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { type CliIO, runCli } from '../src/cli/run'
import { checkHookFile, EDGE_BODY, editServerHook, NODE_BODY, REGISTER_BODY } from '../src/cli/server-hook'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function project(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'flow-checker-hook-'))
  dirs.push(dir)
  mkdirSync(join(dir, '.git'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

/** Checks `instrumentation.ts` (or another hook file name) holding `text`. */
function check(text: string, file = 'instrumentation.ts', extra: Record<string, string> = {}) {
  const root = project({ [file]: text, ...extra })
  return checkHookFile(root, join(root, file), 'server')
}

/** The blocks indented by `n` extra spaces, as when pasted inside a condition. */
const indented = (body: string, n: number) =>
  body
    .split('\n')
    .map((line) => ' '.repeat(n) + line)
    .join('\n')

const NODE = NODE_BODY
const BOTH = REGISTER_BODY

describe('server hook placement: passing shapes', () => {
  it('passes when the blocks are the first statements', () => {
    expect(check(`export async function register() {\n${BOTH}\n  await setupTracing()\n}\n`)).toMatchObject({
      status: 'ok',
      message: 'instrumentation.ts',
    })
  })

  it('allows comments before them', () => {
    const text = `export async function register() {\n  // Tracing comes after flow-checker.\n  /* block comment */\n${NODE}\n  await setupTracing()\n}\n`
    expect(check(text).status).toBe('ok')
  })

  it('allows the edge block second, and checks it on its own', () => {
    const root = project({
      'instrumentation.ts': `export async function register() {\n${NODE}\n${EDGE_BODY}\n  init()\n}\n`,
    })
    expect(checkHookFile(root, join(root, 'instrumentation.ts'), 'edge').status).toBe('ok')

    const late = project({
      'instrumentation.ts': `export async function register() {\n${NODE}\n  init()\n${EDGE_BODY}\n}\n`,
    })
    expect(checkHookFile(late, join(late, 'instrumentation.ts'), 'server').status).toBe('ok')
    const edge = checkHookFile(late, join(late, 'instrumentation.ts'), 'edge')
    expect(edge.status).toBe('fail')
    expect(edge.message).toContain('after other code (line 7: `init()`)')
  })

  it('finds register in every exported shape', () => {
    const body = `{\n${NODE}\n}`
    expect(check(`export const register = async () => ${body}\n`).status).toBe('ok')
    expect(check(`export const register = async function () ${body}\n`).status).toBe('ok')
    expect(check(`async function register() ${body}\nexport { register }\n`).status).toBe('ok')
    expect(check(`async function setup() ${body}\nexport { setup as register }\n`)).toMatchObject({
      status: 'ok',
      message: 'instrumentation.ts (register() from `setup`)',
    })
  })

  it('follows a re-export from another project file', () => {
    const files = { 'lib/hooks.ts': `export async function register() {\n${NODE}\n}\n` }
    expect(check("export { register } from './lib/hooks'\n", 'instrumentation.ts', files)).toMatchObject({
      status: 'ok',
      message: "instrumentation.ts (register() from lib/hooks.ts (re-exported from './lib/hooks'))",
    })
    expect(check("export * from './lib/hooks'\n", 'instrumentation.ts', files).status).toBe('ok')
    const imported = "import { register as setup } from './lib/hooks'\nexport { setup as register }\n"
    expect(check(imported, 'instrumentation.ts', files).status).toBe('ok')
    // Through a tsconfig path alias.
    const alias = { ...files, 'tsconfig.json': '{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }' }
    expect(check("export { register } from '@/lib/hooks'\n", 'instrumentation.ts', alias).status).toBe('ok')
  })

  it('reads .js and .mjs hooks in src/ and the root', () => {
    expect(check(`export async function register() {\n${NODE}\n}\n`, 'src/instrumentation.js').status).toBe(
      'ok',
    )
    expect(check(`export async function register() {\n${NODE}\n}\n`, 'instrumentation.mjs').status).toBe('ok')
    const bad = `export async function register() {\n  if (process.env.NODE_ENV === 'production') {\n${indented(NODE, 2)}\n  }\n}\n`
    expect(check(bad, 'src/instrumentation.mjs').status).toBe('fail')
  })
})

describe('server hook placement: failing shapes', () => {
  const failing = (text: string, files?: Record<string, string>) => {
    const result = check(text, 'instrumentation.ts', files)
    expect(result.status).toBe('fail')
    return result.message
  }

  it('fails inside a production if, naming the line and why', () => {
    const text = `export async function register() {\n  await setupTracing()\n\n  if (process.env.NODE_ENV === 'production') {\n${indented(NODE, 2)}\n  }\n}\n`
    const result = check(text)
    expect(result.status).toBe('fail')
    expect(result.message).toBe(
      "instrumentation.ts: the flow-checker block is inside `if (process.env.NODE_ENV === 'production')` at line 4: it never runs under `next dev`",
    )
    expect(result.hint).toContain('Move these lines to the start of register(), outside any `if`')
    expect(result.hint).toContain('flow-checker init')
    expect(result.hint).toContain("await import('@integr8-media/flow-checker/runtime/server')")
  })

  it('fails inside a runtime if, even though it is true in dev', () => {
    const text = `export async function register() {\n  if (process.env.NEXT_RUNTIME === 'nodejs') {\n${indented(NODE, 2)}\n  }\n}\n`
    expect(failing(text)).toContain(
      "inside `if (process.env.NEXT_RUNTIME === 'nodejs')` at line 2: it only runs when that condition holds",
    )
  })

  it('fails in an else branch', () => {
    const text = `export async function register() {\n  if (process.env.NODE_ENV !== 'production') {\n    return\n  } else {\n${indented(NODE, 2)}\n  }\n}\n`
    expect(failing(text)).toContain(
      "in the `else` branch of `if (process.env.NODE_ENV !== 'production')` at line 2: it never runs under `next dev`",
    )
  })

  it('fails inside try, catch and finally', () => {
    const wrap = (before: string, after: string) =>
      `export async function register() {\n  ${before}\n${indented(NODE, 2)}\n  ${after}\n}\n`
    expect(failing(wrap('try {', '} catch {}'))).toContain('inside a `try` block at line 2')
    expect(failing(wrap('try { init() } catch (e) {', '}'))).toContain('inside a `catch` block at line 2')
    expect(failing(wrap('try { init() } finally {', '}'))).toContain('inside a `finally` block at line 2')
  })

  it('fails inside a switch and a loop', () => {
    const switched = `export async function register() {\n  switch (process.env.NEXT_RUNTIME) {\n    case 'nodejs': {\n${indented(NODE, 4)}\n      break\n    }\n  }\n}\n`
    expect(failing(switched)).toContain('inside `switch (process.env.NEXT_RUNTIME)` at line 2')
    const loop = `export async function register() {\n  for (const step of [1]) {\n${indented(NODE, 2)}\n  }\n}\n`
    expect(failing(loop)).toContain('inside a loop at line 2')
  })

  it('fails after an early return and after other statements', () => {
    const early = `export async function register() {\n  if (process.env.NEXT_RUNTIME === 'edge') return\n${NODE}\n}\n`
    expect(failing(early)).toContain(
      "after other code (line 2: `if (process.env.NEXT_RUNTIME === 'edge') return`)",
    )
    const unconditional = `export async function register() {\n  return\n${NODE}\n}\n`
    expect(failing(unconditional)).toContain('after the `return` at line 2: it never runs')
    const other = `export async function register() {\n  await setupTracing()\n${NODE}\n}\n`
    expect(failing(other)).toContain('after other code (line 2: `await setupTracing()`)')
  })

  it('fails inside a nested callback or function', () => {
    const callback = `export async function register() {\n  queueMicrotask(async () => {\n${indented(NODE, 2)}\n  })\n}\n`
    expect(failing(callback)).toContain('inside a callback passed to `queueMicrotask()` at line 2')
    const nested = `export async function register() {\n  async function later() {\n${indented(NODE, 2)}\n  }\n}\n`
    expect(failing(nested)).toContain('inside a nested function at line 2')
  })

  it('fails inside a ternary or a && expression', () => {
    const and = `export async function register() {\n  process.env.TRACE && (async () => {\n${indented(NODE, 2)}\n  })()\n}\n`
    expect(failing(and)).toContain('after `&&` at line 2')
    const ternary = `export async function register() {\n  const run = process.env.TRACE ? async () => {\n${indented(NODE, 2)}\n  } : undefined\n}\n`
    expect(failing(ternary)).toContain('inside a `? :` expression at line 2')
  })

  it('fails when register is not async, or has no body', () => {
    expect(failing(`export function register() {\n${NODE}\n}\n`)).toContain(
      "register() isn't async, so `await import(...)` in it can't work",
    )
    expect(failing('export const register = () => init()\n')).toContain(
      'register() is an arrow function without a body (`=> init()`)',
    )
  })

  it('fails when the block is outside register, or register is missing', () => {
    expect(failing(`export async function register() {}\n\n${NODE.replace('  if', 'if')}\n`)).toContain(
      'the flow-checker block is outside register() (line 4)',
    )
    expect(failing(`${NODE.replace('  if', 'if')}\n`)).toContain("doesn't export register()")
  })

  it('warns when the block lost its own condition', () => {
    const bare = `export async function register() {\n  const { registerServerRuntime } = await import('@integr8-media/flow-checker/runtime/server')\n  registerServerRuntime()\n}\n`
    expect(check(bare)).toMatchObject({ status: 'warn' })
    expect(check(bare).message).toContain("isn't wrapped in `if (process.env.FLOW_CHECKER === '1'")
    const changed = `export async function register() {\n${NODE.replace("process.env.FLOW_CHECKER === '1' && ", '')}\n}\n`
    expect(check(changed).message).toContain(
      "condition at line 3 was changed to `process.env.NEXT_RUNTIME === 'nodejs'`",
    )
  })

  it("warns when register can't be followed, saying where it comes from", () => {
    const result = check("import { register } from 'some-tracing-lib'\nexport { register }\n")
    expect(result.status).toBe('warn')
    expect(result.message).toContain(
      "register is imported from 'some-tracing-lib', which isn't a project file",
    )
    expect(check('export const register = wrap(setup)\n').message).toContain('register is `wrap(setup)`')
  })
})

describe('doctor: server hook placement', () => {
  it('fails the run with the line and the fix', async () => {
    const root = project({
      'package.json': '{}',
      'app/page.tsx': '',
      'instrumentation.ts': `export async function register() {\n  if (process.env.NODE_ENV === 'production') {\n${indented(NODE, 2)}\n  }\n}\n`,
    })
    const out: string[] = []
    const cli: CliIO = { out: (t) => out.push(t), err: (t) => out.push(t) }
    expect(await runCli(['doctor', '--root', root, '--port', '0', '--app-port', '0'], cli)).toBe(1)
    const text = out.join('\n')
    expect(text).toContain(
      "✗ Server hook: instrumentation.ts: the flow-checker block is inside `if (process.env.NODE_ENV === 'production')` at line 2",
    )
    expect(text).toContain('Move these lines to the start of register()')
  })
})

describe('init: editing an existing register()', () => {
  async function init(files: Record<string, string>, file = 'instrumentation.ts') {
    const root = project({ 'app/page.tsx': '', 'flow-checker.config.mjs': 'export default {}', ...files })
    const out: string[] = []
    const cli: CliIO = { out: (t) => out.push(t), err: (t) => out.push(t) }
    expect(await runCli(['init', '--root', root, '--yes'], cli)).toBe(0)
    const text = readFileSync(join(root, file), 'utf8')
    return { root, text, out: out.join('\n'), check: checkHookFile(root, join(root, file), 'server') }
  }

  it('inserts the blocks first in a function declaration and keeps the rest', async () => {
    const { text, out, check } = await init({
      'instrumentation.ts':
        "import { setupTracing } from './tracing'\n\nexport async function register() {\n  await setupTracing()\n}\n",
    })
    expect(check.status).toBe('ok')
    expect(text).toBe(
      `import { setupTracing } from './tracing'\n\nexport async function register() {\n${BOTH}\n  await setupTracing()\n}\n`,
    )
    expect(out).toContain(
      'update  instrumentation.ts (adds the flow-checker blocks at the start of register())',
    )
  })

  it('makes register async, with a Promise return type', async () => {
    const { text, out, check } = await init({
      'instrumentation.ts': 'export function register(): void {\n  init()\n}\n',
    })
    expect(check.status).toBe('ok')
    expect(text.startsWith('export async function register(): Promise<void> {\n')).toBe(true)
    expect(out).toContain('makes it async')
  })

  it('edits arrows, function expressions and export { setup as register }', async () => {
    const arrow = await init(
      { 'instrumentation.js': 'export const register = () => {\n  init()\n}\n' },
      'instrumentation.js',
    )
    expect(arrow.check.status).toBe('ok')
    expect(arrow.text.startsWith('export const register = async () => {\n  // flow-checker')).toBe(true)

    const expression = await init({ 'instrumentation.ts': 'export const register = function () {}\n' })
    expect(expression.check.status).toBe('ok')
    expect(expression.text).toBe(`export const register = async function () {\n${BOTH}\n}\n`)

    const named = await init(
      {
        'src/instrumentation.ts': 'function setup() {\n  init()\n}\nexport { setup as register }\n',
        'src/app/page.tsx': '',
      },
      'src/instrumentation.ts',
    )
    expect(named.check.status).toBe('ok')
    expect(named.text).toContain(`async function setup() {\n${BOTH}\n  init()\n}`)
  })

  it('gives an expression-bodied arrow a body', async () => {
    const { text, check } = await init({ 'instrumentation.ts': 'export const register = () => init()\n' })
    expect(check.status).toBe('ok')
    expect(text).toBe(`export const register = async () => {\n${BOTH}\n  return init()\n}\n`)
  })

  it('moves misplaced blocks, and running it again changes nothing', async () => {
    const misplaced = `export async function register() {\n  await setupTracing()\n  if (process.env.NODE_ENV === 'production') {\n${indented(BOTH, 2)}\n  }\n}\n`
    const first = await init({ 'instrumentation.ts': misplaced })
    expect(first.check.status).toBe('ok')
    expect(first.out).toContain('moves the flow-checker blocks to the start of register()')
    expect(first.text).toBe(
      `export async function register() {\n${BOTH}\n  await setupTracing()\n  if (process.env.NODE_ENV === 'production') {\n  }\n}\n`,
    )
    expect(editServerHook(join(first.root, 'instrumentation.ts'), first.root)).toEqual({ kind: 'ok' })
  })

  it('leaves shapes it cannot edit to the user', async () => {
    const reexport = await init({
      'instrumentation.ts': "export { register } from './lib/hooks'\n",
      'lib/hooks.ts': 'export async function register() {\n  init()\n}\n',
    })
    expect(reexport.text).toBe("export { register } from './lib/hooks'\n")
    expect(reexport.out).toContain('as the first lines of register(), outside any `if`')
    expect(readFileSync(join(reexport.root, 'lib/hooks.ts'), 'utf8')).toBe(
      'export async function register() {\n  init()\n}\n',
    )
  })
})
