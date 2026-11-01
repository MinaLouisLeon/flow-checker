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
| M15 | Postman import        | Model version 4. `packages/postman`; applied after each scan in the CLI scan runner, never inside the scanner.           |
| M16 | tRPC                  | Model version 5. Batches split in the runtime before redaction (`runtime/src/trpc.ts`); router read by syntax.           |
| M17 | GraphQL               | Model version 6. graphql-js in the scanner only; runtime reads operations by regex; fragments are global by name.        |
| M18 | SSE                   | Model version 7. Streams sent on open, then only new messages (`stream.from`), merged by the verifier.                   |
| M19 | WebSockets            | Model version 8. Reuses the M18 stream recorder both ways; socket.io decoded from its WS frames, not patched.            |
| M20 | Release v0.2.0        | Matrix app has every v0.2.0 transport; it caught a React Query key race on Next 15. Publish = push the `v0.2.0` tag.     |
| M21 | Components/Requests   | List logic is pure in `dashboard/src/lists.ts`; `siteHref()` opens the request page, `ownerHref()` the component.        |
| M22 | Server hook placement | `cli/server-hook.ts` is shared by doctor, init and dev; the rule is shape-only (any wrapper around the blocks fails).    |
| M23 | Dashboard fixes       | Lists that grow with the app use `CappedList` / `useCapped` (5, then "+N more"); request bodies render once opened.      |
| M24 | React Query keys      | Model version 10. Unreadable key segments are `param` + `unknown`; shared queries are `matched` with `sharedWith`.       |
| M25 | Scanner fixes         | Model version 11. Handed-on functions are placed by `#valueTrigger`; `runtime-url` is an info flag (`isInfoFlag`).       |
| M26 | Release v0.2.2        | Real-app before/after = scan + `export --html` with each `cli.js`, then open every page view in Playwright.              |
| M27 | Early-return guards   | `SiteMeta.afterExit` beside `guarded`; side requests and twin choice use both, `isGuarded` itself is unchanged.          |
| M28 | `explore`             | `startDev({ explore })`; no setup = capture off + `model.json` in `<tmp>/flow-checker/<name>-<hash>` (`dataDir`).        |
| M29 | Endpoints             | Derived in `shared/src/endpoints.ts` (no model change); dashboard caches it per index in `endpointsOf()`.                |
| M30 | Areas                 | Derived in `shared/src/areas.ts`; only the `areas` config is stored (`AppModel.areas`, optional, no version bump).       |

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
- New code is dated from when its file changed (`WatchBatch.at` → `ScanUpdate.changedAt` → `CodeHistory.update`),
  not when the re-scan finishes: on slow CI (Windows) a re-scan can take >1 s, and captures sent meanwhile were
  wrongly marked stale (failed `e2e/watch.spec.ts` on PR #18).
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

## M15 — Postman collection import (done, branch `feat/postman-import`)

- The scanner stays Postman-free: `applyPostman(model, import)` runs in `createScanHandler` (CLI scan runner), so
  scan, dev, re-scans and export all get it. Tests that need it (server matching, exporter goldens) apply it
  themselves with `importLocalPostman` (sync, local files only).
- The cache `.flow-checker/postman/collection.json` is the normalized, redacted import, not the raw collection.
  Without `postman` in the config, scans still use it (after a manual `postman import --collection`).
- The scanner only leaves a URL `unknown` when the whole URL is a runtime value; `${fn()}/todos` is `pattern`
  with base `{param}` and matches by URL. The fixture's `listTodos` reads its URL from the page for that reason.
- Recordings for the `postman` fixture were made on app port 3077, so tests pass
  `appOrigins: ['http://localhost:3077']`.
- Postman flags are filed as generic `request` notes in `buildIndex`; the dashboard overview filters them into its
  Postman section, and the Markdown `issues.md` doesn't list them (they're in `postman.md`).

## M16 — tRPC (done, branch `feat/trpc`)

