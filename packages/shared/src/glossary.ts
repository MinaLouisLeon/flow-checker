// Plain wording (M34): one short explanation for every status, flag, trigger, transport and badge.
// The dashboard tooltips and Glossary screen, the Markdown export (GLOSSARY.md) and the CLI
// (`flow-checker explain`) all read this table, so a word means the same thing everywhere.
import type { EndpointStatus } from './endpoints'
import type { FlowStatus } from './flow-runs'
import type { CaptureMatch } from './match'
import type {
  BoundaryGap,
  CacheEntry,
  CacheFlag,
  CacheRuntime,
  ClientUse,
  Component,
  Flag,
  PageBoundary,
  PropLeak,
  RequestSite,
  RequestUrl,
  RouteAccess,
  RouteRender,
  ServerModuleKind,
  Trigger,
} from './model'
import type { TypeCheckStatus } from './type-check'

export interface GlossaryEntry {
  /** The word or badge as the dashboard shows it, e.g. `needs re-check`. */
  label: string
  /** What it means, in one or two short sentences. Code is written in backticks. */
  means: string
  /** What to do about it, when there is something to do. */
  todo?: string
}

export interface GlossaryGroup<K extends string = string> {
  id: GlossaryGroupId
  title: string
  /** One line about where these words appear. */
  intro: string
  entries: Record<K, GlossaryEntry>
}

export type GlossaryGroupId =
  | 'request-status'
  | 'flag'
  | 'trigger'
  | 'transport'
  | 'request'
  | 'url'
  | 'access'
  | 'render'
  | 'boundary'
  | 'client'
  | 'leak'
  | 'cache'
  | 'flow-status'
  | 'endpoint-status'
  | 'endpoint-side'
  | 'capture'
  | 'type-check'
  | 'component'

const REQUEST_STATUS: GlossaryGroup<RequestSite['status']> = {
  id: 'request-status',
  title: 'Request status',
  intro: 'Whether live capture has seen a request the scan found in the code.',
  entries: {
    inferred: {
      label: 'not seen yet',
      means: 'Found in the code, but no captured request has matched it yet.',
      todo: 'Use the part of the app that sends it while `flow-checker dev` runs.',
    },
    verified: {
      label: '✓ verified',
      means: 'Live capture recorded this request and its data fits the types.',
    },
    'needs-recheck': {
      label: '↻ needs re-check',
      means: 'It was captured before, but the code that sends it changed since.',
      todo: 'Use the app again to capture it with the new code.',
    },
    mismatch: {
      label: '✗ type mismatch',
      means: "Live capture recorded this request, but its data doesn't fit the types in the code.",
      todo: 'Open the request to see which fields differ, then fix the type or the backend.',
    },
  },
}

