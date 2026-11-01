# react-query: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in src/app/, 4 pages, 0 route handlers)
- Rendering: [5 server, 7 client, 0 shared](README.md) (12 components)
- Data: React Query (9 requests)
- Data: SWR (1 request)
- Data: fetch (13 requests)

## Areas

4 areas by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page, 2 flows, 3 endpoints)
- settings: [`/settings`](areas.md#ar_1jfq6xl49zk) (1 page, 3 endpoints)
- todos: [`/todos`](areas.md#ar_1zap1ick15k) (1 page, 1 endpoint)
- users: [`/users`](areas.md#ar_0tirr3qjab5) (1 page, 2 flows, 3 endpoints)

## Entry pages

2 pages nothing links to.

- Start page: [`/`](pages/index.md) (1 page links here)
- Not linked: [`/settings`](pages/settings.md) (nothing in the app links here)
- Not linked: [`/users`](pages/users.md) (nothing in the app links here)

## Main flows

4 flows, 0 confirmed.

- AddTodoForm submit: [`/ → /todos/[id]`](flows/addtodoform-submit.md) (5 steps)
- TodoList change: [`/`](flows/todolist-change.md) (4 steps)
- UserList click: [`/users`](flows/userlist-click.md) (2 steps)
- UserList mouseenter: [`/users`](flows/userlist-mouseenter.md) (2 steps)

## Backends

7 endpoints.

- External: [`{NEXT_PUBLIC_API_URL ?? http://localhost:4010}`](endpoints.md#host-env_NEXT_PUBLIC_API_URL) (7 endpoints, 7 called from the browser)

## Where things live

- Root layout: [`src/app/layout.tsx`](components/RootLayout.md)
- Sends requests: `src/services/todos.ts` (13 requests)
- Type: [`Todo`](types.md#typ_0fc96ucq8sd) (src/types/todo.ts, used 8 times)
- Type: [`User`](types.md#typ_25sov0zzv45) (src/types/user.ts, used 5 times)

## To check

The scan resolved every page, component, type and request.
