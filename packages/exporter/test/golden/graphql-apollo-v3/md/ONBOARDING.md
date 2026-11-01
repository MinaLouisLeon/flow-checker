# graphql-apollo-v3: start here

A short tour of this Next.js 16.4.3 app, read from its code by flow-checker. [The full docs](README.md) have every page, component, request and flow.

## Stack

- Next.js: [16.4.3](README.md) (App Router in src/app/, 3 pages, 1 route handler)
- Rendering: [4 server, 6 client, 0 shared](README.md) (10 components)
- Data: GraphQL (apollo) (6 requests)

## Areas

3 areas by URL.

- home: [`/`](areas.md#ar_1vn39fso9m3) (1 page, 1 flow, 3 endpoints)
- search: [`/search`](areas.md#ar_1d3830wqgab) (1 page, 1 flow, 1 endpoint)
- todos: [`/todos`](areas.md#ar_1zap1ick15k) (1 page, 1 flow, 2 endpoints)

## Entry pages

1 page nothing links to.

- Start page: [`/`](pages/index.md) (1 page links here)
- Not linked: [`/search`](pages/search.md) (nothing in the app links here)

## Main flows

3 flows, 0 confirmed.

- AddTodoForm submit: [`/ → /todos/[id]`](flows/addtodoform-submit.md) (6 steps)
- TodoDetail click: [`/todos/[id] → /`](flows/tododetail-click.md) (5 steps)
- Search submit: [`/search`](flows/search-submit.md) (2 steps)

## Backends

6 endpoints.

- This app: [This app's API](endpoints.md#host-app) (6 endpoints, 6 called from the browser)

## Where things live

- Root layout: [`src/app/layout.tsx`](components/RootLayout.md)
- Route handlers: [`src/app/api/`](README.md) (1 handler)
- Type: [`TodoVars`](types.md#typ_1fpq9nx1vnr) (src/types/todo.ts, used 3 times)
- Type: [`AddTodoData`](types.md#typ_0wlmt9r8y2s) (src/types/todo.ts, used 2 times)

## To check

The scan resolved every page, component, type and request.
