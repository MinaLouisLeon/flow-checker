import { cpSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsup'

// Internal @flow-checker/* packages are private and source-only. Their code and
// their types are bundled in here, so users install a single package.
const internal = [/^@flow-checker\//]

// Clean once up front: the two builds below run in parallel, so a per-build
// `clean` would delete the other build's output.
rmSync(new URL('./dist', import.meta.url), { recursive: true, force: true })

// The dashboard SPA is built by Vite in packages/dashboard (which builds first, as a
// dependency) and shipped as static files next to the CLI: dist/dashboard.
const dashboardBuild = fileURLToPath(new URL('../dashboard/dist', import.meta.url))
const dashboardOut = fileURLToPath(new URL('./dist/dashboard', import.meta.url))

function copyDashboard() {
  if (!existsSync(dashboardBuild)) {
    throw new Error(
      'packages/dashboard/dist is missing. Run "pnpm --filter @flow-checker/dashboard build" first.',
    )
  }
  cpSync(dashboardBuild, dashboardOut, { recursive: true })
}

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      config: 'src/config.ts',
      'runtime-client': 'src/runtime-client.ts',
      'runtime-server': 'src/runtime-server.ts',
    },
    format: 'esm',
    target: 'node22',
    noExternal: internal,
    dts: { resolve: internal },
  },
  // next.config files of older Next.js versions are often CommonJS (`require`), so this one
  // entry ships both formats. It has no dependencies.
  {
    entry: { next: 'src/next.ts' },
    format: ['esm', 'cjs'],
    target: 'node18',
    platform: 'node',
    noExternal: internal,
    dts: { resolve: internal },
  },
  {
    // The dev scan session runs in a worker thread: dist/scan-worker.js, next to the CLI.
    entry: { cli: 'src/cli.ts', 'scan-worker': 'src/cli/scan-worker.ts' },
    format: 'esm',
    target: 'node22',
    platform: 'node',
    banner: { js: '#!/usr/bin/env node' },
    noExternal: internal,
    onSuccess: async () => copyDashboard(),
  },
])
