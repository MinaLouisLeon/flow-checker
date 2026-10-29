# Changelog

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
- **`withFlowChecker()`** (`@integr8/flow-checker/next`) makes the capture hooks work on Next.js 13.4–15.2.