- Batches are split by `splitTrpcCapture()` in the runtime, before redaction, so inputs from `?input=` end up
  as JSON request bodies and get redacted. The tool server splits again on ingest (idempotent: captures with
  `procedure` are left alone), using the scanned endpoint.
- Split pieces get ids `<id>-<i>`; server hops still have the whole request's id as `parent.captureId`.
  `Matcher.matchWithParents()` picks the piece; `Verifier.children()` filters a piece's hops by its site's chain.
- tRPC v11 `httpBatchStreamLink` aborts the fetch once every result is read, which errors the runtime's cloned
  stream: `readStream()` keeps the bytes read before an interruption (marked truncated). Without this the
  bodies were lost (`binary`) and type checks skipped; only a live recording showed it.
- v11 `queryOptions()` must not be followed by `#evaluate` (the `*Options` helper rule would resolve it to its
  input): `procedureCall()` stops evaluation there.
- Proxies are recognized by following the root identifier to the factory (no type checker needed), so the
  in-memory test can stub `@trpc/*` as `any`.
- Shorthand object entries (`router({ items })`) need `ShorthandPropertyAssignment.getValueSymbol()`; the
  name's own symbol is the property.
- Recordings were made on app port 3077 (`node scripts/record-captures.mjs trpc-v10 trpc`).

## M17 — GraphQL (done, branch `feat/graphql`)

- graphql-js (16) is only in the scanner and the CLI. The runtime reads operation names with a light regex
  (`runtime/src/graphql.ts`), so nothing GraphQL-sized ends up in the user's bundle.
- Fragments are looked up globally by name, never by following a template's `${FRAGMENT}`; the catalog sweep
  (`GraphqlCatalog.addFile`) runs over loaded files before the walk, so a document in a file nothing imports is
  not found.
- urql's and Apollo's untyped `gql` return `TypedDocumentNode<any, AnyVariables>`: a typed document only counts
  when its data type is meaningful, or `AnyVariables` leaks in as the variables type.
- Codegen's client preset and Relay mask fragment data in their types; `graphql-types.ts` merges it back so type
  checks against wire data pass. Relay also adds `id` to selections and Apollo / urql add `__typename`: those
  are allowed as extra fields for GraphQL sites.
