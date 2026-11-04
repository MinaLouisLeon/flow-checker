# Glossary

[← Overview](README.md)

What each status, note, trigger, transport and badge in these docs and the dashboard means, and what to do about it.

## Request status

Whether live capture has seen a request the scan found in the code.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="request-status-inferred"></a>**not seen yet** (`inferred`) | Found in the code, but no captured request has matched it yet. | Use the part of the app that sends it while `flow-checker dev` runs. |
| <a id="request-status-verified"></a>**✓ verified** (`verified`) | Live capture recorded this request and its data fits the types. |  |
| <a id="request-status-needs-recheck"></a>**↻ needs re-check** (`needs-recheck`) | It was captured before, but the code that sends it changed since. | Use the app again to capture it with the new code. |
| <a id="request-status-mismatch"></a>**✗ type mismatch** (`mismatch`) | Live capture recorded this request, but its data doesn't fit the types in the code. | Open the request to see which fields differ, then fix the type or the backend. |

## Notes on a request

Gaps the scan or a check found. They are shown as ⚠ (or ℹ for information) on the request.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="flag-dynamic-url"></a>**dynamic-url** | The URL is built at runtime, so the scan could not tell which endpoint it calls. | Use the page once with capture on, or add the function that builds it to `apiClients` in the config. |
| <a id="flag-runtime-url"></a>**runtime-url** | The URL comes from data at runtime (a field of an earlier response, a prop). This is information, not a gap. | Nothing to fix. Capture shows the real URL once the app sends it. |
| <a id="flag-unknown-method"></a>**unknown-method** | The HTTP method (GET, POST, …) could not be read from the code. | Write the method as a literal (`method: "POST"`), or capture the request once. |
| <a id="flag-unknown-response"></a>**unknown-response** | No type was found for the data that comes back, so it cannot be checked. | Add a type: an annotation, a generic (`get<User>()`), a cast or a zod schema. |
| <a id="flag-unknown-trigger"></a>**unknown-trigger** | The scan could not tell what starts this request (a page load, a click, …). | Use the app with capture on to see when it is sent. |
| <a id="flag-type-mismatch"></a>**type-mismatch** | Captured data doesn't fit the request or response type in the code. | Open the request to see which fields differ, then fix the type or the backend. |
| <a id="flag-stale"></a>**stale** | The code changed after the last capture, so older captures may not apply. | Use the app again to capture the request with the new code. |
| <a id="flag-not-in-collection"></a>**not-in-collection** | The imported Postman collection has no request for this call. | Add the request to the collection, or check that the code calls the right URL. |
| <a id="flag-contract-mismatch"></a>**contract-mismatch** | The code's type doesn't fit the examples saved in the Postman collection. | Update the type or the collection examples so they agree. |
| <a id="flag-unused-endpoint"></a>**unused-endpoint** | A request in the Postman collection that no code calls. | Remove it from the collection, or check whether the app should call it. |

## What sends a request

When a request is sent, as read from the code.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="trigger-server-render"></a>**server render** (`server-render`) | Sent on the server while a server component renders, before the page reaches the browser. |  |
| <a id="trigger-page-load"></a>**page load** (`page-load`) | Sent when a client component renders: query hooks (`useQuery`, `useSWR`) and render-time calls. |  |
| <a id="trigger-effect"></a>**effect** | Sent from `useEffect` / `useLayoutEffect`, right after the component appears. |  |
| <a id="trigger-event"></a>**event** | Sent when the user does something: a click, a form submit. The badge shows the event (`onClick`). |  |
| <a id="trigger-route-handler"></a>**route handler** (`route-handler`) | Sent by one of the app's route handlers (`route.ts`) when something calls it. |  |
| <a id="trigger-server-action"></a>**server action** (`server-action`) | Sent by a server action (`"use server"`) when a form or the code calls it. |  |
| <a id="trigger-middleware"></a>**middleware** | Sent by `middleware.ts` / `proxy.ts` before a matching request is handled. |  |
| <a id="trigger-unknown"></a>**unknown trigger** (`unknown`) | The scan could not tell what starts this request. | Use the app with capture on to see when it is sent. |

## How a request is sent