const FLAG: GlossaryGroup<Flag['kind']> = {
  id: 'flag',
  title: 'Notes on a request',
  intro: 'Gaps the scan or a check found. They are shown as ⚠ (or ℹ for information) on the request.',
  entries: {
    'dynamic-url': {
      label: 'dynamic-url',
      means: 'The URL is built at runtime, so the scan could not tell which endpoint it calls.',
      todo: 'Use the page once with capture on, or add the function that builds it to `apiClients` in the config.',
    },
    'runtime-url': {
      label: 'runtime-url',
      means:
        'The URL comes from data at runtime (a field of an earlier response, a prop). This is information, not a gap.',
      todo: 'Nothing to fix. Capture shows the real URL once the app sends it.',
    },
    'unknown-method': {
      label: 'unknown-method',
      means: 'The HTTP method (GET, POST, …) could not be read from the code.',
      todo: 'Write the method as a literal (`method: "POST"`), or capture the request once.',
    },
    'unknown-response': {
      label: 'unknown-response',
      means: 'No type was found for the data that comes back, so it cannot be checked.',
      todo: 'Add a type: an annotation, a generic (`get<User>()`), a cast or a zod schema.',
    },
    'unknown-trigger': {
      label: 'unknown-trigger',
      means: 'The scan could not tell what starts this request (a page load, a click, …).',
      todo: 'Use the app with capture on to see when it is sent.',
    },
    'type-mismatch': {
      label: 'type-mismatch',
      means: "Captured data doesn't fit the request or response type in the code.",
      todo: 'Open the request to see which fields differ, then fix the type or the backend.',
    },
    stale: {
      label: 'stale',
      means: 'The code changed after the last capture, so older captures may not apply.',
      todo: 'Use the app again to capture the request with the new code.',
    },
    'not-in-collection': {
      label: 'not-in-collection',
      means: 'The imported Postman collection has no request for this call.',
      todo: 'Add the request to the collection, or check that the code calls the right URL.',
    },
    'contract-mismatch': {
      label: 'contract-mismatch',
      means: "The code's type doesn't fit the examples saved in the Postman collection.",
      todo: 'Update the type or the collection examples so they agree.',
    },
    'unused-endpoint': {
      label: 'unused-endpoint',
      means: 'A request in the Postman collection that no code calls.',
      todo: 'Remove it from the collection, or check whether the app should call it.',
    },
  },
}

const TRIGGER: GlossaryGroup<Trigger['kind']> = {
  id: 'trigger',
  title: 'What sends a request',
  intro: 'When a request is sent, as read from the code.',
  entries: {
    'server-render': {
      label: 'server render',
      means: 'Sent on the server while a server component renders, before the page reaches the browser.',
    },
    'page-load': {
      label: 'page load',
      means:
        'Sent when a client component renders: query hooks (`useQuery`, `useSWR`) and render-time calls.',
    },
    effect: {
      label: 'effect',
      means: 'Sent from `useEffect` / `useLayoutEffect`, right after the component appears.',
    },
    event: {
      label: 'event',
      means:
        'Sent when the user does something: a click, a form submit. The badge shows the event (`onClick`).',
    },
    'route-handler': {
      label: 'route handler',
      means: "Sent by one of the app's route handlers (`route.ts`) when something calls it.",
    },
    'server-action': {
      label: 'server action',
      means: 'Sent by a server action (`"use server"`) when a form or the code calls it.',
    },
    middleware: {
      label: 'middleware',
      means: 'Sent by `middleware.ts` / `proxy.ts` before a matching request is handled.',
    },
    unknown: {
      label: 'unknown trigger',
      means: 'The scan could not tell what starts this request.',
      todo: 'Use the app with capture on to see when it is sent.',
    },
  },
}

const TRANSPORT: GlossaryGroup<RequestSite['transport'] | 'http'> = {
  id: 'transport',
  title: 'How a request is sent',
  intro: 'The library or API that sends the request.',
  entries: {
    fetch: { label: 'fetch', means: 'The built-in `fetch()`, directly or through a helper in the project.' },
    axios: { label: 'axios', means: 'The axios HTTP library.' },
    'api-client': {
      label: 'API client',
      means: "A function or method listed in the config's `apiClients` (an SDK or the project's own client).",
    },
    'server-action': {
      label: 'server action',
      means:
        'A call to a server action: Next.js posts to the current page and runs the action on the server.',
    },
    trpc: { label: 'tRPC', means: 'A tRPC procedure call (hooks, `queryOptions()`, the vanilla client).' },
    graphql: { label: 'GraphQL', means: 'A GraphQL operation sent with Apollo, urql or Relay.' },
    sse: {
      label: 'sse',
      means: 'An event stream (server-sent events): `new EventSource()` or a streamed `fetch`.',
    },
    websocket: { label: 'websocket', means: "A WebSocket: `new WebSocket()` or socket.io's `io()`." },
    http: { label: 'HTTP', means: 'A plain HTTP endpoint, called with `fetch`, axios or an API client.' },
  },
}