- Shorthand `{ link }` in `new ApolloClient({ link })` needs `getValueSymbol()` (same as M16's routers), and the
  expanded initializer is itself the `new BatchHttpLink()` node (`forEachDescendant` skips the node itself).
- Fixtures serve GraphQL from an in-app route handler (batching, GET, APQ, Relay doc ids); `useSuspenseQuery`
  and `useLazyLoadQuery` are wrapped in `ClientOnly` because the relative `/api/graphql` URL fails during SSR.
  Relay's compiler needs `--repersist` to keep `persisted_queries.json` complete and stages its output with
  `git add` on its own. Generated `src/gql`, `src/__generated__` and the manifest are excluded from biome.
- Recordings were made on app port 3077 (`node scripts/record-captures.mjs graphql-apollo graphql-apollo-v3
  graphql-urql graphql-relay`).

## M18 — SSE (done, merged to `dev`)

- Open streams are sent as one capture id many times: the first send is the whole capture, later ones only carry
  new messages with `stream.from`; `Verifier.mergeStream()` appends them. The store replaces by id, so each update
  is matched and type-checked again. The session gets one `capture` event (first send only).
- An EventSource only delivers named events to listeners for that name, so the runtime adds its own listener for
  each name the app listens to (`addEventListener` patched on the subclass prototype; the DOM overloads don't allow
  an `override`). `message` is always recorded.
- Route handler events are read by syntax: SSE text (`data:` lines) in the handler's file, and calls to functions
  that write it from their parameters. Fixed-text data (`data: {}`) has no type.
- Stream sites have no `responseType`; `checkCapture()` checks messages per event instead. A plain fetch of an SSE
  route handler is turned into a streamed fetch in `sites()` (`#linkStream`), after the walk.
- React strict mode closes the first page-load EventSource at once: the `sse` recording has an extra empty clock
  capture.
- Timing scans in a git worktree needs the fixtures' `node_modules` linked in: without them library types don't
  load and the scan looks ~3x faster (a false "regression" during M18). The trpc HTML export golden times out at 5 s
  when run alone (cold scan), on `dev` too.
- Bash heredocs with backticks fail here (`unexpected EOF`) but may still run part of the command: write patch
  scripts with the Write tool.
- Recordings were made on app port 3077 (`node scripts/record-captures.mjs sse`).

## M19 — WebSockets (done, branch `feat/websockets`)

- Captures reuse the M18 `stream` / `messages` fields and recorder (`message()` now takes a direction, parsed
  values and binary sizes). Sent messages are type-checked with paths under `sent[<name>]`, received ones under
  `messages[<name>]`, so the same name both ways doesn't collide.
- socket.io-client isn't patched: its URLs carry `EIO=`, and `runtime/src/socket.ts` decodes the engine.io /
  socket.io text frames (only events are kept). Its HTTP long-polling is a default ignore glob; messages sent
  before the upgrade are lost, so the fixture uses `transports: ['websocket']`.
- socket.io sites are written with an http URL but connect over ws: `matchRequestUrl()` compares origins with
  ws ↔ http. The site URL is `<origin>/socket.io/`; the written path is the namespace.
- Socket uses (`send`, `on`, `emit`) are found by the holder's text in the _outermost_ function around the
  socket (SSE used the innermost), so a ref set in an effect and used in an event handler is followed.
- Console Ninja (VS Code extension on this machine) injects code into Next's dev polyfill that opens its own
  WebSocket to `ws://127.0.0.1:<port>/`. The runtime skips sockets whose stack has a frame ending in
  `, <anonymous>:l:c)` (eval without a source URL) or a browser extension URL.
- React strict mode closes the first-mount socket before it opens: the runtime marks sockets the app `close()`d
  as `closed`, not `error`. The `websocket` recording has two such empty captures (ticker and chat).
- Next route handlers can't upgrade connections, so the fixture has its own `socket-server.mjs` (ws + socket.io,
  port 4011, `destroyUpgrade: false` so socket.io leaves `/live` and `/echo` alone). `record-captures.mjs`
  starts a fixture's `socket-server.mjs` when there is one.
- A `dev` worktree under the session temp folder doesn't work (paths too long: checkout fails without
  `core.longpaths`, then vite / vitest can't resolve their `#imports`). For an A/B timing, `git stash push -- <file>`
  one file instead: the scanner hooks cost ~3% on the fixture snapshot tests.
- Recordings were made on app port 3077 (`node scripts/record-captures.mjs websocket`).

## M20 — Release v0.2.0 (branch `feat/release-v0.2.0`, not yet published)

- Compare performance against a published version on the same machine, not against numbers in the docs:
  `FLOW_CHECKER_CLI=<install>/node_modules/@integr8-media/flow-checker/dist/cli.js node scripts/perf/bench.mjs`.
  On this machine 0.1.0 measured 10.3 s / 3.7 s (the docs say ~9–10 s / 3.4 s).
- To profile a scan: `node --cpu-prof --cpu-prof-dir=<dir> dist/cli.js scan --root <app>`; the scan runs in a worker,
  so the larger `.cpuprofile` is the one to read.
- ts-morph's `getImplementation()` on a bodiless function searches every statement of its file by name. On lib
  declarations (`fetch` in `lib.dom.d.ts`) that cost ~1 s per perf-app scan; `functionOf()` now skips `.d.ts` files.
- The browser runtime must not cache a failed QueryClient lookup across tasks: React can commit the provider right
  after it, and the queries' requests follow within ms. The race only showed on Next 15 (about 1 load in 3), and
  a single matrix run can pass by luck: reload the page ~10 times to check.
