import { resolve } from 'node:path'
import {
  type ApiClientConfig,
  type AppModel,
  createPathFilter,
  DEFAULT_EXCLUDE,
  DEFAULT_INCLUDE,
  HTTP_METHODS,
  type HttpMethod,
  MODEL_VERSION,
  makeId,
  type Route,
} from '@flow-checker/shared'
import { type FileSystemHost, Project, type SourceFile, ts } from 'ts-morph'
import { ComponentGraph } from './components'
import { type Discovery, discoverProject } from './discovery'
import { inferFlows } from './flows'
import { relativeTo, resolveFrom, toPosix } from './paths'
import { createProject } from './project'
import { RequestScanner } from './requests'
import { walkRoutes } from './routes'
import { TypeResolver, type TypeResolverOptions } from './types'

export interface ScanOptions {
  /** Project root (the directory with package.json / next.config). */
  root: string
  /** Overrides app directory auto-detection (`src/app` or `app`). Relative to `root`. */
  appDir?: string
  /** Alternative file system, e.g. ts-morph's `InMemoryFileSystemHost` in tests. */
  fileSystem?: FileSystemHost
  /** Limits for type resolution (config `types`). */
  types?: TypeResolverOptions
  /** Globs of files to scan, relative to the root (config `include`). Default: everything. */
  include?: readonly string[]
  /** Globs of files to skip (config `exclude`). Default: tests, stories and mocks. */
  exclude?: readonly string[]
  /** Modules whose calls are requests (config `apiClients`). */
  apiClients?: readonly ApiClientConfig[]
  /** Called as the scan moves through its phases (CLI progress output). Must not throw. */
  onProgress?: (event: ScanProgress) => void
}

/** Scan phases, in the order they run. */
export const SCAN_PHASES = ['discover', 'load', 'routes', 'components', 'requests', 'flows'] as const

export type ScanPhase = (typeof SCAN_PHASES)[number]

/**
 * Progress of one phase. Each phase sends one event with `done: 0` when it starts, may send
 * more as items finish, and ends with `finished: true`.
 */
export interface ScanProgress {
  phase: ScanPhase
  /** Items finished so far in this phase. */
  done: number
  /** Items in this phase, when known up front. */
  total?: number
  /** Set on the last event of the phase. */
  finished?: boolean
  /** What the phase found, on the last event (e.g. `Next 16.0.1, src/app`). */
  detail?: string
}

type Report = (event: ScanProgress) => void

/** Settings every stage gets. */
export interface ScanSettings {
  types?: TypeResolverOptions
  /** Whether a file (absolute, forward slashes) is scanned. */
  scanned: (file: string) => boolean
  apiClients: readonly ApiClientConfig[]
}

/** Scans a Next.js App Router project into the model written to `.flow-checker/model.json`. */
export function scanProject(options: ScanOptions): AppModel {
  return createScanSession(options).model
}

/** What changed on disk since the last scan. Paths are absolute or relative to the root. */
export interface FileChanges {
  changed?: readonly string[]
  added?: readonly string[]
  removed?: readonly string[]
}

/**
 * A scan that stays warm for re-scans (docs/PLAN.md 6.7). The ts-morph project is kept, so a
 * re-scan only re-reads the files that changed and the compiler reuses everything else.
 */
export interface ScanSession {
  /** The latest scan result. */
  readonly model: AppModel
  /**
   * Re-reads the given files and scans again. Changes to tsconfig, package.json or
   * next.config, or to the app directory itself, start over with a fresh project.
   */
  update(changes: FileChanges): AppModel
  /**
   * Prepares the compiler for the first re-scan. The first rebuild after any change costs about
   * a second, later ones a fraction of that. Run it while nothing is waiting, e.g. right after
   * start, so the first edit shows up quickly. It does not change the model.
   */
  warm(): void
}

/** Files whose change can affect discovery or compiler options: they restart the session. */
const PROJECT_FILES = /(^|\/)(tsconfig\.json|jsconfig\.json|package\.json|next\.config\.[cm]?[jt]s)$/

