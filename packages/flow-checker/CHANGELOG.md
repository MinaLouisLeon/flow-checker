# Changelog

## Unreleased

- **Progress output for every command.** `dev`, `scan`, `export`, `init` and `doctor` no longer look stuck on large projects: in a terminal a live line shows a spinner, a progress bar for the whole command, the current step with its count and time, and each scan phase leaves a `✓` line (files loaded, routes, components, requests, flows). `dev` also shows starting the dashboard and waiting for your app's port until it is ready, and re-scans show a short progress line. `doctor` prints each check as it runs. Plain lines in CI and piped output.
- **`--verbose`** prints the resolved config and where the scan runs; **`-q, --quiet`** turns progress output off.
- `scan` and `export` scan in a worker thread, like `dev`.

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
