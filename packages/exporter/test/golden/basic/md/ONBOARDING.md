# basic: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in app/, 3 pages, 0 route handlers)
- Rendering: [5 server, 2 client, 0 shared](README.md) (7 components)
- Data: axios (1 request)
- Data: fetch (3 requests)

## Areas

3 areas by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page, 1 endpoint)
- about: [`/about`](areas.md#ar_1twt91jehoj) (1 page)
- users: [`/users`](areas.md#ar_0tirr3qjab5) (1 page, 1 flow, 3 endpoints)

## Entry pages

- Start page: [`/`](pages/index.md) (1 page links here)

## Main flows

1 flow, 0 confirmed.

- DeleteUserButton click: [`/users/[id] → /`](flows/deleteuserbutton-click.md) (4 steps)

## Backends

4 endpoints.

- External: [`{NEXT_PUBLIC_API_URL ?? http://localhost:4010}`](endpoints.md#host-env_NEXT_PUBLIC_API_URL) (4 endpoints, 2 called from the browser)

## Where things live

- Root layout: [`app/layout.tsx`](components/RootLayout.md)
- Sends requests: `lib/api.ts` (4 requests)
- Type: [`User`](types.md#typ_0857a9l1j3p) (types/user.ts, used 4 times)
- Type: [`Todo`](types.md#typ_1tfsxfuhjes) (types/user.ts, used 2 times)

## To check

The scan resolved every page, component, type and request.
