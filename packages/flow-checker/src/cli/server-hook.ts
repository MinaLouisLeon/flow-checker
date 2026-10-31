// The server hook in `instrumentation.ts` (docs/PLAN.md M22). The flow-checker blocks must be the
// first statements of `register()`, outside any condition: pasted inside an existing `if` they
// may never run, and server capture silently stays off. `doctor` checks that, and `init` puts
// them there. The rule is about shape, not about what a condition means.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { PACKAGE_NAME } from '@flow-checker/shared'
import { ts } from 'ts-morph'

export const NODE_BODY = `  // flow-checker: captures server-side requests while you test. It does nothing unless FLOW_CHECKER=1.
  if (process.env.FLOW_CHECKER === '1' && process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerServerRuntime } = await import('${PACKAGE_NAME}/runtime/server')
    registerServerRuntime()
  }`

/** For middleware on the edge runtime (`middleware.ts` before Next.js 16): fetch only. */
export const EDGE_BODY = `  // flow-checker: requests sent from middleware on the edge runtime (fetch only, best effort).
  if (process.env.FLOW_CHECKER === '1' && process.env.NEXT_RUNTIME === 'edge') {
    const { registerEdgeRuntime } = await import('${PACKAGE_NAME}/runtime/edge')
    registerEdgeRuntime(process.env.FLOW_CHECKER_RUNTIME)
  }`

export const REGISTER_BODY = `${NODE_BODY}
${EDGE_BODY}`

export const SERVER_SNIPPET = `export async function register() {
${REGISTER_BODY}
}
`

export type HookEntry = 'server' | 'edge'

type FunctionLike = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction

export interface RegisterFunction {
  file: string
  source: ts.SourceFile
  fn: FunctionLike
  /** Declared in the hook file in a shape `init` can edit. */
  editable: boolean
  /** Where it comes from when it isn't declared as `export function register`, for messages. */
  via?: string
}

export type RegisterLookup =
  | { kind: 'found'; register: RegisterFunction }
  /** The hook file exports no `register`. */
  | { kind: 'none' }
  /** `register` exists but can't be followed to a function body. */
  | { kind: 'unknown'; reason: string }

/** One hook block's placement. `missing` means `register()` doesn't load the runtime at all. */
export interface Placement {
  status: 'ok' | 'warn' | 'fail' | 'missing'
  /** What is wrong and why it matters (not set when ok). */
  message?: string
  /** The fix, when it isn't "move the block". */
  hint?: string
}

const MAX_DEPTH = 5

// ---------------------------------------------------------------------------------------------
// Finding register()

/** Finds the `register` export of a hook file, following re-exports through project files. */
export function findRegister(file: string, root: string): RegisterLookup {
  return lookupExport(file, 'register', { root, depth: 0, seen: new Set() })
}

interface Lookup {
  root: string
  depth: number
  seen: Set<string>
}

function lookupExport(file: string, name: string, at: Lookup): RegisterLookup {
  const key = `${file}#${name}`
  if (at.seen.has(key) || at.depth > MAX_DEPTH) return { kind: 'none' }
  at.seen.add(key)
  const source = parseFile(file)
  if (!source) return { kind: 'unknown', reason: `${shown(at.root, file)} can't be read` }
  const where = (node: ts.Node) => `${shown(at.root, file)}:${lineOf(source, node)}`

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && isExported(statement) && statement.name?.text === name) {
      return found(file, source, statement, at, name === 'register' ? undefined : where(statement))
    }
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue
        return fromVariable(file, source, declaration, at)
      }
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        if (element.name.text !== name) continue
        const local = element.propertyName?.text ?? element.name.text
        const spec = moduleText(statement.moduleSpecifier)
        if (spec !== undefined) return follow(file, spec, local, at, `re-exported from '${spec}'`)
        return lookupLocal(file, source, local, at)
      }
    }
  }
  // `export * from './x'`
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || statement.exportClause) continue
    const spec = moduleText(statement.moduleSpecifier)
    if (spec === undefined) continue
    const result = follow(file, spec, name, at, `re-exported from '${spec}'`)
    if (result.kind !== 'none') return result
  }
  return { kind: 'none' }
}