- The matrix's WebSocket echo server is a hand-written handshake + short text frames in `next-matrix.mjs` (no `ws`
  dependency in the script). React Query, tRPC, urql and zod are installed into each matrix app at the fixtures'
  versions.
- A test harness that hosts a fake upstream in the same process must not `spawnSync` the browser script: the
  blocked event loop stalls the page's server fetch.

## Scan accuracy on a real app (branch `feat/scan-accuracy-fixes`, after M20)

- Found by running 0.2.0 on jobseekk (54 pages, `request()` wrapper → `getProxyUrl()` → `secureApiFetch()` → `fetch`).
  Patterns are reproduced in `packages/scanner/test/wrappers.test.ts`; model version 9 (`prop` component refs).
- `#str` follows project calls through `#evaluate`; ternaries use `#truth` (array/string `includes`, `===`, `!`,
  `&&`/`||`), else `optionalQuery()` (same URL with/without a query). Placeholders are assumed not to hold `?`/`&`.
- Shorthand `{ method }` / `{ submit }`: the name node's symbol is the property. `declarationOf` uses
  `getValueSymbol()`, and mutation/trigger code compares symbols with `refersTo()`.
- Branch twins: one call into a wrapper reaching `fetch` on several `if` branches made 2 sites per call (doubling
  sites and warnings). `#mergeTwins()` (start of `sites()`) keeps the unguarded branch; a guarded branch with a
  default method (`?? 'POST'`, tracked as `Str.fallback`) gives way to a different method.
- `#followUses()` places triggers through local functions (`const go = useCallback(...)`), returned objects and
  wrappers (`guard(m.mutate)`), up the walk's frames. Dependency lists (`[mutate]`) are not calls.
- Matcher: stack-source points per frame depend on how many sites share the line (`locSites`): 25 / 15 / 5.
  Without it, an unknown-URL site won with the wrapper's frames alone (score 75).
- `isThirdParty()`: cross-origin, no source-mapped project frame, and a cross-origin script on the stack.
- To check the dashboard on a real app without touching its running instance: `flow-checker export --html <dir>`
  reads `.flow-checker/` but writes nothing there; serve the folder with any static server.

## M21 — Components and Requests screens (branch `feat/m21-components-requests-screens`)

- v0.2.2 rule: problems found on a real test app are fixed as general code patterns, each with its own test case
  written from scratch. Never match names, paths or helpers from that app.
- `lists.ts` holds the list logic (rows, filters, sorting, `requestWhen()`, `siteOwner()`, `groupSame()`), so it is
  tested in node without rendering. `RequestView` re-exports `siteOwner` for the older imports.
- Big lists render 200 rows at a time (`usePaged()` in `ui.tsx`); the selected row is always included. That kept
  search at ~20–40 ms per keystroke on the perf app without a windowing library.
- A CSS rule that comes after one with higher specificity on the same element trips biome's
  `noDescendingSpecificity`; `.row-group:not([open]) > summary::before` matches `.request[open] > summary::before`.
- Claude in Chrome can't open `file://` pages. To look at an exported site, serve the folder on 127.0.0.1
  and add `?v=N` to the URL after re-exporting: the browser otherwise reuses the cached `data.js`.

## M22 — Server hook placement (branch `feat/m22-server-hook-placement`)

- `server-hook.ts` parses with `ts` from ts-morph (`createSourceFile`, no project): `findRegister()` follows
  re-exports and tsconfig aliases; `editServerHook()` must use the lookup's own `SourceFile`, or nodes from two parses
  never compare equal.
- The dev safety net only waits on route handlers that have route-handler sites in the model: a handler that just
  answers sends no server request, so a working hook would look broken.
