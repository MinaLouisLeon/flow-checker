import { resolve } from 'node:path'
import {
  type AppModel,
  HTTP_METHODS,
  type HttpMethod,
  MODEL_VERSION,
  makeId,
  type Route,
} from '@flow-checker/shared'
import { type FileSystemHost, Project, type SourceFile } from 'ts-morph'
import { ComponentGraph } from './components'
import { discoverProject } from './discovery'
import { relativeTo, resolveFrom, toPosix } from './paths'
import { createProject } from './project'
import { RequestScanner } from './requests'
import { walkRoutes } from './routes'
import { TypeResolver } from './types'

export interface ScanOptions {
  /** Project root (the directory with package.json / next.config). */
  root: string
  /** Overrides app directory auto-detection (`src/app` or `app`). Relative to `root`. */
  appDir?: string
  /** Alternative file system, e.g. ts-morph's `InMemoryFileSystemHost` in tests. */
  fileSystem?: FileSystemHost
}

/** Scans a Next.js App Router project into the model written to `.flow-checker/model.json`. */
export function scanProject(options: ScanOptions): AppModel {
  // A custom file system uses its own (posix) paths; the real one is resolved against cwd.
  const root = options.fileSystem ? toPosix(options.root) : toPosix(resolve(options.root))
  const fs = options.fileSystem ?? new Project({ skipAddingFilesFromTsConfig: true }).getFileSystem()
  const discovery = discoverProject(fs, root, options.appDir)
  const project = createProject(discovery, fs)
  const { tree, routes: found } = walkRoutes(fs, root, discovery.appDir)

  const types = new TypeResolver(root)
  const graph = new ComponentGraph(root, types)
  const fileComponents = new Map<string, string | undefined>()
  const componentOf = (relFile: string) => {
    if (!fileComponents.has(relFile)) {
      const file = sourceFile(project, resolveFrom(root, relFile))
      fileComponents.set(relFile, file ? graph.addFileDefault(file) : undefined)
    }
    return fileComponents.get(relFile)
  }

  const routes: Route[] = found.map((r) => {
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
    return route
  })

  const roots = [...fileComponents.values()].filter((id): id is string => !!id)
  const components = graph.components(roots)

  // Requests come after components (client/server kinds decide what a server action call is)
  // and before types are collected (request body and response types join the type table).
  const requests = new RequestScanner(root, types)
  const bodies = graph.bodies()
  for (const component of components) {
    const body = bodies.get(component.id)
    if (body) requests.addComponent(component, body)
  }
  for (const route of routes) {
    if (route.kind !== 'route-handler') continue
    const file = sourceFile(project, resolveFrom(root, route.file))
    if (file) requests.addRouteHandler(route, file)
  }

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
    types: types.types(),
    requests: requests.sites(routes),
  }
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