/** A local name exported with `export { name as register }`. */
function lookupLocal(file: string, source: ts.SourceFile, name: string, at: Lookup): RegisterLookup {
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) {
      return found(file, source, statement, at, `\`${name}\``)
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
          return fromVariable(file, source, declaration, at)
        }
      }
    }
    if (ts.isImportDeclaration(statement)) {
      const spec = moduleText(statement.moduleSpecifier)
      const bindings = statement.importClause?.namedBindings
      if (spec === undefined || !bindings || !ts.isNamedImports(bindings)) continue
      for (const element of bindings.elements) {
        if (element.name.text !== name) continue
        return follow(file, spec, element.propertyName?.text ?? name, at, `imported from '${spec}'`)
      }
    }
  }
  return {
    kind: 'unknown',
    reason: `\`${name}\` is exported as register, but it isn't declared in this file`,
  }
}

function fromVariable(
  file: string,
  source: ts.SourceFile,
  declaration: ts.VariableDeclaration,
  at: Lookup,
): RegisterLookup {
  const value = declaration.initializer && unwrap(declaration.initializer)
  if (value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value))) {
    const name = (declaration.name as ts.Identifier).text
    return found(file, source, value, at, name === 'register' ? undefined : `\`${name}\``)
  }
  return {
    kind: 'unknown',
    reason: `register is \`${short(declaration.initializer?.getText(source) ?? 'undefined')}\` (${shown(at.root, file)}:${lineOf(source, declaration)}), not a function flow-checker can read`,
  }
}

function follow(file: string, spec: string, name: string, at: Lookup, how: string): RegisterLookup {
  const target = resolveModule(file, spec, at.root)
  if (!target) return { kind: 'unknown', reason: `register is ${how}, which isn't a project file` }
  const result = lookupExport(target, name, { ...at, depth: at.depth + 1 })
  if (result.kind === 'none') {
    return {
      kind: 'unknown',
      reason: `register is ${how}, but ${shown(at.root, target)} doesn't export \`${name}\``,
    }
  }
  if (result.kind === 'found' && !result.register.via) {
    result.register.via = `${shown(at.root, target)} (${how})`
  }
  return result
}

function found(
  file: string,
  source: ts.SourceFile,
  fn: FunctionLike,
  at: Lookup,
  via: string | undefined,
): RegisterLookup {
  return { kind: 'found', register: { file, source, fn, editable: at.depth === 0, via } }
}