const REQUEST: GlossaryGroup<'sometimes' | 'warnings' | 'grouped'> = {
  id: 'request',
  title: 'Other request badges',
  intro: 'Extra badges on a request row.',
  entries: {
    sometimes: {
      label: 'sometimes',
      means:
        'Sent only under a condition inside a shared helper (a token refresh before the real request), next to the main request.',
    },
    warnings: {
      label: '⚠ N',
      means: 'The number of notes on this request. Open it to read them.',
    },
    grouped: {
      label: '×N',
      means: 'The same request is sent from N places in the code. Open the row to see each one.',
    },
  },
}

const URL: GlossaryGroup<RequestUrl['confidence']> = {
  id: 'url',
  title: 'How sure the URL is',
  intro: 'How much of a request URL the scan could read.',
  entries: {
    exact: { label: 'exact', means: 'The whole URL was read from the code.' },
    pattern: {
      label: 'pattern',
      means: 'Read from the code, with `:name` placeholders for values only known at runtime (`/users/:id`).',
    },
    unknown: {
      label: 'unknown',
      means: 'The path could not be read from the code.',
      todo: 'Use the page once with capture on, or add the function that builds it to `apiClients` in the config.',
    },
    postman: {
      label: 'from Postman',
      means: "The code didn't say; the path comes from the matching request in the Postman collection.",
    },
  },
}

const ACCESS: GlossaryGroup<RouteAccess['status']> = {
  id: 'access',
  title: 'Page access',
  intro: 'Whether a page can stop a visitor (redirect to a login, show not found), as read from the code.',
  entries: {
    guarded: {
      label: 'guarded',
      means:
        'Something can redirect or stop a visitor before the page shows: middleware, a layout or the page itself.',
      todo: 'Hover the badge or open the page to see the condition and where it sends the visitor.',
    },
    open: { label: 'open', means: 'Nothing in the code redirects or stops a visitor on this page.' },
    unknown: {
      label: 'access ?',
      means: 'The scan could not tell: a check is in code it could not follow (a package, an excluded file).',
      todo: 'Open the page to see what could not be read.',
    },
  },
}

const RENDER: GlossaryGroup<RouteRender['mode']> = {
  id: 'render',
  title: 'Render mode',
  intro:
    'How Next renders a page in a production build, as read from the code. `next dev` renders every page per request.',
  entries: {
    static: {
      label: 'static',
      means: 'Prerendered once at build time; every visitor gets the same HTML until the next build.',
    },
    isr: {
      label: 'ISR',
      means:
        'Prerendered at build time and rebuilt in the background after the time shown (`revalidate`, `next.revalidate` or `cacheLife`).',
    },
    dynamic: {
      label: 'dynamic',
      means:
        'Rendered for each request, because the page reads the request (`cookies()`, `headers()`, `searchParams`), opts out of caching or has params it cannot list ahead.',
      todo: 'Open the page to see each reason and where it is; remove the ones you did not mean.',
    },
    partial: {
      label: 'partial',
      means:
        'Cache Components: a static shell is prerendered and the parts that read the request or uncached data stream in per request.',
      todo: 'Each reason must sit inside `<Suspense>` (or `use cache`), or the build fails.',
    },
    unknown: {
      label: 'render ?',
      means: 'The scan could not tell: a config value or a call it could not read.',
      todo: 'Open the page to see what could not be read.',
    },
  },
}

