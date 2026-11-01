# graphql-relay: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in src/app/, 3 pages, 1 route handler)
- Rendering: [4 server, 8 client, 0 shared](README.md) (12 components)
- Data: GraphQL (relay) (5 requests)

## Areas

3 areas by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page, 1 flow, 2 endpoints)
- todos: [`/todos`](areas.md#ar_1zap1ick15k) (1 page, 1 flow, 2 endpoints)
- users: [`/users`](areas.md#ar_0tirr3qjab5) (1 page, 1 flow, 1 endpoint)

## Entry pages

1 page nothing links to.

- Start page: [`/`](pages/index.md)
- Not linked: [`/users`](pages/users.md) (nothing in the app links here)

## Main flows

3 flows, 0 confirmed.

- AddTodoForm submit: [`/ → /todos/[id]`](flows/addtodoform-submit.md) (4 steps)
- TodoDetail click: [`/todos/[id]`](flows/tododetail-click.md) (2 steps)
- UserList click: [`/users`](flows/userlist-click.md) (2 steps)

## Backends

5 endpoints.

- This app: [This app's API](endpoints.md#host-app) (5 endpoints, 5 called from the browser)

## Where things live

- Root layout: [`src/app/layout.tsx`](components/RootLayout.md)
- Route handlers: [`src/app/api/`](README.md) (1 handler)
- Type: [`TodoDetailQuery$variables`](types.md#typ_1ji4t5gnvh0) (src/\__generated_\_/TodoDetailQuery.graphql.ts, used 3 times)
- Type: [`UserListQuery$data`](types.md#typ_1fqrz3yzgfq) (src/\__generated_\_/UserListQuery.graphql.ts, used 3 times)

## To check

The scan resolved every page, component, type and request.