The library or API that sends the request.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="transport-fetch"></a>**fetch** | The built-in `fetch()`, directly or through a helper in the project. |  |
| <a id="transport-axios"></a>**axios** | The axios HTTP library. |  |
| <a id="transport-api-client"></a>**API client** (`api-client`) | A function or method listed in the config's `apiClients` (an SDK or the project's own client). |  |
| <a id="transport-server-action"></a>**server action** (`server-action`) | A call to a server action: Next.js posts to the current page and runs the action on the server. |  |
| <a id="transport-trpc"></a>**tRPC** (`trpc`) | A tRPC procedure call (hooks, `queryOptions()`, the vanilla client). |  |
| <a id="transport-graphql"></a>**GraphQL** (`graphql`) | A GraphQL operation sent with Apollo, urql or Relay. |  |
| <a id="transport-sse"></a>**sse** | An event stream (server-sent events): `new EventSource()` or a streamed `fetch`. |  |
| <a id="transport-websocket"></a>**websocket** | A WebSocket: `new WebSocket()` or socket.io's `io()`. |  |
| <a id="transport-http"></a>**HTTP** (`http`) | A plain HTTP endpoint, called with `fetch`, axios or an API client. |  |

## Other request badges

Extra badges on a request row.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="request-sometimes"></a>**sometimes** | Sent only under a condition inside a shared helper (a token refresh before the real request), next to the main request. |  |
| <a id="request-warnings"></a>**⚠ N** (`warnings`) | The number of notes on this request. Open it to read them. |  |
| <a id="request-grouped"></a>**×N** (`grouped`) | The same request is sent from N places in the code. Open the row to see each one. |  |

## How sure the URL is

How much of a request URL the scan could read.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="url-exact"></a>**exact** | The whole URL was read from the code. |  |
| <a id="url-pattern"></a>**pattern** | Read from the code, with `:name` placeholders for values only known at runtime (`/users/:id`). |  |
| <a id="url-unknown"></a>**unknown** | The path could not be read from the code. | Use the page once with capture on, or add the function that builds it to `apiClients` in the config. |
| <a id="url-postman"></a>**from Postman** (`postman`) | The code didn't say; the path comes from the matching request in the Postman collection. |  |

## Page access

Whether a page can stop a visitor (redirect to a login, show not found), as read from the code.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="access-guarded"></a>**guarded** | Something can redirect or stop a visitor before the page shows: middleware, a layout or the page itself. | Hover the badge or open the page to see the condition and where it sends the visitor. |
| <a id="access-open"></a>**open** | Nothing in the code redirects or stops a visitor on this page. |  |
| <a id="access-unknown"></a>**access ?** (`unknown`) | The scan could not tell: a check is in code it could not follow (a package, an excluded file). | Open the page to see what could not be read. |

## Render mode

How Next renders a page in a production build, as read from the code. `next dev` renders every page per request.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="render-static"></a>**static** | Prerendered once at build time; every visitor gets the same HTML until the next build. |  |
| <a id="render-isr"></a>**ISR** (`isr`) | Prerendered at build time and rebuilt in the background after the time shown (`revalidate`, `next.revalidate` or `cacheLife`). |  |
| <a id="render-dynamic"></a>**dynamic** | Rendered for each request, because the page reads the request (`cookies()`, `headers()`, `searchParams`), opts out of caching or has params it cannot list ahead. | Open the page to see each reason and where it is; remove the ones you did not mean. |
| <a id="render-partial"></a>**partial** | Cache Components: a static shell is prerendered and the parts that read the request or uncached data stream in per request. | Each reason must sit inside `<Suspense>` (or `use cache`), or the build fails. |
| <a id="render-unknown"></a>**render ?** (`unknown`) | The scan could not tell: a config value or a call it could not read. | Open the page to see what could not be read. |

## Boundaries