const BOUNDARY: GlossaryGroup<PageBoundary['kind'] | BoundaryGap['kind']> = {
  id: 'boundary',
  title: 'Boundaries',
  intro:
    'What Next shows while a page loads, when it throws or when it calls `notFound()`, read from the special files in its folders and the `<Suspense>` and error boundaries it renders.',
  entries: {
    loading: {
      label: 'loading',
      means:
        'A `loading` file: shown while the page in its folder (and the layouts in folders below) load. It does not cover the layout in its own folder.',
    },
    error: {
      label: 'error',
      means:
        'An `error` file: shown when the page in its folder (or a layout in a folder below) throws. It does not catch the layout in its own folder.',
    },
    'not-found': {
      label: 'not-found',
      means:
        'A `not-found` file: shown when `notFound()` is called below its folder. The one in the app folder also answers URLs no page has.',
    },
    forbidden: {
      label: 'forbidden',
      means: 'A `forbidden` file: shown when `forbidden()` is called below its folder (`authInterrupts`).',
    },
    unauthorized: {
      label: 'unauthorized',
      means:
        'An `unauthorized` file: shown when `unauthorized()` is called below its folder (`authInterrupts`).',
    },
    'global-error': {
      label: 'global-error',
      means:
        'The `global-error` file in the app folder: replaces the whole page, root layout included, when nothing nearer catches an error.',
    },
    suspense: {
      label: '<Suspense>',
      means:
        'A `<Suspense>` a layout, the page or a component renders: its `fallback` shows while what is inside loads.',
    },
    'error-boundary': {
      label: 'error boundary',
      means:
        'A component that catches what its children throw (`react-error-boundary`, or a class with `componentDidCatch` / `getDerivedStateFromError`).',
    },
    'blocking-route': {
      label: 'blocks the build',
      means:
        'Cache Components: the page reads request data (`cookies()`, an uncached `fetch`, awaited `params` or `searchParams`) outside `<Suspense>`, so `next build` fails.',
      todo: 'Wrap the part that reads it in `<Suspense>` (or add a `loading` file beside the page), cache it with `use cache`, or set `export const instant = false`.',
    },
    'no-fallback': {
      label: 'no loading state',
      means:
        'The page is rendered per request and waits for a server request with nothing to show meanwhile: navigating to it seems stuck until the data arrives.',
      todo: 'Add a `loading` file beside the page, or wrap the part that fetches in `<Suspense>`.',
    },
    'no-error-boundary': {
      label: 'no error boundary',
      means:
        "The page fetches fresh data on the server, and no `error` file, error boundary or `global-error` catches a failure, so visitors get Next's default error page.",
      todo: 'Add an `error` file in a folder above the page (or `global-error` in the app folder).',
    },
    'no-not-found': {
      label: 'no not-found page',
      means:
        '`notFound()`, `forbidden()` or `unauthorized()` is called with no file of that name above it, so Next shows its plain default page.',
      todo: 'Add the file in a folder above the call (for a layout, above its own folder).',
    },
    'slot-no-match': {
      label: 'slot without default',
      means:
        'A parallel slot (`@name`) of a layout around the page has no page for its URL and no `default` file. Next 16 fails the build; earlier versions show 404 on a full page load.',
      todo: 'Add a `default` file to the slot (returning `null` or calling `notFound()`).',
    },
    'no-canonical': {
      label: 'no page to intercept',
      means:
        'An intercepting route (`(.)`) has no plain page at the URL it intercepts, so a refresh or shared link has nothing to show. Next 16 fails the build.',
      todo: 'Add the page at that URL, outside the slot.',
    },
  },
}

