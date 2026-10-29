# Configuration

flow-checker works without a config file: the app directory, dev command, ports and package manager are detected. Add `flow-checker.config.ts` in the project root to change them (`flow-checker init` creates one).

```ts
import { defineConfig } from '@integr8-media/flow-checker/config'

export default defineConfig({
  root: '.',
  appDir: 'src/app',
  devCommand: 'pnpm dev',
  ports: { dashboard: 4400, app: 3000 },
  include: ['**'],
  exclude: ['**/*.test.*', '**/*.spec.*', '**/*.stories.*', '**/__tests__/**', '**/__mocks__/**'],
  apiClients: [],
  capture: {
    storeRaw: false,
    redact: { headers: [], keys: [], patterns: [] },
    maxBodyBytes: 256_000,
    ignore: [],
  },
  types: { maxDepth: 6 },
  export: { md: 'docs/flow', html: '.flow-checker/site' },
})
```

The file is loaded with Node's built-in TypeScript support, which needs Node 22.18 or later. On older Node versions, name it `flow-checker.config.mjs` (also accepted: `.mts`, `.js`). Use `--config <file>` to load another file. Command-line options win over the config file.

## Options

### `root`

The project root (the folder with `package.json` and `next.config`), **relative to the config file's folder**. Default: `'.'`, the folder the config file is in.

Without it, the root is the current directory or `--root`, and the config file is looked up there. Set it when the config lives somewhere else, e.g. in a monorepo's tooling folder:

```ts
// tools/flow-checker.config.ts, run with: flow-checker --config tools/flow-checker.config.ts
export default defineConfig({ root: '../apps/web' })
```

`.flow-checker/`, the dev command and every other relative path then use that root.

### `appDir`

App Router directory, relative to the project root. Default: `src/app` if it exists, otherwise `app`. Same as `--app-dir`.

### `devCommand`

The command `flow-checker dev` runs to start your app. Default: `<package manager> run dev` when `package.json` has a `dev` script, otherwise `next dev` through the package manager. Same as `--dev-command`.

The command runs in the project root with these extra environment variables: `FLOW_CHECKER=1`, `PORT=<app port>`, `FLOW_CHECKER_RUNTIME` and `NEXT_PUBLIC_FLOW_CHECKER` (the capture settings as JSON). If your command ignores `PORT`, set `ports.app` to the port it uses.

### `ports`

| Field       | Default | Meaning                                                                                               |
| ----------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `dashboard` | `4400`  | Dashboard and capture endpoint. Same as `--port`.                                                     |
| `app`       | `3000`  | Port your app runs on. Passed to it as `PORT` and used for "open in app" links. Same as `--app-port`. |

### `include` and `exclude`

Which files the scan reads, as globs relative to the root. A file is scanned when it matches `include` and doesn't match `exclude`.

| Field     | Default                                                                                  |
| --------- | ---------------------------------------------------------------------------------------- |
| `include` | `['**']` (everything)                                                                    |
| `exclude` | `['**/*.test.*', '**/*.spec.*', '**/*.stories.*', '**/__tests__/**', '**/__mocks__/**']` |

Your list **replaces** the default, so keep the default entries you still want. `exclude: []` scans everything.

Glob syntax: `**` matches any number of folders, `*` anything within one folder or file name, `?` one character, `{a,b}` either. Patterns are matched against the whole path from the root (`app/page.tsx`, not `page.tsx`), so start with `**/` to match at any depth.

What happens to a file that is left out:

- A page or route handler in it is dropped from the routes (its folder still shows in the route tree).
- A component declared in it shows in its parent's tree as `excluded` and is not walked further.
- The request scan doesn't follow calls into it, so requests sent from there aren't listed.

```ts
// Leave out an internal admin area and storybook files.
exclude: ['app/(admin)/**', '**/*.stories.*', '**/*.test.*'],
```

### `apiClients`

Modules whose calls are requests. Default: `[]`.

The scanner already finds `fetch`, axios, React Query, SWR, Server Actions and route handlers, and it follows your own wrapper functions down to those calls. It does **not** look inside packages, so add a module here when requests go through:

- an HTTP library other than `fetch`/axios (`ky`, `ofetch`, `wretch`, `openapi-fetch`, ...)
- a generated or shared API client installed as a package (`@acme/api`)
- a project module you want listed as the request itself instead of the `fetch` inside it

