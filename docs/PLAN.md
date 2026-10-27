# flow-checker — Implementation Plan

> Status: M0–M4 done on `dev` (scanner, types, read-only dashboard). M5 (runtime capture) is next. Updated: 2026-10-27.

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
 │ Tool server (Hono + WS)  │───────────┘
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
| Server        | **Hono** on Node, with `ws`                                                      | Small and fast. Serves the API, WebSocket and static dashboard.                                |
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
                 callStack: SourceLoc[], status: inferred|verified|needs-recheck|mismatch, flags: Flag[] }
TypeRef        { name, definedAt: SourceLoc, resolved: TypeShape }   // TypeShape = JSON-like IR
Flow           { id, name, steps: FlowStep[], source: inferred|recorded|both, status }
FlowStep       { order, routeId, componentId, action, requestSiteId?, onSuccess?: next, onError?: next }
Capture        { id, sessionId, timestamp, routeUrl, request{method,url,headers,body},
                 response{status,headers,body,durationMs}, origin: browser|server,
                 attribution{ stack[], componentChain[], interaction? }, matchedSiteId?, matchScore,
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

### 6.7 Incremental re-scan

- Keep a reverse dependency map (file → entities that depend on it).
- On a chokidar change: refresh that file in ts-morph, re-run the stages for the affected entities, compare old and new entities, and push the changes over WebSocket.
- If a request site's hash changed, set its status to `needs-recheck` and keep the old captures, marked stale.

## 7. Runtime capture (`packages/runtime`)

### 7.1 Injection with no manual setup

The tool runs the dev command with `FLOW_CHECKER=1` and `FLOW_CHECKER_INGEST=http://localhost:4400/ingest`.

- **Next 15.3+:** use `instrumentation-client.ts` (browser) and `instrumentation.ts` (server).
- **Next 13.4–15.2:** `instrumentation.ts` for the server (with `experimental.instrumentationHook` where needed). The browser runtime comes from a small `withFlowChecker()` wrapper in `next.config` that prepends the client entry.
- `flow-checker init` makes these one-line additions, with your confirmation. Every hook is a **no-op unless `FLOW_CHECKER=1`**, and the runtime is excluded from production builds.
- `flow-checker doctor` checks the setup.

### 7.2 Browser side

- Patch `fetch` and `XMLHttpRequest`, which covers axios, React Query and SWR. Server Action calls are recognized by the `Next-Action` header.
- For each request, record:
  - the request and response (body cloned, size-limited)
  - the timing
  - a stack trace (`new Error().stack`)
  - the **last user interaction**: event type and target element. From the element's React fiber (`__reactFiber$…`), it walks up to the component names. This works for event-driven requests even when the stack loses async frames.
  - the current URL
- It also records **navigation** events (history patch + `popstate`) and **interaction** events into a session timeline, which is used to record flows.
- Events are sent in batches over `navigator.sendBeacon` / `fetch` to the ingest endpoint, which is excluded from capture.

### 7.3 Server side (`instrumentation.ts`)

- Wrap `globalThis.fetch` after Next's own patch, and add an undici/http hook for axios on Node.
- Use `AsyncLocalStorage` (with Next's request context) to link each outgoing call to the incoming request (route handler, server action, or RSC render of route X). This is how the **BFF two-hop chain** and server component fetches get linked.
- **Server Actions:** map the action ID to its file and export using `.next/server/server-reference-manifest.json`.
- Edge runtime: best effort (`fetch` patch only). This is documented as a limit.

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
- `.flow-checker/captures/` and `sessions/` are added to `.gitignore` on first run.

## 8. Matching and verification (`packages/server`)

Captures are matched to scanned request sites with a score:

| Signal                                                                                                       | Weight    |
| ------------------------------------------------------------------------------------------------------------ | --------- |
| Stack trace frame (via dev source maps) points to the site's file and line, or to a frame in its `callStack` | very high |
| Server Action ID → manifest → the site's action                                                              | exact     |
| Method + URL matches `urlPattern`                                                                            | high      | To do   |
| Component chain from the interaction matches the site's component                                            | high      |
| Current route matches the site's route                                                                       | medium    |
| Trigger type is consistent (e.g. it happened right after a submit event)                                     | low       |
- Best score above the threshold → matched. The site becomes `verified` and the capture is attached as an example.
- Two sites with similar scores → "ambiguous" flag, and you pick the right one in the UI. Your choice is remembered.
- No match → `unmatched-capture` flag. This usually means the scanner missed something, so it's reported as a scanner gap.

**Type check:** the captured response and body are validated against the site's `TypeShape`. The results are `ok`, `missing field`, `extra field`, `wrong type`, or `null where non-null`. Any mismatch flags the site, and the UI shows the difference.

**Flow recording:** a session timeline is split into flows at the starting interaction (e.g. a submit). The ordered steps are matched to inferred flows:
- If they match, the flow becomes `both` (confirmed).
- If you took an unexpected path, it's added as a new `recorded` variant.
- Inferred branches that were never exercised stay flagged as `unconfirmed`.

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

Live updates over WebSocket. "Open in editor" links use `vscode://file/...`.

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

## 11. CLI

```
flow-checker            # = dev: scan + watch + dashboard + run app with capture, opens browser
flow-checker scan       # scan only, write model.json (CI-friendly), exit non-zero on --fail-on flags
flow-checker init       # add instrumentation hooks + config file + .gitignore entries
flow-checker export     # --md <dir> | --html <dir> [--raw]
flow-checker doctor     # check Next version, hooks, ports, tsconfig
```

Options: `--port`, `--app-port`, `--dev-command "pnpm dev"`, `--no-open`, `--config`.

Package manager (npm, pnpm, yarn or bun) is detected from the lockfile.

## 12. Config file (`flow-checker.config.ts`)

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
├─ captures/<siteId>/<captureId>.json   # gitignored by default
├─ sessions/<sessionId>.json            # gitignored by default
└─ cache/              # scan cache keyed by file hash (gitignored)
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
| M5  | **Runtime capture:** client + server runtime, `init`, ingest, **redaction**, store                                                                          | Playwright test: a click in the fixture shows a redacted capture in the dashboard | To do   |
| M6  | **Matching + verification:** scoring, flags, manual assignment, status changes                                                                              | ≥95% of fixture captures auto-matched                                             | To do   |
| M7  | **Flows:** navigation edges, inferred flows, session recording, flow merge                                                                                  | Login → OTP → dashboard flow inferred and confirmed in the fixture                | To do   |
| M8  | **Type comparison** of captures vs. types                                                                                                                   | Mismatch fixture produces the expected type-mismatch flags                        | To do   |
| M9  | **Watch + incremental re-scan**                                                                                                                             | Editing a fixture file updates the UI in under 1 s and marks `needs-recheck`      | To do   |
| M10 | **Export:** Markdown + static HTML                                                                                                                          | Export of each fixture matches the golden files                                   | To do   |
| M11 | **Public release:** README, config docs, `doctor`, Next 13.4/14/15/16 matrix, Windows/macOS/Linux, performance on a large repo, npm publish with provenance | v0.1.0 on npm                                                                     | To do   |

Suggested order for early value: M0 → M1 → M2 → M4 (usable as a static map) → M3 → M5 → M6 → M7 → M8 → M9 → M10 → M11.

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

## 16. Out of scope for v1

- Pages Router (`pages/`).
- GraphQL operation-level analysis, WebSockets and SSE streams (they're captured only as raw requests).
- OpenAPI and Postman export. These are easy to add later from the same model.
- Live iframe preview with element highlighting.
