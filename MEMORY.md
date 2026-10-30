# MEMORY.md

Project memory: decisions, gotchas and per-milestone learnings that are not obvious from the code. Newest last.
Full design notes per milestone live in `docs/PLAN.md` ("Built" paragraphs); this file keeps the short version.

## Finished milestones

| #   | Milestone             | Key facts to remember                                                                                                    |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| M0  | Setup                 | pnpm 11 catalog pins one version per dependency; TypeScript pinned to 6.x (tsup .d.ts needs the JS API).                 |
| M1  | Routes + components   | Only `app/` files are added to the ts-morph project up front; imports are pulled in on demand.                           |
| M2  | Request sites         | `requests.ts` walks from each component / route handler / server action through project functions (`#reachesNetwork`).   |
| M3  | Types                 | Named project types are stored once in `AppModel.types` and referenced with `{ kind: 'ref' }`.                           |
| M4  | Dashboard             | Read-only SPA served by the Hono server; same build is reused for the static HTML export.                                |
| M5  | Runtime capture       | Server `fetch` is wrapped through a property accessor because Next resets it on hot reload.                              |
| M6  | Matching              | Hard filters first, then points; threshold 40, margin 15. Recordings in `packages/server/test/recordings`.               |
| M7  | Flows                 | Navigation is found on the request walk, so it shares origin, trigger and URL resolution.                                |
| M8  | Type comparison       | `checkCapture()` in shared; masked values only need the right JSON type.                                                 |
| M9  | Watch + re-scan       | Warm ts-morph session instead of a dependency map; site `hash` ignores whitespace, comments and lines.                   |
| M10 | Export                | Markdown is a pure function of the snapshot, so fixtures have golden files.                                              |
| M11 | Public release v0.1.0 | Published as `@integr8-media/flow-checker`; `withFlowChecker()` for Next < 15.3; scan worker thread.                     |
| M12 | CLI progress          | `ScanOptions.onProgress`; progress goes to stderr; plain lines when not a TTY.                                           |
| M13 | React Query           | Model version 2. Runtime patches `Query`/`Mutation` prototypes rather than cache events (those fire too late).           |
| M14 | Middleware / proxy    | Model version 3. Matcher = path-to-regexp v6 port in `shared/src/middleware.ts`; edge hook `runtime/edge` for Next < 16. |

## Gotchas

- Slow CLI tests (`watch.test.ts`, `export.test.ts`, `config-options.test.ts` doctor case) and the bff HTML golden can
  time out when the whole suite runs in parallel; re-run them alone before assuming a regression.
- `next dev` writes `AGENTS.md` into each fixture; it is gitignored there (`fixtures/*/AGENTS.md`).
- Next middleware matchers use path-to-regexp v6 semantics (anchored both ends, optional trailing slash,
  case-insensitive, `:param*` modifiers). Next adds optional `_next/data` / `.rsc` forms
  (`next/dist/build/analysis/get-page-static-info.js`); `shared/test/middleware.test.ts` compares our compiler with
  Next's bundled `next/dist/compiled/path-to-regexp`.
- The server runtime registers only when `NEXT_RUNTIME === 'nodejs'`. Next 16 `proxy.ts` runs on Node.js (its fetches
  get the incoming request as `parent`); `middleware.ts` before 16 runs on the edge runtime unless its config says
  `runtime: 'nodejs'` (15.5+).
- Edge code only gets env variables Next sees written out (`process.env.FLOW_CHECKER_RUNTIME`, not
  `process.env[name]`), so the edge hook passes the variable explicitly.
- `scripts/next-matrix.mjs` packs the package at start; it needs network (npm) and takes ~1 min per version.
- Tooling on this Windows machine: Python writes CRLF unless files are opened with `newline=''`; bash heredocs that
  contain backticks or `\n` inside Python strings get mangled, so write patch scripts with the Write tool instead.
- Don't `git stash` while a background job (matrix, `pnpm pack`) may rewrite `pnpm-lock.yaml`: the pop can fail.
  pnpm writes the lockfile with single quotes; `pnpm biome format --write pnpm-lock.yaml` restores the repo's style.

## M14 — Middleware (done, branch `feat/middleware`)

- Model: `AppModel.middleware` (matchers, routes with `conditional`, rewrites, next-intl `i18n`), origin/trigger
  `middleware` for sites, navigation origin `middleware` with `condition`, `from` and `sourceRouteIds`, match signal
  `middleware`, id prefix `rw` for rewrites.
- Redirect conditions: pure path checks (`pathname === '/x'`, `startsWith`) are split out of the condition text into
  `from` / exclusions, which narrow `sourceRouteIds`; earlier `if (...) return` guards count as negated conditions.
- `servedPaths()` (shared) is the one place that maps a requested path to the paths that really answer it (rewrites,
  then next-intl default locale, then itself). Matcher route evidence, handler checks and flow recording use it.
- "From middleware" on the server = a source-mapped frame in the middleware file, or Next's `server/web/adapter` frame.
- The `middleware` fixture's proxy deletes the session cookie when the session is invalid; without that, the login
  redirect loops (a real bug the recording script caught).
- Verified on the Next matrix 13.4, 14.2, 15.2, 15.5 and 16 (scan + middleware fetch captured and matched).
