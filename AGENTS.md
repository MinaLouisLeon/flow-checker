# AGENTS.md

Guide for coding agents working in this repo. Humans: see `README.md` and `docs/PLAN.md`.

## What this is

`flow-checker` (npm: `@integr8-media/flow-checker`) maps a Next.js **App Router** project — pages, components,
requests, types and user flows — from a static scan, checks the map against real traffic captured while you use
the app, and exports it as docs. `docs/PLAN.md` is the source of truth for design and milestones; each milestone
has a "Built" note there describing what was actually built.

## Layout

pnpm monorepo, published as one package (`packages/flow-checker`, bundled with tsup).

| Package                 | Role                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/shared`       | Data model + zod schemas (`model.ts`, `capture.ts`), URL/key helpers, text formatters            |
| `packages/scanner`      | ts-morph static analysis: routes, components, requests, types, navigation, flows                 |
| `packages/runtime`      | Injected dev-only capture code (browser `client.ts`, Node `server.ts`), redaction                |
| `packages/server`       | Hono tool server: ingest, store, matcher, verifier, flows, watcher, export snapshot              |
| `packages/dashboard`    | React + Vite SPA                                                                                 |
| `packages/exporter`     | Markdown + static HTML export                                                                    |
| `packages/postman`      | Postman collection import (v2.1 JSON, v3 YAML, cloud) and the contract check (M15)               |
| `packages/flow-checker` | CLI (`dev`, `explore`, `scan`, `impact`, `init`, `export`, `doctor`, `postman`) and entry points |
| `fixtures/*`            | Small Next.js 16 apps, one per pattern group, used by snapshot, matching and e2e tests           |
| `scripts/`              | `record-captures.mjs`, `next-matrix.mjs`, `perf/`, package/config verification                   |

## Commands

```bash
pnpm install
pnpm build                 # all packages (needed before e2e, record-captures, next-matrix)
pnpm test                  # vitest, all packages
pnpm vitest run packages/scanner            # one package
pnpm vitest run packages/scanner -u         # update file snapshots / golden files
pnpm typecheck
pnpm lint                  # biome; pnpm lint:fix to format
pnpm test:e2e              # playwright (after pnpm build)
pnpm check                 # everything CI runs
node scripts/record-captures.mjs <fixture>  # re-record real captures (after pnpm build)
node scripts/next-matrix.mjs 15.5 16        # Next version matrix (network)
```

Under full parallel load a couple of slow tests (`flow-checker/test/watch.test.ts`, `export.test.ts`) can time out;
re-run them on their own before assuming a regression.

## Conventions

- TypeScript, ESM, biome formatting (2 spaces, single quotes, no semicolons, 110 columns).
- All paths in the model are project-relative with forward slashes. Ids come from `makeId()` (stable hashes).
- Model changes go in `packages/shared/src/model.ts`; bump `MODEL_VERSION` in `constants.ts` for format changes and
  keep older versions loadable (see `AppModelSchema.version`).
- Scanner output is snapshot-tested per fixture (`packages/scanner/test/__snapshots__/<fixture>.*`). When adding a
  fixture, add it to `FIXTURES` in `packages/scanner/test/fixtures.test.ts` and document it in `fixtures/README.md`.
- Exporter output is golden-tested (`packages/exporter/test/golden/<fixture>`), using recordings from
  `packages/server/test/recordings/<fixture>.json`.
- Runtime code must never throw into the user's app and is a no-op unless `FLOW_CHECKER=1`.
- Redaction is on by default; never write raw secrets to disk.
- Comments: short and plain, explaining why.
- After finishing a milestone: update its "Built" note in `docs/PLAN.md`, the milestone table, `CHANGELOG.md`
  (`packages/flow-checker/CHANGELOG.md`), and the milestone lists in `AGENTS.md`, `CLAUDE.md` and `MEMORY.md`.

## Git

- Branch from `dev` (`feat/<name>`); PRs target `dev`.
- Never commit, push or open PRs unless the user explicitly asks in that session.

## Milestones

| #   | Milestone                                         | Status |
| --- | ------------------------------------------------- | ------ |
| M0  | Setup: monorepo, builds, Vitest, fixtures         | Done   |
| M1  | Routes + components scan                          | Done   |
| M2  | Request sites                                     | Done   |
| M3  | Types (TypeShape IR, zod `z.infer`)               | Done   |
| M4  | Dashboard (read-only)                             | Done   |
| M5  | Runtime capture, `init`, ingest, redaction        | Done   |
| M6  | Matching + verification                           | Done   |
| M7  | Flows: navigation, inferred flows, recording      | Done   |
| M8  | Type comparison of captures vs. types             | Done   |
| M9  | Watch + incremental re-scan                       | Done   |
| M10 | Export: Markdown + static HTML                    | Done   |
| M11 | Public release v0.1.0 (docs, doctor, Next matrix) | Done   |
| M12 | CLI progress output                               | Done   |
| M13 | React Query APIs, keys and cache links            | Done   |
| M14 | Middleware / proxy                                | Done   |
| M15 | Postman collection import                         | Done   |
| M16 | tRPC                                              | Done   |
| M17 | GraphQL                                           | Done   |
| M18 | SSE                                               | Done   |
| M19 | WebSockets                                        | Done   |
| M20 | Release v0.2.0                                    | Done   |
| M21 | Components and Requests screens                   | Done   |
| M22 | Server hook placement check                       | Done   |
| M23 | Dashboard fixes (bounded lists, scroll, handlers) | Done   |
| M24 | React Query keys                                  | Done   |
| M25 | Scanner fixes (triggers, URLs, components, types) | Done   |
| M26 | Release v0.2.2                                    | Done   |
| M27 | Early-return guards (v0.3.0)                      | Done   |
| M28 | `flow-checker explore`                            | Done   |
| M29 | Endpoints                                         | Done   |
| M30 | Areas                                             | Done   |
| M31 | Guarded pages                                     | Done   |
| M32 | Start here                                        | Done   |
| M33 | Global search                                     | Done   |
| M34 | Plain wording                                     | Done   |
| M35 | Guided walk-through                               | Done   |
| M36 | Impact check                                      | Done   |
