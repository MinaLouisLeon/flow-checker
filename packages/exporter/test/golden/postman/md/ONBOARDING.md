# postman: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in app/, 2 pages, 0 route handlers)
- Rendering: [3 server, 3 client, 0 shared](README.md) (6 components)
- Data: fetch (6 requests)
- Postman: [Fixture API](README.md) (contract with 7 requests)

## Areas

2 areas by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page, 1 flow, 4 endpoints)
- users: [`/users`](areas.md#ar_0tirr3qjab5) (1 page, 1 flow, 2 endpoints)

## Entry pages

- Start page: [`/`](pages/index.md) (1 page links here)

## Main flows

2 flows, 0 confirmed.

- DeleteUserButton click: [`/users/[id] → /`](flows/deleteuserbutton-click.md) (6 steps)
- TodoPanel submit: [`/`](flows/todopanel-submit.md) (2 steps)

## Backends

6 endpoints.

- External: [`http://localhost:4010`](endpoints.md#host-base_http___localhost_4010) (1 endpoint, 1 called from the browser)
- External: [`{NEXT_PUBLIC_API_URL ?? http://localhost:4010}`](endpoints.md#host-env_NEXT_PUBLIC_API_URL) (5 endpoints, 3 called from the browser)

## Where things live

- Root layout: [`app/layout.tsx`](components/RootLayout.md)
- Sends requests: `lib/api.ts` (5 requests)
- Type: [`Todo`](types.md#typ_29n1iw0u1hd) (types/index.ts, used 3 times)
- Type: [`Product`](types.md#typ_1f1vojxmn7g) (types/index.ts, used 2 times)

## To check

3 open notes.

- Type mismatch: [GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products: Response doesn't match Product\[\]: \[\].price is number 49.9 (expected string) (4 of 4 captures).](components/ProductPanel.md#req_08kv7zxxjyg) (components/ProductPanel.tsx:11)
- Request: [DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id: The Postman collection "Fixture API" has no DELETE /users/:id request.](components/DeleteUserButton.md#req_1nhvqmicx4q) (components/DeleteUserButton.tsx:13)
- Request: [GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products: The response type Product\[\] doesn't match the Postman example "200 OK": \[\].price is number 49.9 (expected string).](components/ProductPanel.md#req_08kv7zxxjyg) (components/ProductPanel.tsx:11)