What Next shows while a page loads, when it throws or when it calls `notFound()`, read from the special files in its folders and the `<Suspense>` and error boundaries it renders.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="boundary-loading"></a>**loading** | A `loading` file: shown while the page in its folder (and the layouts in folders below) load. It does not cover the layout in its own folder. |  |
| <a id="boundary-error"></a>**error** | An `error` file: shown when the page in its folder (or a layout in a folder below) throws. It does not catch the layout in its own folder. |  |
| <a id="boundary-not-found"></a>**not-found** | A `not-found` file: shown when `notFound()` is called below its folder. The one in the app folder also answers URLs no page has. |  |
| <a id="boundary-forbidden"></a>**forbidden** | A `forbidden` file: shown when `forbidden()` is called below its folder (`authInterrupts`). |  |
| <a id="boundary-unauthorized"></a>**unauthorized** | An `unauthorized` file: shown when `unauthorized()` is called below its folder (`authInterrupts`). |  |
| <a id="boundary-global-error"></a>**global-error** | The `global-error` file in the app folder: replaces the whole page, root layout included, when nothing nearer catches an error. |  |
| <a id="boundary-suspense"></a>**\<Suspense\>** (`suspense`) | A `<Suspense>` a layout, the page or a component renders: its `fallback` shows while what is inside loads. |  |
| <a id="boundary-error-boundary"></a>**error boundary** (`error-boundary`) | A component that catches what its children throw (`react-error-boundary`, or a class with `componentDidCatch` / `getDerivedStateFromError`). |  |
| <a id="boundary-blocking-route"></a>**blocks the build** (`blocking-route`) | Cache Components: the page reads request data (`cookies()`, an uncached `fetch`, awaited `params` or `searchParams`) outside `<Suspense>`, so `next build` fails. | Wrap the part that reads it in `<Suspense>` (or add a `loading` file beside the page), cache it with `use cache`, or set `export const instant = false`. |
| <a id="boundary-no-fallback"></a>**no loading state** (`no-fallback`) | The page is rendered per request and waits for a server request with nothing to show meanwhile: navigating to it seems stuck until the data arrives. | Add a `loading` file beside the page, or wrap the part that fetches in `<Suspense>`. |
| <a id="boundary-no-error-boundary"></a>**no error boundary** (`no-error-boundary`) | The page fetches fresh data on the server, and no `error` file, error boundary or `global-error` catches a failure, so visitors get Next's default error page. | Add an `error` file in a folder above the page (or `global-error` in the app folder). |
| <a id="boundary-no-not-found"></a>**no not-found page** (`no-not-found`) | `notFound()`, `forbidden()` or `unauthorized()` is called with no file of that name above it, so Next shows its plain default page. | Add the file in a folder above the call (for a layout, above its own folder). |
| <a id="boundary-slot-no-match"></a>**slot without default** (`slot-no-match`) | A parallel slot (`@name`) of a layout around the page has no page for its URL and no `default` file. Next 16 fails the build; earlier versions show 404 on a full page load. | Add a `default` file to the slot (returning `null` or calling `notFound()`). |
| <a id="boundary-no-canonical"></a>**no page to intercept** (`no-canonical`) | An intercepting route (`(.)`) has no plain page at the URL it intercepts, so a refresh or shared link has nothing to show. Next 16 fails the build. | Add the page at that URL, outside the slot. |

## Client boundaries

Where a page's browser part starts, what it brings to the browser, and the code that needs the browser.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="client-boundary"></a>**client boundary** (`boundary`) | A server component (or the page, a layout) renders a component whose file starts with `'use client'`. That component and everything it renders and imports is sent to the browser. |  |
| <a id="client-bundle"></a>**brings** (`bundle`) | The components, project modules and packages a boundary sends to the browser, and the size of their source (before minifying, types and comments included, packages left out): an estimate to compare boundaries, not the size of the built files. |  |
| <a id="client-barrel"></a>**through a barrel** (`barrel`) | Imported from a file that re-exports it (`components/index.ts`). The boundary is the component's own file; in the browser, a barrel imports everything it re-exports. |  |
| <a id="client-lower"></a>**could move lower** (`lower`) | Nothing in this file, or in what it imports, needs the browser, so it could render on the server and `'use client'` could go on the components below that do. | Move `'use client'` into the files listed (or remove it when none are) and check the page still builds. |
| <a id="client-hook"></a>**hook** | A hook a server component can't call (`useState`, `useEffect`, `useRef`, `useContext`, `usePathname`...), or a project hook that calls one. `use`, `useMemo`, `useCallback` and `useId` work on the server. |  |
| <a id="client-event"></a>**event handler** (`event`) | An `on*` handler on an HTML element (`onClick`, `onChange`): it runs in the browser. |  |
| <a id="client-function-prop"></a>**function prop** (`function-prop`) | A function handed to a component. A server component can't hand one to a client component (only a server action), so this one has to stay in the browser. |  |
| <a id="client-browser-api"></a>**browser API** (`browser-api`) | `window`, `document`, `localStorage` and the like, read while rendering: they don't exist on the server. |  |
| <a id="client-class-component"></a>**class component** (`class-component`) | Class components only work as client components. |  |
| <a id="client-context"></a>**context** | `createContext()`: React contexts only work in client components. |  |

## Server/client leaks

