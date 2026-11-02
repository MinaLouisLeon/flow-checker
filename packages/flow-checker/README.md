# flow-checker

Maps a Next.js **App Router** project (its pages, components, requests, types and user flows), checks that map against real traffic while you use the app, and exports it as documentation.

```bash
npm install -D @integr8-media/flow-checker
npx flow-checker init     # adds two capture hooks and a config file
npx flow-checker          # scans, opens the dashboard and starts your app with capture on
```

Then use your app as usual. Each request the app sends shows up in the dashboard, linked to the line of code that sent it.

## What it does

- **Scans the code.** Routes (groups, dynamic, catch-all, parallel and intercepting segments, next-intl `[locale]`), the component tree with server/client boundaries, and every request: `fetch`, axios, your own wrapper clients (and any HTTP library or API client package you list in `apiClients`), React Query, SWR, tRPC (v10 and v11: hooks, the vanilla client and v11 `queryOptions()`, typed from the router's procedures), GraphQL (Apollo Client 3 and 4, urql and Relay: operations by name, typed from codegen, the Relay compiler or your schema), server-sent events (`new EventSource()` and streamed `fetch`, with the events each listens to and their data types), WebSockets (`new WebSocket()` and socket.io, with the messages each sends and receives and their types), Server Actions and route handlers (including the second hop to your backend). It also finds navigation between pages (`Link`, `router.push`, `redirect`) and infers user flows such as _login → verify OTP → dashboard_. Middleware (`middleware.ts`, or `proxy.ts` on Next.js 16) is read too: which routes its `config.matcher` selects, its redirects (with the condition around each one), its rewrites (used to tell which page answered a URL) and the requests it sends. Types of request bodies, responses and props are fully resolved by the TypeScript compiler.
- **Captures real traffic** while you test, in the browser and on the server, with passwords, tokens and auth headers **masked before anything is saved**.
- **Verifies the map.** Each capture is matched to the request site that sent it, which marks that site `✓ verified`. The captured data is compared with the declared types (missing fields, extra fields, wrong types, unexpected `null`), and flows are confirmed when you walk them.
- **Checks the code against your Postman collection** (optional): requests the collection doesn't have, endpoints nothing calls, and types from saved examples.
- **Keeps up with your edits.** Files are watched and re-scanned incrementally. Requests whose code changed since they were captured are marked `↻ needs re-check`.
- **Exports documentation:** Markdown (with Mermaid route maps and sequence diagrams) and a static, read-only copy of the dashboard you can host anywhere.

## Requirements

|                  | Supported                                                               |
| ---------------- | ----------------------------------------------------------------------- |
| Next.js          | 13.4 and later, App Router only (the `pages/` directory is not scanned) |
| Node.js          | 22.12 or later (22.18+ to load a `flow-checker.config.ts`)              |
| OS               | Windows, macOS, Linux                                                   |
| Package managers | npm, pnpm, yarn, bun (detected from the lockfile)                       |

### Next.js before 15.3

Next.js 15.3 added the `instrumentation-client` file that loads the browser hook. On 13.4–15.2, wrap your config with `withFlowChecker()` so the same hook files work (on 13.4–14.x it also turns on `experimental.instrumentationHook` for the server hook):

```js
// next.config.mjs
import { withFlowChecker } from '@integr8-media/flow-checker/next'

export default withFlowChecker({
  // your config
})
```

```js
// next.config.js (CommonJS)
const { withFlowChecker } = require('@integr8-media/flow-checker/next')

module.exports = withFlowChecker({})
```

It changes nothing unless the app was started by flow-checker, and returns your config untouched on 15.3 and later. On these versions browser capture needs webpack: run `next dev` without `--turbo`. `flow-checker init` and `flow-checker doctor` tell you when you need this.

## Commands

```
flow-checker            # same as `dev`
flow-checker dev        # scan + watch + dashboard + start your app with capture on
flow-checker explore    # scan + watch + dashboard only: no app, no setup, project files untouched
flow-checker scan       # scan only, write .flow-checker/model.json
flow-checker scan --diff main --fail-on dynamic-url   # what the branch's changes affect; CI gate
flow-checker impact src/lib/api.ts:12   # the pages, flows and requests a change to this file affects
flow-checker summary    # print Start here: stack, areas, entry pages, main flows, backends (--json)
flow-checker explain dynamic-url   # what a status, note or badge means and what to do (no word: all)
flow-checker init       # add the capture hooks, a config file and .gitignore entries
flow-checker export     # Markdown docs and/or a static HTML site
flow-checker doctor     # check Node, Next.js, hooks, tsconfig, ports and .gitignore
flow-checker postman import   # read a Postman collection to check the code against
```

| Option                                       | Commands                       | Meaning                                                                                       |
| -------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `--root <dir>`                               | all                            | Project root (default: current directory)                                                     |
| `--app-dir <dir>`                            | all                            | App Router directory (default: `src/app` or `app`)                                            |
| `--config <file>`                            | dev, scan, export, doctor      | Config file (default: `flow-checker.config.*` in the root)                                    |
| `--port <n>`                                 | dev, explore, doctor           | Dashboard port (default 4400)                                                                 |
| `--app-port <n>`                             | dev, explore, doctor           | Port your app runs on (default 3000)                                                          |
| `--dev-command <cmd>`                        | dev                            | Command that starts your app (default: the `dev` script, or `next dev`)                       |
| `--no-app`                                   | dev                            | Don't start the app. Start it yourself with the environment `dev` prints.                     |
| `--no-open`                                  | dev, explore                   | Don't open the browser                                                                        |
| `--no-watch`                                 | dev, explore                   | Don't re-scan when files change                                                               |
| `-y, --yes`                                  | init                           | Apply the changes without asking                                                              |
| `--tree`, `--types`, `--requests`, `--flows` | scan                           | Also print the route/component trees, resolved types, request sites or flows                  |
| `--diff <ref>`                               | scan                           | Also print what the files changed since this git ref (commit, branch, tag) affect             |
| `--fail-on <kinds>`                          | scan                           | Exit 1 when a note of these kinds is open (`dynamic-url,type-mismatch`); see Impact check     |
| `--json`                                     | scan, impact, summary, explain | Print JSON instead of text, for scripts                                                       |
| `--md <dir>`, `--html <dir>`                 | export                         | Write Markdown docs / the static site to this folder. Neither: both, to the config's folders. |
| `--raw`                                      | export                         | Keep captures as saved, without redacting them again                                          |
| `--force`                                    | export                         | Write into a folder that has other files                                                      |
| `--collection <src>`                         | postman import                 | v2.1 JSON file, v3 YAML folder or cloud collection id (default: `postman.collection`)         |
| `--environment <src>`                        | postman import                 | Environment file or cloud id for `{{variables}}`                                              |
| `--api-key-env <name>`                       | postman import                 | Env variable with the Postman API key, for cloud ids (default `POSTMAN_API_KEY`)              |
| `--verbose`                                  | all                            | Also print the resolved config, where the scan runs and other details                         |
| `-q, --quiet`                                | all                            | No progress output: only results, warnings and errors                                         |

Every command shows its progress on stderr. In a terminal, a live line shows a spinner, a bar for the whole command, the current step and its time, and each finished step leaves a `✓` line with what it found:

```text
✓ Loaded: 1,806 files (3.8 s)
✓ Routes: 401 pages, 200 route handlers (0.2 s)
⠸ [█████████░░░░░░░░░░░]  47%  Walking components… route 300/601  1.3 s
```

In CI, when output is piped, or with `NO_COLOR` / `TERM=dumb`, only the `✓` lines are printed, as plain text.

### Dashboard

`flow-checker dev` serves the dashboard on port 4400. The same screens are in the static HTML export, read-only.

- **Start here** (the first screen): a short tour of the app for someone new to it. What it is built with (Next.js version, server / client components, data libraries such as React Query, SWR, tRPC, GraphQL or axios, next-intl, middleware, a Postman contract), its largest areas, the start page, the most-linked pages and the pages nothing links to, the longest flows, the backends it calls, where things live (the root layout, the files that send the most requests, route handlers, the most-used types) and the first things to check. Every item opens its screen. `flow-checker summary` prints the same in the terminal, and the Markdown export writes it to `ONBOARDING.md`.
- **Walk the app** (`#/walk`): the flows not confirmed yet as a checklist, the ones that start on an entry page first. Each step says what to do ("Submit the form in `LoginForm` on `/[locale]/login`") or what should happen next ("It sends `POST /auth/login`", "It goes to `/[locale]/verify`"). **Open in app** opens the start page in your running app, with dynamic segments (`[locale]`, `[id]`) filled in from values you type once (the next-intl default locale is suggested). Steps tick as the captures and page changes arrive, and a walked flow moves to Walked. Start here and the overview show the coverage: confirmed flows and captured requests, in percent. Without capture (`explore`) it is a reading guide and says how to turn capture on.
- **Overview** (`#/overview`): counts for pages, route handlers, components, requests, types and flows, each a link to its list, and the things to check (unresolved URLs, unknown triggers, type mismatches...), one note per request.
- **Map:** the route map (graph or tree). A page shows its component tree, the requests it sends on load and on events (apart from those its layouts send on every page), where it leads and the flows that start on it.
- **Components:** every component, searchable by name or file, filtered by kind (server / client / shared), by what it has (sends requests, things to check, not on any page) and sorted by name, requests or pages.
- **Requests:** every request site, searchable by URL, component or file, filtered by when it is sent (on load, on events, server-side, unknown trigger), status (verified, mismatch, needs re-check, not captured yet), transport and flags. The same request sent from several places is one row. A request opens on its own page with its body and response types, server hops, query-cache links, captures and the call path from the component.
- **Flows**, **Types**, **Live** (captures as they arrive, with their match and type check) and **Export**.
- **Glossary:** what each status, note (`dynamic-url`, `unknown-trigger`...), trigger, transport and badge means, and what to do about it. Hover any badge to read its line; each note on a request links to its entry. `flow-checker explain <word>` prints the same in the terminal, and the Markdown export writes it to `GLOSSARY.md`.

**Show details:** lists and the page view show only the main badge of each row (its status, or the number of notes) so they stay easy to read. Click **Show details** in the top bar to also see how each request is sent, what triggers it, `use client`, conditional and lazy renders, request counts and the other badges. The choice is remembered in your browser.

**Search everything:** press Ctrl+K (⌘K on a Mac) or `/` on any screen, or click Search in the top bar. One box finds pages, route handlers, components, requests, endpoints, types, flows and areas by name, file, URL pattern or route path; exact names come first, then names that start with what you typed, then word matches. Arrow keys move, Enter opens, Esc closes. It works in the static export too.

**Affected by changes:** when you save a file, the overview (and `#/changes`, linked from the scan time in the top bar) lists what the change touches: the pages, flows and requests to check, by area, each with why. It needs `dev` or `explore` watching files, so the static export doesn't have it.

Filters and searches stay in the URL, so a filtered list can be bookmarked or shared. Lists that grow with the app (the queries a cache call hits, a route handler's callers...) show five entries, then "+N more".

### Impact check

`flow-checker impact <file>[:line]` says what a change to a file touches before you make it: the pages, route handlers, flows and requests, grouped by area, each with the reason (`sent through src/lib/api.ts:14`, `its data type uses User`, `renders ProfileCard`). With a line, only the declaration around it counts (the function or component); several files can be given at once. It scans without writing anything.

- **Components, hooks, API clients:** what is defined in the file or sends a request through it, then the pages that render it or send the request, and the flows with those steps.
- **Types:** everything that uses them, also through other types (a props type that holds a `User`).
- **Route handlers and server actions:** the requests that call them, and their pages.
- **Layouts, `loading` / `error` files, the middleware:** every page under them or that it runs on.
- **Files with none of that** (constants, utils): the nearest files that import them and have something the scan knows.

`flow-checker scan --diff <ref>` does the same for every source file changed since a git ref (committed, staged, unstaged and new files). `--fail-on <kinds>` makes `scan` exit 1 when a request has an open note of those kinds, with `--diff` only the requests the changes affect, so a CI job can stop a branch that adds a URL the scan can't read:

```bash
npx @integr8-media/flow-checker scan --diff origin/main --fail-on dynamic-url,unknown-trigger
```

Kinds are the note names from `flow-checker explain` (`dynamic-url`, `unknown-method`, `unknown-response`, `unknown-trigger`, `runtime-url`, `type-mismatch`, `stale`, `not-in-collection`, `contract-mismatch`, `unused-endpoint`). `type-mismatch` and `stale` come from captures, so they count when `.flow-checker/` holds some. Exit codes with `--fail-on`: 0 nothing open, 1 open notes, 2 the check couldn't run (an unknown kind, a ref git doesn't know, a config or scan error). `--json` prints the scan counts, the changed files with their impact and the open notes.

### React Query

`useQuery`, `useInfiniteQuery`, the suspense hooks, `useQueries` / `useSuspenseQueries` (one request per entry), `useMutation`, `usePrefetchQuery` and `queryClient.fetchQuery` / `prefetchQuery` / `ensureQueryData` (and their infinite forms) are request sites, in v4 and v5. Each query's key is read into segments (`['todos', 'detail', :id]`), also through key factories, `queryOptions()` and functions that return options.

`invalidateQueries`, `refetchQueries`, `resetQueries`, `removeQueries` and `setQueryData` are linked to the queries their key hits (by prefix, or `exact`) and to the mutation whose callback calls them, so a flow shows which queries a mutation refreshes. A server-side `prefetchQuery` handed over with `HydrationBoundary` (v4: `Hydrate`) is linked to the client query it fills. While you test, each request a query or mutation sends carries its key, and captures are matched by it.

### Middleware

`middleware.ts` (and `proxy.ts` on Next.js 16) is read for its `config.matcher`: each page shows whether middleware runs on it. `NextResponse.redirect()` becomes an edge on the route map with the condition around it (`if !token`), `NextResponse.rewrite()` and next-intl's default locale are used to tell which page answered a captured URL, and requests the middleware sends get a `middleware` trigger. On Node.js (`proxy.ts`) those requests are captured like the rest of the server; on the edge runtime, best effort (see [limits](#limits)).

### tRPC

Procedure calls are request sites in v10 and v11: `createTRPCReact` hooks (`trpc.todo.byId.useQuery()`), the vanilla client (`client.todo.add.mutate()`), `utils` calls and v11's `useTRPC()` with `queryOptions()` / `mutationOptions()`. The router is read from the route handler's `fetchRequestHandler()` (or the client's `AppRouter` type), so each call gets its procedure's input type (from `.input()`) and output type without annotations. While you test, a batched request is split into one capture per procedure, each matched and type-checked on its own.

### Postman collections

Point flow-checker at a Postman collection (config `postman`, or `flow-checker postman import --collection <src>`) and every scan is checked against it:

- Each request in the code is matched to a collection request by method and URL (`{{baseUrl}}/users/:id` fits `` `${API}/users/${id}` ``). Requests the collection doesn't have are flagged **not in collection**; collection requests nothing calls are listed as **unused endpoints**.
- Saved response examples give a type to requests whose code has none (marked "from Postman example"), and captures are then checked against it. When the code declares a type, it is checked against the examples (**contract mismatch**).
- A URL the scan can't resolve is filled in from the collection request its function names and method point to, when exactly one fits.

`postman import` prints a summary and the list of findings; the dashboard overview and the Markdown export (`postman.md`) show them too.

### GraphQL

Apollo Client (3 and 4), urql and Relay calls are request sites, one per operation. Every operation goes to the same URL, so captures are matched by operation name, or by persisted query id. Batched requests are split into one capture per operation, and type checks compare `variables` and `data`.

Types come from type arguments at the call, codegen's typed documents or the Relay compiler first. Without those, set `graphql.schema` (or let flow-checker find `schema.graphql` / the schema in your Relay or codegen config), or `graphql.introspection` to ask a running endpoint (see [config](../../docs/config.md#graphql)). The dashboard overview lists every operation with its types and callers, and fragments with the components that read them.

### Server-sent events

`new EventSource(url)` and a `fetch` read as an event stream (`Accept: text/event-stream`, or any fetch of a route handler that answers with `text/event-stream`) are request sites. The scan lists the events each one listens to (`onmessage`, `addEventListener('tick', ...)`) with the type its data is read as (`JSON.parse(e.data) as Tick`, `const t: Tick = JSON.parse(e.data)`, `MessageEvent<Tick>`), and reads the events a route handler writes (`event: tick` / `data: ${JSON.stringify(tick)}`, also through a helper like `send('tick', tick)`). Events the code has no type for take the handler's.

While you test, each stream is captured message by message: the dashboard shows the capture as soon as it opens, then every message with its time, event name and data (redacted like bodies), and each message is checked against its event's type. `capture.maxMessages` (200) and `capture.maxMessageBytes` (64 kB) limit what is kept per connection.

### WebSockets

`new WebSocket(url)` and socket.io's `io(url)` are request sites. The scan lists the messages each one sends and receives with their types: `ws.send(JSON.stringify(subscribe))` and `JSON.parse(e.data) as Quote` for native sockets, `socket.emit('chat', draft)` and `socket.on('chat', (message) => ...)` for socket.io (typed events such as `Socket<ServerEvents, ClientEvents>` give both types).

While you test, every message in both directions is captured (redacted like bodies), with the close code; socket.io events are read from its frames by name. The dashboard shows a timeline of what was sent and received, and each message is checked against its type. `capture.maxMessages` and `capture.maxMessageBytes` limit what is kept per connection, as for event streams.

## Setup in detail

`flow-checker init` shows what it will change and asks first:

- `instrumentation-client.ts` (browser hook) and `instrumentation.ts` (server hook), next to your `app` directory (in `src/` when you use `src/app`). If `instrumentation.ts` already exports `register()`, `init` adds the flow-checker blocks as its first statements (see below). The server hook also registers a small edge runtime, so requests sent from middleware on the edge runtime (`middleware.ts` before Next.js 16) are captured too; hooks written by 0.1 can get it from `init` or `doctor`.
- `flow-checker.config.ts`.
- `.gitignore` entries for captured data.

Both hooks are **no-ops unless the app was started by flow-checker** (`FLOW_CHECKER=1`), and the browser runtime is never active in production builds, so it is safe to commit them.

### The server hook goes first in `register()`

The two flow-checker blocks must be the **first statements of `register()`**, outside any `if`, and `register` must be `async`:

```ts
// instrumentation.ts
export async function register() {
  // flow-checker: captures server-side requests while you test. It does nothing unless FLOW_CHECKER=1.
  if (process.env.FLOW_CHECKER === '1' && process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerServerRuntime } = await import('@integr8-media/flow-checker/runtime/server')
    registerServerRuntime()
  }
  // flow-checker: requests sent from middleware on the edge runtime (fetch only, best effort).
  if (process.env.FLOW_CHECKER === '1' && process.env.NEXT_RUNTIME === 'edge') {
    const { registerEdgeRuntime } = await import('@integr8-media/flow-checker/runtime/edge')
    registerEdgeRuntime(process.env.FLOW_CHECKER_RUNTIME)
  }

  // your own code
  if (process.env.NODE_ENV === 'production') {
    // ...
  }
}
```

Pasted inside an existing condition (such as a production-only `if`) or after an early `return`, they never run under `next dev`, and server-side requests are silently not captured.

- `init` edits an existing `register()` for you: it puts the blocks first, makes `register` `async` when needed and moves misplaced blocks when run again. A `register` re-exported from another file gets a note with the lines to add instead.
- `doctor` fails when a block is inside an `if`, `switch`, loop, `try`, ternary, `&&` or nested callback, comes after other code, or when `register` isn't `async`. It names the line and prints the lines to move.
- `dev` warns at start when the hook is misplaced, and once more when your app answers route handlers that send requests but no server-side request is captured within 10 s. Live shows the same warning.

`flow-checker dev` starts your dev command with `FLOW_CHECKER=1`, `PORT` and the capture settings in the environment. With `--no-app`, it prints that environment so you can start the app yourself (for example in a Docker container or a monorepo task runner).

## Configuration

Optional. Everything is auto-detected. See [docs/config.md](https://github.com/MinaLouisLeon/flow-checker/blob/main/docs/config.md) for every option.

```ts
// flow-checker.config.ts
import { defineConfig } from '@integr8-media/flow-checker/config'

export default defineConfig({
  root: '.', // project root, relative to this file
  ports: { dashboard: 4400, app: 3000 },
  // Files the scan reads and skips (globs from the root). These are the defaults.
  include: ['**'],
  exclude: ['**/*.test.*', '**/*.spec.*', '**/*.stories.*', '**/__tests__/**', '**/__mocks__/**'],
  // Packages or modules whose calls are requests: HTTP libraries and API clients the scan
  // can't look inside. Default: none.
  apiClients: [{ module: 'ky', methods: ['default', 'get', 'post'] }],
  capture: {
    storeRaw: false, // true = save captures unmasked (local debugging only)
    redact: { keys: ['iban'], headers: ['x-session'] }, // added to the defaults
    ignore: ['/api/health'],
  },
  export: { md: 'docs/flow', html: '.flow-checker/site' },
  // A Postman collection to check the code against (v2.1 JSON, v3 YAML folder or { id, apiKeyEnv }).
  postman: { collection: 'postman/collections/My API', environment: 'postman/environments/dev.yaml' },
  // GraphQL types when the code has none: a schema file, or live introspection (env:NAME headers).
  graphql: { schema: 'schema.graphql' },
})
```

Event stream and WebSocket capture keep at most `capture.maxMessages` (200) messages per connection, and messages over `capture.maxMessageBytes` (64 kB) without their data.

## Sensitive data

Redaction is **on by default** and happens in the runtime, before a capture leaves your app:

- Headers: `authorization`, `cookie`, `set-cookie`, `x-api-key`, `proxy-authorization`.
- Body keys at any depth (case-insensitive): `password`, `pass`, `token`, `accessToken`, `refreshToken`, `secret`, `otp`, `code`, `cvv`, `cardNumber`, `ssn`.
- Values that look like JWTs, bearer tokens or card numbers, and sensitive query parameters.

Masked values keep their shape (`"[REDACTED:string]"`, `0`, `false`), so type checks still work. The tool server redacts again on arrival, and exports redact again unless you pass `--raw`.

## Files

```
.flow-checker/
├─ model.json          scan result (safe to commit)
├─ overrides.json      your decisions: manual matches, flow names, recordings (safe to commit)
├─ captures/           captured requests (gitignored)
├─ sessions/           browsing sessions used to confirm flows (gitignored)
├─ cache/              ingest token, code hashes, GraphQL introspection (gitignored)
└─ postman/            the last imported Postman collection (gitignored)
```

## Limits

- App Router only.
- WebSockets: only in the browser (not sockets opened on the server). A socket created at module level (outside a component or a function it calls) isn't a request site. socket.io: messages sent over HTTP long-polling before the connection moves to a WebSocket aren't captured (use `transports: ['websocket']` to capture everything), acks aren't recorded, binary attachments keep no data, and namespaces aren't told apart when matching.
- Server-sent events: an EventSource only reports named events someone listens to, so events the app has no listener for aren't recorded. Event streams read by libraries such as `@microsoft/fetch-event-source` are captured (they use `fetch`), but their listeners aren't read by the scan. Streams on the edge runtime are captured as plain requests.
- GraphQL: subscriptions over WebSockets are captured as WebSocket messages, but aren't linked to their operations. Operations sent through your own `fetch` wrapper (not Apollo, urql or Relay) are plain requests. Server resolvers aren't linked to the operations that run them.
- Edge runtime (middleware before Next.js 16): capture is best effort, `fetch` only and without the incoming request. Middleware on Node.js (`proxy.ts`, or `runtime: 'nodejs'`) is captured like the rest of the server.
- Middleware `config.matcher` must be written out in the file (as Next.js requires); routes are matched with sample values for dynamic segments, and redirects or rewrites to URLs built at runtime are shown as written.
- tRPC: procedures called through `createCaller` or a server-side `createTRPCOptionsProxy({ router })` run without an HTTP request and are not request sites. Subscriptions are found in the code, but their streams are captured as plain requests. The router must be reachable from `fetchRequestHandler({ router })` or the client's `AppRouter` type.
- Next.js before 15.3: browser capture needs webpack (no Turbopack) and `withFlowChecker()`.
- Large repositories: the first scan of a ~1,800-file app takes about 12 s and a re-scan after an edit about 4 s. Re-scans run in a worker thread, so the dashboard and capture stay responsive meanwhile.

## License

MIT
