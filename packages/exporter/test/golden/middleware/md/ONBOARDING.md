# middleware: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in app/, 5 pages, 1 route handler)
- Rendering: [6 server, 0 client, 0 shared](README.md) (6 components)
- Data: fetch (4 requests)
- Proxy: [`proxy.ts`](middleware.md) (runs on 3 routes)

## Areas

4 areas by URL.

- dashboard: [`/dashboard`](areas.md#ar_1q9mt49i536) (2 pages, 2 endpoints)
- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page)
- login: [`/login`](areas.md#ar_0pgtfiopjqa) (1 page)
- products: [`/products`](areas.md#ar_2erkuzrjb5u) (1 page, 1 endpoint)

## Entry pages

- Start page: [`/`](pages/index.md)
- Most linked: [`/login`](pages/login.md) (3 pages link here)
- Most linked: [`/dashboard`](pages/dashboard.md) (2 pages link here)

## Main flows

No flows found: no event handler leads to a request or another page.

## Backends

5 endpoints.

- This app: [This app's API](endpoints.md#host-app) (1 endpoint)
- External: [`{API_URL ?? http://localhost:4010}`](endpoints.md#host-env_API_URL) (4 endpoints)

## Where things live

- Root layout: [`app/layout.tsx`](components/RootLayout.md)
- Sends requests: `lib/api.ts` (3 requests)
- Route handlers: [`app/api/`](README.md) (1 handler)
- Type: [`User`](types.md#typ_0857a9l1j3p) (types/user.ts, used 2 times)

## To check

The scan resolved every page, component, type and request.
