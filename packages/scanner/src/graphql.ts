// GraphQL (M17): documents, client calls and client setup.
//
// Documents are found where they are written: `gql` / `graphql` tagged templates (Apollo, urql,
// graphql-tag, Relay), the codegen client preset's `graphql('...')`, imported `.graphql` files
// and codegen's generated document constants. Fragments are global by name (that is how every
// client resolves `...TodoItem`), so a template's `${FRAGMENT}` interpolations don't need to be
// followed.
//
// Calls are the client libraries' hooks and methods: Apollo (`useQuery`, `useLazyQuery`,
// `useMutation`, `client.query()`, ...), urql (`useQuery({ query })`, `client.query(doc)`) and
// Relay (`useLazyLoadQuery`, `useQueryLoader`, `commitMutation`, ...).
import { createHash } from 'node:crypto'
import { posix } from 'node:path'
import {
  type GraphqlLibrary,
  type GraphqlOperation,
  type GraphqlOperationType,
  makeId,
  type SourceLoc,
} from '@flow-checker/shared'
import {
  type ASTNode,
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  Kind,
  type OperationDefinitionNode,
  parse,
  print,
  type SelectionSetNode,
  visit,
} from 'graphql'
import { type CallExpression, type FileSystemHost, Node as N, type Node, type SourceFile, ts } from 'ts-morph'
import { importModuleOf, unalias } from './components'
import { usedFragments } from './graphql-schema'
import { relativeTo } from './paths'

// --- Documents -------------------------------------------------------------------------------

/** Modules whose `gql` / `graphql` tag parses a document. A tag named so from elsewhere counts too. */
const TAG_MODULES: Record<string, GraphqlLibrary | undefined> = {
  'graphql-tag': undefined,
  'graphql-request': undefined,
  '@apollo/client': 'apollo',
  '@apollo/client/core': 'apollo',
  urql: 'urql',
  '@urql/core': 'urql',
  '@urql/next': 'urql',
  'react-relay': 'relay',
  'react-relay/hooks': 'relay',
  'relay-runtime': 'relay',
  'babel-plugin-relay/macro': 'relay',
}
const TAG_NAMES = new Set(['gql', 'graphql'])

/** One operation or fragment in a document. */
export interface Definition {
  kind: 'operation' | 'fragment'
  /** Empty for an anonymous operation. */
  name: string
  type: GraphqlOperationType
  /** Fragments: the type it is on. */
  on?: string
  node: OperationDefinitionNode | FragmentDefinitionNode
  /** Printed. */
  text: string
}

export interface Doc {
  source: GraphqlOperation['source']
  /** The tag, call, import or constant it came from. */
  node: Node
  loc: SourceLoc
  /** `.graphql` file: project-relative. */
  file?: string
  definitions: Definition[]
  /** Written with Relay's `graphql` tag (the Relay compiler generates its types). */
  relay: boolean
}

export interface OperationEntry {
  id: string
  name: string
  type: GraphqlOperationType
  definition: Definition
  doc: Doc
}

export interface FragmentEntry {
  id: string
  name: string
  on: string
  definition: Definition
  doc: Doc
}

/** A document a value resolves to, and the operation an import named (`import { Todos } from './x.graphql'`). */
export interface DocRef {
  doc: Doc
  pick?: string
}

/** Every document found in the project, with its operations and fragments. */
export class GraphqlCatalog {
  readonly #root: string
  readonly #fs: FileSystemHost
  readonly #docs = new Map<Node, Doc | null>()
  readonly #files = new Map<string, Doc | null>()
  /** By id. Operations with the same name and text are one entry. */
  readonly operations = new Map<string, OperationEntry>()
  readonly fragments = new Map<string, FragmentEntry>()

  constructor(root: string, fs: FileSystemHost) {
    this.#root = root
    this.#fs = fs
  }

  /** Finds the tags and `graphql()` calls in a file. */
  addFile(file: SourceFile) {
    const text = file.getFullText()
    if (!text.includes('gql') && !text.includes('graphql')) return
    file.forEachDescendant((node) => {
      if (N.isTaggedTemplateExpression(node) || N.isCallExpression(node)) this.docAt(node)
    })
  }