/** A relative path or a tsconfig path alias that resolves to a project source file. */
function resolveModule(from: string, spec: string, root: string): string | undefined {
  if (spec.startsWith('.')) {
    const base = resolve(dirname(from), spec)
    const stem = base.replace(/\.(m|c)?jsx?$/, '')
    const candidates = [
      base,
      ...SOURCE_EXTENSIONS.flatMap((ext) => [`${stem}${ext}`, join(base, `index${ext}`)]),
    ]
    return candidates.find((file) => existsSync(file) && /\.(m|c)?[jt]sx?$/.test(file))
  }
  const config = ts.findConfigFile(root, ts.sys.fileExists)
  if (!config) return undefined
  const read = ts.readConfigFile(config, ts.sys.readFile)
  const options = ts.parseJsonConfigFileContent(read.config ?? {}, ts.sys, dirname(config)).options
  const resolved = ts.resolveModuleName(spec, from.replaceAll('\\', '/'), options, ts.sys).resolvedModule
  if (!resolved || resolved.isExternalLibraryImport || resolved.resolvedFileName.endsWith('.d.ts')) {
    return undefined
  }
  return resolve(resolved.resolvedFileName)
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs']

// ---------------------------------------------------------------------------------------------
// Checking where the blocks are

export interface HookCheck {
  status: 'ok' | 'warn' | 'fail' | 'missing'
  message: string
  hint?: string
}

/**
 * The block for `entry` in an existing hook file, as a doctor check: `missing` when the file
 * doesn't load that runtime at all.
 */
export function checkHookFile(root: string, file: string, entry: HookEntry): HookCheck {
  const where = shown(root, file)
  const spec = `${PACKAGE_NAME}/runtime/${entry}`
  const snippet = entry === 'server' ? NODE_BODY : EDGE_BODY
  const lookup = findRegister(file, root)
  if (lookup.kind === 'none') {
    const loads = readText(file).includes(spec)
    return loads
      ? {
          status: 'fail',
          message: `${where} doesn't export register(), so Next.js never runs the flow-checker block`,
          hint: `Run "flow-checker init" to add register() with the blocks in it.`,
        }
      : { status: 'missing', message: `${where} doesn't load ${spec}` }
  }
  if (lookup.kind === 'unknown') {
    return readText(file).includes(spec) || entry === 'server'
      ? {
          status: 'warn',
          message: `${where}: can't check where the flow-checker block runs: ${lookup.reason}`,
          hint: `Make sure these lines are the first statements of register(), outside any \`if\`:\n\n${snippet}`,
        }
      : { status: 'missing', message: `${where} doesn't load ${spec}` }
  }
  const register = lookup.register
  const placement = checkPlacement(register, entry)
  const inFile = register.via ? `${where} (register() from ${register.via})` : where
  if (placement.status === 'missing') return { status: 'missing', message: `${inFile} doesn't load ${spec}` }
  if (placement.status === 'ok') return { status: 'ok', message: inFile }
  const fix = register.editable ? ' (or run "flow-checker init", which moves them)' : ''
  return {
    status: placement.status,
    message: `${inFile}: ${placement.message}`,
    hint:
      placement.hint ??
      (placement.status === 'fail'
        ? `Move these lines to the start of register(), outside any \`if\`${fix}:\n\n${snippet}`
        : `It should read:\n\n${snippet}`),
  }
}

function readText(file: string): string {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

/** Where the block that loads `runtime/<entry>` sits in `register()`. */
export function checkPlacement(register: RegisterFunction, entry: HookEntry): Placement {
  const { fn, source } = register
  const name = fnName(register)
  if (!fn.body) return { status: 'fail', message: `${name} has no body` }
  if (!ts.isBlock(fn.body)) {
    return {
      status: 'fail',
      message: `${name} is an arrow function without a body (\`=> ${short(fn.body.getText(source))}\`), so there is no place for the flow-checker blocks`,
      hint: 'Give it a body: `async () => { <the blocks>; return … }` (or run "flow-checker init", which does it).',
    }
  }
  const anchors = runtimeAnchors(source, entry, fn)
  if (anchors.length === 0) {
    const elsewhere = runtimeAnchors(source, entry)
    if (elsewhere[0]) {
      const block = ownCondition(elsewhere[0], source) ?? statementOf(elsewhere[0])
      return {
        status: 'fail',
        message: `the flow-checker block is outside ${name} (line ${lineOf(source, block)}): Next.js only runs register()`,
      }
    }
    return { status: 'missing' }
  }
  const results = anchors.map((anchor) =>
    checkAnchor(register, fn as FunctionLike & { body: ts.Block }, anchor, entry),
  )
  const rank = { ok: 0, warn: 1, fail: 2, missing: 3 }
  return results.sort((a, b) => rank[a.status] - rank[b.status])[0] as Placement
}

function checkAnchor(
  register: RegisterFunction,
  fn: FunctionLike & { body: ts.Block },
  anchor: ts.Node,
  entry: HookEntry,
): Placement {
  const { source } = register
  const name = fnName(register)
  const own = ownCondition(anchor, fn)
  const block = own ?? statementOf(anchor)

  if (!isAsync(fn) && isDynamicImport(anchor)) {
    return {
      status: 'fail',
      message: `${name} isn't async, so \`await import(...)\` in it can't work`,
      hint: 'Make it async: `export async function register()` (or run "flow-checker init", which does it).',
    }
  }

  // Wrapped in something: describe the outermost construct, the one to move it out of.
  const path: ts.Node[] = []
  for (let node = block.parent; node && node !== fn.body; node = node.parent) path.unshift(node)
  const wrapper =
    path.map((node) => describeWrapper(node, block, source)).find(Boolean) ??
    path
      .filter((node) => ts.isStatement(node) && !ts.isBlock(node))
      .map((node) => `nested inside the statement at line ${lineOf(source, node)}`)[0]
  if (wrapper) return { status: 'fail', message: `the flow-checker block is ${wrapper}` }

  // At the top level: only comments and other flow-checker blocks may come before it.
  const index = fn.body.statements.indexOf(block as ts.Statement)
  for (const before of fn.body.statements.slice(0, index)) {
    if (isFlowCheckerBlock(before, source)) continue
    if (ts.isReturnStatement(before)) {
      return {
        status: 'fail',
        message: `the flow-checker block comes after the \`return\` at line ${lineOf(source, before)}: it never runs`,
      }
    }
    return {
      status: 'fail',
      message: `the flow-checker block comes after other code (line ${lineOf(source, before)}: \`${short(before.getText(source))}\`): an early return or an error there skips it, and requests sent before it are missed`,
    }
  }

  const runtime = entry === 'server' ? 'nodejs' : 'edge'
  const expected = `if (process.env.FLOW_CHECKER === '1' && process.env.NEXT_RUNTIME === '${runtime}')`
  if (!own) {
    return {
      status: 'warn',
      message: `the flow-checker block at line ${lineOf(source, block)} isn't wrapped in \`${expected}\``,
    }
  }
  const condition = normalize(own.expression.getText(source))
  if (
    !condition.includes("process.env.FLOW_CHECKER==='1'") ||
    !condition.includes(`process.env.NEXT_RUNTIME==='${runtime}'`)
  ) {
    return {
      status: 'warn',
      message: `the flow-checker block's condition at line ${lineOf(source, own)} was changed to \`${short(own.expression.getText(source))}\` (expected \`${expected}\`)`,
    }
  }
  return { status: 'ok' }
}

/** The text that says why a construct around the block stops it from running reliably. */
function describeWrapper(node: ts.Node, block: ts.Node, source: ts.SourceFile): string | undefined {
  const line = lineOf(source, node)
  if (ts.isIfStatement(node)) {
    const condition = short(node.expression.getText(source))
    const inElse = node.elseStatement !== undefined && within(block, node.elseStatement)
    const never = inElse
      ? /NODE_ENV\s*!==?\s*['"]production['"]|NODE_ENV\s*===?\s*['"]development['"]/.test(condition)
      : /NODE_ENV\s*===?\s*['"]production['"]/.test(condition)
    const why = never ? 'it never runs under `next dev`' : 'it only runs when that condition holds'
    return inElse
      ? `in the \`else\` branch of \`if (${condition})\` at line ${line}: ${why}`
      : `inside \`if (${condition})\` at line ${line}: ${why}`
  }
  if (ts.isSwitchStatement(node)) {
    return `inside \`switch (${short(node.expression.getText(source))})\` at line ${line}: it only runs for one case`
  }
  if (ts.isTryStatement(node)) {
    if (node.catchClause && within(block, node.catchClause)) {
      return `inside a \`catch\` block at line ${line}: it only runs after an error`
    }
    if (node.finallyBlock && within(block, node.finallyBlock)) {
      return `inside a \`finally\` block at line ${line}: code before it runs first`
    }
    return `inside a \`try\` block at line ${line}: errors from it are hidden`
  }
  if (ts.isIterationStatement(node, false)) return `inside a loop at line ${line}`
  if (ts.isConditionalExpression(node)) {
    return `inside a \`? :\` expression at line ${line}: it only runs on one side`
  }
  if (ts.isBinaryExpression(node) && LOGICAL.has(node.operatorToken.kind)) {
    return `after \`${node.operatorToken.getText(source)}\` at line ${line}: it only runs when the left side allows it`
  }
  if (ts.isFunctionLike(node)) {
    const call = node.parent && ts.isCallExpression(node.parent) ? node.parent : undefined
    return call
      ? `inside a callback passed to \`${short(call.expression.getText(source))}()\` at line ${line}: it only runs if that callback is called`
      : `inside a nested function at line ${line}: it only runs if that function is called`
  }
  return undefined
}

const LOGICAL = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
])

/**
 * Nodes that load `runtime/<entry>`: `import('…/runtime/server')`, or a call to a name imported
 * from it with a static import. Inside `scope` when given, else anywhere in the file.
 */
function runtimeAnchors(source: ts.SourceFile, entry: HookEntry, scope?: ts.Node): ts.Node[] {
  const spec = `${PACKAGE_NAME}/runtime/${entry}`
  const imported = new Set<string>()
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || moduleText(statement.moduleSpecifier) !== spec) continue
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) for (const e of bindings.elements) imported.add(e.name.text)
  }
  const out: ts.Node[] = []
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      if (isDynamicImport(node) && moduleText(node.arguments[0]) === spec) out.push(node)
      else if (ts.isIdentifier(node.expression) && imported.has(node.expression.text)) out.push(node)
    }
    ts.forEachChild(node, visit)
  }
  if (scope) ts.forEachChild(scope, visit)
  else {
    visit(source)
    // A static import with no call to it still loads the runtime outside register().
    if (out.length === 0) {
      const declaration = source.statements.find(
        (s) => ts.isImportDeclaration(s) && moduleText(s.moduleSpecifier) === spec,
      )
      if (declaration) out.push(declaration)
    }
  }
  return out
}

