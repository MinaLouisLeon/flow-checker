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
    maxMessages: 200,
    maxMessageBytes: 64_000,
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

| Field             | Default   | Meaning                                                                                                                               |
| ----------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `storeRaw`        | `false`   | `true` saves captures **unmasked**. For local debugging only: the CLI warns at startup, and exports still redact unless `--raw`.      |
| `redact.headers`  | see below | Extra header names to mask (case-insensitive).                                                                                        |
| `redact.keys`     | see below | Extra body keys to mask at any depth (case-insensitive), in JSON bodies, form data and query strings.                                 |
| `redact.patterns` | see below | Extra `RegExp`s. Matching parts of any string value are masked.                                                                       |
| `maxBodyBytes`    | `256000`  | Larger bodies are cut off (and skipped by the type check).                                                                            |
| `ignore`          | see below | Extra URL globs that are never captured. `*` matches anything. A glob is matched against the path and the full URL.                   |
| `maxMessages`     | `200`     | Event stream (SSE) and WebSocket messages kept per connection. Later ones are only counted, and the capture is marked truncated.      |
| `maxMessageBytes` | `64000`   | Event stream and WebSocket messages larger than this are kept without their data (size and time only), and skipped by the type check. |

Your values are **added to** the defaults, never replace them:

- headers: `authorization`, `cookie`, `set-cookie`, `x-api-key`, `proxy-authorization`
- keys: `password`, `pass`, `token`, `accessToken`, `refreshToken`, `secret`, `otp`, `code`, `cvv`, `cardNumber`, `ssn`
- patterns: JWTs, `Bearer …` tokens, and 13–19 digit card numbers that pass the Luhn check
- ignore: Next.js internals (`/_next/*`, `/__nextjs*`, `/__webpack*`), `/favicon.ico`, images, fonts, CSS, source maps, Next telemetry, the npm registry and socket.io's HTTP long-polling (`*/socket.io/?*transport=polling*`)

Masked strings become `"[REDACTED:string]"`, numbers `0` and booleans `false`, so captures keep their shape and the type check still works. Each capture lists what was masked in `redactedPaths`.

### `types`

| Field      | Default | Meaning                                                                                                                                                       |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxDepth` | `6`     | How deep anonymous (inline) types are expanded. Named types are always referenced by name, so cycles are safe. Lower it if scans of very deep types are slow. |

### `areas`

The dashboard's Areas screen, the Map's area frames and `areas.md` group pages by feature. By default a page goes in the area named after the first static part of its URL, after route groups, dynamic segments and locale prefixes (`/[locale]/billing/invoices` is in `billing`); pages at the root are in `home`. When that gives a single area, pages are grouped by the feature folder that holds most of their components instead (`src/features/billing`, `src/modules/billing`: whatever the folder is called).

| Field    | Meaning                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| `rename` | Display names by area: `{ billing: 'Billing & invoices' }`.                                                  |
| `merge`  | Areas folded into another: `{ account: ['profile', 'settings'] }`. The target can be a name no page has yet. |

Merges apply first, so `rename` uses the merged names. Names that match no area are listed on the Areas screen and in `areas.md`.

```ts
export default defineConfig({
  areas: {
    merge: { account: ['profile', 'settings'] },
    rename: { account: 'Account', home: 'Landing' },
  },
})
```

### `export`

Folders `flow-checker export` (with neither `--md` nor `--html`) and the dashboard's Export screen write to, relative to the project root.

| Field  | Default              |
| ------ | -------------------- |
| `md`   | `docs/flow`          |
| `html` | `.flow-checker/site` |

Each export folder gets a `.flow-checker-export.json` listing the files it wrote. The next export replaces those files and nothing else. A folder that has other files and no such list is refused unless `--force`.

### `postman`

A Postman collection to check the code against (the API contract). See `flow-checker postman import` in the README.

```ts
postman: {
  collection: 'postman/collections/My API',     // v3 YAML folder
  // collection: 'api.postman_collection.json',  // or a v2.1 JSON export
  // collection: { id: '12345-abcd…', apiKeyEnv: 'POSTMAN_API_KEY' }, // or a cloud collection
  environment: 'postman/environments/dev.yaml',  // optional: values for {{variables}}
},
```

| Field         | Meaning                                                                                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collection`  | A v2.1 JSON export, a git-native v3 YAML collection folder (`postman/collections/<name>`), or `{ id, apiKeyEnv }` for a collection in Postman's cloud. Paths are relative to the project root. |
| `environment` | Optional. An environment JSON export, a v3 YAML environment file, or `{ id, apiKeyEnv }`. Its values win over collection variables.                                                            |

`apiKeyEnv` names the environment variable that holds your Postman API key (default `POSTMAN_API_KEY`). The key is only read from there, never written anywhere. Local files are read on every scan; cloud collections are fetched when `flow-checker dev` starts and by `flow-checker postman import`, and otherwise come from the last import in `.flow-checker/postman/` (gitignored). If a source can't be read, the last import is used with a warning.

Only what the check needs is kept: method, URL, folder, saved example bodies and the request's JSON body, redacted with the `capture.redact` rules. Headers, auth and scripts are dropped, and only variables a URL uses are kept (never `secret` ones or names the redaction rules mask).

### `graphql`

Where GraphQL operation types come from when the code has none (no codegen, Relay compiler or type arguments), and how persisted queries map to operations. All fields are optional.

```ts
graphql: {
  schema: 'schema.graphql',                      // SDL (.graphql / .gql) or an introspection result (.json)
  introspection: {                               // used when there is no schema file
    url: 'http://localhost:4000/graphql',
    headers: { Authorization: 'env:GQL_TOKEN' }, // env:NAME is read from that variable
  },
  persistedQueries: 'persisted-documents.json',  // id -> document manifest
  endpoint: '/api/graphql',                      // when the client setup doesn't say
},
```

| Field              | Meaning                                                                                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`           | Relative to the project root. Default: the `schema` of `relay.config.json` or of the codegen config (`codegen.ts`, `.graphqlrc.yml`, ...), else `schema.graphql`, `schema.gql`, `src/schema.graphql` or `schema.json`.                         |
| `introspection`    | Asks a running endpoint for its schema on `flow-checker dev` and `scan`. The result is cached in `.flow-checker/cache/` (gitignored) and used when the endpoint can't be reached. Header values `env:NAME` are only read from the environment. |
| `persistedQueries` | codegen's `persisted-documents.json`, Apollo's `persisted-query-manifest.json` or Relay's `persisted_queries.json`. Default: found by those names in the root, or the Relay config's `persistConfig.file`.                                     |
| `endpoint`         | A path (`/api/graphql`) or full URL. Default: from `new ApolloClient()` / `HttpLink`, urql's `createClient()`, Relay's `Network.create()`, or a route handler whose path ends in `/graphql`.                                                   |

When the endpoint is your own app (a route handler), it isn't running yet when `dev` starts: the first start has no introspection result. Run `flow-checker scan` once while the app runs (or use a schema file); later starts use the cache.

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
