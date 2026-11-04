# perf: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in src/app/, 6 pages, 0 route handlers)
- Rendering: [8 server, 1 client, 0 shared](README.md) (9 components)
- Data: axios (4 requests)
- Data: fetch (14 requests)

## Areas

6 areas by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page, 2 endpoints)
- catalog: [`/catalog`](areas.md#ar_2buzu539ylk) (1 page, 2 endpoints)
- products: [`/products`](areas.md#ar_2erkuzrjb5u) (1 page, 2 endpoints)
- settings: [`/settings`](areas.md#ar_1jfq6xl49zk) (1 page, 3 endpoints)
- todos: [`/todos`](areas.md#ar_1zap1ick15k) (1 page, 2 endpoints)
- users: [`/users`](areas.md#ar_0tirr3qjab5) (1 page, 3 endpoints)

## Entry pages

- Start page: [`/`](pages/index.md)

## Main flows

No flows found: no event handler leads to a request or another page.

## Backends

8 endpoints.

- External: [`http://localhost:4010`](endpoints.md#host-base_http___localhost_4010) (8 endpoints, 1 called from the browser)

## Where things live

- Root layout: [`src/app/layout.tsx`](components/RootLayout.md)
- Sends requests: `src/lib/api.ts` (13 requests)
- Sends requests: `src/lib/settings.ts` (4 requests)
- Type: [`Product`](types.md#typ_0v98ajm1yyv) (src/lib/types.ts, used 7 times)
- Type: [`User`](types.md#typ_0mxt2h8i81o) (src/lib/types.ts, used 7 times)

## To check

8 open notes.

- Performance: [\`GET http://localhost:4010/products/:id?delay=40\` is sent once per item of \`products\` in \`products.map()\` in \`CatalogPage\`; confirmed at runtime in 2 of 2 loads: up to 2 requests per load, 59 ms together](pages/catalog.md) (src/app/catalog/page.tsx:6)
- Performance: [\`getProducts()\` waits for \`getUser(1)\` in \`Home\` but doesn't use its result: they could start together; confirmed at runtime in 3 of 3 loads: about 103 ms to save](pages/index.md) (src/app/page.tsx:6)
- Performance: [\`GET http://localhost:4010/products/:id?delay=40\` is sent once per item of \`products\` in \`for (const product of products)\` in \`ProductsPage\`, each waiting for the one before; confirmed at runtime in 2 of 2 loads: up to 2 requests per load, 113 ms together](pages/products.md) (src/app/products/page.tsx:8)

5 more: [all open issues](issues.md).