/** The block's own `if (process.env.FLOW_CHECKER === '1' && …)`, when the anchor is in its `then`. */
function ownCondition(anchor: ts.Node, fn: ts.Node): ts.IfStatement | undefined {
  for (let node = anchor.parent; node && node !== fn; node = node.parent) {
    if (ts.isFunctionLike(node)) return undefined
    if (
      ts.isIfStatement(node) &&
      within(anchor, node.thenStatement) &&
      /\bFLOW_CHECKER\b|\bNEXT_RUNTIME\b/.test(node.expression.getText())
    ) {
      return node
    }
  }
  return undefined
}

/** The statement that holds a node (its nearest ancestor in a statement list). */
function statementOf(node: ts.Node): ts.Node {
  let current = node
  while (current.parent && !isStatementList(current.parent)) current = current.parent
  return current
}

function isStatementList(node: ts.Node): boolean {
  return ts.isBlock(node) || ts.isSourceFile(node) || ts.isCaseClause(node) || ts.isDefaultClause(node)
}

function isFlowCheckerBlock(statement: ts.Node, source: ts.SourceFile): boolean {
  const text = statement.getText(source)
  return ["'", '"', '`'].some((quote) => text.includes(`${quote}${PACKAGE_NAME}/runtime/`))
}

// ---------------------------------------------------------------------------------------------
// Editing (init)

