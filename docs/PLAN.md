# flow-checker — Implementation Plan

> Status: M0–M17 done. **v0.1.0 is published on npm** (scanner, types, dashboard, runtime capture, matching + verification, flows, type comparison, watch + incremental re-scan, export, public release). M12 (CLI progress output) and M13 (React Query APIs, keys and cache links) are on `dev` for v0.2.0; M14 (middleware / proxy) is on `dev`; M15 (Postman collection import) is on `dev`; M16 (tRPC) is on `dev`; M17 (GraphQL) is on `feat/graphql`. Next: **v0.2.0** (M18–M20, see [§14](#14-milestones)): SSE and WebSockets. Updated: 2026-10-30.

## 1. Goal

`flow-checker` is a public npm package for Next.js **App Router** projects. You install it and run one command:

```bash
npx flow-checker
```

It maps how the whole project works: pages, components, requests, types and user flows. It checks that map against real traffic while you use the app, and exports it as documentation.

## 2. Agreed requirements

| #   | Topic            | Decision                                                                                                                                                                      |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Data source      | The **code scan is the source of truth**. The UI flags what the scan can't confirm. You run the app and test it, and the tool captures real requests and fills in those gaps. |
| 2   | Framework scope  | **App Router only** (Next.js 13.4+). No `pages/` directory.                                                                                                                   |
| 3   | Request patterns | `fetch` and axios (including wrapper clients), React Query and SWR, **Server Actions**, and **Route handlers / BFF** (two-hop chain to the external backend).                 |
| 4   | Flows            | **Inferred from code and confirmed by recording.** Flows can cross pages.                                                                                                     |
| 5   | Capture method   | **Injected dev-only runtime.** The browser side patches fetch/XHR. The server side uses `instrumentation.ts`. No proxy.                                                       |
| 6   | Sensitive data   | **Redacted by default.** The config option `capture.storeRaw: true` saves raw data instead.                                                                                   |
| 7   | Storage          | JSON files in `.flow-checker/` inside the project.                                                                                                                            |
| 8   | Export           | **Markdown docs** and a **static HTML site**.                                                                                                                                 |
| 9   | Types            | **Fully resolved** with the TS compiler, and **compared against captured data** to flag mismatches.                                                                           |
| 10  | Code changes     | **Watch files and re-scan incrementally.** The dashboard updates live, and affected captures are marked "needs re-check".                                                     |
| 11  | Map view         | **Graph** (pages and navigation edges) with a toggle to a **route tree**.                                                                                                     |
| 12  | Launch           | **The tool starts both**: the dashboard and the user's `next dev` with capture enabled.                                                                                       |
| 13  | Page view        | **Component tree** with badges. Clicking a component shows its types and requests.                                                                                            |
| 14  | Audience         | **Public npm package.** General-purpose, configurable and documented.                                                                                                         |

## 3. How it works

```
 npx flow-checker
        │
        ▼
 ┌──────────────┐   writes    ┌────────────────────┐
 │   Scanner    │───────────▶ │ .flow-checker/     │
 │ (ts-morph)   │◀── watch ── │   model.json       │
 └──────┬───────┘             │   captures/*.json  │
        │                     │   sessions/*.json  │
        ▼                     └─────────▲──────────┘
 ┌──────────────────────────┐           │
 │ Tool server (Hono + SSE) │───────────┘
 │  - serves dashboard :4400│◀──── capture events ────┐
 │  - ingest endpoint       │                         │
 │  - matcher + verifier    │                         │
 └──────┬───────────────────┘                         │
        │ spawns  FLOW_CHECKER=1 next dev (:3000)     │
        ▼                                             │
 ┌──────────────────────────────────────────────┐     │
 │ User's Next.js app (dev)                     │     │
 │  instrumentation.ts        → server runtime ─┼─────┤
 │  instrumentation-client.ts → browser runtime ┼─────┘
 └──────────────────────────────────────────────┘
```

Lifecycle of one item:

1. **Scan** finds a request site, e.g. `UserForm.onSubmit → useMutation → api.post('/users')`. Its status is `inferred`.
2. If the scan can't confirm something, such as the response shape, a dynamic URL or an unknown branch, the item gets a **flag**.
3. During **live testing**, the runtime captures the real request and response and records where it came from (page, component, stack trace).
4. The **matcher** links the capture to the scanned item. The status becomes `verified`, and the **type check** compares the captured data with the declared types.
5. If you **edit the code** later, the changed items go back to `needs-recheck`.

## 4. Package structure

A pnpm monorepo, published as **one** npm package (`flow-checker`) with subpath exports.

```
flow-checker/
├─ packages/
│  ├─ shared/        # data model types, zod schemas for model.json/captures, URL-pattern utils
│  ├─ scanner/       # static analysis (ts-morph): routes, components, requests, types, flows
│  ├─ runtime/       # injected code: browser patch + server instrumentation (tiny, no deps)
│  ├─ server/        # Hono server: API, WebSocket, ingest, matcher, verifier, store, watcher
│  ├─ dashboard/     # React + Vite SPA (graph, tree, page view, flows, flags)
│  ├─ exporter/      # Markdown + static HTML export
│  └─ cli/           # `flow-checker` bin: dev, scan, init, export, doctor
├─ fixtures/         # sample Next.js apps used by tests (one per pattern)
├─ docs/
└─ flow-checker (published package, bundled with tsup)
     ├─ bin: flow-checker
     ├─ exports: ".", "./runtime/client", "./runtime/server", "./config"
```

### Technology choices

| Concern       | Choice                                                                           | Why                                                                                            |
| ------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| AST + types   | **ts-morph** (TypeScript compiler API)                                           | Required for fully resolved types (generics, `Pick`, `z.infer`). SWC and Babel don't do types. |
| Server        | **Hono** on Node, with server-sent events                                        | Small and fast. Serves the API, live feed and static dashboard. SSE needs no extra dependency. |
| Dashboard     | **React + Vite + @xyflow/react** (graph) + TanStack Query                        | React Flow is the standard for interactive node graphs.                                        |
| File watching | **chokidar**                                                                     | Reliable across platforms, including Windows.                                                  |
| Validation    | **zod** for internal files. A custom checker compares captured data to TS types. |                                                                                                |
| CLI           | **cac** or **commander**                                                         |                                                                                                |
| Build         | **tsup** (packages), **Vite** (dashboard)                                        |                                                                                                |
| Tests         | **Vitest** (unit and snapshots on fixtures), **Playwright** (end-to-end capture) |                                                                                                |

## 5. Data model (`packages/shared`)

Each entity has a stable `id` (a hash of file path + symbol + position) so captures stay linked across re-scans.

```ts
Route          { id, path: "/[locale]/users/[id]", file, layoutChain[], segments[], kind: page|route-handler,
                 navigatesTo: Edge[] }
Component      { id, name, file, kind: server|client, children: ComponentRef[], propsType: TypeRef,
                 usedTypes: TypeRef[], requestSites: RequestSiteId[] }
RequestSite    { id, componentId, routeId, trigger: page-load|event(onSubmit|onClick|…)|effect|server-render,
                 transport: fetch|axios|client-wrapper|react-query|swr|server-action|route-handler,
                 method, urlPattern: "/api/users/:id", urlConfidence: exact|pattern|unknown,
                 bodyType?: TypeRef, responseType?: TypeRef, chain?: RequestSiteId[],  // BFF hop
                 callStack: SourceLoc[], hash, status: inferred|verified|needs-recheck|mismatch, flags: Flag[] }
TypeRef        { name, definedAt: SourceLoc, resolved: TypeShape }   // TypeShape = JSON-like IR
Navigation     { id, origin: component|server-action, kind: link|push|replace|redirect|permanent-redirect,
                 api: next|next-intl, href: RequestUrl, targetRouteId?, trigger, outcome?: success|error, loc }
Flow           { id, name, routeId?, componentId, steps: FlowStep[], branches: { after, outcome: error, steps }[],
                 routeIds[] }        // source + status (inferred|both, confirmed|partial) come from recording
FlowStep       interaction{ routeId, componentId, event } | request{ siteId, onLoad? } | navigate{ navigationId, routeId? }
Capture        { id, sessionId, timestamp, routeUrl, request{method,url,headers,body},
                 response{status,headers,body,durationMs}, origin: browser|server,
                 attribution{ stack[], componentChain[], interaction? }, sourceStack?, match?{status,siteId,score,candidates},
                 redacted: boolean, typeCheck?: Mismatch[] }
Session        { id, startedAt, events: (navigation|interaction|capture)[] }   // used to record flows
Flag           { kind: unknown-response|dynamic-url|unconfirmed-flow|type-mismatch|unmatched-capture|stale, message }
```

## 6. Scanner (`packages/scanner`)

It runs as a pipeline. Each stage writes to the model, and the watcher re-runs only the stages affected by a change.

### 6.1 Project discovery

- Find `next.config.*` and `tsconfig.json` (path aliases), `src/app` or `app`, and the Next version.
- Load `flow-checker.config.ts`.

### 6.2 Routes

- Walk `app/` and handle: `page`, `layout`, `template`, `loading`, `error`, `not-found`, `route.ts`, route groups `(group)`, dynamic `[id]`, catch-all `[...slug]` and `[[...slug]]`, parallel `@slot`, intercepting `(.)`, and `[locale]` (next-intl).
- Output: route tree + layout chain per page.

### 6.3 Components

- Start at each `page.tsx` and its layouts, then follow JSX element references through imports (resolving barrels and aliases) to build the component tree.
- Classify server or client using `'use client'` boundaries (inherited by imports below the boundary).
- Note conditional and dynamic children (`next/dynamic`, `lazy`) as a "possibly rendered" edge.

### 6.4 Request sites

Detect each call, then **trace it back up the call graph** to the component and the trigger that starts it.

| Pattern                                 | Detection                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fetch(...)` / `axios.*` / `axios(...)` | Direct call expressions.                                                                                                                               |
| Wrapper clients                         | Functions whose body ends in fetch or axios, discovered automatically by following the call graph. They can also be declared in config (`apiClients`). |
| React Query / SWR                       | `useQuery`, `useSuspenseQuery`, `useMutation`, `useInfiniteQuery`, `useSWR`, `useSWRMutation`: read the `queryFn`/`mutationFn`/fetcher and the key.    |
| Server Actions                          | Files or functions with `'use server'`. Find their call sites (form `action=`, `useActionState`, direct calls in handlers).                            |
| Route handlers                          | `route.ts` exported `GET`/`POST`/…. The fetch calls inside them become the **second hop** (`chain`).                                                   |
| Server components                       | `await fetch` and data functions in async components → trigger `server-render`.                                                                        |
- **Trigger detection:** where the call lives. `onSubmit`/`onClick`/etc. means event, `useEffect` means effect, a query hook at render means page-load, and an async server component means server-render.
- **URL patterns:** resolve string literals, template literals, constants and `baseURL`. Unknown parts become `:param`. If nothing can be resolved, the URL is `unknown` and gets a `dynamic-url` flag.
- **Body and response types:** come from generics (`axios.get<User>`, `useQuery<User>`), annotations, `as` casts, return types of the wrapper, and zod schemas. If no type is found, the item gets an `unknown-response` flag.

### 6.5 Types

- For each component, collect its props type, the types used in its body, and the request and response types.
- Resolve them with `type.getApparentProperties()` etc. into a **TypeShape IR** (object, array, union, literal, primitive, nullable, optional, ref). Depth limits and cycle detection prevent infinite expansion.
- Keep `definedAt`, so the UI and docs can link to the source.

### 6.6 Navigation and inferred flows

- **Edges between pages:** `<Link href>`, `router.push/replace`, `redirect()`, `permanentRedirect()`, middleware redirects (best effort) and form actions that redirect.
- **Flow inference:** inside each event handler or mutation, build an ordered step graph. Example:
  `submit → mutation(POST /auth/login) → onSuccess → router.push('/verify') → [on /verify] page-load GET /me → …`
  Branches (`onError`, `if (res.ok)`) become alternative paths.
- Flows are named from the starting component and route (e.g. "LoginForm submit"), and you can rename them in the UI.

**Built in M7** (`packages/scanner`: `navigation.ts`, `flows.ts`):

- Navigation is found on the request walk, so it gets the same origin, trigger and string resolution (`` `/verify?challenge=${id}` `` → `/verify?challenge=:id`). Supported: `next/link`, `next/navigation` (`useRouter().push/replace`, `redirect`, `permanentRedirect`) and next-intl `createNavigation()` wrappers, including renamed exports and `{ href }` / `{ pathname, params }` targets. Hrefs resolve to routes, static segments first. For next-intl the `[locale]` prefix is added.
- **Outcome:** a navigation is on the `success` path in a `try` block, `onSuccess`, `.then`, or an `if` that checks a response (`res.ok`, `status`); on the `error` path in `catch`, `onError`, `.catch` or the failing side of that `if`. Mutation `onSuccess`/`onError`/`onSettled` callbacks are now walked too.
- **Flows:** start at each event handler that sends a request. Steps: interaction → its requests (server action redirects included) → success navigation → the next page's load requests (its own component tree, not layouts) → the next page's handler that sends a request and moves on (forms first), and so on, until a page repeats. Error navigations become branches. A handler that only continues another flow is not listed separately (the OTP form is part of "LoginForm submit").
- Middleware redirects are scanned since M14 (navigation origin `middleware`, see the M14 notes).
- `flow-checker scan --flows` prints navigation and flows; snapshot `<fixture>.flows.txt`.

### 6.7 Incremental re-scan

- Keep a reverse dependency map (file → entities that depend on it).
- On a chokidar change: refresh that file in ts-morph, re-run the stages for the affected entities, compare old and new entities, and push the changes over WebSocket.
- If a request site's hash changed, set its status to `needs-recheck` and keep the old captures, marked stale.

**Built in M9** (`packages/scanner`: `scan.ts` `createScanSession`, `code-hash.ts`; `packages/server`: `watch.ts`, `history.ts`, `scan-feed.ts`; `packages/shared`: `diff.ts`):

- **Warm session instead of a dependency map.** `createScanSession()` keeps the ts-morph project. `update({ changed, added, removed })` re-reads only those files, then runs every stage again on the warm project. The compiler reuses everything else, so this takes about 75–300 ms on the fixtures (a cold scan takes 0.8–2.5 s). That is fast enough without tracking which entities depend on which file. Imports are only resolved again when a file was added or a changed file's imports changed (it's the slowest step). Changes to `tsconfig.json`, `jsconfig.json`, `package.json` or `next.config.*` start a fresh project.
- **Warm-up.** The first program rebuild after any change costs about a second, later ones much less. `session.warm()` pays for it right after start, so the first edit is fast too.
- **Watcher.** chokidar watches the project root, skipping `node_modules`, `.next`, `.git`, `.flow-checker` and build output, and only reports source files and project config files. Events are batched (40 ms). Each batch is re-scanned, written to `model.json` and published to the server. A failed re-scan is printed and the next change starts over. `--no-watch` turns it off.
- **Code hash.** Each request site has a `hash` of the code that sends it: the transport, method, URL, trigger and hook, plus the code along its call path. In the origin (component, route handler or action) only the part around the call counts: the JSX attribute, the nearest function inside it (handler, effect), or the statement. The functions the path enters (handlers, wrappers) count in full. The code is hashed as AST tokens, so whitespace, comments and line numbers don't count. Types don't count either: they don't change what is sent, and M8 re-checks old captures against new types anyway.
- **Stale captures.** `.flow-checker/cache/code-hashes.json` remembers when each hash was first seen. A capture taken before its site's current hash appeared is **stale**. A site with only stale captures is `needs-recheck`, with a `stale` flag. A new capture makes it `verified` again. The type check uses captures of the current code while there are some. The first run ever sets a baseline (existing captures count as current). Code edited while the tool was off is noticed on the next start. Hashes no longer in the code are forgotten, so undoing an edit also asks for a re-check.
- **Ids that moved.** Site ids include line numbers, so adding a line above a request gives it a new id. After a re-scan, removed and added sites are paired by hash (only moved), then by call path without line numbers (moved and changed). Only unambiguous pairs. A paired site keeps its automatic matches (instead of scoring again with outdated lines), and manual matches in `overrides.json` move to the new id.
- **Live update.** The server applies the new model, matches every capture again and sends a `scan` event on `/api/live` (server-sent events, which the dashboard already uses, rather than a WebSocket): files, entity counts added/removed/changed, sites whose code changed, and sites that now need a re-check. `/api/live` is on whenever files are watched, even without capture. Capture summaries carry `stale`.
- Dashboard: refetches the model on `scan`, `↻ needs re-check` badge, `stale` badge on captures (Live screen and request panel), a "code changed" banner and the changed file next to the scan time, and a "Requests whose code changed since they were captured" group on the overview.
- **Check:** `watch.test.ts` (CLI) runs `dev` on a copy of the basic fixture with its recorded captures. Moving lines keeps every site verified. Editing `getUsers` makes only that site `needs-recheck`, with the `scan` event and the model update arriving in under 1 s (about 170 ms). A new capture verifies it again. An edit made while the tool was off is noticed on start. `incremental.test.ts` checks that every session update equals a fresh scan, and the hash rules. `e2e/watch.spec.ts` edits `LoginForm.tsx` in the running next-intl fixture: the dashboard shows `↻ needs re-check` within 1 s (about 480 ms), then a new login shows `✓ verified` again.
- **M11:** the warm session runs in a worker thread (`dist/scan-worker.js`), so the server keeps answering during large re-scans. Scans are queued one at a time. From source (tests) it runs in-process. (Middleware is scanned since M14.)

## 7. Runtime capture (`packages/runtime`)

### 7.1 Injection with no manual setup

The tool runs the dev command with `FLOW_CHECKER=1`, `PORT=<app port>`, and the runtime settings as JSON (ingest URL, a per-project ingest token, resolved capture options) in `FLOW_CHECKER_RUNTIME` (server) and `NEXT_PUBLIC_FLOW_CHECKER` (browser, inlined by Next).

- **Next 15.3+:** use `instrumentation-client.ts` (browser) and `instrumentation.ts` (server).
- **Next 13.4–15.2:** `instrumentation.ts` for the server (with `experimental.instrumentationHook` where needed). The browser runtime comes from a small `withFlowChecker()` wrapper in `next.config` that prepends the client entry.
- `flow-checker init` makes these one-line additions, with your confirmation. Every hook is a **no-op unless `FLOW_CHECKER=1`**, and the runtime is excluded from production builds.
- `flow-checker doctor` checks the setup.
- **Built in M5:** the 15.3+ path. `dev` warns when a hook is missing.
- **Built in M11:** `withFlowChecker()` (`@integr8-media/flow-checker/next`, ESM and CommonJS). Before 15.3 it prepends the project's own `instrumentation-client.*` to the webpack `main-app` client entry in dev, so the same hook files work on every version; before 15.0 it also sets `experimental.instrumentationHook`. It returns the config untouched without `FLOW_CHECKER=1` or on 15.3+, and accepts config functions. Turbopack ignores webpack config, so browser capture before 15.3 needs `next dev` without `--turbo` (`doctor` warns). `init` prints the wrapper snippet when it is needed.

### 7.2 Browser side

- Patch `fetch` and `XMLHttpRequest`, which covers axios, React Query and SWR. Server Action calls are recognized by the `Next-Action` header.
- For each request, record:
  - the request and response (body cloned, size-limited)
  - the timing
  - a stack trace (`new Error().stack`)
  - the **last user interaction**: event type and target element. From the element's React fiber (`__reactFiber$…`), it walks up to the component names. This works for event-driven requests even when the stack loses async frames.
  - the current URL
- It also records **navigation** events (history patch + `popstate`) and **interaction** events into a session timeline, which is used to record flows.
- Events are sent in batches over `navigator.sendBeacon` / `fetch` to the ingest endpoint, which is excluded from capture. Batches are `text/plain` with `mode: 'no-cors'` (a CORS simple request, no preflight) and carry the ingest token.
- Next's own RSC requests (`RSC: 1` header, `_rsc` param) are skipped. Same-origin requests get an `x-flow-checker-link: <sessionId>.<captureId>` header so server captures can point back to them.

### 7.3 Server side (`instrumentation.ts`)

- `globalThis.fetch` is wrapped through a property accessor. Next's dev server puts the native fetch back on hot reload (`resetFetch` in `router-server`), so a plain wrapper would silently disappear; the accessor wraps whatever gets assigned, except Next's patched fetch (which already calls ours).
- Node's `http`/`https` (axios on Node) are captured through the `http.client.request.start` / `http.client.response.finish` diagnostics channels. Request bodies are tapped on `ClientRequest.prototype.write/end`, response bodies by tapping `emit('data')` (no extra listener, so streams keep their mode).
- `http.server.request.start` puts the incoming request into an `AsyncLocalStorage`, so each outgoing call records its `parent` (method, URL, `Next-Action` id, and the browser capture from `x-flow-checker-link`). This is how the **BFF two-hop chain** and server component fetches get linked.
- **Server Actions:** the runtime records the action ID. The tool server maps it to its file and export with `server-reference-manifest.json` (`.next/dev/server/` on Next 16, `.next/server/` before), re-read when it changes.
- Next's own RSC requests (`RSC: 1`, e.g. the page Next fetches from itself after a server action redirects) are skipped, as in the browser.
- Edge runtime: best effort (`fetch` patch only). This is documented as a limit. **Built in M14:** `registerEdgeRuntime()` (`@integr8-media/flow-checker/runtime/edge`), registered by the `init` hook when `NEXT_RUNTIME === 'edge'`.

### 7.4 Redaction (default ON)

- Applied **in the runtime before sending**, so raw secrets never reach disk by default.
- Default rules:
  - headers: `authorization`, `cookie`, `set-cookie`, `x-api-key`, `proxy-authorization`
  - body keys (case-insensitive, nested): `password`, `pass`, `token`, `accessToken`, `refreshToken`, `secret`, `otp`, `code`, `cvv`, `cardNumber`, `ssn`
  - value patterns: JWTs, bearer tokens, card numbers
- Masking keeps the **shape**: strings become `"[REDACTED:string]"`, while numbers and booleans keep their type marker. This way the type comparison still works on redacted data.
- Config:

  ```ts
  capture: {
    storeRaw: false,                 // true = save everything unmasked (local debugging only)
    redact: { headers: [...], keys: [...], patterns: [/.../] },  // extend or replace defaults
    maxBodyBytes: 256_000,
    ignore: ['/_next/*', '/__nextjs*', '*.png'],
  }
  ```
- If `storeRaw: true`, the CLI prints a warning at startup, and `export` still redacts unless you pass `--raw`.
- `.flow-checker/captures/`, `sessions/` and `cache/` are added to `.gitignore` on first run, unless a `.gitignore` up to the repo root already covers them.
- The tool server redacts every capture again on arrival (unless `storeRaw`), as a safety net. Redaction is idempotent.
- Masked numbers become `0` and booleans `false`. Each capture lists what was masked in `redactedPaths`. Sensitive query parameters in URLs are masked too.

## 8. Matching and verification (`packages/server`)

Captures are matched to scanned request sites with a score:

| Signal                                                                                                       | Weight    |
| ------------------------------------------------------------------------------------------------------------ | --------- |
| Stack trace frame (via dev source maps) points to the site's file and line, or to a frame in its `callStack` | very high |
| Server Action ID → manifest → the site's action                                                              | exact     |
| Method + URL matches `urlPattern`                                                                            | high      |
| Component chain from the interaction matches the site's component                                            | high      |
| Current route matches the site's route                                                                       | medium    |
| Trigger type is consistent (e.g. it happened right after a submit event)                                     | low       |
- Best score above the threshold → matched. The site becomes `verified` and the capture is attached as an example.
- Two sites with similar scores → "ambiguous" flag, and you pick the right one in the UI. Your choice is remembered.
- No match → `unmatched-capture` flag. This usually means the scanner missed something, so it's reported as a scanner gap.

**Built in M6** (`packages/server`: `matcher.ts`, `verify.ts`, `stack.ts`, `actions.ts`):

- **Hard filters first.** A site is only a candidate if it fits: same side (browser or server, from the trigger), same method, URL matches the pattern (a base from an env variable is not enforced), a browser Server Action call only matches server-action sites (and the right action when the manifest resolves it), a hop inside a route handler only matches sites of that handler and method.
- **Points** (`MATCH_THRESHOLD` 40, `MATCH_MARGIN` 15): action id → manifest 100 (60 for fetches inside the action), source-mapped stack frames on the site's call path 25 each (max 75), URL 35–40 (+5 same fixed base, +3 per query key), interaction component 15–30, parent request matched to a site whose `chain` leads here 40, route handler 40, route 15 (25 for server render), stack function names 5–20, trigger fit −10…+10.
- **Source maps:** the server resolves frames through the dev build's `.map` files (Turbopack index maps and webpack `webpack-internal://` frames) **when the capture arrives**, and stores them as `sourceStack`, because chunks change on rebuild.
- **Ambiguous** when the best two are closer than the margin. **Unmatched** when nothing reaches the threshold. Both stay in `captures/_unmatched/`. Matched captures are filed under `captures/<siteId>/`.
- **Manual assignment** (`PUT/DELETE /api/captures/:id/match`) is saved in `overrides.json` by fingerprint (side, method, URL shape, action, incoming request, nearest component), so it applies to similar captures later.
- **Status:** `/api/model` serves sites with a matched capture as `verified`. Captures are matched again after each re-scan, and server hops again once their browser request is matched. The live feed sends `verification` events, and the dashboard shows match badges, evidence, an assign control, verified badges and route colors.
- **Check:** `scripts/record-captures.mjs` records real captures from every fixture (`packages/server/test/recordings/`). `matching.test.ts` requires ≥95% auto-matched (currently all of them, each to the right site per the snapshot), and ≥90% even without source maps or the manifest.

**Type check:** the captured response and body are validated against the site's `TypeShape`. The results are `ok`, `missing field`, `extra field`, `wrong type`, or `null where non-null`. Any mismatch flags the site, and the UI shows the difference.

**Built in M8** (`packages/shared`: `type-check.ts`, `verification.ts`; `packages/server/src/verify.ts`):

- `checkCapture()` compares a matched capture's request body (`bodyType`) and response (`responseType`) with the site's types. Each part is `ok`, `mismatch` or `skipped` with a reason. Skipped: error responses (non-2xx, the type describes success), server action calls (React-encoded, not JSON; the action's own fetches are checked), form data, binary, truncated bodies, failed requests. An empty body is fine for `void`/`undefined`.
- Mismatch kinds: `missing-field`, `extra-field`, `wrong-type`, `null`. Paths use the `redactedPaths` form (`response.body.user.email`). Array items share one path (`response.body[].id`) with a count. Tuple positions keep their index.
- Rules: optional and `| undefined` properties may be missing; index signatures check unknown keys; `{}` accepts any object; unions report against the closest member (same JSON kind, matching literal discriminant, then fewest mismatches), or as a whole for scalar unions; object intersections are merged; branded primitives check only the primitive; `Date` accepts a string; `Promise<T>`/`Array<T>` unwrap; package types, type parameters and unresolved shapes are not checked. Masked values (`[REDACTED:string]`, `0`, `false`) only need the right JSON type.
- The verifier runs it on every matched capture (on arrival and after each re-scan, so fixing a type clears the flag) and stores it as `Capture.typeCheck`. A `typeCheck` sent by the runtime is dropped.
- `applyVerification()` (shared by server and dashboard) sets site status `mismatch` and adds a `type-mismatch` flag listing what didn't fit and in how many captures. `/api/verification` has per-site `typeCheck` (`checked`, `mismatched`, distinct mismatches). Capture summaries carry `typeCheck: ok|mismatch|skipped`.
- Dashboard: `✗ type mismatch` badge, a type-check table on each request (field, problem, expected, captured, captures), a "Type check" section and `✗ types` badge on captures in Live, a "Type mismatch" filter, and a group on the overview to-do list.
- **Check:** the `mismatch` fixture (types that disagree with `mock-api` on purpose; `GET /settings` added to the mock) is recorded like the others. `type-check.test.ts` requires the expected flags there (wrong type, missing and extra field, null, request body), `verified` with no flag for its correct site, and **no** mismatches in the five correctly typed fixtures.

**Flow recording:** a session timeline is split into flows at the starting interaction (e.g. a submit). The ordered steps are matched to inferred flows:
- If they match, the flow becomes `both` (confirmed).
- If you took an unexpected path, it's added as a new `recorded` variant.
- Inferred branches that were never exercised stay flagged as `unconfirmed`.

**Built in M7** (`packages/server/src/flows.ts`):

- Each session timeline (interactions, navigation, browser captures with their matched site) is checked against every inferred flow. A flow is split into segments, one per interaction. A segment's requests and navigation must show up after its interaction and before the next segment's interaction (any order, within 60 s; the next interaction within 10 min). Server-render requests aren't linked to a browser session, so they don't block confirmation.
- Results (`GET /api/flows`, live `flows` event): `confirmed` (walked end to end, source `both`), `partial` (started, stopped early), `unconfirmed`. Error branches are marked seen when a session takes them.
- A walk that navigates to a page the flow doesn't predict becomes a `variant` recorded flow.
- **Named recording:** start/stop in the Live screen (`POST /api/recordings`, `POST /api/recordings/stop`). Everything in between is saved in `overrides.json`, linked to the inferred flow it walks. Flow renames are saved there too (`PUT /api/flows/:id/name`).
- Dashboard: Flows screen (step list with done marks, branches, rename, recorded variants), flows per page, navigation edges on the map, flow count on the overview.

## 9. Dashboard (`packages/dashboard`)

| Screen              | Content                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Overview**        | Counts (pages, components, requests, flows) and verification progress (% verified). Lists **flags to check**, grouped as a to-do list, with "open in app" links that open the page on `:3000`.                                                                                       |
| **Map**             | **Graph:** pages as nodes, navigation and redirect edges, color = verification status. **Tree:** mirrors `app/`, with groups and dynamic segments. Toggle between the two, with search.                                                                                              |
| **Page view**       | Route info and the layout chain. **Page-load requests** list. **Component tree** with badges (`server`/`client`, `⇄ requests`, `⚠ flags`, `✓ verified`).                                                                                                                             |
| **Component panel** | Props and used types (expandable resolved shape, plus source link). **Requests it triggers**, with the trigger (e.g. `onSubmit`), method and URL, the **request body**, the **response** (captured examples, status, timing) and type-check results. BFF chain shown as nested hops. |
| **Flows**           | List per page and app-wide. Each flow is a step diagram (route → component → action → request → response → next), with success and error branches. Each step expands to its request and response. Status: inferred / recorded / confirmed.                                           |
| **Live**            | Real-time feed of captures while you test, with the match result for each one. Manual "assign to site" for ambiguous or unmatched captures. Start/stop **recording** a named flow.                                                                                                   |
| **Types**           | Searchable index of all types, showing where each is defined and which components and requests use it.                                                                                                                                                                               |
| **Export**          | Buttons for Markdown and HTML, with a redaction toggle.                                                                                                                                                                                                                              |

Live updates over server-sent events (`/api/live`). "Open in editor" links use `vscode://file/...`.

## 10. Export (`packages/exporter`)

**Markdown** (`flow-checker export --md ./docs/flow`):
```
README.md            overview, route map (Mermaid graph), verification summary
pages/<route>.md     layout chain, component tree, requests (body/response examples + types)
flows/<flow>.md      Mermaid sequence diagram + step table with request/response
components/<name>.md props, types, requests
types.md             all types with resolved shapes and usages
issues.md            open flags, type mismatches, unmatched captures
```

**Static HTML** (`flow-checker export --html ./flow-site`): the same dashboard build in read-only mode, with `model.json` and captures embedded. It's one folder you can host anywhere, with no tool server needed.

Both formats redact by default.

**Built in M10** (`packages/exporter`; `packages/server/src/snapshot.ts`; `flow-checker export`; dashboard Export screen):

- **Snapshot first.** `collectSnapshot()` scans fresh, reads `.flow-checker/` (captures, sessions, overrides) **without changing it** (read-only store, in-memory code history) and runs the same verifier and flow tracker as `dev`. `buildSnapshot()` does the same from a running server (`POST /api/export`). The result is one `ExportData` object (`packages/shared/src/export.ts`): the served model (statuses, flags, flow names), verification, flow results and captures.
- **Captures:** redacted again with the config's rules unless `--raw` (which only matters with `capture.storeRaw`), absolute project paths removed from stack frames, the newest 10 per site and 100 unmatched kept, plus every capture the verification points at.
- **Markdown** is a pure function of the snapshot, so fixtures have golden files (`packages/exporter/test/golden/<fixture>/md`, recorded captures from `packages/server/test/recordings`). File names: `pages/users.[id].md`, `components/<Name>.md` (`<Name>.<file>` when names repeat), `flows/<slug>.md`, `flows/recorded.md` when there are recordings. Requests are documented with their types, type-check table and the newest successful and failed captured examples; BFF and server action hops are nested under the request that leads to them. Flow sequence diagrams show the user, each page, the app server, route handlers and external APIs.
- **Static HTML:** the dashboard build plus `data.js` (`window.__FLOW_CHECKER__`). The dashboard reads everything from it, hides what needs a server (re-scan, live feed, assign, record, rename, export) and labels Live as Captures. The bundle has no imports, so it is loaded as a classic script and `index.html` also works from `file://`. The embedded data is golden-tested too (`golden/<fixture>/html/data.json`).
- **Writing:** each export folder gets `.flow-checker-export.json` listing its files. The next export replaces those (and removes pages that are gone) and nothing else. A folder with other files and no manifest is refused unless `--force`.
- **CLI:** `flow-checker export --md <dir> --html <dir> [--raw] [--force]`. With neither flag, both go to `export.md` / `export.html` from the config, default `docs/flow` and `.flow-checker/site`.
- **Dashboard:** an Export screen with a button per format and the redaction toggle (only changeable with `capture.storeRaw`), writing to the config folders.
- **Check:** `markdown.test.ts` and `html.test.ts` compare every fixture with its golden files; `snapshot.test.ts` covers redaction, path removal, trimming and the read-only guarantee; `e2e/export.spec.ts` opens an exported site from disk and uses the Export screen.

## 11. CLI

```
flow-checker            # = dev: scan + watch + dashboard + run app with capture, opens browser
flow-checker scan       # scan only, write model.json (CI-friendly), exit non-zero on --fail-on flags
flow-checker init       # add instrumentation hooks + config file + .gitignore entries
flow-checker export     # --md <dir> | --html <dir> [--raw]
flow-checker doctor     # check Next version, hooks, ports, tsconfig
```

Options: `--port`, `--app-port`, `--dev-command "pnpm dev"`, `--no-open`, `--no-watch`, `--config`.

Package manager (npm, pnpm, yarn or bun) is detected from the lockfile.

**Built in M11:** `doctor` checks Node (22.12+, 22.18+ for a `.ts` config), the config file, the App Router directory (warns about `pages/`), the Next version (13.4+), `tsconfig`/`jsconfig` (parse errors, path aliases), that the package is installed, both hooks, `withFlowChecker()` before 15.3, Turbopack before 15.3, both ports and `.gitignore`. Each problem comes with a fix; exit code 1 on a failed check. `scan` now loads the config too. `--no-app` prints the environment to start the app with. Not done: `scan --fail-on`.

## 12. Config file (`flow-checker.config.ts`)

**Built in M11** (documented in [config.md](config.md); `init` writes the defaults into the new file):

- `root`: resolved from the config file's folder (default `.`); `.flow-checker/` and the dev command use it. `doctor` loads the config first, so every check uses it.
- `include` / `exclude`: globs from the root (`packages/shared/src/glob.ts`). Defaults `['**']` and tests/specs/stories/`__tests__`/`__mocks__`; a user list replaces the default. Excluded pages and route handlers are dropped, components declared in excluded files appear as `resolution: 'excluded'` and are not walked, and the request walk doesn't enter excluded functions.
- `apiClients`: `{ module, methods }[]`, default `[]`. A call becomes a site with transport `api-client` and `client: { module, name }` when its callee is a listed name imported from the module (as written, or resolving to the same project file, also through barrels), a method on such an import, or on an instance created from it (`ky.create()`, also when imported from another file). `default` = calling the import or instance. Method from a verb name, else the `method` option, else GET; URL from the first argument (or `url`), with `prefixUrl`/`baseURL` from the instance; body from `json`/`body`/`data` or the second argument of `post`/`put`/`patch`; response from a type argument. A configured project module is the request itself (not entered). `doctor` warns when a listed package isn't installed.
- `types.maxDepth` is passed to the type resolver.

```ts
import { defineConfig } from 'flow-checker/config'
export default defineConfig({
  root: '.',
  appDir: 'src/app', // auto-detected
  devCommand: 'next dev', // auto-detected from package.json
  ports: { dashboard: 4400, app: 3000 },
  include: ['src/**'],
  exclude: ['**/*.test.*', '**/*.stories.*'],
  apiClients: [{ module: '@/lib/api', methods: ['get', 'post', 'put', 'patch', 'delete'] }], // optional hints
  capture: {
    storeRaw: false,
    redact: {
      /*…*/
    },
    maxBodyBytes: 256_000,
    ignore: [],
  },
  types: { maxDepth: 6 },
  export: { md: 'docs/flow', html: '.flow-checker/site' },
})
```

## 13. Storage (`.flow-checker/`)

```
.flow-checker/
├─ model.json          # scan result (safe to commit)
├─ overrides.json      # user decisions: renamed flows, manual matches (safe to commit)
├─ captures/<siteId>/<captureId>.json   # gitignored by default (`_unmatched/` until matched to a site)
├─ sessions/<sessionId>.json            # gitignored by default
└─ cache/              # gitignored: ingest token, code-hashes.json (when each request's code was first seen, M9)
```

Every file is checked against a zod schema with a `version` field, so the format can change safely later.

## 14. Milestones

| #   | Milestone                                                                                                                                                   | Done when                                                                         | Status  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- |
| M0  | **Setup:** monorepo, tsup/Vite builds, Vitest, fixtures (basic, react-query, server-actions, bff, next-intl)                                                | CI green on an empty pipeline                                                     | ✅ Done |
| M1  | **Routes + components** scan                                                                                                                                | Snapshot tests: route tree and component trees for all fixtures                   | ✅ Done |
| M2  | **Request sites:** fetch/axios/wrappers, React Query/SWR, server actions, route handlers + chain, triggers, URL patterns                                    | Every fixture request detected with the right component and trigger               | ✅ Done |
| M3  | **Types:** resolution into TypeShape IR, zod `z.infer`                                                                                                      | Resolved shapes match the expected snapshots                                      | ✅ Done |
| M4  | **Dashboard (read-only):** server, overview, map (graph + tree), page view, component panel, types                                                          | You can browse a fixture's full scan                                              | ✅ Done |
| M5  | **Runtime capture:** client + server runtime, `init`, ingest, **redaction**, store                                                                          | Playwright test: a click in the fixture shows a redacted capture in the dashboard | ✅ Done |
| M6  | **Matching + verification:** scoring, flags, manual assignment, status changes                                                                              | ≥95% of fixture captures auto-matched                                             | ✅ Done |
| M7  | **Flows:** navigation edges, inferred flows, session recording, flow merge                                                                                  | Login → OTP → dashboard flow inferred and confirmed in the fixture                | ✅ Done |
| M8  | **Type comparison** of captures vs. types                                                                                                                   | Mismatch fixture produces the expected type-mismatch flags                        | ✅ Done |
| M9  | **Watch + incremental re-scan**                                                                                                                             | Editing a fixture file updates the UI in under 1 s and marks `needs-recheck`      | ✅ Done |
| M10 | **Export:** Markdown + static HTML                                                                                                                          | Export of each fixture matches the golden files                                   | ✅ Done |
| M11 | **Public release:** README, config docs, `doctor`, Next 13.4/14/15/16 matrix, Windows/macOS/Linux, performance on a large repo, npm publish with provenance | v0.1.0 on npm                                                                     | ✅ Done |

### v0.2.0 milestones

Decided on 2026-10-30. Everything ships together as **v0.2.0** (new features, so a minor release). Order: CLI progress → React Query → middleware → Postman import → tRPC → GraphQL → SSE → WebSockets → release. Supported library versions: **React Query v4 + v5, tRPC v10 + v11, Apollo Client 3 + 4**, urql and Relay (current). Each gets its own fixture.

| #   | Milestone                                                                                                                                                                                                                                                                                                                                                                                               | Done when                                                                                                                                                                                          | Status  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| M12 | **CLI progress output for every command** (`dev`, `scan`, `export`, `init`, `doctor`): scanner `onProgress` phases with counts, spinner + progress bar + ✓ done lines in a terminal, plain lines in CI / piped output, `--verbose` / `--quiet`, `scan` and `export` scan in the worker                                                                                                                  | Each command on the perf app shows its current step and bar within 1 s of the step starting, and the bar only moves forward; CI output has no ANSI codes; `--quiet` prints only results and errors | ✅ Done |
| M13 | **React Query APIs and keys:** `useQueries`, `useSuspenseQueries`, `queryClient.fetchQuery / prefetchQuery / ensureQueryData / fetchInfiniteQuery / prefetchInfiniteQuery`, `queryOptions()` / `infiniteQueryOptions()` / `mutationOptions()`, server prefetch + `HydrationBoundary`, structured keys and key factories, invalidation links, runtime `QueryCache` key capture, `query-key` match signal | v4 and v5 fixtures: every query and mutation detected with its structured key; mutation → invalidated query links shown; captures matched by key                                                   | ✅ Done |
| M14 | **Middleware:** `middleware.ts` and `proxy.ts` (Next 16), `config.matcher` → affected routes, redirects as navigation edges, rewrites used for URL resolution, fetches inside with a `middleware` trigger, best-effort edge capture                                                                                                                                                                     | Middleware fixture: matcher routes, redirect edge and middleware fetch are all correct (on Next 15 and 16)                                                                                         | ✅ Done |
| M15 | **Postman collection import:** v2.1 JSON, v3 YAML folder and cloud collection by ID, plus environments. Used as an API contract, a types source and for URL resolution                                                                                                                                                                                                                                  | Fixture with a collection: sites matched to collection requests, example-based types fill `unknown-response`, `{{baseUrl}}` URLs resolved, missing / unused endpoints flagged                      | ✅ Done |
| M16 | **tRPC:** client calls (React hooks, vanilla, v11 `queryOptions`), router procedures with input / output types, runtime batch splitting, match by procedure path                                                                                                                                                                                                                                        | v10 and v11 fixtures: every procedure call detected, typed and matched, including batched requests                                                                                                 | ✅ Done |
| M17 | **GraphQL:** Apollo 3 + 4, urql, Relay. Operations by name + type, fragments. Types from codegen, then a schema file, then live introspection. Runtime operation parsing, batching, persisted queries. `graphql-operation` match signal                                                                                                                                                                 | One fixture per client: every operation detected, typed and matched by operation name                                                                                                              | ✅ Done |
| M18 | **SSE:** `EventSource`, streamed `fetch`, `text/event-stream` route handlers. Runtime captures events (redacted, size-capped bodies); type check per event                                                                                                                                                                                                                                              | SSE fixture: stream and events captured, matched and type-checked                                                                                                                                  | Planned |
| M19 | **WebSockets:** native `WebSocket` and socket.io-client. Connection + send/emit sites. Runtime captures messages (redacted, size-capped bodies); message timeline in the dashboard                                                                                                                                                                                                                      | WS fixture: connection and messages captured, matched and shown in the timeline                                                                                                                    | Planned |
| M20 | **Release v0.2.0:** README, config docs for the new options, CHANGELOG, Next matrix extended with the new fixtures, performance budgets rechecked                                                                                                                                                                                                                                                       | v0.2.0 on npm                                                                                                                                                                                      | Planned |

### v0.2.0 notes

**Shared model changes (`packages/shared`):**

- Site `transport`: `fetch | axios | api-client | server-action | graphql | trpc | websocket | sse`. Capture `transport` gains `websocket` and `eventsource`.
- New trigger kind `middleware`.
- New optional site fields: `queryKey` (structured segments: static, or `:param` for dynamic parts), `operation` (GraphQL `{ name, type: query | mutation | subscription, document }`), `procedure` (tRPC `{ path, type: query | mutation | subscription }`), `contract` (the matched Postman request).
- Captures gain the same `queryKey` / `operation` / `procedure` fields, and a `messages` list for WS / SSE (direction, event name, time, size, redacted body).
- New match signals: `query-key`, `graphql-operation`, `trpc-procedure`.
- All schema changes bump the `version` field, with migration of existing `.flow-checker/` files.

**M12 — CLI progress output:**

Today the first scan runs as one blocking step and nothing prints until the summary, so `dev`, `scan` and `export` look stuck on large repos (~10 s on the perf app).

- **Scanner:** `ScanOptions.onProgress(event)` with `{ phase, done?, total?, detail? }`, fired at phase boundaries and every few items inside long phases. Phases: `discover` (Next version, app dir) → `load` (files) → `routes` → `components` → `requests` (route i of N, includes types) → `flows` → `write`. Re-scans report the same phases. From the worker, events are posted to the main thread as messages.
- **Terminal (TTY), on by default:** one live line with a spinner, an overall progress bar, the percentage, the current step with its count and the elapsed time, replaced by a done line when the step ends:

  ```text
  ✓ Project found: Next 16.0, src/app (0.1 s)
  ✓ Files loaded: 1,808 (2.0 s)
  ✓ Routes: 401 (0.3 s)
  ✓ Components: 804 (1.1 s)
  ⠋ [██████████░░░░░░░░░░] 52%  Scanning requests… route 120/401  4.2 s
  ```

  - The bar shows the **whole command**, not just the current step. Each step has a weight (scan phases weighted by their share of time on the perf app, e.g. `load` ~25%, `requests` ~40%), and steps with a count (files, routes, checks, pages) fill their share item by item. The bar never moves backwards.
  - A step with no count (waiting for a port, starting a process) keeps the bar still while the spinner and timer keep moving.
  - The bar shrinks to fit narrow terminals and is dropped below 60 columns (spinner + text only). Redrawn at most every 80 ms, written to stderr so piped stdout stays clean. The line is cleared on exit and on Ctrl+C.
- **Not a TTY (CI, pipes) or `NO_COLOR` / `TERM=dumb`:** plain lines, one per finished step, no spinner, bar or ANSI codes.
- **Per command:**
  - **`dev`:** loading config → scan phases → starting dashboard → starting your app → waiting for the app on its port → `App ready (2.3 s)`. After that the live line is gone, and the app's own log lines show as today. Watch re-scans show a short spinner + bar line while they run, then their one-line summary.
  - **`scan`:** loading config → scan phases → writing `model.json`, then the summary and any `--tree` / `--types` / `--requests` / `--flows` output.
  - **`export`:** loading config → scan phases → loading captures → building the model → writing Markdown (page i of N) → writing the static site (file i of N).
  - **`init`:** checking the project → each planned change (hooks, config, `.gitignore`, `next.config` wrapper). The live line pauses while the `[y/N]` question is shown, then continues.
  - **`doctor`:** check i of N, with each check's ✓ / ⚠ / ✗ line left behind as it finishes (ports and the Next version can take a moment).
- **`--verbose`:** also prints timings per phase, the resolved config (root, app dir, include / exclude, apiClients), skipped / excluded file counts and the scan worker in use. **`--quiet`:** no progress, only results, warnings and errors.
- **`scan` and `export`** run their scan in the worker too (same as `dev`), so the spinner keeps moving while the scan blocks.
- A small helper in `packages/flow-checker/src/cli/progress.ts` (no new dependency) handles the spinner, the weighted bar, terminal width, TTY detection and cleanup on Ctrl+C. Every command reports through it, and `CliIO` gets a `progress` handle so tests can record steps. Tests use a fake TTY and check both output modes, bar weights and that the bar never goes back.

- **Built:** `ScanOptions.onProgress` / `SCAN_PHASES` in the scanner, `writeExport({ onFile })` in the exporter, `src/cli/progress.ts` in the CLI. `CliIO` got `display` and `verbose`, `runDoctor` an `onCheck` callback, and the scan runner forwards phase events from the worker (`scan(onProgress)`, `update(changes, onProgress)`, `writeModel: false` for `export`). Bar weights come from the perf app (1,806 files): load 3.8 s, components 2.6 s, requests 3.4 s, the rest under 0.3 s. `dev` waits for the app's port in the background (only when progress is shown), and re-scan lines wait until the start-up line is done. Tests: `packages/scanner/test/progress.test.ts`, `packages/flow-checker/test/progress.test.ts`.

**M13 — React Query:**

- Scanner adds the hooks and `queryClient` methods above (on `@tanstack/react-query` v5 and `react-query` / `@tanstack/react-query` v4, including v4's positional `useQuery(key, fn)` form). `queryOptions()` objects are followed to where they're used.
- Keys are parsed into segments. Literals and constants are static; variables become `:name`. Key factories (`userKeys.detail(id)`, objects or functions returning arrays) are resolved by following the call.
- `invalidateQueries`, `refetchQueries`, `resetQueries`, `removeQueries` and `setQueryData` (by exact key or prefix) become links from the code that calls them (usually a mutation's `onSuccess`) to the queries they hit. Shown on the page view and in flows.
- `prefetchQuery` in a server component + `HydrationBoundary` → trigger `server-render`, linked to the client `useQuery` with the same key.
- Runtime: when the app has a `QueryClient`, subscribe to its `QueryCache` / `MutationCache` (found via the `QueryClientProvider` fiber), and tag each fetch started during a query run with its key.

- **Built:** model version 2 (version 1 files still load): site `queryKey` (segments `static` / `param` / `object` / `rest`), `AppModel.queryLinks` (kinds `invalidate`, `refetch`, `reset`, `remove`, `set-data`, `hydrate`, with `fromSiteIds` and `targetSiteIds`), flow step `query-update`, capture `query: { kind, key }` and match signal `query-key`. Key helpers in `packages/shared/src/query-keys.ts`. Scanner: values are followed through constants, object properties, index access, project functions' returns and `*Options()` helpers (`#evaluate` in `requests.ts`); `queryClient` methods are found by the receiver's `QueryClient` type. A key segment the scanner cannot resolve (`...extra`) is never counted as hit. Hydration needs a `HydrationBoundary` / `Hydrate` in the prefetching component's subtree and links to client queries rendered below it.
- **Runtime as built:** instead of subscribing to cache events (they fire after the query function has already sent its request), the runtime patches the `Query` / `Mutation` prototypes through `QueryCache.build` / `MutationCache.build` and wraps each query and mutation function, so a request sent while one runs synchronously is tagged (`packages/runtime/src/query.ts`). The client is looked up from React's root fiber every 300 ms and on each request until found. The request that finds it is tagged with the only query that is fetching, if there is exactly one. A request sent after an `await` inside a query function is not tagged.
- **Matching:** a capture whose key fits the site's key gets +45 (+10 for keys with no fixed part), a different key −30, a query capture on a non-query site −10, query vs mutation −15. Hover, focus and similar events, which the runtime does not record as interactions, no longer lose points for having none.
- **Tests:** `packages/scanner/test/react-query.test.ts` (in-memory edge cases), fixtures `react-query` (v5, extended with `/users`) and `react-query-v4`, `packages/runtime/test/query.test.ts` (real `@tanstack/query-core` v4 and v5), and re-recorded captures for both fixtures in the matching test: 28 captures, 26 matched to the right site. The other 2 are refetches of one cache entry that two sites share, and stay ambiguous.

**M14 — Middleware:**

- Scan `middleware.ts` (Next ≤15) and `proxy.ts` (Next 16) in the root or `src/`.
- `config.matcher` (strings, regex-like paths, `has` / `missing` objects) is matched against the route tree; each page shows the middleware that runs on it.
- `NextResponse.redirect(...)` → navigation edges (kind `redirect`, with the condition text). `NextResponse.rewrite(...)` → a rewrite map used when resolving captured URLs to routes.
- Fetch calls inside → sites with trigger `middleware`. Captures come from the existing edge-runtime `fetch` patch (best effort, documented).

- **Built** (model version 3; version 1 and 2 files still load):
  - **Model** (`packages/shared`): `AppModel.middleware` (file, `convention` `middleware` | `proxy`, export name, package `factory`, `matchers` with `has` / `missing`, `matcherText` when the matcher can't be read, `routes` it runs on with `conditional`, `rewrites`, next-intl `i18n` locales). Site origin and trigger `middleware`. Navigation origin `middleware` with `condition`, `from` (the path check) and `sourceRouteIds`. Match signal `middleware`. `middleware.ts` (shared) compiles matcher sources with the same grammar and defaults as path-to-regexp v6 (tested against Next's bundled copy) and has `middlewareRunsOn()` and `servedPaths()` (rewrite targets and the next-intl default-locale path first, then the path itself).
  - **Scanner** (`packages/scanner/src/middleware.ts`, `requests.ts`): the file is found next to the app directory or in the root (`proxy` before `middleware`), added to the project, and adding or removing it restarts the scan session. The exported function (default, `proxy` or `middleware`) is walked as origin `middleware`; a factory call (`createMiddleware(routing)`, `auth(handler)`) is recorded and its function arguments walked. `config.matcher` is read as a static literal through constants and `as const`. Routes are matched with sample paths (`x` for dynamic segments, then words from the matchers and the locales: a hit only then is `conditional`). `NextResponse.redirect()` / `Response.redirect()` (301/308 → `permanent-redirect`) and `NextResponse.rewrite()` are found on the walk, also inside helpers. Their URL comes from `new URL('/x', request.url)`, a string, or a cloned `nextUrl` with `url.pathname = '/x'`. The `if` / `?:` branches and earlier `if (...) return` guards around them are split: pure path checks (`pathname === '/x'`, `pathname.startsWith('/x')`) give `from` (and exclusions) for `sourceRouteIds`; the rest is the `condition` text. Links to a rewritten path resolve to the page that answers it. `new URL(path, base)` now resolves in any URL.
  - **Runtime:** Next 16 `proxy.ts` runs on Node.js, so the server runtime already captures its fetches with the incoming request as `parent`. For the edge runtime, `packages/runtime/src/edge.ts` patches `fetch` with web APIs only and sends each capture when it finishes (no timers). The env variables are written out (`process.env.FLOW_CHECKER_RUNTIME`) because Next only gives edge code the variables it sees. No incoming-request context on the edge.
  - **Server:** a capture is "from middleware" when a source-mapped frame is in the middleware file or Next's `server/web/adapter` is on the stack. Middleware sites are hard-filtered by the matcher (unless the stack says middleware) and get `middleware` evidence (+20 runs on the path, +10 conditional, +30 stack); other sites get −30 for a capture from middleware. Route evidence, route handler checks and flow recording resolve page URLs through `servedPaths()`.
  - **Dashboard / export:** a Middleware section on page and route handler views (runs here / may run, matcher, redirects with conditions, rewrites to this route, its requests); middleware redirects are edges on the route map (from `sourceRouteIds`); a scan note when the matcher can't be read. Markdown: `middleware.md` (matcher, routes, redirects, rewrites, requests), a section on each affected page, a README line.
  - **CLI:** `init` writes the edge branch into `register()` (and prints it for v0.1 hooks when the middleware runs on the edge); `doctor` has a Middleware check (Node.js vs edge, the edge hook, `proxy.ts` before Next 16).
  - **Check:** fixture `middleware` (Next 16 root `proxy.ts`) with snapshots, recordings (8 captures, all matched) and goldens; `packages/scanner/test/middleware.test.ts` (Next 15 `src/middleware.ts`, matcher forms, factories, helpers, cloned URLs, rewrites, re-scans); `packages/shared/test/middleware.test.ts` (matcher vs path-to-regexp v6, `servedPaths`, v2 models); `packages/server/test/middleware.test.ts`; `packages/runtime/test/edge.test.ts`; `e2e/middleware.spec.ts`; and `scripts/next-matrix.mjs` now adds a middleware file to each app (`middleware.ts` before 16, `proxy.ts` on 16) and checks the scan (matcher, redirect, fetch) and that its fetch is captured and matched: passes on 13.4, 14.2, 15.2, 15.5 and 16.

**M15 — Postman collection import:**

- Sources: v2.1 JSON export, the git-native v3 YAML folder (`postman/collections/`), and a cloud collection by ID (Postman API key from an env var, never stored). Environments are imported the same way for `{{variables}}`.
- Command `flow-checker postman import` (also re-read on `dev` start when configured). The imported collection is cached in `.flow-checker/postman/`.
- **Contract check:** each request site is matched to a collection request by method + URL pattern (`{{baseUrl}}/users/:id` ≈ `/users/${id}`). New flags: `not-in-collection` (site with no collection request) and `unused-endpoint` (collection request no site calls, shown in an overview list).
- **Types:** saved response examples are turned into TypeShapes. They fill types only where the code has none (`unknown-response`), and are marked as source `postman`. When both exist, a mismatch between them is flagged.
- **URLs:** collection URLs and environment values resolve dynamic URLs the scanner left as `unknown` (matched by the call's code path and method), with confidence `postman`.
- GraphQL bodies in collections are recognized after M17.

- **Built** (model version 4; version 1–3 files still load):
  - **Model** (`packages/shared`): `AppModel.postman` (collection and environment with their source `file` / `folder` / `cloud`, `importedAt`, and each collection request with `folder`, `method`, the resolved `url`, `unresolved` variables, `responseType` / `bodyType` from examples, `examples`, `siteIds` and `flags`), site `contract` (`requestId`, `name`, `by: url | code`), URL confidence `postman`, `TypeRef.source: 'postman'`, flags `not-in-collection`, `contract-mismatch`, `unused-endpoint`, id prefix `pmr`. Config `postman: { collection, environment }` (path or `{ id, apiKeyEnv }`).
  - **Import** (new package `packages/postman`, `yaml` dependency): v2.1 / v2.0 JSON (also the cloud API's `{ collection }`), v3 YAML folders (`.resources/definition.yaml` names, order and folder variables, `*.request.yaml`, examples under `.resources/<name>.resources/examples/`), environments as JSON or YAML, and the cloud API (`api.getpostman.com/collections|environments/<id>`, `X-Api-Key` from the env variable). Normalized to `.flow-checker/postman/collection.json` (gitignored): no headers, auth or scripts; bodies redacted with the capture rules (`redactedPaths` kept so masked values still type-check); only variables a URL uses, never `secret` ones or names the rules mask. Local sources are read on every scan, cloud ones on `dev` start and `postman import`, else from the cache; a failed read falls back to the cache with a warning.
  - **Apply** (`applyPostman`, pure): variables resolve environment over folder over collection; numeric / UUID segments in collection URLs count as parameters. Matching compares paths from the end (a side with an unknown base may leave out leading segments like `/v1`), needs the same method, and rules out a different known origin unless the site's base is an env fallback; ties go to the first request in the collection. `localhost:<app port>` counts as the app's own origin. `not-in-collection` only for sites whose origin fits some collection request. An `unknown` URL is filled (`by: 'code'`) when the literal path parts in its text are all in one request's path and the function names on the call path (split into singular words, generic ones dropped) point to that request alone. Missing or `any` / `unknown` types are filled from 2xx JSON examples (merged: missing properties optional, mixed values a union); declared types are checked against the examples with `checkValue` (`contract-mismatch`). Captures then type-check against example types like declared ones.
  - **CLI:** `flow-checker postman import [--collection] [--environment] [--api-key-env]` imports, scans and prints a summary with unused endpoints and flagged sites. `scan`, `dev` (and its full re-scans from the dashboard, which re-read local files) and `export` apply the collection in the scan runner (`ScanOptions.postman`, worker message `postman`); `export` doesn't write the cache. `doctor` has a read-only Postman check (API key variable for cloud sources). `.flow-checker/postman/` is added to `.gitignore`. Editing the collection while `dev` runs needs a full re-scan from the dashboard (the watcher only watches source files).
  - **Dashboard / export:** a Postman section on the overview (source, counts, sites not in the collection, contract mismatches, unused endpoints), a Postman row and "from Postman example" type badges on request views; Markdown `postman.md`, a README section and a Postman row per request.
  - **Check:** fixture `postman` (v3 folder + the same collection as v2.1 JSON) with scanner snapshot, recordings (14 captures, all matched, including the URL only the collection resolves) and export goldens; `packages/postman/test` (both formats give the same import, redaction, folder variables, cloud with a fake API, cache fallback, matching edge cases, example types, runtime type check against them); `packages/flow-checker/test/postman.test.ts` (import command, scans with and without config, broken source, dev re-scan, doctor).

**M16 — tRPC:**

- Client: `trpc.a.b.useQuery()` / `useSuspenseQuery()` / `useInfiniteQuery()` / `useMutation()` / `useSubscription()`, vanilla `client.a.b.query()` / `mutate()`, and v11 `trpc.a.b.queryOptions()` / `mutationOptions()` with React Query. The proxy is found from `createTRPCReact` / `createTRPCProxyClient` / `createTRPCClient` / `createTRPCContext`.
- Server: the router (`router({...})`, `t.router`, merged routers) is read into a procedure list with input (zod) and output types, and linked to the route handler that serves it (`fetchRequestHandler`).
- Runtime: `/api/trpc/a.b,c.d?batch=1&input=...` and batched POST bodies are split into one capture per procedure. Streaming (`httpBatchStreamLink`) is supported.

- **Built** (model version 5; version 1–4 files still load):
  - **Model** (`packages/shared`): site transport `trpc` and `procedure: { path, type }` (also on requests a procedure's resolver sends, origin `route-handler`), `QueryLink.procedure` (path prefix; empty = every procedure), `AppModel.trpc` (`endpoint`, `routeId` of the handler, root `router` name and loc, `procedures` with `inputType` / `outputType` / `siteIds`), capture `procedure: { path, type, batch?: { id, index, size } }`, match signal `trpc-procedure`, id prefix `trp`. `queryLinkTarget()` renders a link's key or procedure everywhere.
  - **Scanner** (`packages/scanner/src/trpc.ts`, `requests.ts`, `scan.ts`): before components are walked, the endpoint and router come from the route handler's `fetchRequestHandler({ endpoint, router })`, else from the clients (`createTRPCReact<AppRouter>()` → `typeof appRouter`, the `httpBatchLink({ url })` path, then the handler route without its dynamic segment). Routers are read by syntax: `router()` / `t.router` / `createTRPCRouter` (any callee or alias ending in `router`), `mergeRouters` (procedures keep their own paths), v11 plain objects, shorthand and spread entries. Procedure chains are followed through constants (`userProcedure = publicProcedure.use(...)`); input = a single `.input()` zod schema (`z.input`), else the resolver's `input` type; output = the `.output()` schema, else the resolver's return type. Client proxies are found by following the call chain's root to `createTRPCReact` / `createTRPCNext` (hooks), `createTRPCProxyClient` / `createTRPCClient` (vanilla), `useTRPC()` / `useTRPCClient()` from `createTRPCContext()`, `createTRPCOptionsProxy({ client })` (options; with `router` it calls the router directly and is skipped), `trpc.useUtils()` / `useContext()` (utils). v11 `queryOptions()` is handled where a React Query hook (or `queryClient` method) uses it, also spread into an object or in `useQueries`; mutation callbacks in `mutationOptions({...})` or next to the spread are walked like React Query's. `utils.x.invalidate()` / `refetch` / `reset` / `setData` and `queryClient.*Queries(trpc.x.pathFilter())` or `{ queryKey: trpc.x.queryKey() }` become query links that hit tRPC query sites by path prefix. Each resolver is walked as origin `route-handler` of the tRPC handler (GET for queries, POST for mutations) with its procedure, and a client site's `chain` only takes its own procedure's requests. Type arguments of `@trpc/*` factories (`createTRPCClient<AppRouter>()`) don't count as types a component uses.
  - **Runtime** (`packages/runtime/src/trpc.ts`): `splitTrpcCapture()` runs before redaction in the browser and server runtimes, and again on ingest with the scanned endpoint. A URL counts as tRPC when its last segment is a list of procedure paths and the endpoint has a `trpc` segment, is the scanned endpoint, or the request has a `trpc-accept` / `x-trpc-source` header. Inputs come from `?input=` (GET) or the body (POST), keyed by index with `batch=1`; results from a JSON array, an object keyed by index (v10 stream) or v11 JSON Lines (a head plus promise chunks, decoded by `decodeJsonLines()`). Each piece gets the single-procedure URL, its input as the request body, its result data or error as the response (status from `error.data.httpStatus`, 207 → 200), superjson `{ json, meta }` unwrapped, id `<id>-<i>` when the batch has more than one call, and the React Query key only if it is that procedure's. `readStream()` now keeps what arrived when the read is interrupted (tRPC's stream link aborts the fetch once every result is in), marked truncated; complete JSON Lines still decode.
  - **Server:** the matcher adds `trpc-procedure` evidence (+20 same procedure; another procedure is ruled out; −20 for a tRPC capture on a non-tRPC site). For server hops made while a tRPC request ran, resolver sites must belong to one of its procedures (+30 alone, +15 in a batch). `Matcher.matchWithParents()` tries each piece of a split batch as the hop's parent and keeps the best; the verifier uses it, re-matches the batch's hops when a piece arrives, and `children()` of a piece lists only its own procedure's hops.
  - **Dashboard / export:** a tRPC section on the overview (endpoint, router, procedures with input/output types and callers), a tRPC / "In procedure" row on requests, the procedure and batch position on captures; `trpc.md` (procedures, callers, what each sends, unused procedures), a README section and a row per request in the Markdown export.
  - **Check:** fixtures `trpc-v10` (tRPC 10.45 + React Query v4) and `trpc` (tRPC 11.22 + TanStack integration, `httpBatchStreamLink`), each with scanner snapshots, recordings (19 and 17 captures, all matched to the right site, including batched pieces and the upstream requests inside procedures; every type check `ok`) and export goldens. `packages/runtime/test/trpc.test.ts` splits responses from the real v10 and v11 servers (batches, streams, errors, httpLink, superjson, interrupted streams); `packages/scanner/test/trpc.test.ts` (router from the client type, endpoint from the link, `useQueries`, utils, server-side proxy, link prefixes); `packages/server/test/trpc.test.ts` (an unsplit batch at ingest, hops arriving first, `children()`); `e2e/trpc.spec.ts`.
  - **Not covered:** `createCaller` and server-side options proxies (no HTTP request), subscription streams (M18 / M19), Pages Router adapters (`createNextApiHandler`), routers built at runtime.

**M17 — GraphQL:**

- Documents: `gql` / `graphql` tags, codegen `graphql()` (client preset), imported `.graphql` files, and Relay `graphql` tags.
- Calls: Apollo `useQuery`, `useLazyQuery`, `useMutation`, `useSubscription`, `useSuspenseQuery`, `useBackgroundQuery`, `client.query` / `mutate` / `subscribe`; urql `useQuery`, `useMutation`, `useSubscription`, `client.query` / `mutation`; Relay `useLazyLoadQuery`, `usePreloadedQuery`, `useQueryLoader`, `useMutation`, `commitMutation`, `useSubscription`. `useFragment` is recorded as a data dependency of the component.
- Types, in order: codegen `TypedDocumentNode` / Relay generated `$data` / `$variables`, then a local schema file, then **live introspection** of an endpoint (URL + headers from env vars, dev only, cached in `.flow-checker/cache/`).
- Runtime: read `operationName`, query and variables from the body (and GET params), split batched arrays, recognize persisted queries by hash (mapped to documents when a manifest exists). Subscriptions over WS are handled after M19.

- **Built** (model version 6; version 1–5 files still load):
  - **Model** (`packages/shared`): site transport `graphql` and `operation: { id, name, type }` (`bodyType` = variables, `responseType` = `data`), `QueryLink.operation` (Apollo refetch by name), `AppModel.graphql` (`endpoint`, `routeId`, `clients` with `library`, `endpoint`, `batching`, `persisted`, `getForQueries`, `schema` source / path / url / types / error, persisted query `manifest`, `operations` with `source` `tag | codegen | generated | file`, printed `document`, `fragments`, `hashes`, `variablesType`, `resultType`, `typesFrom` `code | codegen | relay | schema | introspection`, schema `errors`, `siteIds`, and `fragments` with the `componentIds` that read them), capture `operation: { name?, type?, hash?, persisted?, batch? }`, match signal `graphql-operation`, id prefixes `gqo` / `gqf`, config `graphql: { schema, introspection: { url, headers }, persistedQueries, endpoint }`, `PostmanRequest.operation`. `graphql-js` 16 is a dependency of the scanner and the published package (not the runtime).
  - **Scanner** (`graphql.ts`, `graphql-schema.ts`, `graphql-types.ts`, `graphql-setup.ts`, `requests.ts`): before the walk, every scanned file with `gql` / `graphql` in it is swept for tagged templates and codegen `graphql('...')` calls; documents are parsed with graphql-js, and fragments are global by name (so `${FRAGMENT}` interpolations aren't followed). Values at calls are followed through parameters, constants, imports, `.graphql` file imports (read from disk; named imports pick the operation) and codegen's generated JSON-AST constants. Calls are recognized by module + name (Apollo `@apollo/client[/react]` and the Next.js integration, urql, Relay) and client methods by the receiver's type (`ApolloClient`, urql `Client`) or where it comes from (`useApolloClient()`, `useClient()`, `getClient()` from `registerApolloClient`). Tuple hooks (`useLazyQuery`, `useMutation`, `useQueryLoader`, urql `useMutation`) take their trigger from where the returned function is called; `onCompleted` / `onError` (hook options or the call's) are walked as success / error; `refetchQueries` (names or `{ query }`) and `client.refetchQueries({ include })` become `refetch` links. `useFragment` records the component; `usePreloadedQuery` is not a site. Types per operation: the document's `__apiType` (codegen `TypedDocumentNode`, only when its data type isn't `any`), the Relay artifact's `<Name>$data` / `$variables` (found in `artifactDirectory` or `__generated__` next to the source), the first call's type arguments, then the schema (selection walk: nullability, lists, enums as literal unions, abstract types as a union per possible type, `@include` / `@skip` optional, variables from their definitions; named `<Name>Query` / `<Name>QueryVariables`). Fragment masking is undone: codegen's `' $fragmentRefs'` and Relay's `" $fragmentSpreads"` are replaced by the fragments' fields (deep merge). Clients come from `new ApolloClient()` (its link followed through constants: `HttpLink`, `BatchHttpLink`, persisted query link, `useGETForQueries`), urql `createClient()` / `new Client()` (GET queries unless `preferGetMethod: false`) and Relay `Network.create()` (the fetch URL inside). Hashes: sha256 of the printed document with its fragments, with and without Apollo's added `__typename`, plus manifest ids by operation name.
  - **Runtime** (`packages/runtime/src/graphql.ts`, no GraphQL parser): `splitGraphqlCapture()` after the tRPC split, before redaction, in the browser and server runtimes and again on ingest. A POST body (or `application/graphql` text) with a `query`, APQ `extensions.persistedQuery.sha256Hash`, `doc_id` / `documentId` / `queryId`, or a bare `{ id, variables }`; arrays are split into `<id>-<i>` pieces with their own result. GET queries move their payload into the request body (redacted and type-checked there) and keep only the path. Names come from `operationName`, else a light scan of the query text (comments and strings dropped).
  - **Server:** GraphQL sites skip the method filter (GET/POST and retries); the operation decides: a different name or type rules the site out, the same name (or a persisted id the operation has) gives +40; a hash-only capture whose id belongs to another operation is ruled out; a capture without an operation on a GraphQL site, or a GraphQL capture on another site, −20. The verifier names hash-only captures from the scanned hashes before matching. Fingerprints include the operation. Type checks read `variables` and `data`, skip responses with errors and no data, and allow `__typename` (and `id` for Relay sites) as extra fields.
  - **Dashboard / export / CLI:** `GraphQL` overview section (endpoint, clients with features, schema, manifest, operations with types, schema errors and callers, fragments with components), GraphQL rows on requests and captures; `graphql.md`, a README section and a row per request in the Markdown export. `scan`, `dev` (on start) fetch live introspection when configured (`env:NAME` headers), cache it in `.flow-checker/cache/graphql-introspection.json` and fall back to it; `export` reads the cache only. `doctor` has a GraphQL check. Postman: GraphQL-mode bodies, v3 `graphql-request` files and raw JSON bodies with a `query` give the request an operation; sites and requests are paired by operation (not method), and example types are the `data`.
  - **Check:** fixtures `graphql-apollo` (Apollo 4.3 + codegen client preset, `BatchHttpLink`, `useSuspenseQuery`, `useLazyQuery`, `useFragment`, `refetchQueries`, `client.query()`), `graphql-apollo-v3` (Apollo 3.14, `gql` tags with fragment interpolation, hand-written types, APQ), `graphql-urql` (urql 5, GET queries, types from `schema.graphql` only) and `graphql-relay` (Relay 21 compiler with SWC transform under Turbopack, `useQueryLoader`, `commitMutation`, `fetchQuery`, persisted documents sent as `{ doc_id }` only), each serving the same schema from an in-app route handler (batching, GET, APQ, doc ids). Scanner snapshots; recordings (9, 14, 7 and 5 captures, all matched to the right site, every type check `ok`); export goldens. `packages/scanner/test/graphql.test.ts` (in-memory: `.graphql` imports, codegen masking, Relay masking, unions from the schema, manifests, refetch links, callbacks), `packages/runtime/test/graphql.test.ts`, `packages/postman/test/graphql.test.ts`, `packages/flow-checker/test/graphql.test.ts` (introspection against a local server, cache fallback, doctor), `e2e/graphql.spec.ts`.
  - **Not covered:** subscriptions over WebSockets (M19), operations sent through a hand-written `fetch` (plain requests), server resolvers linked to operations, Apollo `useReadQuery` / `PreloadQuery` as separate sites, introspection retried once the app's own endpoint is up on the first `dev` start (use a schema file or run `scan` once).

**M18 — SSE / M19 — WebSockets:**

- Browser runtime patches `EventSource` and `WebSocket`; socket.io-client is recognized through its WS frames (engine.io packet parsing for event names). Streamed `fetch` responses with `text/event-stream` are read through a tee.
- Message bodies are **stored, redacted and capped**: new options `capture.maxMessages` (per connection) and `capture.maxMessageBytes` (per message). Over the limit, only metadata is kept and the connection is marked `truncated`.
- Each event / message name gets its own expected type when the code declares one (`onmessage` handler annotations, socket.io typed events), and captured messages are type-checked against it.

**New config options:**

```ts
graphql: {
  schema: 'schema.graphql',                      // optional local schema
  introspection: { url: 'http://localhost:4000/graphql', headers: { Authorization: 'env:GQL_TOKEN' } }, // optional, dev only
},
postman: {
  collection: 'postman/collections/my-api',    // v2.1 JSON file, v3 YAML folder, or { id, apiKeyEnv: 'POSTMAN_API_KEY' }
  environment: 'postman/environments/dev.yaml',  // optional
},
capture: { maxMessages: 200, maxMessageBytes: 64_000 },
```

### M11 notes

- **Docs:** user README in `packages/flow-checker/README.md` (shown on npm), `docs/config.md`, `CHANGELOG.md`, MIT `LICENSE`.
- **Next.js matrix:** `scripts/next-matrix.mjs` creates a small app per version (13.4.19, 14.2.35, 15.2.9, 15.5.28, 16.4.3), installs the packed package, runs `init` (+ `withFlowChecker()` before 15.3), `doctor`, `scan`, then `dev` with Chromium: a page-load server fetch, a click-triggered browser fetch and the route handler's upstream fetch must be captured, matched, and linked as a two-hop chain. CI runs every version on Linux, and 13.4 and 16 also on Windows and macOS. Next 13.4–13.5 dev-server IPC to its render workers (`/?key=…&method=…`) is ignored by default.
- **OS:** lint/typecheck/test/build/package checks and the Playwright e2e suite run on Linux, Windows and macOS in CI.
- **Performance:** `scripts/perf/generate-app.mjs` writes a synthetic app; `scripts/perf/bench.mjs` measures it. At 200 features (1,808 files, 401 pages, 804 components, 1,000 requests): cold scan ~9–10 s, re-scan after an edit ~3.4 s, and the slowest dashboard API answer during re-scans fell from ~4,000 ms (main thread) to ~170 ms (worker). CI fails above 25 s / 8 s / 1 s. Profiling shows the time spread over import resolution (~4 s cold) and symbol/type lookups, with no single hot spot; per-file caching and lazy type resolution remain options for later.
- **Published:** v0.1.0 is on npm as `@integr8-media/flow-checker` and was tested by hand after release (2026-10-30).
- **Release:** `.github/workflows/release.yml` publishes on a `v*` tag that matches the package version, after every check, with `pnpm publish --provenance` (needs `NPM_TOKEN` or npm trusted publishing, and an `npm` environment). `verify:package` also checks `./next` from ESM, CommonJS and TypeScript.

Suggested order for early value: M0 → M1 → M2 → M4 (usable as a static map) → M3 → M5 → M6 → M7 → M8 → M9 → M10 → M11. For v0.2.0: M12 → M13 → M14 → M15 → M16 → M17 → M18 → M19 → M20.

## 15. Risks and mitigations

| Risk                                                                                                                                | Mitigation                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Attributing a request to the right component.** Async stacks lose frames, and React Query calls `queryFn` far from the component. | Combine signals: source-mapped stack frames + query key → `useQuery` site + interaction target fiber + route. Manual assignment as a fallback, remembered in `overrides.json`.        |
| **Dynamic URLs and heavy abstraction** (generated clients, OpenAPI codegen, GraphQL).                                               | URL patterns with confidence levels, `apiClients` hints in config, and runtime captures filling the gaps. GraphQL is out of scope for v1 (operation name as the key, planned for v2). |
| **ts-morph is slow on big repos.**                                                                                                  | Scan cache keyed by file hash, lazy type resolution (resolve only when viewed or exported), worker thread.                                                                            |
| **Next.js internals change** (fetch patch, manifest paths, instrumentation APIs, Turbopack).                                        | Isolate version-specific code behind adapters, run the CI matrix on several Next versions, and have `doctor` explain what isn't supported.                                            |
| **Edge runtime / middleware**                                                                                                       | Best-effort fetch patch, documented limits.                                                                                                                                           |
| **Secrets leaking** into the repo or docs                                                                                           | Redaction ON by default, done in the runtime, plus gitignore entries, a startup warning when `storeRaw` is on, and exports that redact unless `--raw`.                                |
| **Runtime affecting the app**                                                                                                       | Dev-only, no-op without `FLOW_CHECKER=1`, never throws (all wrapped), body cloning with size limits.                                                                                  |
| **WS / SSE message volume and secrets** (v0.2.0)                                                                                    | Redaction on every message, `maxMessages` / `maxMessageBytes` caps with metadata-only fallback, captures still gitignored.                                                            |
| **GraphQL introspection** needs a running server and auth (v0.2.0)                                                                  | Last of three type sources, opt-in, headers only from env vars, result cached; clear `doctor` message when it fails.                                                                  |
| **Postman cloud API key** (v0.2.0)                                                                                                  | Read only from an env var named in config, never written to disk or logs; local files work without it.                                                                                |
| **Library API drift** (React Query v4/v5, tRPC v10/v11, Apollo 3/4)                                                                 | One fixture per supported major version, run in CI.                                                                                                                                   |

## 16. Out of scope for v1

- Pages Router (`pages/`).
- ~~GraphQL operation-level analysis, WebSockets and SSE streams~~ → planned for v0.2.0 (M17–M19).
- OpenAPI and Postman **export**. These are easy to add later from the same model. (Postman collection **import** is planned for v0.2.0, M15.)
- Live iframe preview with element highlighting.