  /** The document written at this node: a tag, a codegen `graphql()` call or a generated constant. */
  docAt(node: Node): Doc | undefined {
    const cached = this.#docs.get(node)
    if (cached !== undefined) return cached ?? undefined
    let doc: Doc | undefined
    try {
      doc = this.#read(node)
    } catch {
      doc = undefined
    }
    this.#docs.set(node, doc ?? null)
    if (doc) this.#register(doc)
    return doc
  }

  /** Follows a value (constants, imports, `.graphql` files) to the document it is. */
  resolve(expr: Node | undefined, depth = 0): DocRef | undefined {
    if (!expr || depth > 8) return undefined
    const node = skip(expr)
    const direct = this.docAt(node)
    if (direct) return { doc: direct }
    if (!N.isIdentifier(node) && !N.isPropertyAccessExpression(node)) return undefined
    const symbol = node.getSymbol()
    if (!symbol) return undefined
    for (const decl of symbol.getDeclarations()) {
      const importDecl = decl.getFirstAncestorByKind(ts.SyntaxKind.ImportDeclaration)
      if (importDecl && /\.(graphql|gql)$/.test(importDecl.getModuleSpecifierValue())) {
        const doc = this.#importedFile(importDecl.getSourceFile(), importDecl.getModuleSpecifierValue())
        if (!doc) return undefined
        return N.isImportSpecifier(decl) ? { doc, pick: decl.getName() } : { doc }
      }
    }
    for (const decl of unalias(symbol).getDeclarations()) {
      if (N.isVariableDeclaration(decl) || N.isPropertyAssignment(decl)) {
        const found = this.resolve(decl.getInitializer(), depth + 1)
        if (found) return found
      }
      if (N.isExportAssignment(decl)) return this.resolve(decl.getExpression(), depth + 1)
    }
    return undefined
  }

  /** The operation a document sends: the one named, else the first. */
  operationOf(ref: DocRef): OperationEntry | undefined {
    const defs = ref.doc.definitions.filter((d) => d.kind === 'operation')
    const def = (ref.pick && defs.find((d) => d.name === ref.pick)) || defs[0]
    return def ? this.#entryOf(def) : undefined
  }

  /** Fragments a document defines: the one named, else all. */
  fragmentsOf(ref: DocRef): FragmentEntry[] {
    const defs = ref.doc.definitions.filter((d) => d.kind === 'fragment')
    const picked = ref.pick ? defs.filter((d) => d.name === ref.pick) : defs
    return picked.flatMap((d) => this.fragments.get(d.name) ?? [])
  }

  /** Fragment definitions by name, for the schema walk and hashes. */
  fragmentNodes(): Map<string, FragmentDefinitionNode> {
    return new Map(
      [...this.fragments].map(([name, f]) => [name, f.definition.node as FragmentDefinitionNode]),
    )
  }

  /** Fragment names an operation spreads, directly or through other fragments. */
  spreadsOf(op: OperationEntry): string[] {
    return usedFragments(op.definition.node.selectionSet, this.fragmentNodes()).map((f) => f.name.value)
  }