const CLIENT: GlossaryGroup<ClientUse['kind'] | 'boundary' | 'lower' | 'barrel' | 'bundle'> = {
  id: 'client',
  title: 'Client boundaries',
  intro:
    "Where a page's browser part starts, what it brings to the browser, and the code that needs the browser.",
  entries: {
    boundary: {
      label: 'client boundary',
      means:
        "A server component (or the page, a layout) renders a component whose file starts with `'use client'`. That component and everything it renders and imports is sent to the browser.",
    },
    bundle: {
      label: 'brings',
      means:
        'The components, project modules and packages a boundary sends to the browser, and the size of their source (before minifying, types and comments included, packages left out): an estimate to compare boundaries, not the size of the built files.',
    },
    barrel: {
      label: 'through a barrel',
      means:
        "Imported from a file that re-exports it (`components/index.ts`). The boundary is the component's own file; in the browser, a barrel imports everything it re-exports.",
    },
    lower: {
      label: 'could move lower',
      means:
        "Nothing in this file, or in what it imports, needs the browser, so it could render on the server and `'use client'` could go on the components below that do.",
      todo: "Move `'use client'` into the files listed (or remove it when none are) and check the page still builds.",
    },
    hook: {
      label: 'hook',
      means:
        "A hook a server component can't call (`useState`, `useEffect`, `useRef`, `useContext`, `usePathname`...), or a project hook that calls one. `use`, `useMemo`, `useCallback` and `useId` work on the server.",
    },
    event: {
      label: 'event handler',
      means: 'An `on*` handler on an HTML element (`onClick`, `onChange`): it runs in the browser.',
    },
    'function-prop': {
      label: 'function prop',
      means:
        "A function handed to a component. A server component can't hand one to a client component (only a server action), so this one has to stay in the browser.",
    },
    'browser-api': {
      label: 'browser API',
      means:
        "`window`, `document`, `localStorage` and the like, read while rendering: they don't exist on the server.",
    },
    'class-component': {
      label: 'class component',
      means: 'Class components only work as client components.',
    },
    context: {
      label: 'context',
      means: '`createContext()`: React contexts only work in client components.',
    },
  },
}

const LEAK: GlossaryGroup<'module' | 'prop' | ServerModuleKind | PropLeak['value']> = {
  id: 'leak',
  title: 'Server/client leaks',
  intro:
    "Server-only code that client code imports, and props a server component hands to a client component that can't cross to the browser. Next rejects both, so the page fails to build or render.",
  entries: {
    module: {
      label: 'server-only module',
      means:
        "A `'use client'` file, or a file it imports, imports something that only works on the server. Everything client code imports is sent to the browser, except a `'use server'` file (only a reference to its actions is) and type-only imports.",
      todo: "Move the server part into a server component or a server action (a `'use server'` file), and pass the result to the client component as a prop.",
    },
    prop: {
      label: "prop that can't cross",
      means:
        "A server component renders a client component with a prop React cannot send to the browser. Plain data crosses (also `Date`, `Map`, `Set`, `URL`, `Error`, promises, JSX), and so do server actions and functions from a `'use client'` file.",
      todo: 'Pass plain data instead: a server action instead of a function, the fields of an object instead of a class instance; or create the value in the client component.',
    },
    'server-only': {
      label: 'server-only',
      means:
        'The file imports `server-only`, which marks it as server code: Next fails the build when client code imports it.',
    },
    node: {
      label: 'Node.js module',
      means:
        "A Node.js module with no browser version (`fs`, `child_process`, `net`...). Next has browser versions of a few (`path`, `crypto`, `buffer`, `url`...), which aren't flagged.",
    },
    database: {
      label: 'database client',
      means:
        'A database client (`pg`, `mysql2`, `mongoose`, `@prisma/client`...). In client code it fails to build, or it sends a database connection to the browser.',
    },
    'next-server': {
      label: 'server API',
      means:
        'An API Next only allows in server code: `next/headers` (`cookies()`, `headers()`), `revalidatePath`, `revalidateTag`, `cacheTag`, `cacheLife` from `next/cache`, `after` from `next/server`.',
    },
    'node-package': {
      label: 'Node.js package',
      means: 'A package that only runs on Node.js (`bcrypt`, `sharp`, `firebase-admin`, `nodemailer`...).',
    },
    function: {
      label: 'function prop',
      means:
        "A function handed to a client component (inline, a named function, a component, or one inside an object or array). Only server actions and functions exported from a `'use client'` file cross.",
    },
    'class-instance': {
      label: 'class instance prop',
      means:
        'An instance of a class (or a built-in such as `RegExp` or `WeakMap`). React only sends plain objects, unless the class has `toJSON` (then it sends what that returns) or can be iterated.',
    },
    symbol: {
      label: 'symbol prop',
      means: 'A symbol made with `Symbol()`. Only symbols from `Symbol.for()` cross.',
    },
    'null-prototype': {
      label: 'prop without a prototype',
      means: '`Object.create(null)`: React only sends plain objects.',
    },
  },
}

