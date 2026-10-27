# flow-checker

Maps a Next.js App Router project: its pages, components, requests, types and user flows. It verifies that map against real traffic while you use the app, and exports it as documentation.

> Status: early development. The scan covers routes, components, request sites and types (M1–M3): `flow-checker scan` writes `.flow-checker/model.json` (add `--requests` to print the request sites), and `flow-checker dev` serves a read-only dashboard of it (M4). The plan is in [docs/PLAN.md](docs/PLAN.md).

Published as [`@integr8/flow-checker`](packages/flow-checker). The command is `flow-checker`.

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

Internal packages (`@flow-checker/*`) are private and source-only. Other packages import their TypeScript directly, and `tsup` bundles them into `@integr8/flow-checker` at build time.

## Development

Requires Node 22.12+ and pnpm 11.

```bash
pnpm install
pnpm check              # everything CI runs: lint, typecheck, fixture typecheck, test, build
pnpm test:watch         # vitest in watch mode
node packages/flow-checker/dist/cli.js dev --root fixtures/bff   # after pnpm build: dashboard on :4400
pnpm --filter @flow-checker/dashboard dev   # dashboard with hot reload on :4401 (API proxied to :4400)
```

The repo tooling is pinned to TypeScript 6.x because TypeScript 7 (the native compiler) has no stable JavaScript API yet, and tsup's declaration build needs one. The scanner uses `ts-morph`, which ships its own compiler.
