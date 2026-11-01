# trpc-v10: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in src/app/, 3 pages, 1 route handler)
- Rendering: [4 server, 7 client, 0 shared](README.md) (11 components)
- Data: React Query (6 requests)
- Data: tRPC (7 requests)
- Data: fetch (6 requests)

## Areas

3 areas by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page, 1 flow, 9 endpoints)
- feed: [`/feed`](areas.md#ar_005q5nhjyp9) (1 page, 4 endpoints)
- todos: [`/todos`](areas.md#ar_1zap1ick15k) (1 page, 1 flow, 7 endpoints)

## Entry pages

1 page nothing links to.

- Start page: [`/`](pages/index.md)
- Not linked: [`/feed`](pages/feed.md) (nothing in the app links here)

## Main flows

2 flows, 0 confirmed.

- AddTodoForm submit: [`/ → /todos/[id]`](flows/addtodoform-submit.md) (5 steps)
- TodoDetail click: [`/todos/[id]`](flows/tododetail-click.md) (3 steps)

## Backends

12 endpoints.

- This app: [This app's API](endpoints.md#host-app) (7 endpoints, 7 called from the browser)
- External: [`{API_URL ?? http://localhost:4010}`](endpoints.md#host-env_API_URL) (5 endpoints)

## Where things live

- Root layout: [`src/app/layout.tsx`](components/RootLayout.md)
- Sends requests: `src/server/upstream.ts` (6 requests)
- Route handlers: [`src/app/api/trpc/`](README.md) (1 handler)
- Type: [`Todo`](types.md#typ_0fc96ucq8sd) (src/types/todo.ts, used 10 times)
- Type: [`User`](types.md#typ_25sov0zzv45) (src/types/user.ts, used 2 times)

## To check

The scan resolved every page, component, type and request.