const CACHE: GlossaryGroup<CacheEntry['kind'] | CacheFlag['kind'] | CacheRuntime['verdict']> = {
  id: 'cache',
  title: 'Server cache',
  intro:
    'What Next keeps on the server between requests, the tags on it, and the calls that refresh it (`revalidateTag`, `updateTag`, `revalidatePath`).',
  entries: {
    fetch: {
      label: 'fetch',
      means:
        "A server `fetch` that asks to be cached: `cache: 'force-cache'`, `next.revalidate` or `next.tags`.",
    },
    'use-cache': {
      label: 'use cache',
      means:
        'A function, component or file with the `use cache` directive. `cacheLife` sets how long it is kept, `cacheTag` its tags.',
    },
    'unstable-cache': {
      label: 'unstable_cache',
      means: 'A function wrapped in `unstable_cache()`, with its `tags` and `revalidate` options.',
    },
    'tag-never-set': {
      label: 'tag never set',
      means: 'The tag is revalidated, but no cached data has it, so the call refreshes nothing.',
      todo: 'Check the tag for a typo, or add it where the data is cached.',
    },
    'tag-never-revalidated': {
      label: 'never revalidated',
      means:
        'The tag is set, but no `revalidateTag` or `updateTag` call has it: the data only refreshes when its time runs out.',
      todo: 'Revalidate the tag where the data changes, or drop the tag if nothing needs it.',
    },
    'path-no-route': {
      label: 'no such path',
      means: '`revalidatePath` names a path that no page or route handler has, so it refreshes nothing.',
      todo: 'Use the route path from the `app` folder (for a rewrite, its destination).',
    },
    'update-tag-outside-action': {
      label: 'updateTag outside an action',
      means: '`updateTag` only works in a server action; Next throws anywhere else.',
      todo: 'Use `revalidateTag(tag, { expire: 0 })` in route handlers.',
    },
    cached: {
      label: 'cached at runtime',
      means: 'Live capture: Next served it from its server cache at least once.',
    },
    'not-reused': {
      label: 'not reused yet',
      means:
        'Live capture saw it run, but nothing asked for the same data again yet, so it could not be served from the cache.',
      todo: 'Load the page again to check that the second time is a hit.',
    },
    'always-missed': {
      label: 'always missed',
      means:
        'Live capture: the same data was asked for again, and Next missed its cache every time. It was never served from the cache.',
      todo: "For a `fetch`, check that it answers 200 (Next keeps nothing else). For a function, check that it doesn't throw and that what it reads doesn't change each time.",
    },
    'never-cached': {
      label: 'never cached',
      means:
        'Live capture: Next skipped its cache every time, for the reason shown. `auto no cache` is a `fetch` without a `cache` option in a page rendered per request.',
      todo: "Give the `fetch` `cache: 'force-cache'` or `next.revalidate`, or check the segment config (`dynamic`, `fetchCache`).",
    },
  },
}

const FLOW_STATUS: GlossaryGroup<FlowStatus['status']> = {
  id: 'flow-status',
  title: 'Flow status',
  intro: 'Whether a flow found in the code has been walked in the running app.',
  entries: {
    unconfirmed: {
      label: 'not walked yet',
      means: 'Found in the code, but nobody has gone through it with capture on.',
      todo: 'Walk it in the app while `flow-checker dev` runs.',
    },
    partial: {
      label: 'partial',
      means: 'Started in the app, but not walked to the end yet.',
      todo: 'Finish the flow in the app.',
    },
    confirmed: { label: '✓ confirmed', means: 'Walked end to end in the app with capture on.' },
  },
}

