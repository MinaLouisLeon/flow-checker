# CLAUDE.md

@AGENTS.md

## Notes for Claude

- Read `docs/PLAN.md` (design + milestone notes) and `MEMORY.md` (decisions and gotchas from past milestones)
  before starting a milestone.
- The fixtures run Next.js 16, which differs from older training data. Check
  `fixtures/<app>/node_modules/next/dist/docs/` before writing Next-specific code.
- Never commit, push or open PRs unless the user says so in the current session; leave changes in the working tree.
- When a milestone is finished, update the milestone tables in this file's import (`AGENTS.md`), the list below and
  `MEMORY.md`.

## Finished milestones

M0 setup · M1 routes + components · M2 request sites · M3 types · M4 dashboard · M5 runtime capture ·
M6 matching + verification · M7 flows · M8 type comparison · M9 watch + incremental re-scan · M10 export ·
M11 public release v0.1.0 · M12 CLI progress output · M13 React Query keys and cache links ·
M14 middleware / proxy · M15 Postman collection import · M16 tRPC (branch `feat/trpc`).

Next: **M17 GraphQL**.