export type HookEdit =
  /** Already in place. */
  | { kind: 'ok' }
  /** No register() in the file: append the whole snippet. */
  | { kind: 'append'; text: string }
  /** The file's new text, and what changed. */
  | { kind: 'edit'; text: string; what: string }
  /** A shape init can't edit: the user does it. */
  | { kind: 'manual'; note: string }

/**
 * Puts the flow-checker blocks at the start of `register()` in an existing hook file: inserted
 * when missing, moved when misplaced, and `register` made `async` when it isn't.
 */
export function editServerHook(file: string, root: string): HookEdit {
  const lookup = findRegister(file, root)
  // One parse, so nodes from the lookup and from this file compare equal.
  const source =
    lookup.kind === 'found' && lookup.register.file === file ? lookup.register.source : parseFile(file)
  if (!source) return manual(`${shown(root, file)} can't be read.`)
  const text = source.text
  const ours = ownBlocks(source)
  const custom = (['server', 'edge'] as const).some((entry) =>
    runtimeAnchors(source, entry).some((anchor) => !ours.some((block) => within(anchor, block))),
  )
  const where = shown(root, file)

  if (lookup.kind === 'none') {
    if (custom) return manual(`${where} loads flow-checker outside register().`)
    if (ours.length === 0) return { kind: 'append', text: `\n${SERVER_SNIPPET}` }
    return {
      kind: 'edit',
      text: `${removeRanges(text, source, ours).trimEnd()}\n\n${SERVER_SNIPPET}`,
      what: 'moves the flow-checker blocks into register()',
    }
  }
  if (lookup.kind === 'unknown') return manual(`${where}: ${lookup.reason}.`)

  const register = lookup.register
  const node = checkPlacement(register, 'server')
  const edge = checkPlacement(register, 'edge')
  const placed = (p: Placement) => p.status === 'ok' || p.status === 'warn'
  if (placed(node) && (placed(edge) || edge.status === 'missing')) return { kind: 'ok' }
  if (!register.editable || register.file !== file) {
    return manual(`register() in ${where} comes from ${register.via ?? 'another file'}.`)
  }
  if (custom) return manual(`${where} loads flow-checker in a shape init can't move.`)

  const fn = register.fn
  const fnBody = fn.body
  if (!fnBody) return manual(`register() in ${where} has no body.`)
  const edits: { start: number; end: number; text: string }[] = []
  const what: string[] = [
    ours.length > 0
      ? 'moves the flow-checker blocks to the start of register()'
      : 'adds the flow-checker blocks at the start of register()',
  ]
  for (const block of ours) edits.push({ ...lineRange(text, source, block), text: '' })

  if (!isAsync(fn)) {
    what.push('makes it async')
    const at = ts.isArrowFunction(fn)
      ? fn.getStart(source)
      : skipSpace(text, fn.modifiers?.end ?? fn.getStart(source))
    edits.push({ start: at, end: at, text: 'async ' })
    if (fn.type && !/^Promise\s*</.test(fn.type.getText(source))) {
      edits.push({
        start: fn.type.getStart(source),
        end: fn.type.end,
        text: `Promise<${fn.type.getText(source)}>`,
      })
    }
  }

  const indent = lineIndent(text, fn.getStart(source))
  if (ts.isBlock(fnBody)) {
    const first = fnBody.statements[0]
    const inner =
      first && !ours.some((block) => block === first)
        ? lineIndent(text, first.getStart(source))
        : `${indent}  `
    const open = fnBody.getStart(source) + 1
    const rest = text.slice(open, fnBody.end - 1)
    const closing = /^[ \t]*\r?\n/.test(rest) ? '' : `\n${indent}`
    edits.push({ start: open, end: open, text: `\n${reindent(REGISTER_BODY, inner)}${closing}` })
  } else {
    // `() => init()` gets a body: the blocks, then `return init()`.
    const inner = `${indent}  `
    const body = fnBody.getText(source)
    edits.push({
      start: fnBody.getStart(source),
      end: fnBody.end,
      text: `{\n${reindent(REGISTER_BODY, inner)}\n${inner}return ${body}\n${indent}}`,
    })
    what.push('gives it a body')
  }

  return { kind: 'edit', text: applyEdits(text, edits), what: what.join(', ') }
}