export function createScanSession(options: ScanOptions): ScanSession {
  // A custom file system uses its own (posix) paths; the real one is resolved against cwd.
  const root = options.fileSystem ? toPosix(options.root) : toPosix(resolve(options.root))
  const fs = options.fileSystem ?? new Project({ skipAddingFilesFromTsConfig: true }).getFileSystem()

  const pathFilter = createPathFilter(options.include ?? DEFAULT_INCLUDE, options.exclude ?? DEFAULT_EXCLUDE)
  const settings: ScanSettings = {
    types: options.types,
    scanned: (file) => pathFilter(relativeTo(root, file)),
    apiClients: options.apiClients ?? [],
  }

  const report: Report = (event) => {
    try {
      options.onProgress?.(event)
    } catch {
      // Progress output must never break a scan.
    }
  }

  let discovery = discover(fs, root, options.appDir, report)
  let project = load(discovery, fs, settings, report)
  let model = analyze(root, fs, discovery, project, settings, report)

  return {
    get model() {
      return model
    },
    warm() {
      // Same text, so the scan doesn't change, but the compiler builds a new program once.
      const file = project.getSourceFiles().find((f) => f.getFilePath().startsWith(`${discovery.appDir}/`))
      if (!file) return
      file.replaceWithText(file.getFullText())
      // Both are built lazily, when their compiler object is first read.
      void project.getProgram().compilerObject
      void project.getTypeChecker().compilerObject
    },
    update(changes) {
      const abs = (file: string) => resolveFrom(root, file)
      const changed = (changes.changed ?? []).map(abs)
      const added = (changes.added ?? []).map(abs)
      const removed = (changes.removed ?? []).map(abs)
      const all = [...changed, ...added, ...removed]

      const restart =
        all.some((f) => PROJECT_FILES.test(f)) ||
        // The app directory appeared or went away (e.g. `src/app` created next to `app`).
        removed.some((f) => f === discovery.appDir || discovery.appDir.startsWith(`${f}/`))
      if (restart) {
        discovery = discover(fs, root, options.appDir, report)
        project = load(discovery, fs, settings, report)
      } else {
        report({ phase: 'load', done: 0, total: all.length })
        for (const file of removed) {
          // A removed directory removes every file below it.
          for (const sf of project.getSourceFiles()) {
            const path = sf.getFilePath()
            if (path === file || path.startsWith(`${file}/`)) project.removeSourceFile(sf)
          }
        }
        // Resolving imports again is the slowest step of a re-scan, so it only runs when a new
        // file may be imported now: a file was added, or a changed file imports something else.
        let resolveImports = added.length > 0
        for (const file of changed) {
          const sf = project.getSourceFile(file)
          if (!sf) continue
          if (!fs.fileExistsSync(file)) {
            project.removeSourceFile(sf)
            continue
          }
          const before = importsOf(sf)
          sf.refreshFromFileSystemSync()
          if (importsOf(sf) !== before) resolveImports = true
        }
        for (const file of added) {
          const existing = project.getSourceFile(file)
          if (existing) existing.refreshFromFileSystemSync()
          // New files in the app directory are scanned. Elsewhere they are only pulled in once
          // something imports them, which re-resolving imports below takes care of.
          else if (file.startsWith(`${discovery.appDir}/`) && isSource(file) && settings.scanned(file))
            project.addSourceFileAtPathIfExists(file)
        }
        if (resolveImports) project.resolveSourceFileDependencies()
        report({
          phase: 'load',
          done: all.length,
          total: all.length,
          finished: true,
          detail: plural(all.length, 'changed file'),
        })
      }
      model = analyze(root, fs, discovery, project, settings, report)
      return model
    },
  }
}

const SOURCE_FILE = /\.(tsx?|jsx?|mts|cts|mjs|cjs)$/

function isSource(file: string): boolean {
  return SOURCE_FILE.test(file) && !file.includes('/node_modules/')
}

/** Every module a file imports or re-exports, including `import()` and `require()`. */
function importsOf(file: SourceFile): string {
  return file
    .getImportStringLiterals()
    .map((literal) => literal.getLiteralValue())
    .join('\n')
}

/** Runs every stage on the project as it is now. */
function discover(fs: FileSystemHost, root: string, appDir: string | undefined, report: Report): Discovery {
  report({ phase: 'discover', done: 0 })
  const discovery = discoverProject(fs, root, appDir)
  const next = discovery.nextVersion ? `Next ${discovery.nextVersion}, ` : ''
  report({
    phase: 'discover',
    done: 1,
    total: 1,
    finished: true,
    detail: `${next}${relativeTo(root, discovery.appDir)}`,
  })
  return discovery
}