const ENDPOINT_STATUS: GlossaryGroup<EndpointStatus> = {
  id: 'endpoint-status',
  title: 'Endpoint status',
  intro: 'From the requests that call the endpoint.',
  entries: {
    verified: { label: '✓ verified', means: 'Live capture recorded a call to it.' },
    mismatch: {
      label: '✗ type mismatch',
      means: "Captured data doesn't fit the types of one of its callers.",
      todo: 'Open the endpoint and its calls to see which fields differ.',
    },
    'needs-recheck': {
      label: '↻ needs re-check',
      means: 'The code of a caller changed after the last capture.',
      todo: 'Use the app again to capture it with the new code.',
    },
    'not-captured': {
      label: 'not captured',
      means: 'No call to it has been captured yet.',
      todo: 'Use the part of the app that calls it while `flow-checker dev` runs.',
    },
  },
}

const ENDPOINT_SIDE: GlossaryGroup<'browser' | 'server' | 'both'> = {
  id: 'endpoint-side',
  title: 'Where an endpoint is called from',
  intro: 'Whether the browser can reach the endpoint, or only the server.',
  entries: {
    browser: {
      label: 'browser',
      means: 'Called by code that runs in the browser (client components, form actions).',
    },
    server: {
      label: 'server',
      means: 'Only called by server code: server components, route handlers, server actions, middleware.',
    },
    both: { label: 'browser + server', means: 'Called from the browser and from server code.' },
  },
}

const CAPTURE: GlossaryGroup<CaptureMatch['status'] | 'third-party' | 'stale'> = {
  id: 'capture',
  title: 'Captured requests',
  intro: 'How a request captured from the running app was matched to the code.',
  entries: {
    matched: { label: '✓ matched', means: 'One request in the code clearly fits this capture.' },
    ambiguous: {
      label: '? ambiguous',
      means: 'Several requests in the code fit about equally well.',
      todo: 'Open the capture and pick the right one.',
    },
    unmatched: {
      label: '✗ unmatched',
      means: 'No request in the code fits. Usually something the scan missed.',
      todo: 'Open the capture and pick the request it belongs to, if there is one.',
    },
    'third-party': {
      label: 'third-party',
      means: "Sent by another site's script (an SDK) to its own servers, not by your code.",
    },
    stale: {
      label: 'stale',
      means: 'Taken before the code that sends this request changed.',
      todo: 'Use the app again to capture it with the new code.',
    },
  },
}

const TYPE_CHECK: GlossaryGroup<TypeCheckStatus> = {
  id: 'type-check',
  title: 'Type check of captured data',
  intro: 'Captured data compared with the types in the code.',
  entries: {
    ok: { label: '✓ types', means: 'The captured data fits the types.' },
    mismatch: {
      label: '✗ types',
      means: "The captured data doesn't fit the types.",
      todo: 'Open the capture to see which fields differ.',
    },
    skipped: {
      label: 'types not checked',
      means: 'The data could not be compared: no type, or a body that is not JSON.',
    },
  },
}

const COMPONENT: GlossaryGroup<
  Component['kind'] | 'use-client' | 'conditional' | 'lazy' | 'excluded' | 'unresolved' | 'prop' | 'recursive'
> = {
  id: 'component',
  title: 'Component badges',
  intro: 'Where a component runs and how it is rendered.',
  entries: {
    server: {
      label: 'server',
      means: 'A server component: it runs on the server only, never in the browser.',
    },
    client: {
      label: 'client',
      means:
        "A client component: it runs in the browser. Its file, or one above it, starts with `'use client'`.",
    },
    shared: {
      label: 'shared',
      means: 'Rendered from both server and client components, so it runs in both.',
    },
    'use-client': {
      label: 'use client',
      means: "This file starts with `'use client'`: everything it renders runs in the browser.",
    },
    conditional: {
      label: 'conditional',
      means: 'Only rendered on some paths (behind an `if`, a `&&` or a ternary).',
    },
    lazy: { label: 'lazy', means: 'Loaded on demand with `next/dynamic` or `React.lazy`.' },
    excluded: {
      label: 'excluded',
      means: "In a file the config's `include` / `exclude` leaves out, so the scan didn't read it.",
    },
    unresolved: {
      label: '⚠ unresolved',
      means: 'The scan could not find where this component is defined.',
      todo: 'Check the import path and the `paths` in tsconfig.',
    },
    prop: { label: 'from props', means: 'Passed in by the parent (an `as` or `component` prop).' },
    recursive: { label: 'recursive', means: 'Renders itself (a tree or nested menu); the tree stops here.' },
  },
}