  #entryOf(def: Definition): OperationEntry | undefined {
    for (const entry of this.operations.values()) if (entry.definition === def) return entry
    return undefined
  }

  #register(doc: Doc) {
    for (const def of doc.definitions) {
      if (def.kind === 'fragment') {
        if (!this.fragments.has(def.name)) {
          this.fragments.set(def.name, {
            id: makeId('gqf', def.name),
            name: def.name,
            on: def.on ?? '',
            definition: def,
            doc,
          })
        }
        continue
      }
      const same = [...this.operations.values()].find(
        (o) => o.name === def.name && o.definition.text === def.text,
      )
      if (same && def.name) {
        // A codegen constant repeats a document written elsewhere: point it at the first one.
        if (same.definition !== def) doc.definitions[doc.definitions.indexOf(def)] = same.definition
        continue
      }
      const taken = def.name && [...this.operations.values()].some((o) => o.name === def.name)
      const key = !def.name || taken ? `${def.name}@${doc.loc.file}:${doc.loc.line}` : def.name
      const id = makeId('gqo', key)
      this.operations.set(id, { id, name: def.name, type: def.type, definition: def, doc })
    }
  }

  #read(node: Node): Doc | undefined {
    if (N.isTaggedTemplateExpression(node)) {
      const tag = node.getTag()
      const name = N.isPropertyAccessExpression(tag) ? tag.getName() : tag.getText()
      if (!TAG_NAMES.has(name)) return undefined
      const module = importModuleOf(tag)
      const definitions = parseDefinitions(templateText(node.getTemplate()))
      if (!definitions) return undefined
      return {
        source: 'tag',
        node,
        loc: this.#loc(node),
        definitions,
        relay: !!module && TAG_MODULES[module] === 'relay',
      }
    }
    if (N.isCallExpression(node)) {
      // The codegen client preset: `graphql(\`query Todos { ... }\`)`.
      const callee = node.getExpression()
      const name = N.isPropertyAccessExpression(callee) ? callee.getName() : callee.getText()
      const [arg, ...rest] = node.getArguments()
      if (!TAG_NAMES.has(name) || !arg || rest.length > 0) return undefined
      if (!N.isStringLiteral(arg) && !N.isNoSubstitutionTemplateLiteral(arg) && !N.isTemplateExpression(arg))
        return undefined
      const text = N.isTemplateExpression(arg) ? templateText(arg) : arg.getLiteralText()
      const definitions = parseDefinitions(text)
      if (!definitions) return undefined
      const module = importModuleOf(callee)
      const source = module && module in TAG_MODULES ? 'tag' : 'codegen'
      return { source, node, loc: this.#loc(node), definitions, relay: false }
    }
    if (N.isObjectLiteralExpression(node)) {
      // A generated constant: `{"kind":"Document","definitions":[...]} as unknown as DocumentNode<...>`.
      const text = node.getText()
      if (!/^\{\s*"?kind"?\s*:\s*["']Document["']/.test(text)) return undefined
      const ast = JSON.parse(text) as DocumentNode
      const definitions = parseDefinitions(print(ast))
      if (!definitions) return undefined
      return { source: 'generated', node, loc: this.#loc(node), definitions, relay: false }
    }
    return undefined
  }

  /** An imported `.graphql` file, read from disk. */
  #importedFile(from: SourceFile, specifier: string): Doc | undefined {
    if (!specifier.startsWith('.')) return undefined
    const path = posix.join(posix.dirname(from.getFilePath()), specifier)
    const cached = this.#files.get(path)
    if (cached !== undefined) return cached ?? undefined
    let doc: Doc | undefined
    try {
      const text = this.#fs.readFileSync(path)
      const definitions = parseDefinitions(text, true)
      const first = definitions?.[0]?.node.loc
      if (definitions) {
        doc = {
          source: 'file',
          node: from,
          loc: { file: relativeTo(this.#root, path), line: first?.startToken.line ?? 1, column: 1 },
          file: relativeTo(this.#root, path),
          definitions,
          relay: false,
        }
      }
    } catch {
      doc = undefined
    }
    this.#files.set(path, doc ?? null)
    if (doc) this.#register(doc)
    return doc
  }

  #loc(node: Node): SourceLoc {
    const file = node.getSourceFile()
    const { line, column } = file.getLineAndColumnAtPos(node.getStart())
    return { file: relativeTo(this.#root, file.getFilePath()), line, column }
  }
}

/** Parses a document's operations and fragments. Undefined when it isn't one (or is only a schema). */
export function parseDefinitions(text: string, withLocations = false): Definition[] | undefined {
  let doc: DocumentNode
  try {
    doc = parse(text, { noLocation: !withLocations })
  } catch {
    return undefined
  }
  const out: Definition[] = []
  for (const def of doc.definitions) {
    if (def.kind === Kind.OPERATION_DEFINITION) {
      out.push({
        kind: 'operation',
        name: def.name?.value ?? '',
        type: def.operation,
        node: def,
        text: print(def),
      })
    } else if (def.kind === Kind.FRAGMENT_DEFINITION) {
      out.push({
        kind: 'fragment',
        name: def.name.value,
        type: 'query',
        on: def.typeCondition.name.value,
        node: def,
        text: print(def),
      })
    }
  }
  return out.length > 0 ? out : undefined
}

/** A template's text. Interpolations (`${FRAGMENT}`) are documents, joined in by name. */
function templateText(tpl: Node): string {
  if (N.isNoSubstitutionTemplateLiteral(tpl)) return tpl.getLiteralText()
  if (!N.isTemplateExpression(tpl)) return ''
  return [
    tpl.getHead().getLiteralText(),
    ...tpl.getTemplateSpans().map((s) => s.getLiteral().getLiteralText()),
  ].join('\n')
}

// --- Persisted queries -----------------------------------------------------------------------

const TYPENAME: FieldNode = { kind: Kind.FIELD, name: { kind: Kind.NAME, value: '__typename' } }

/**
 * Ids a persisted query link would send for the operation: the sha256 of the printed document
 * with its fragments, as written and with `__typename` added the way Apollo's cache does.
 */
export function documentHashes(op: OperationDefinitionNode, fragments: FragmentDefinitionNode[]): string[] {
  const doc: DocumentNode = { kind: Kind.DOCUMENT, definitions: [op, ...fragments] }
  const typed = visit(doc, {
    SelectionSet: {
      leave(node: SelectionSetNode, _key, parent) {
        const owner = parent as ASTNode | readonly ASTNode[] | undefined
        if (owner && !Array.isArray(owner) && (owner as ASTNode).kind === Kind.OPERATION_DEFINITION)
          return undefined
        if (node.selections.some((s) => s.kind === Kind.FIELD && s.name.value === '__typename'))
          return undefined
        return { ...node, selections: [...node.selections, TYPENAME] }
      },
    },
  })
  return [...new Set([sha256(print(doc)), sha256(print(typed))])]
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/**
 * A persisted query manifest: id -> document text. Reads codegen's `persisted-documents.json` and
 * Relay's `persisted_queries.json` (`{ id: text }`) and Apollo's `persisted-query-manifest.json`.
 */
export function readManifest(text: string): Map<string, string> {
  const json = JSON.parse(text) as unknown
  const out = new Map<string, string>()
  if (!json || typeof json !== 'object') return out
  const ops = (json as { operations?: unknown }).operations
  if (Array.isArray(ops)) {
    for (const op of ops) {
      const { id, body } = (op ?? {}) as { id?: unknown; body?: unknown }
      if (typeof id === 'string' && typeof body === 'string') out.set(id, body)
    }
    return out
  }
  for (const [id, body] of Object.entries(json)) if (typeof body === 'string') out.set(id, body)
  return out
}

// --- Calls -----------------------------------------------------------------------------------

/**
 * `query`: sends on render. `lazy`: sends when the function it returns is called (`useLazyQuery`,
 * `useQueryLoader`). `fragment`: reads a fragment (`useFragment`), no request. `preloaded`:
 * reads what `loadQuery` fetched, no request.
 */
export type GraphqlCallKind = 'query' | 'lazy' | 'mutation' | 'subscription' | 'fragment' | 'preloaded'

export interface GraphqlCall {
  library: GraphqlLibrary
  /** As shown on the site: `useQuery`, `client.query`. */
  name: string
  module: string
  kind: GraphqlCallKind
  type: GraphqlOperationType
  /** The document: argument index, and the property of that argument when it is an options object. */
  docArg: number
  docProp?: string
  /** The options object (variables, callbacks, `refetchQueries`). */
  optionsArg?: number
  /** Position, in the returned tuple, of the function that sends it (lazy queries, mutations). */
  executor?: number
  /** Type arguments: Apollo / urql `<Data, Variables>`, Relay `<Operation>` with `response` / `variables`. */
  typeArgs: 'data-vars' | 'relay'
}

type CallDef = Omit<GraphqlCall, 'library' | 'module' | 'name' | 'typeArgs'>

const APOLLO_MODULES = [
  '@apollo/client',
  '@apollo/client/react',
  '@apollo/client/react/hooks',
  '@apollo/client-integration-nextjs',
  '@apollo/experimental-nextjs-app-support',
  '@apollo/experimental-nextjs-app-support/ssr',
]
const URQL_MODULES = ['urql', '@urql/next', '@urql/preact']
const RELAY_MODULES = ['react-relay', 'react-relay/hooks', 'relay-runtime']

const APOLLO_HOOKS: Record<string, CallDef> = {
  useQuery: { kind: 'query', type: 'query', docArg: 0, optionsArg: 1 },
  useSuspenseQuery: { kind: 'query', type: 'query', docArg: 0, optionsArg: 1 },
  useBackgroundQuery: { kind: 'query', type: 'query', docArg: 0, optionsArg: 1 },
  useLazyQuery: { kind: 'lazy', type: 'query', docArg: 0, optionsArg: 1, executor: 0 },
  useLoadableQuery: { kind: 'lazy', type: 'query', docArg: 0, optionsArg: 1, executor: 0 },
  useMutation: { kind: 'mutation', type: 'mutation', docArg: 0, optionsArg: 1, executor: 0 },
  useSubscription: { kind: 'subscription', type: 'subscription', docArg: 0, optionsArg: 1 },
  useFragment: { kind: 'fragment', type: 'query', docArg: 0, docProp: 'fragment' },
  useSuspenseFragment: { kind: 'fragment', type: 'query', docArg: 0, docProp: 'fragment' },
}
const URQL_HOOKS: Record<string, CallDef> = {
  useQuery: { kind: 'query', type: 'query', docArg: 0, docProp: 'query', optionsArg: 0 },
  useMutation: { kind: 'mutation', type: 'mutation', docArg: 0, executor: 1 },
  useSubscription: { kind: 'subscription', type: 'subscription', docArg: 0, docProp: 'query', optionsArg: 0 },
}
const RELAY_CALLS: Record<string, CallDef> = {
  useLazyLoadQuery: { kind: 'query', type: 'query', docArg: 0 },
  useQueryLoader: { kind: 'lazy', type: 'query', docArg: 0, executor: 1 },
  usePreloadedQuery: { kind: 'preloaded', type: 'query', docArg: 0 },
  loadQuery: { kind: 'query', type: 'query', docArg: 1 },
  fetchQuery: { kind: 'query', type: 'query', docArg: 1 },
  useMutation: { kind: 'mutation', type: 'mutation', docArg: 0, executor: 0 },
  commitMutation: { kind: 'mutation', type: 'mutation', docArg: 1, docProp: 'mutation', optionsArg: 1 },
  useSubscription: { kind: 'subscription', type: 'subscription', docArg: 0, docProp: 'subscription' },
  requestSubscription: { kind: 'subscription', type: 'subscription', docArg: 1, docProp: 'subscription' },
  useFragment: { kind: 'fragment', type: 'query', docArg: 0 },
  usePaginationFragment: { kind: 'fragment', type: 'query', docArg: 0 },
  useRefetchableFragment: { kind: 'fragment', type: 'query', docArg: 0 },
}

const CALLS = new Map<string, Omit<GraphqlCall, 'name'>>()
for (const module of APOLLO_MODULES)
  for (const [name, def] of Object.entries(APOLLO_HOOKS))
    CALLS.set(`${module}#${name}`, { ...def, library: 'apollo', module, typeArgs: 'data-vars' })
for (const module of URQL_MODULES)
  for (const [name, def] of Object.entries(URQL_HOOKS))
    CALLS.set(`${module}#${name}`, { ...def, library: 'urql', module, typeArgs: 'data-vars' })
for (const module of RELAY_MODULES)
  for (const [name, def] of Object.entries(RELAY_CALLS))
    CALLS.set(`${module}#${name}`, { ...def, library: 'relay', module, typeArgs: 'relay' })

/** Apollo client methods: `client.query({ query })`, `client.mutate({ mutation })`. */
const APOLLO_METHODS: Record<string, CallDef> = {
  query: { kind: 'query', type: 'query', docArg: 0, docProp: 'query', optionsArg: 0 },
  watchQuery: { kind: 'query', type: 'query', docArg: 0, docProp: 'query', optionsArg: 0 },
  mutate: { kind: 'mutation', type: 'mutation', docArg: 0, docProp: 'mutation', optionsArg: 0 },
  subscribe: { kind: 'subscription', type: 'subscription', docArg: 0, docProp: 'query', optionsArg: 0 },
}
/** urql client methods: `client.query(doc, variables)`. */
const URQL_METHODS: Record<string, CallDef> = {
  query: { kind: 'query', type: 'query', docArg: 0 },
  mutation: { kind: 'mutation', type: 'mutation', docArg: 0 },
  subscription: { kind: 'subscription', type: 'subscription', docArg: 0 },
}

/** A GraphQL client call, or undefined. */
export function graphqlCall(call: CallExpression): GraphqlCall | undefined {
  const callee = call.getExpression()
  const imported = importedName(callee)
  if (imported) {
    const def = CALLS.get(`${imported.module}#${imported.name}`)
    if (def) return { ...def, name: imported.name }
  }
  if (N.isPropertyAccessExpression(callee)) {
    const method = callee.getName()
    const kind =
      APOLLO_METHODS[method] || URQL_METHODS[method] ? clientKind(callee.getExpression()) : undefined
    const def =
      kind === 'apollo' ? APOLLO_METHODS[method] : kind === 'urql' ? URQL_METHODS[method] : undefined
    if (kind && def) {
      const module = kind === 'apollo' ? '@apollo/client' : '@urql/core'
      return { ...def, library: kind, module, name: `client.${method}`, typeArgs: 'data-vars' }
    }
  }
  // `export const { query } = registerApolloClient(...)` (Apollo's Next.js integration).
  if (N.isIdentifier(callee) && callee.getText() === 'query' && fromRegisterApolloClient(callee)) {
    const def = APOLLO_METHODS.query as CallDef
    return {
      ...def,
      library: 'apollo',
      module: '@apollo/client-integration-nextjs',
      name: 'query',
      typeArgs: 'data-vars',
    }
  }
  return undefined
}

/** `client.refetchQueries({ include: [...] })` on an Apollo client. */
export function isApolloRefetch(call: CallExpression): boolean {
  const callee = call.getExpression()
  return (
    N.isPropertyAccessExpression(callee) &&
    callee.getName() === 'refetchQueries' &&
    clientKind(callee.getExpression()) === 'apollo'
  )
}

const clientKinds = new WeakMap<Node, GraphqlLibrary | null>()

/** Whether a value is an Apollo or urql client: by its type, else by where it comes from. */
function clientKind(expr: Node): GraphqlLibrary | undefined {
  const cached = clientKinds.get(expr)
  if (cached !== undefined) return cached ?? undefined
  let kind: GraphqlLibrary | undefined
  try {
    kind = clientKindOf(expr, 0)
  } catch {
    kind = undefined
  }
  clientKinds.set(expr, kind ?? null)
  return kind
}

function clientKindOf(expr: Node, depth: number): GraphqlLibrary | undefined {
  if (depth > 4) return undefined
  const node = skip(expr)
  const type = node.getType()
  const symbol = type.getSymbol() ?? type.getAliasSymbol()
  const name = symbol?.getName()
  const file = symbol?.getDeclarations()[0]?.getSourceFile().getFilePath() ?? ''
  if (name === 'ApolloClient' && file.includes('@apollo')) return 'apollo'
  if (name === 'Client' && file.includes('@urql')) return 'urql'
  // Untyped: follow the value to `useApolloClient()`, `useClient()`, `new ApolloClient()`, `getClient()`.
  let init: Node | undefined = node
  if (N.isIdentifier(node)) {
    const decl = node.getSymbol() && unalias(node.getSymbol() as never).getDeclarations()[0]
    init = decl && N.isVariableDeclaration(decl) ? decl.getInitializer() : undefined
  }
  if (!init) return undefined
  init = skip(init)
  if (N.isCallExpression(init) || N.isNewExpression(init)) {
    const callee = init.getExpression()
    const imported = importedName(callee)
    if (imported) {
      if (imported.name === 'useApolloClient' || imported.name === 'ApolloClient') {
        if (APOLLO_MODULES.includes(imported.module)) return 'apollo'
      }
      if (
        (imported.name === 'useClient' || imported.name === 'createClient' || imported.name === 'Client') &&
        [...URQL_MODULES, '@urql/core'].includes(imported.module)
      )
        return 'urql'
    }
    if (N.isIdentifier(callee) && callee.getText() === 'getClient' && fromRegisterApolloClient(callee))
      return 'apollo'
    if (N.isIdentifier(callee) && depth < 4) {
      // A project function that returns the client.
      const decl = callee.getSymbol() && unalias(callee.getSymbol() as never).getDeclarations()[0]
      const fn = decl && N.isVariableDeclaration(decl) ? decl.getInitializer() : decl
      if (fn && (N.isArrowFunction(fn) || N.isFunctionDeclaration(fn) || N.isFunctionExpression(fn))) {
        const body = fn.getBody()
        const returned =
          body && N.isBlock(body)
            ? body.getDescendantsOfKind(ts.SyntaxKind.ReturnStatement)[0]?.getExpression()
            : body
        if (returned) return clientKindOf(returned, depth + 1)
      }
    }
  }
  return undefined
}

function fromRegisterApolloClient(identifier: Node): boolean {
  const symbol = identifier.getSymbol()
  if (!symbol) return false
  const decl = unalias(symbol).getDeclarations()[0]
  if (!decl || !N.isBindingElement(decl)) return false
  const init = decl.getFirstAncestorByKind(ts.SyntaxKind.VariableDeclaration)?.getInitializer()
  return (
    !!init && N.isCallExpression(init) && importedName(init.getExpression())?.name === 'registerApolloClient'
  )
}

// --- Client setup ----------------------------------------------------------------------------

export interface ClientFound {
  library: GraphqlLibrary
  node: Node
  /** The URL expression, to be evaluated by the request scanner. */
  url?: Node
  batching?: boolean
  persisted?: boolean
  /** Queries go as GET (urql's default, Apollo's `useGETForQueries`). */
  getForQueries?: boolean
}

const HTTP_LINKS = new Set([
  'HttpLink',
  'createHttpLink',
  'BatchHttpLink',
  'createUploadLink',
  'UploadHttpLink',
])

/** `new ApolloClient({ uri | link })`, urql's `createClient({ url })`, Relay's `Network.create(fetchFn)`. */
export function findClients(files: SourceFile[]): ClientFound[] {
  const out: ClientFound[] = []
  for (const file of files) {
    const text = file.getFullText()
    if (!/ApolloClient|createClient|new Client\b|Network\.create/.test(text)) continue
    file.forEachDescendant((node) => {
      if (!N.isNewExpression(node) && !N.isCallExpression(node)) return
      const callee = node.getExpression()
      const imported = importedName(callee)
      const options = node.getArguments()[0]
      if (imported?.name === 'ApolloClient' && N.isNewExpression(node)) {
        out.push({ library: 'apollo', node, ...apolloLinks(options) })
        return
      }
      if (
        imported &&
        (imported.name === 'createClient' || (imported.name === 'Client' && N.isNewExpression(node))) &&
        [...URQL_MODULES, '@urql/core'].includes(imported.module)
      ) {
        const url = options && propInit(options, 'url')
        const preferGet = options && propInit(options, 'preferGetMethod')
        const exchanges = options && propInit(options, 'exchanges')
        out.push({
          library: 'urql',
          node,
          ...(url ? { url } : {}),
          // urql 4+ sends queries as GET while the URL is short enough, unless told otherwise.
          getForQueries: !preferGet || !/^(false|'POST'|"POST")$/.test(preferGet.getText()),
          ...(exchanges && /persistedExchange/.test(exchanges.getText()) ? { persisted: true } : {}),
        })
        return
      }
      if (
        N.isCallExpression(node) &&
        N.isPropertyAccessExpression(callee) &&
        callee.getName() === 'create' &&
        importedName(callee.getExpression())?.name === 'Network'
      ) {
        const fn = options && functionAt(options)
        const fetchCall = fn
          ?.getDescendantsOfKind(ts.SyntaxKind.CallExpression)
          .find((c) => c.getExpression().getText() === 'fetch')
        const url = fetchCall?.getArguments()[0]
        const persisted = !!fn && /\b(doc_id|documentId)\b|params\.id\b/.test(fn.getText())
        out.push({ library: 'relay', node, ...(url ? { url } : {}), ...(persisted ? { persisted } : {}) })
      }
    })
  }
  return out
}

/** The URL and link features of an Apollo client, following the link through constants. */
function apolloLinks(options: Node | undefined): Omit<ClientFound, 'library' | 'node'> {
  if (!options) return {}
  const uri = propInit(options, 'uri')
  const out: Omit<ClientFound, 'library' | 'node'> = uri ? { url: uri } : {}
  for (const node of expand(options, 0)) {
    for (const d of [node, ...node.getDescendants()]) {
      if (!N.isNewExpression(d) && !N.isCallExpression(d)) continue
      const name = importedName(d.getExpression())?.name
      if (!name) continue
      if (HTTP_LINKS.has(name)) {
        const linkUri = d.getArguments()[0] && propInit(d.getArguments()[0] as Node, 'uri')
        if (linkUri && !out.url) out.url = linkUri
        if (name === 'BatchHttpLink') out.batching = true
        const get = d.getArguments()[0] && propInit(d.getArguments()[0] as Node, 'useGETForQueries')
        if (get?.getText() === 'true') out.getForQueries = true
      }
      if (name === 'createPersistedQueryLink' || name === 'PersistedQueryLink') out.persisted = true
    }
  }
  return out
}

/** A node and the initializers of the project constants it uses, a few levels deep. */
function expand(node: Node, depth: number, seen = new Set<Node>()): Node[] {
  if (seen.has(node)) return []
  seen.add(node)
  const out = [node]
  if (depth >= 3) return out
  for (const id of node.getDescendantsOfKind(ts.SyntaxKind.Identifier)) {
    // `{ link }`: the name's own symbol is the property, the value is the variable.
    const parent = id.getParent()
    const symbol =
      parent && N.isShorthandPropertyAssignment(parent) ? parent.getValueSymbol() : id.getSymbol()
    const decl = symbol?.getDeclarations()[0]
    if (!decl || !N.isVariableDeclaration(decl) || decl.getSourceFile().isInNodeModules()) continue
    const init = decl.getInitializer()
    if (init) out.push(...expand(init, depth + 1, seen))
  }
  return out
}

function propInit(obj: Node, name: string): Node | undefined {
  const node = skip(obj)
  if (!N.isObjectLiteralExpression(node)) return undefined
  const prop = node.getProperty(name)
  if (prop && N.isPropertyAssignment(prop)) return prop.getInitializer()
  if (prop && N.isShorthandPropertyAssignment(prop)) {
    const decl = prop.getValueSymbol()?.getDeclarations()[0]
    return decl && N.isVariableDeclaration(decl) ? (decl.getInitializer() ?? prop) : prop
  }
  return undefined
}

function functionAt(node: Node): Node | undefined {
  const inner = skip(node)
  if (N.isArrowFunction(inner) || N.isFunctionExpression(inner)) return inner
  if (N.isIdentifier(inner)) {
    const decl = unalias(inner.getSymbol() as never)?.getDeclarations()[0]
    if (decl && N.isFunctionDeclaration(decl)) return decl
    if (decl && N.isVariableDeclaration(decl)) return decl.getInitializer()
  }
  return undefined
}

// --- Helpers ---------------------------------------------------------------------------------

/** For an imported identifier (or `ns.name`), the module and the exported name. */
function importedName(expr: Node): { module: string; name: string } | undefined {
  const module = importModuleOf(expr)
  if (!module) return undefined
  if (N.isPropertyAccessExpression(expr)) return { module, name: expr.getName() }
  if (!N.isIdentifier(expr)) return undefined
  for (const decl of expr.getSymbol()?.getDeclarations() ?? []) {
    if (N.isImportSpecifier(decl)) return { module, name: decl.getName() }
    if (N.isImportClause(decl)) return { module, name: 'default' }
  }
  return undefined
}

/** Parentheses, `as`, `satisfies`, `!` and type assertions. */
function skip(node: Node): Node {
  let current = node
  for (let i = 0; i < 10; i++) {
    if (
      N.isParenthesizedExpression(current) ||
      N.isAsExpression(current) ||
      N.isSatisfiesExpression(current) ||
      N.isNonNullExpression(current) ||
      N.isTypeAssertion(current)
    ) {
      current = current.getExpression()
      continue
    }
    break
  }
  return current
}