function load(discovery: Discovery, fs: FileSystemHost, settings: ScanSettings, report: Report): Project {
  report({ phase: 'load', done: 0 })
  const project = createProject(discovery, fs, settings.scanned)
  const files = project.getSourceFiles().filter((f) => !f.isInNodeModules()).length
  report({ phase: 'load', done: files, total: files, finished: true, detail: plural(files, 'file') })
  return project
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`
}

/** Starts a counted phase. The returned function reports progress about 100 times at most. */
function counter(report: Report, phase: ScanPhase, total: number) {
  const step = Math.max(1, Math.floor(total / 100))
  report({ phase, done: 0, total })
  return (done: number) => {
    if (done === total || done % step === 0) report({ phase, done, total })
  }
}

function analyze(
  root: string,
  fs: FileSystemHost,
  discovery: Discovery,
  project: Project,
  settings: ScanSettings,
  report: Report,
): AppModel {
  report({ phase: 'routes', done: 0 })
  const walked = walkRoutes(fs, root, discovery.appDir)
  const tree = walked.tree
  // Excluded pages and route handlers are left out (their folders stay in the route tree).
  const found = walked.routes.filter((r) => settings.scanned(resolveFrom(root, r.file)))
  const pageCount = found.filter((r) => r.kind === 'page').length
  report({
    phase: 'routes',
    done: found.length,
    total: found.length,
    finished: true,
    detail: `${plural(pageCount, 'page')}, ${plural(found.length - pageCount, 'route handler')}`,
  })

  const types = new TypeResolver(root, settings.types)
  const graph = new ComponentGraph(root, types, settings.scanned)
  const fileComponents = new Map<string, string | undefined>()
  const componentOf = (relFile: string) => {
    if (!settings.scanned(resolveFrom(root, relFile))) return undefined
    if (!fileComponents.has(relFile)) {
      const file = sourceFile(project, resolveFrom(root, relFile))
      fileComponents.set(relFile, file ? graph.addFileDefault(file) : undefined)
    }
    return fileComponents.get(relFile)
  }

  // Walking each page and layout finds the components below it.
  const routeDone = counter(report, 'components', found.length)
  const routes: Route[] = found.map((r, index) => {
    const route: Route = {
      id: makeId('rt', r.file),
      path: r.path,
      kind: r.kind,
      file: r.file,
      segments: r.segments,
      layoutChain: r.layoutChain.map((l) => withId(l, componentOf(l.file))),
      ...(r.slot ? { slot: r.slot } : {}),
      ...(r.intercepting ? { intercepting: r.intercepting } : {}),
    }
    if (r.kind === 'page') {
      const id = componentOf(r.file)
      if (id) route.componentId = id
    } else {
      const file = sourceFile(project, resolveFrom(root, r.file))
      route.methods = file ? exportedMethods(file) : []
    }
    routeDone(index + 1)
    return route
  })

  const roots = [...fileComponents.values()].filter((id): id is string => !!id)
  const components = graph.components(roots)
  report({
    phase: 'components',
    done: found.length,
    total: found.length,
    finished: true,
    detail: plural(components.length, 'component'),
  })

  // Requests come after components (client/server kinds decide what a server action call is)
  // and before types are collected (request body and response types join the type table).
  const requests = new RequestScanner(root, types, {
    scanned: settings.scanned,
    apiClients: settings.apiClients,
    resolveModule: (specifier) => resolveModule(project, root, specifier),
  })
  const bodies = graph.bodies()
  const handlers = routes.filter((r) => r.kind === 'route-handler')
  const requestTotal = components.length + handlers.length
  const requestDone = counter(report, 'requests', requestTotal)
  let done = 0
  for (const component of components) {
    const body = bodies.get(component.id)
    if (body) requests.addComponent(component, body)
    requestDone(++done)
  }
  for (const route of handlers) {
    const file = sourceFile(project, resolveFrom(root, route.file))
    if (file) requests.addRouteHandler(route, file)
    requestDone(++done)
  }

  const sites = requests.sites(routes)
  const queryLinks = requests.queryLinks(sites, components)
  report({
    phase: 'requests',
    done: requestTotal,
    total: requestTotal,
    finished: true,
    detail: plural(sites.length, 'request'),
  })

  report({ phase: 'flows', done: 0 })
  const navigations = requests.navigations(routes)
  const flows = inferFlows({ routes, components, requests: sites, navigations, queryLinks })
  const modelTypes = types.types()
  report({
    phase: 'flows',
    done: 1,
    total: 1,
    finished: true,
    detail: `${plural(flows.length, 'flow')}, ${plural(modelTypes.length, 'type')}`,
  })

  return {
    version: MODEL_VERSION,
    project: {
      appDir: relativeTo(root, discovery.appDir),
      ...(discovery.tsconfig ? { tsconfig: relativeTo(root, discovery.tsconfig) } : {}),
      ...(discovery.nextConfig ? { nextConfig: relativeTo(root, discovery.nextConfig) } : {}),
      ...(discovery.nextVersion ? { nextVersion: discovery.nextVersion } : {}),
    },
    routeTree: tree,
    routes,
    components,
    types: modelTypes,
    requests: sites,
    navigations,
    flows,
    queryLinks,
  }
}

/** The project file a module specifier (e.g. `@/lib/api`) points to, as seen from the root. */
function resolveModule(project: Project, root: string, specifier: string): string | undefined {
  const resolved = ts.resolveModuleName(
    specifier,
    `${root}/index.ts`,
    project.getCompilerOptions(),
    project.getModuleResolutionHost(),
  ).resolvedModule
  return resolved && !resolved.isExternalLibraryImport ? toPosix(resolved.resolvedFileName) : undefined
}

function withId<T extends object>(value: T, componentId: string | undefined): T & { componentId?: string } {
  return componentId ? { ...value, componentId } : value
}

function sourceFile(project: Project, path: string): SourceFile | undefined {
  return project.getSourceFile(path) ?? project.addSourceFileAtPathIfExists(path)
}

/** `export function GET`, `export const POST = ...` and `export { handler as PUT }`. */
function exportedMethods(file: SourceFile): HttpMethod[] {
  const exported = new Set(file.getExportedDeclarations().keys())
  return HTTP_METHODS.filter((m) => exported.has(m))
}