function manual(reason: string): HookEdit {
  return {
    kind: 'manual',
    note: `${reason} Add this as the first lines of register(), outside any \`if\` (register must be async):\n\n${REGISTER_BODY}\n`,
  }
}

/** flow-checker's own `if (process.env.FLOW_CHECKER === '1' …) { … import('…/runtime/…') }` blocks. */
function ownBlocks(source: ts.SourceFile): ts.IfStatement[] {
  const out: ts.IfStatement[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isIfStatement(node) &&
      !node.elseStatement &&
      /\bFLOW_CHECKER\b/.test(node.expression.getText(source)) &&
      isFlowCheckerBlock(node.thenStatement, source)
    ) {
      out.push(node)
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return out
}

/** The whole lines of a statement, with the `// flow-checker:` comments right above it. */
function lineRange(text: string, source: ts.SourceFile, node: ts.Node): { start: number; end: number } {
  let start = node.getStart(source)
  for (const comment of ts.getLeadingCommentRanges(text, node.pos) ?? []) {
    if (text.slice(comment.pos, comment.end).startsWith('// flow-checker:')) {
      start = Math.min(start, comment.pos)
      break
    }
  }
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  if (/^[ \t]*$/.test(text.slice(lineStart, start))) start = lineStart
  let end = node.end
  const newline = text.indexOf('\n', end)
  const lineEnd = newline === -1 ? text.length : newline + 1
  if (/^[ \t]*\r?\n?$/.test(text.slice(end, lineEnd))) end = lineEnd
  return { start, end }
}

function removeRanges(text: string, source: ts.SourceFile, nodes: ts.Node[]): string {
  return applyEdits(
    text,
    nodes.map((node) => ({ ...lineRange(text, source, node), text: '' })),
  )
}

function applyEdits(text: string, edits: { start: number; end: number; text: string }[]): string {
  let out = text
  for (const edit of [...edits].sort((a, b) => b.start - a.start || b.end - a.end)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
  }
  return out
}

function reindent(snippet: string, indent: string): string {
  return snippet
    .split('\n')
    .map((line) => (line.startsWith('  ') ? indent + line.slice(2) : line))
    .join('\n')
}

function lineIndent(text: string, at: number): string {
  const lineStart = text.lastIndexOf('\n', at - 1) + 1
  return /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? ''
}

function skipSpace(text: string, at: number): number {
  let i = at
  while (i < text.length && /\s/.test(text[i] ?? '')) i++
  return i
}

// ---------------------------------------------------------------------------------------------
// Helpers

function parseFile(file: string): ts.SourceFile | undefined {
  try {
    return ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      scriptKind(file),
    )
  } catch {
    return undefined
  }
}

