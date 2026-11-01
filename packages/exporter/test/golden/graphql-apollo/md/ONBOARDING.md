# graphql-apollo: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in src/app/, 3 pages, 1 route handler)
- Rendering: [4 server, 9 client, 0 shared](README.md) (13 components)
- Data: GraphQL (apollo) (7 requests)

## Areas

3 areas by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page, 1 flow, 3 endpoints)
- todos: [`/todos`](areas.md#ar_1zap1ick15k) (1 page, 1 flow, 2 endpoints)
- users: [`/users`](areas.md#ar_0tirr3qjab5) (1 page, 2 flows, 2 endpoints)

## Entry pages

1 page nothing links to.

- Start page: [`/`](pages/index.md)
- Not linked: [`/users`](pages/users.md) (nothing in the app links here)

## Main flows

4 flows, 0 confirmed.

- AddTodoForm submit: [`/ → /todos/[id]`](flows/addtodoform-submit.md) (5 steps)
- TodoView click: [`/todos/[id]`](flows/todoview-click.md) (2 steps)
- UserSearch click: [`/users`](flows/usersearch-click.md) (2 steps)
- UserSearch submit: [`/users`](flows/usersearch-submit.md) (2 steps)

## Backends

7 endpoints.

- This app: [This app's API](endpoints.md#host-app) (7 endpoints, 7 called from the browser)

## Where things live

- Root layout: [`src/app/layout.tsx`](components/RootLayout.md)
- Route handlers: [`src/app/api/`](README.md) (1 handler)
- Type: [`TodoItemFragment`](types.md#typ_10ogag4yxtl) (src/gql/graphql.ts, used 2 times)
- Type: [`TodoStatus`](types.md#typ_25jlj2yb23q) (src/gql/graphql.ts, used 2 times)

## To check

The scan resolved every page, component, type and request.
