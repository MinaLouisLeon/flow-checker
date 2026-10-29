# flow-checker

Maps a Next.js App Router project: its pages, components, requests, types and user flows. It verifies that map against real traffic while you use the app, and exports it as documentation.

```bash
npm install -D @integr8-media/flow-checker
npx flow-checker init     # adds the capture hooks and a config file
npx flow-checker          # scans, opens the dashboard and starts your app with capture on
```

**User docs:** [package README](packages/flow-checker/README.md) (setup, commands, Next.js 13.4–15.2, redaction, limits) and [docs/config.md](docs/config.md) (every config option). The design and milestones are in [docs/PLAN.md](docs/PLAN.md), and releases in the [changelog](packages/flow-checker/CHANGELOG.md).

Published as [`@integr8-media/flow-checker`](https://www.npmjs.com/package/@integr8-media/flow-checker). The command is `flow-checker`.

## Repository layout

| Path                    | What it is                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `packages/flow-checker` | The published package: CLI plus public entry points. Bundles every internal package.       |
| `packages/shared`       | Data model, config types and shared utilities                                              |
| `packages/scanner`      | Static analysis of App Router projects (ts-morph)                                          |
| `packages/runtime`      | Dev-only capture runtime injected into the analyzed app                                    |
| `packages/server`       | Tool server: API, WebSocket, ingest, matcher, store                                        |
| `packages/dashboard`    | React + Vite dashboard UI                                                                  |
| `packages/exporter`     | Markdown and static HTML export                                                            |
| `fixtures/*`            | Small Next.js 16 apps used as test inputs, one per pattern ([details](fixtures/README.md)) |

Internal packages (`@flow-checker/*`) are private and source-only. Other packages import their TypeScript directly, and `tsup` bundles them into `@integr8-media/flow-checker` at build time.

## Development

Requires Node 22.12+ and pnpm 11.

```bash
pnpm install
pnpm check              # everything CI runs: lint, typecheck, test, build, fixture typecheck
pnpm test:watch         # vitest in watch mode
node packages/flow-checker/dist/cli.js dev --root fixtures/bff   # after pnpm build: dashboard on :4400, app on :3000
pnpm test:e2e           # after pnpm build: Playwright capture test (once: pnpm exec playwright install chromium)
node scripts/record-captures.mjs   # after pnpm build: re-record the fixture captures the matcher tests use
pnpm vitest run packages/exporter -u   # rewrite the export golden files (packages/exporter/test/golden) after a format change
pnpm --filter @flow-checker/dashboard dev   # dashboard with hot reload on :4401 (API proxied to :4400)
node scripts/next-matrix.mjs [13.4 14.2 15.2 15.5 16]   # after pnpm build: init/doctor/scan/capture on each Next.js version (needs network)
node scripts/perf/bench.mjs [features]   # after pnpm build: scan, re-scan and API times on a synthetic large app
```

## Releasing

1. Update the version in `packages/flow-checker/package.json` and the [changelog](packages/flow-checker/CHANGELOG.md), and merge to `main`.
2. Tag it: `git tag v0.1.0 && git push origin v0.1.0`.
3. The [Release workflow](.github/workflows/release.yml) runs every check, then publishes to npm with provenance. It needs the `NPM_TOKEN` secret (or npm trusted publishing) and an `npm` environment.

The repo tooling is pinned to TypeScript 6.x because TypeScript 7 (the native compiler) has no stable JavaScript API yet, and tsup's declaration build needs one. The scanner uses `ts-morph`, which ships its own compiler.