Server-only code that client code imports, and props a server component hands to a client component that can't cross to the browser. Next rejects both, so the page fails to build or render.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="leak-module"></a>**server-only module** (`module`) | A `'use client'` file, or a file it imports, imports something that only works on the server. Everything client code imports is sent to the browser, except a `'use server'` file (only a reference to its actions is) and type-only imports. | Move the server part into a server component or a server action (a `'use server'` file), and pass the result to the client component as a prop. |
| <a id="leak-prop"></a>**prop that can't cross** (`prop`) | A server component renders a client component with a prop React cannot send to the browser. Plain data crosses (also `Date`, `Map`, `Set`, `URL`, `Error`, promises, JSX), and so do server actions and functions from a `'use client'` file. | Pass plain data instead: a server action instead of a function, the fields of an object instead of a class instance; or create the value in the client component. |
| <a id="leak-server-only"></a>**server-only** | The file imports `server-only`, which marks it as server code: Next fails the build when client code imports it. |  |
| <a id="leak-node"></a>**Node.js module** (`node`) | A Node.js module with no browser version (`fs`, `child_process`, `net`...). Next has browser versions of a few (`path`, `crypto`, `buffer`, `url`...), which aren't flagged. |  |
| <a id="leak-database"></a>**database client** (`database`) | A database client (`pg`, `mysql2`, `mongoose`, `@prisma/client`...). In client code it fails to build, or it sends a database connection to the browser. |  |
| <a id="leak-next-server"></a>**server API** (`next-server`) | An API Next only allows in server code: `next/headers` (`cookies()`, `headers()`), `revalidatePath`, `revalidateTag`, `cacheTag`, `cacheLife` from `next/cache`, `after` from `next/server`. |  |
| <a id="leak-node-package"></a>**Node.js package** (`node-package`) | A package that only runs on Node.js (`bcrypt`, `sharp`, `firebase-admin`, `nodemailer`...). |  |
| <a id="leak-function"></a>**function prop** (`function`) | A function handed to a client component (inline, a named function, a component, or one inside an object or array). Only server actions and functions exported from a `'use client'` file cross. |  |
| <a id="leak-class-instance"></a>**class instance prop** (`class-instance`) | An instance of a class (or a built-in such as `RegExp` or `WeakMap`). React only sends plain objects, unless the class has `toJSON` (then it sends what that returns) or can be iterated. |  |
| <a id="leak-symbol"></a>**symbol prop** (`symbol`) | A symbol made with `Symbol()`. Only symbols from `Symbol.for()` cross. |  |
| <a id="leak-null-prototype"></a>**prop without a prototype** (`null-prototype`) | `Object.create(null)`: React only sends plain objects. |  |

## Server cache

What Next keeps on the server between requests, the tags on it, and the calls that refresh it (`revalidateTag`, `updateTag`, `revalidatePath`).

| Word | Means | What to do |
| --- | --- | --- |
| <a id="cache-fetch"></a>**fetch** | A server `fetch` that asks to be cached: `cache: 'force-cache'`, `next.revalidate` or `next.tags`. |  |
| <a id="cache-use-cache"></a>**use cache** (`use-cache`) | A function, component or file with the `use cache` directive. `cacheLife` sets how long it is kept, `cacheTag` its tags. |  |
| <a id="cache-unstable-cache"></a>**unstable_cache** (`unstable-cache`) | A function wrapped in `unstable_cache()`, with its `tags` and `revalidate` options. |  |
| <a id="cache-tag-never-set"></a>**tag never set** (`tag-never-set`) | The tag is revalidated, but no cached data has it, so the call refreshes nothing. | Check the tag for a typo, or add it where the data is cached. |
| <a id="cache-tag-never-revalidated"></a>**never revalidated** (`tag-never-revalidated`) | The tag is set, but no `revalidateTag` or `updateTag` call has it: the data only refreshes when its time runs out. | Revalidate the tag where the data changes, or drop the tag if nothing needs it. |
| <a id="cache-path-no-route"></a>**no such path** (`path-no-route`) | `revalidatePath` names a path that no page or route handler has, so it refreshes nothing. | Use the route path from the `app` folder (for a rewrite, its destination). |
| <a id="cache-update-tag-outside-action"></a>**updateTag outside an action** (`update-tag-outside-action`) | `updateTag` only works in a server action; Next throws anywhere else. | Use `revalidateTag(tag, { expire: 0 })` in route handlers. |
| <a id="cache-cached"></a>**cached at runtime** (`cached`) | Live capture: Next served it from its server cache at least once. |  |
| <a id="cache-not-reused"></a>**not reused yet** (`not-reused`) | Live capture saw it run, but nothing asked for the same data again yet, so it could not be served from the cache. | Load the page again to check that the second time is a hit. |
| <a id="cache-always-missed"></a>**always missed** (`always-missed`) | Live capture: the same data was asked for again, and Next missed its cache every time. It was never served from the cache. | For a `fetch`, check that it answers 200 (Next keeps nothing else). For a function, check that it doesn't throw and that what it reads doesn't change each time. |
| <a id="cache-never-cached"></a>**never cached** (`never-cached`) | Live capture: Next skipped its cache every time, for the reason shown. `auto no cache` is a `fetch` without a `cache` option in a page rendered per request. | Give the `fetch` `cache: 'force-cache'` or `next.revalidate`, or check the segment config (`dynamic`, `fetchCache`). |

