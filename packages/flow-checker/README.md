# flow-checker

Maps a Next.js **App Router** project (its pages, components, requests, types and user flows), checks that map against real traffic while you use the app, and exports it as documentation.

```bash
npm install -D @integr8-media/flow-checker
npx flow-checker init     # adds two capture hooks and a config file
npx flow-checker          # scans, opens the dashboard and starts your app with capture on
```

Then use your app as usual. Each request the app sends shows up in the dashboard, linked to the line of code that sent it.

## What it does

- **Scans the code.** Routes (groups, dynamic, catch-all, parallel and intercepting segments, next-intl `[locale]`), the component tree with server/client boundaries, and every request: `fetch`, axios, your own wrapper clients (and any HTTP library or API client package you list in `apiClients`), React Query, SWR, Server Actions and route handlers (including the second hop to your backend). It also finds navigation between pages (`Link`, `router.push`, `redirect`) and infers user flows such as _login → verify OTP → dashboard_. Middleware (`middleware.ts`, or `proxy.ts` on Next.js 16) is read too: which routes its `config.matcher` selects, its redirects (with the condition around each one), its rewrites (used to tell which page answered a URL) and the requests it sends. Types of request bodies, responses and props are fully resolved by the TypeScript compiler.
- **Captures real traffic** while you test, in the browser and on the server, with passwords, tokens and auth headers **masked before anything is saved**.
- **Verifies the map.** Each capture is matched to the request site that sent it, which marks that site `✓ verified`. The captured data is compared with the declared types (missing fields, extra fields, wrong types, unexpected `null`), and flows are confirmed when you walk them.
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
flow-checker scan       # scan only, write .flow-checker/model.json
flow-checker init       # add the capture hooks, a config file and .gitignore entries
flow-checker export     # Markdown docs and/or a static HTML site
flow-checker doctor     # check Node, Next.js, hooks, tsconfig, ports and .gitignore
```

| Option                                       | Commands                  | Meaning                                                                                       |
| -------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `--root <dir>`                               | all                       | Project root (default: current directory)                                                     |
| `--app-dir <dir>`                            | all                       | App Router directory (default: `src/app` or `app`)                                            |
| `--config <file>`                            | dev, scan, export, doctor | Config file (default: `flow-checker.config.*` in the root)                                    |
| `--port <n>`                                 | dev, doctor               | Dashboard port (default 4400)                                                                 |
| `--app-port <n>`                             | dev, doctor               | Port your app runs on (default 3000)                                                          |
| `--dev-command <cmd>`                        | dev                       | Command that starts your app (default: the `dev` script, or `next dev`)                       |
| `--no-app`                                   | dev                       | Don't start the app. Start it yourself with the environment `dev` prints.                     |
| `--no-open`                                  | dev                       | Don't open the browser                                                                        |
| `--no-watch`                                 | dev                       | Don't re-scan when files change                                                               |
| `-y, --yes`                                  | init                      | Apply the changes without asking                                                              |
| `--tree`, `--types`, `--requests`, `--flows` | scan                      | Also print the route/component trees, resolved types, request sites or flows                  |
| `--md <dir>`, `--html <dir>`                 | export                    | Write Markdown docs / the static site to this folder. Neither: both, to the config's folders. |
| `--raw`                                      | export                    | Keep captures as saved, without redacting them again                                          |
| `--force`                                    | export                    | Write into a folder that has other files                                                      |
| `--verbose`                                  | all                       | Also print the resolved config, where the scan runs and other details                         |
| `-q, --quiet`                                | all                       | No progress output: only results, warnings and errors                                         |

Every command shows its progress on stderr. In a terminal, a live line shows a spinner, a bar for the whole command, the current step and its time, and each finished step leaves a `✓` line with what it found:

```text
✓ Loaded: 1,806 files (3.8 s)
✓ Routes: 401 pages, 200 route handlers (0.2 s)
⠸ [█████████░░░░░░░░░░░]  47%  Walking components… route 300/601  1.3 s
```

In CI, when output is piped, or with `NO_COLOR` / `TERM=dumb`, only the `✓` lines are printed, as plain text.

## Setup in detail

`flow-checker init` shows what it will change and asks first:

- `instrumentation-client.ts` (browser hook) and `instrumentation.ts` (server hook), next to your `app` directory (in `src/` when you use `src/app`). If `instrumentation.ts` already exports `register()`, it prints the lines to add instead of editing it. The server hook also registers a small edge runtime, so requests sent from middleware on the edge runtime (`middleware.ts` before Next.js 16) are captured too; hooks written by 0.1 can get it from `init` or `doctor`.
- `flow-checker.config.ts`.
- `.gitignore` entries for captured data.

Both hooks are **no-ops unless the app was started by flow-checker** (`FLOW_CHECKER=1`), and the browser runtime is never active in production builds, so it is safe to commit them.

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
})
```

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
└─ cache/              ingest token, code hashes (gitignored)
```

## Limits

- App Router only. GraphQL, WebSockets and SSE streams are captured as plain requests only.
- Edge runtime (middleware before Next.js 16): capture is best effort, `fetch` only and without the incoming request. Middleware on Node.js (`proxy.ts`, or `runtime: 'nodejs'`) is captured like the rest of the server.
- Middleware `config.matcher` must be written out in the file (as Next.js requires); routes are matched with sample values for dynamic segments, and redirects or rewrites to URLs built at runtime are shown as written.
- Next.js before 15.3: browser capture needs webpack (no Turbopack) and `withFlowChecker()`.
- Large repositories: the first scan of a ~1,800-file app takes about 10 s and a re-scan after an edit a few seconds. Re-scans run in a worker thread, so the dashboard and capture stay responsive meanwhile.

## License

MIT
