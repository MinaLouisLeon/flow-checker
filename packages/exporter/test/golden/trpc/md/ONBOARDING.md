# trpc: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in src/app/, 3 pages, 1 route handler)
- Rendering: [4 server, 6 client, 0 shared](README.md) (10 components)
- Data: React Query (6 requests)
- Data: tRPC (7 requests)
- Data: fetch (6 requests)

## Areas

3 areas by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page, 1 flow, 9 endpoints)
- todos: [`/todos`](areas.md#ar_1zap1ick15k) (1 page, 1 flow, 9 endpoints)
- users: [`/users`](areas.md#ar_0tirr3qjab5) (1 page, 5 endpoints)

## Entry pages

1 page nothing links to.

- Start page: [`/`](pages/index.md)
- Not linked: [`/users`](pages/users.md) (nothing in the app links here)

## Main flows

2 flows, 0 confirmed.

- AddTodoForm submit: [`/ → /todos/[id]`](flows/addtodoform-submit.md) (6 steps)
- TodoDetail click: [`/todos/[id]`](flows/tododetail-click.md) (3 steps)

## Backends

13 endpoints.

- This app: [This app's API](endpoints.md#host-app) (7 endpoints, 7 called from the browser)
- External: [`{API_URL ?? http://localhost:4010}`](endpoints.md#host-env_API_URL) (6 endpoints)

## Where things live

- Root layout: [`src/app/layout.tsx`](components/RootLayout.md)
- Sends requests: `src/server/upstream.ts` (6 requests)
- Route handlers: [`src/app/api/trpc/`](README.md) (1 handler)
- Type: [`Todo`](types.md#typ_0fc96ucq8sd) (src/types/todo.ts, used 8 times)

## To check

2 open notes.

- Request: [GET {API_URL ?? http://localhost:4010}/users: No response type was found (annotation, generic or cast).](pages/api.trpc.%5Btrpc%5D.md#req_1grc5hxysxt) (src/server/routers/user.ts:14)
- Request: [GET {API_URL ?? http://localhost:4010}/users/:id: No response type was found (annotation, generic or cast).](pages/api.trpc.%5Btrpc%5D.md#req_2c4oanm9vl7) (src/server/routers/user.ts:18)