## Flow status

Whether a flow found in the code has been walked in the running app.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="flow-status-unconfirmed"></a>**not walked yet** (`unconfirmed`) | Found in the code, but nobody has gone through it with capture on. | Walk it in the app while `flow-checker dev` runs. |
| <a id="flow-status-partial"></a>**partial** | Started in the app, but not walked to the end yet. | Finish the flow in the app. |
| <a id="flow-status-confirmed"></a>**✓ confirmed** (`confirmed`) | Walked end to end in the app with capture on. |  |

## Endpoint status

From the requests that call the endpoint.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="endpoint-status-verified"></a>**✓ verified** (`verified`) | Live capture recorded a call to it. |  |
| <a id="endpoint-status-mismatch"></a>**✗ type mismatch** (`mismatch`) | Captured data doesn't fit the types of one of its callers. | Open the endpoint and its calls to see which fields differ. |
| <a id="endpoint-status-needs-recheck"></a>**↻ needs re-check** (`needs-recheck`) | The code of a caller changed after the last capture. | Use the app again to capture it with the new code. |
| <a id="endpoint-status-not-captured"></a>**not captured** (`not-captured`) | No call to it has been captured yet. | Use the part of the app that calls it while `flow-checker dev` runs. |

## Where an endpoint is called from

Whether the browser can reach the endpoint, or only the server.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="endpoint-side-browser"></a>**browser** | Called by code that runs in the browser (client components, form actions). |  |
| <a id="endpoint-side-server"></a>**server** | Only called by server code: server components, route handlers, server actions, middleware. |  |
| <a id="endpoint-side-both"></a>**browser + server** (`both`) | Called from the browser and from server code. |  |

## Captured requests

How a request captured from the running app was matched to the code.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="capture-matched"></a>**✓ matched** (`matched`) | One request in the code clearly fits this capture. |  |
| <a id="capture-ambiguous"></a>**? ambiguous** (`ambiguous`) | Several requests in the code fit about equally well. | Open the capture and pick the right one. |
| <a id="capture-unmatched"></a>**✗ unmatched** (`unmatched`) | No request in the code fits. Usually something the scan missed. | Open the capture and pick the request it belongs to, if there is one. |
| <a id="capture-third-party"></a>**third-party** | Sent by another site's script (an SDK) to its own servers, not by your code. |  |
| <a id="capture-stale"></a>**stale** | Taken before the code that sends this request changed. | Use the app again to capture it with the new code. |

## Type check of captured data

Captured data compared with the types in the code.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="type-check-ok"></a>**✓ types** (`ok`) | The captured data fits the types. |  |
| <a id="type-check-mismatch"></a>**✗ types** (`mismatch`) | The captured data doesn't fit the types. | Open the capture to see which fields differ. |
| <a id="type-check-skipped"></a>**types not checked** (`skipped`) | The data could not be compared: no type, or a body that is not JSON. |  |

## Component badges

Where a component runs and how it is rendered.

| Word | Means | What to do |
| --- | --- | --- |
| <a id="component-server"></a>**server** | A server component: it runs on the server only, never in the browser. |  |
| <a id="component-client"></a>**client** | A client component: it runs in the browser. Its file, or one above it, starts with `'use client'`. |  |
| <a id="component-shared"></a>**shared** | Rendered from both server and client components, so it runs in both. |  |
| <a id="component-use-client"></a>**use client** (`use-client`) | This file starts with `'use client'`: everything it renders runs in the browser. |  |
| <a id="component-conditional"></a>**conditional** | Only rendered on some paths (behind an `if`, a `&&` or a ternary). |  |
| <a id="component-lazy"></a>**lazy** | Loaded on demand with `next/dynamic` or `React.lazy`. |  |
| <a id="component-excluded"></a>**excluded** | In a file the config's `include` / `exclude` leaves out, so the scan didn't read it. |  |
| <a id="component-unresolved"></a>**⚠ unresolved** (`unresolved`) | The scan could not find where this component is defined. | Check the import path and the `paths` in tsconfig. |
| <a id="component-prop"></a>**from props** (`prop`) | Passed in by the parent (an `as` or `component` prop). |  |
| <a id="component-recursive"></a>**recursive** | Renders itself (a tree or nested menu); the tree stops here. |  |
