# Changelog

## Unreleased

- **Progress output for every command.** `dev`, `scan`, `export`, `init` and `doctor` no longer look stuck on large projects: in a terminal a live line shows a spinner, a progress bar for the whole command, the current step with its count and time, and each scan phase leaves a `✓` line (files loaded, routes, components, requests, flows). `dev` also shows starting the dashboard and waiting for your app's port until it is ready, and re-scans show a short progress line. `doctor` prints each check as it runs. Plain lines in CI and piped output.
- **`--verbose`** prints the resolved config and where the scan runs; **`-q, --quiet`** turns progress output off.
- `scan` and `export` scan in a worker thread, like `dev`.
- **React Query, in depth (v4 and v5).** Query keys are read into segments (`['todos', 'detail', :id]`) through key factories, `queryOptions()` and functions that return options. New: `useQueries` / `useSuspenseQueries` (one request per entry), `usePrefetchQuery`, `queryClient.fetchQuery` / `prefetchQuery` / `ensureQueryData` / infinite variants, and v4's positional `useQuery(key, fn)` / `useMutation(fn, options)`.
- **Query cache links.** `invalidateQueries`, `refetchQueries`, `resetQueries`, `removeQueries` and `setQueryData` are linked to the queries their key hits (by prefix or `exact`), and to the mutation whose callback calls them. A server-side `prefetchQuery` handed over with `HydrationBoundary` (or v4 `Hydrate`) is linked to the client query it fills. Shown on request and page views, in flows (as steps after the mutation), in `scan --requests` and in the Markdown export.
- **Captures know their query.** In the browser, each request sent by a React Query query or mutation carries its key (redacted like bodies), and the matcher uses it (`query key` evidence).
- **Middleware (`middleware.ts`, and `proxy.ts` on Next.js 16).** The scan reads `config.matcher` (strings, `has` / `missing` objects, constants) and works out which pages and route handlers it runs on; each page shows it in the dashboard and the Markdown export (new `middleware.md`). `NextResponse.redirect()` / `Response.redirect()` become redirect edges on the route map, with the pages they can fire on and the condition around them (`if !token`); `NextResponse.rewrite()` is recorded and used to resolve captured URLs (and links) to the page that answers them, as is the default locale of next-intl's `createMiddleware()`. Requests sent from middleware get a `middleware` trigger.
- **Middleware capture.** On Node.js (Next.js 16 `proxy.ts`) its requests are captured with the incoming request, and matched with new `middleware` evidence (its matcher and the stack). On the edge runtime (`middleware.ts` before 16) a new edge hook (`@integr8-media/flow-checker/runtime/edge`) captures `fetch`, best effort. `init` adds it; `doctor` checks it and warns about `proxy.ts` before Next.js 16.
- `new URL('/path', request.url)` resolves to `/path` in request and redirect URLs.
- `.flow-checker/model.json` is now version 3. Version 1 and 2 files still load.

## 0.1.0

First public release.

- **Scan** of Next.js App Router projects (13.4+): routes, layouts, component trees with server/client boundaries, request sites (`fetch`, axios, wrapper clients, React Query, SWR, Server Actions, route handlers with their second hop), fully resolved types, navigation and inferred user flows.
- **Dashboard** (`flow-checker`): overview with a to-do list of flags, route map (graph and tree), page and component views, flows, live captures, types index and export.
- **Capture** while you test, in the browser and on the server, redacted by default before anything is saved.
- **Verification:** captures matched to the code that sent them, type comparison of captured bodies against the declared types, and flows confirmed by walking them.
- **Watch mode:** incremental re-scans in a worker thread, with `needs re-check` on requests whose code changed.
- **Export:** Markdown docs with Mermaid diagrams, and a static read-only copy of the dashboard.
- **Config:** `root`, `appDir`, `devCommand`, `ports`, `include`/`exclude` (file globs; tests, stories and mocks skipped by default), `apiClients` (HTTP libraries and API client packages whose calls are requests), `capture`, `types.maxDepth` and `export`. `flow-checker init` writes the defaults into the new config file.
- **`flow-checker doctor`** checks Node, Next.js, hooks, tsconfig, ports and `.gitignore`.
- **`withFlowChecker()`** (`@integr8-media/flow-checker/next`) makes the capture hooks work on Next.js 13.4–15.2.
