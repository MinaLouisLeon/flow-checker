# CLAUDE.md

@AGENTS.md

## Notes for Claude

- Read `docs/PLAN.md` (design + milestone notes) and `MEMORY.md` (decisions and gotchas from past milestones)
  before starting a milestone.
- The fixtures run Next.js 16, which differs from older training data. Check
  `fixtures/<app>/node_modules/next/dist/docs/` before writing Next-specific code.
- Never commit, push or open PRs unless the user says so in the current session; leave changes in the working tree.
- Before reporting a milestone (or any change) as finished, run the full `pnpm check` (repo-wide `biome check .`,
  which also formats Markdown, every package's typecheck, tests, build, fixture typechecks, package and config checks).
  Linting or typechecking only the touched folders is not enough.
- When a milestone is finished, update the milestone tables in this file's import (`AGENTS.md`), the list below and
  `MEMORY.md`.

## Finished milestones

M0 setup · M1 routes + components · M2 request sites · M3 types · M4 dashboard · M5 runtime capture ·
M6 matching + verification · M7 flows · M8 type comparison · M9 watch + incremental re-scan · M10 export ·
M11 public release v0.1.0 · M12 CLI progress output · M13 React Query keys and cache links ·
M14 middleware / proxy · M15 Postman collection import · M16 tRPC · M17 GraphQL · M18 SSE ·
M19 WebSockets · M20 release v0.2.0 (published; 0.2.1 followed with scan-accuracy fixes) ·
M21 Components and Requests screens · M22 server hook placement check · M23 dashboard fixes ·
M24 React Query keys · M25 scanner fixes · M26 release v0.2.2 (branch `feat/m26-release-v0.2.2`; publish = push the
`v0.2.2` tag after merging to `main`) · M27 early-return guards (v0.3.0, branch `feat/m27-early-return-guards`) ·
M28 `flow-checker explore` (branch `feat/m28-explore`) · M29 Endpoints (branch `feat/m29-endpoints`) ·
M30 Areas (branch `feat/m30-areas`) · M31 Guarded pages (branch `feat/m31-guarded-pages`) · M32 Start here (branch `feat/m32-start-here`) ·
M33 Global search (branch `feat/m33-global-search`) · M34 Plain wording (branch `feat/m34-plain-wording`) · M35 Guided walk-through (branch `feat/m35-guided-walk-through`) ·
M36 Impact check (branch `feat/m36-impact-check`) · M37 Release v0.3.0 (branch `feat/m37-release-v0.3.0`; publish = push the
`v0.3.0` tag after merging to `main`) · M38 Render mode per page (v0.4.0, branch `feat/m38-render-mode`) · M39 Server cache map (branch
`feat/server-cache-map-m39`) · M40 Cache check at runtime (branch `feat/cache-check-at-runtime-m40`) ·
M41 Special files and boundaries (branch `feat/special-files-and-boundaries-m41`) ·
M42 Release v0.4.0 (branch `feat/release-040`; publish = push the `v0.4.0` tag after merging to `main`) ·
M43 Client boundaries (v0.5.0, branch `feat/client-boundries-m43`) · M44 Server/client leaks (branch `feat/server-client-leaks-m44`) · M45 Environment variables (branch `feat/env-var-m45`) ·
M46 Server action safety (branch `feat/server-action-safety-m46`).

Next: v0.5.0 (boundaries, safety and performance, M47–M48 left), then v0.6.0 (M49–M54) and
v1.0.0 (`export --llm` + MCP server covering every feature, M55–M57); see `docs/PLAN.md`.
Fixes must target code patterns, not the app they were found on.