function scriptKind(file: string): ts.ScriptKind {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX
  if (/\.(m|c)?ts$/.test(file)) return ts.ScriptKind.TS
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX
  return ts.ScriptKind.JS
}

function isExported(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  )
}

function isAsync(fn: FunctionLike): boolean {
  return (ts.getModifiers(fn) ?? []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
}

function isDynamicImport(node: ts.Node): boolean {
  return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
}

function moduleText(node: ts.Node | undefined): string | undefined {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression
  }
  return current
}

function within(node: ts.Node, container: ts.Node): boolean {
  return node.pos >= container.pos && node.end <= container.end
}

function fnName(register: RegisterFunction): string {
  return register.via ? `register() (from ${register.via})` : 'register()'
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
}

/** Quotes made single and spaces removed, so conditions compare by shape. */
function normalize(code: string): string {
  return code.replaceAll('"', "'").replaceAll('`', "'").replace(/\s+/g, '')
}

/** First line of some code, cut to a readable length. */
function short(code: string): string {
  const line = code.split('\n')[0]?.trim() ?? ''
  const cut = line.length > 60 ? `${line.slice(0, 57)}…` : line
  return code.includes('\n') && cut === line ? `${cut} …` : cut
}

function shown(root: string, file: string): string {
  return relative(root, file).replaceAll('\\', '/') || file
}