/** Every group, in the order the Glossary screen and GLOSSARY.md list them. */
export const GLOSSARY: readonly GlossaryGroup[] = [
  REQUEST_STATUS,
  FLAG,
  TRIGGER,
  TRANSPORT,
  REQUEST,
  URL,
  ACCESS,
  RENDER,
  BOUNDARY,
  CLIENT,
  LEAK,
  CACHE,
  FLOW_STATUS,
  ENDPOINT_STATUS,
  ENDPOINT_SIDE,
  CAPTURE,
  TYPE_CHECK,
  COMPONENT,
]

const BY_ID = new Map(GLOSSARY.map((g) => [g.id, g]))

/** The entry for one word of a group, e.g. `explain('flag', 'dynamic-url')`. */
export function explain(group: GlossaryGroupId, key: string): GlossaryEntry | undefined {
  const entries = BY_ID.get(group)?.entries
  return entries && Object.hasOwn(entries, key) ? entries[key] : undefined
}

/** Tooltip text: what it means, then what to do, without backticks. */
export function explainTitle(group: GlossaryGroupId, key: string): string | undefined {
  const entry = explain(group, key)
  return entry ? entryText(entry).replaceAll('`', '') : undefined
}

/** What it means, then what to do. */
export function entryText(entry: GlossaryEntry): string {
  return entry.todo ? `${entry.means} ${entry.todo}` : entry.means
}

/** Id of an entry for links and anchors: `flag-dynamic-url`. */
export function termId(group: GlossaryGroupId, key: string): string {
  return `${group}-${key}`
}

export interface GlossaryTerm {
  group: GlossaryGroup
  key: string
  entry: GlossaryEntry
}

/** Every entry, in glossary order. */
export function glossaryTerms(): GlossaryTerm[] {
  return GLOSSARY.flatMap((group) =>
    Object.entries(group.entries).map(([key, entry]) => ({ group, key, entry })),
  )
}

/**
 * Entries whose key or label is the word asked for (`dynamic-url`, `needs re-check`, `verified`),
 * ignoring case, symbols and spaces vs. dashes. The same word can be in several groups.
 */
export function findTerms(word: string): GlossaryTerm[] {
  const q = plain(word)
  if (!q) return []
  const terms = glossaryTerms()
  const exact = terms.filter(
    (t) => plain(t.key) === q || plain(t.entry.label) === q || termId(t.group.id, t.key) === word,
  )
  if (exact.length > 0) return exact
  return terms.filter((t) => plain(t.key).includes(q) || plain(t.entry.label).includes(q))
}

function plain(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Plain text for the CLI: one group per block, or only the given terms. */
export function formatGlossary(terms?: GlossaryTerm[]): string {
  const list = terms ?? glossaryTerms()
  const out: string[] = []
  let group: GlossaryGroup | undefined
  for (const t of list) {
    if (t.group !== group) {
      if (group) out.push('')
      group = t.group
      out.push(`${t.group.title}`)
    }
    const name = t.entry.label === t.key ? t.key : `${t.entry.label} (${t.key})`
    out.push(`  ${name}`)
    out.push(`    ${t.entry.means.replaceAll('`', '')}`)
    if (t.entry.todo) out.push(`    What to do: ${t.entry.todo.replaceAll('`', '')}`)
  }
  return out.join('\n')
}
