# server-actions: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in src/app/, 4 pages, 0 route handlers)
- Rendering: [5 server, 2 client, 0 shared](README.md) (7 components)
- Data: fetch (4 requests)
- Data: Server actions (2 requests)

## Areas

2 areas by URL.

- products: [`/products`](areas.md#ar_2erkuzrjb5u) (3 pages, 2 flows, 6 endpoints)
- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page)

## Entry pages

- Start page: [`/`](pages/index.md)
- Most linked: [`/products`](pages/products.md) (2 pages link here)
- Most linked: [`/products/[id]`](pages/products.%5Bid%5D.md) (2 pages link here)

## Main flows

2 flows, 0 confirmed.

- CreateProductForm submit: [`/products/new → /products/[id]`](flows/createproductform-submit.md) (4 steps)
- DeleteProductButton click: [`/products`](flows/deleteproductbutton-click.md) (2 steps)

## Backends

6 endpoints.

- This app: [This app's API](endpoints.md#host-app) (2 endpoints, 2 called from the browser)
- External: [`{API_URL ?? http://localhost:4010}`](endpoints.md#host-env_API_URL) (4 endpoints)

## Where things live

- Root layout: [`src/app/layout.tsx`](components/RootLayout.md)
- Sends requests: `src/lib/backend.ts` (4 requests)
- Type: [`Product`](types.md#typ_0c608pp860k) (src/types/product.ts, used 3 times)

## To check

5 open notes.

- Boundary: [/products: no loading state: waits for a request (\`fetch\`) with no \`loading\` file or \`\<Suspense\>\` to show meanwhile](pages/products.md) (src/lib/backend.ts:7)
- Boundary: [/products: no error boundary: fetches on the server (\`fetch\`), and no \`error\` file, error boundary or \`global-error\` catches a failure](pages/products.md) (src/lib/backend.ts:7)
- Boundary: [/products/\[id\]: no loading state: waits for a request (\`fetch\`) with no \`loading\` file or \`\<Suspense\>\` to show meanwhile](pages/products.%5Bid%5D.md) (src/lib/backend.ts:12)

2 more: [all open issues](issues.md).
