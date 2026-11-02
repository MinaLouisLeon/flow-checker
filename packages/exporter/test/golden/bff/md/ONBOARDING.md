# bff: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in src/app/, 2 pages, 2 route handlers)
- Rendering: [2 server, 3 client, 0 shared](README.md) (5 components)
- Data: fetch (6 requests)

## Areas

2 areas by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page, 1 flow, 4 endpoints)
- products: [`/products`](areas.md#ar_2erkuzrjb5u) (1 page, 2 endpoints)

## Entry pages

- Start page: [`/`](pages/index.md) (1 page links here)

## Main flows

1 flow, 0 confirmed.

- CreateProductForm submit: [`/ → /products/[id]`](flows/createproductform-submit.md) (4 steps)

## Backends

6 endpoints.

- This app: [This app's API](endpoints.md#host-app) (3 endpoints, 3 called from the browser)
- External: [`{BACKEND_URL ?? http://localhost:4010}`](endpoints.md#host-env_BACKEND_URL) (3 endpoints)

## Where things live

- Root layout: [`src/app/layout.tsx`](components/RootLayout.md)
- Sends requests: `src/lib/backend.ts` (3 requests)
- Route handlers: [`src/app/api/products/`](README.md) (2 handlers)
- Type: [`Product`](types.md#typ_1rwhmsgdwtz) (src/lib/schemas.ts, used 9 times)
- Type: [`CreateProductInput`](types.md#typ_2g53pdr4pws) (src/lib/schemas.ts, used 2 times)

## To check

The scan resolved every page, component, type and request.
