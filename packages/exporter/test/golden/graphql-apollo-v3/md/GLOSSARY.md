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