```ts
apiClients: [
  { module: 'ky', methods: ['default', 'get', 'post', 'put', 'patch', 'delete'] },
  { module: 'ofetch', methods: ['default', 'ofetch'] },
  { module: '@acme/api', methods: ['listOrders', 'createOrder'] },
  { module: '@/lib/api', methods: ['get', 'post'] },
],
```

- **`module`**: the import specifier as written in your code, a package (`ky`, `@acme/api`) or a project path (`@/lib/api`). A project path also matches relative imports and barrels that lead to the same file.
- **`methods`**: names whose calls are requests. That's a named export called directly (`listOrders(url)`), a method on the import (`ky.post(url)`, `api.get(url)`), or a method on an instance created from it (`const http = ky.create(...)`, then `http.get(url)`). `default` means calling the default import or the instance itself (`ofetch(url)`, `ky(url)`).

How each call is read:

- **Method:** from the name when it is an HTTP verb (`get`, `post`, `put`, `patch`, `delete`, `head`, `options`), otherwise from a `method` option, otherwise `GET`.
- **URL:** the first argument, or its `url` property when the first argument is an options object. A `prefixUrl`, `baseURL` or `baseUrl` given when the instance was created is put in front.
- **Body:** the `json`, `body` or `data` option. For a `post`/`put`/`patch` call whose second argument isn't an options object (`api.post(url, data)`), that argument.
- **Response type:** a type argument (`api.get<User>(url)`), else the call's return type.

These requests show the transport `api-client` with the module and name. Captured traffic is matched to them like any other request.

### `capture`

What the runtime records while you test.

| Field             | Default   | Meaning                                                                                                                          |
| ----------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `storeRaw`        | `false`   | `true` saves captures **unmasked**. For local debugging only: the CLI warns at startup, and exports still redact unless `--raw`. |
| `redact.headers`  | see below | Extra header names to mask (case-insensitive).                                                                                   |
| `redact.keys`     | see below | Extra body keys to mask at any depth (case-insensitive), in JSON bodies, form data and query strings.                            |
| `redact.patterns` | see below | Extra `RegExp`s. Matching parts of any string value are masked.                                                                  |
| `maxBodyBytes`    | `256000`  | Larger bodies are cut off (and skipped by the type check).                                                                       |
| `ignore`          | see below | Extra URL globs that are never captured. `*` matches anything. A glob is matched against the path and the full URL.              |

Your values are **added to** the defaults, never replace them:

- headers: `authorization`, `cookie`, `set-cookie`, `x-api-key`, `proxy-authorization`
- keys: `password`, `pass`, `token`, `accessToken`, `refreshToken`, `secret`, `otp`, `code`, `cvv`, `cardNumber`, `ssn`
- patterns: JWTs, `Bearer …` tokens, and 13–19 digit card numbers that pass the Luhn check
- ignore: Next.js internals (`/_next/*`, `/__nextjs*`, `/__webpack*`), `/favicon.ico`, images, fonts, CSS, source maps, Next telemetry and the npm registry

Masked strings become `"[REDACTED:string]"`, numbers `0` and booleans `false`, so captures keep their shape and the type check still works. Each capture lists what was masked in `redactedPaths`.

### `types`

| Field      | Default | Meaning                                                                                                                                                       |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxDepth` | `6`     | How deep anonymous (inline) types are expanded. Named types are always referenced by name, so cycles are safe. Lower it if scans of very deep types are slow. |

### `export`

Folders `flow-checker export` (with neither `--md` nor `--html`) and the dashboard's Export screen write to, relative to the project root.

| Field  | Default              |
| ------ | -------------------- |
| `md`   | `docs/flow`          |
| `html` | `.flow-checker/site` |

Each export folder gets a `.flow-checker-export.json` listing the files it wrote. The next export replaces those files and nothing else. A folder that has other files and no such list is refused unless `--force`.

## Next.js config: `withFlowChecker()`

Only needed on Next.js 13.4–15.2 (see the [README](../packages/flow-checker/README.md#nextjs-before-153)).

```ts
import { withFlowChecker } from '@integr8-media/flow-checker/next'

export default withFlowChecker(nextConfig, {
  // Both optional:
  root: process.cwd(), // where to look for instrumentation-client.*
  nextVersion: '14.2.3', // default: read from the installed next package
})
```

It accepts a config object or a config function `(phase, context) => config`. Without `FLOW_CHECKER=1`, or on Next.js 15.3+, it returns your config unchanged.