- Watch timers ignore captures timestamped before the watch started: a re-scan re-adds old captures to the store.
- Doctor tests now need real `register()` text (`NODE_BODY` / `EDGE_BODY` from `server-hook.ts`): a bare top-level
  `await import(...)` fails the placement check.
- Patch scripts with backticks or `\n` must not go through bash heredocs (they get mangled); use the Edit tool.

## M23 — Dashboard fixes (branch `feat/m23-dashboard-fixes`)

- A closed `<details>` still renders its children in React: request rows render their body only once opened
  (`LazyDetails` in `RequestView.tsx`). That, more than capping, keeps big pages small.
- Scroll memory keys positions by an id stored in `history.state`. `replaceScreen()` must pass the current
  `history.state` along, or the entry looks new and the screen jumps.
- `dashboard/test/synthetic.ts` builds a big model over a fixture snapshot with type-only imports, so both vitest and
  the Playwright spec (`e2e/dashboard-limits.spec.ts`, which rewrites an export's `data.js`) can use it.
- Playwright scrolls an element into view before clicking it; to test that a toggle keeps the scroll position, click
  it from script (`locator.evaluate((b) => b.click())`).

## M24 — React Query keys (branch `feat/m24-react-query-keys`)

- Enum members resolve in `#prop` (the member node), then `#keyPart` / `#str` read `EnumMember.getValue()`. `as const`
  objects already worked through `skipWrappers`.
- "Unknown" vs runtime key segments is decided by where the value's root is declared: inside a function = runtime
  (`:id`), outside (package import, module value, module-level call) = unknown (`?name`). A runtime param as a cache
  call's first segment also links nothing.
- Destructured parameters are bound (`bindParams` keeps patterns; `#resolve` follows a `BindingElement` through
  `#bindingValue`). Anything reading `env` by `ParameterDeclaration` still works: identifiers in a pattern resolve to
  their `BindingElement`, never to the parameter.
- A project call's arguments are walked in place after `#enter` (`#call` returns false): an inline `queryFn` passed to
  a project hook was walked twice. `Walk.hookFns` skips functions already walked as a query/mutation function.
- Use `matchedSiteIds(match)` (shared) wherever captures are counted or listed per site: a shared match verifies
  several sites. `sameQuery()` only covers `use*` hooks; imperative `queryClient` calls stay separate.
- Changing a fixture file can change a site `hash` (the formatter turned `<T,>` into `<T>` in a `.ts` file): update
  the model snapshot after `biome check --write`.

## M25 — Scanner fixes (branch `feat/m25-scanner-fixes`)

- A function that is passed rather than called (`handleSubmit(save)`, `{ onSelect: save }`, a provider `value`) is
  placed by `#valueTrigger()`: it climbs the value to a JSX prop, a variable (`#holderTrigger`) or a context
  (`#providedTrigger`). An `on*` name only counts in configs that aren't call options: `commit({ onCompleted })` in
  the graphql-relay fixture turned into `event onCompleted` until the call branch dropped it.
- The walk only entered functions that are _called_; references passed into library calls were never walked
  (`#passedFunctions` / `#configHandler`). Skip anything already in `Walk.hookFns` or the hook's site doubles.
- Context consumers come from ts-morph `findReferencesAsNodes()` (language service), cached per context. Only reached
  from provider values, so it costs nothing elsewhere.
- `#followUses` can return `'unused'`; callers that build a frame from it must skip the mutation, not emit
  `unknown`. When a hook returns another hook's result (`() => useX()`), the caller looks for the same members.
- Fixture output didn't change for any M25 pattern: the fixtures don't have them. Each is covered in-memory
  (`triggers`, `urls`, `component-choice`, `library-types`, `layout-flows` tests). The fixture twin check
  (`has no duplicate sites`) guards the walked-twice bug.
- A/B against `dev` without a worktree: `pnpm build`, copy `packages/flow-checker/dist` to a sibling folder (so
  `node_modules` still resolves), `git stash`, build, copy, `git stash pop`, build; then scan one generated perf
  app with both `cli.js` files.

## M26 — Release v0.2.2 (branch `feat/m26-release-v0.2.2`)

- Real-app smoke check without touching the apps: back up `.flow-checker/model.json` (scan overwrites it), run
  `scan` then `export --html <dir>` with each build's `cli.js` (export writes nothing into `.flow-checker/`), restore.
  The export's `data.js` holds the model and captures, so site diffs and the dashboard numbers come from it.
- An app's own `node_modules/@integr8-media/flow-checker/dist/cli.js` is a ready "before" build for bench A/B too.
- Run the Next matrix and the real-app scans before the perf bench, not alongside it: scan times taken
  while the matrix runs are not comparable.
- A site count that goes up on a real app isn't a regression by itself: check repeated keys' call paths for twins.

## M27 — Early-return guards (branch `feat/m27-early-return-guards`)

- Don't fold "after an early exit" into `isGuarded()`: a wrapper's main `fetch` after `if (multipart) return ...`
  would then count as guarded, and `#mergeTwins` / `#markSideRequests` lose the request they keep as the main one.
  It is a separate `afterExit` list, and twins prefer the call before the exit only when the `if` guarding ties.
- Quick A/B for a scanner change: make the new function return early, `pnpm --filter ./packages/flow-checker build`,
  bench, restore, build, bench. Compare runs from the same session only; absolute bench times drift between days.

## M28 — `flow-checker explore` (branch `feat/m28-explore`)

- Explore is `startDev()` with `explore: true`, not a separate server path, so watch, re-scan and export stay shared
  with `dev`. Anything new that `dev` writes into the project must be skipped when `explore` has no setup
  (`dataDir` set): `explore.test.ts` hashes every file of each fixture copy and fails on any write.
- Tests that copy a fixture link its `node_modules` with a `junction` symlink (no admin rights needed on Windows)
  instead of copying it. Remove the copy only after the CLI process has exited: on Windows its working directory or
  open handles make `rmSync` fail with `EBUSY`, so spawn with `--root` rather than `cwd`.

## M29 — Endpoints (branch `feat/m29-endpoints`)

- Never name a `Screen` field `key`: `App.tsx` spreads the screen into the screen component's props
  (`<X {...screen} />`), and React keeps `key` for itself, so the component never gets it. The endpoints screen
  uses `endpointId`. Only the e2e test caught it; the router round-trip unit test passed.
- Endpoint keys normalize param names (`/users/:id` = `/users/:userId`) and drop the query string; the
  fixture test recomputes the "distinct (base, method, URL pattern)" count on its own, so a change to the key
  rules has to change both on purpose.
- Uncalled route handler methods are listed under this app, except on tRPC, GraphQL and catch-all handlers,
  whose callers send whatever path or method they like.
- The perf app's 1,000 sites give 1,000 endpoints (each generated URL is distinct), so it is the worst case for
  the list size, not a folding test; the react-query fixture is the one where sites fold (13 → 7).

## M30 — Areas (branch `feat/m30-areas`)

- The `areas` config reaches every view through the model: the scanner copies it to `AppModel.areas` (like
  `apiClients` reaches the scan), so the dashboard, the static export and the Markdown never need the config file.
  An optional field doesn't need a `MODEL_VERSION` bump (older files load, older readers drop it).
- No fixture has feature folders or a single URL area with folders, so the folder fallback is only covered by
  hand-written models in `shared/test/areas.test.ts` (three base folder names, `.tsx` / `.jsx`). Components most pages
  use (a `Button`) are left out when picking a page's folder, or a shared `src/components` would win.
- Area frames on the Map are extra React Flow nodes behind the pages (`zIndex: -1`); the page nodes cover the middle of
  a frame, so tests click its name label.
- Nested `doc()` sections in the Markdown exporter end with a newline; `.trimEnd()` them (like `endpointSection`) or
  the file gets double blank lines.
