import { posix } from 'node:path'
import { type FileSystemHost, Project, ts } from 'ts-morph'
import type { Discovery } from './discovery'

const SOURCE_GLOB = '**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'

/**
 * Creates the ts-morph project. Only `app/` files are added up front; everything they
 * import is pulled in by the compiler on demand, which keeps large repos fast.
 */
export function createProject(
  discovery: Discovery,
  fileSystem?: FileSystemHost,
  scanned: (file: string) => boolean = () => true,
): Project {
  const project = discovery.tsconfig
    ? new Project({
        tsConfigFilePath: discovery.tsconfig,
        skipAddingFilesFromTsConfig: true,
        fileSystem,
        compilerOptions: { noEmit: true },
      })
    : new Project({
        fileSystem,
        compilerOptions: {
          allowJs: true,
          jsx: ts.JsxEmit.Preserve,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          target: ts.ScriptTarget.ESNext,
          noEmit: true,
        },
      })

  project.addSourceFilesAtPaths([
    posix.join(discovery.appDir, SOURCE_GLOB),
    `!${posix.join(discovery.appDir, '**/node_modules/**')}`,
  ])
  if (discovery.middleware) project.addSourceFileAtPathIfExists(discovery.middleware)
  // Excluded app files (tests, stories...) are not scanned. Their imports may still pull them in.
  for (const file of project.getSourceFiles()) {
    if (!scanned(file.getFilePath())) project.removeSourceFile(file)
  }
  project.resolveSourceFileDependencies()
  return project
}
