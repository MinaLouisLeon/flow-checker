# Page `/todos/[id]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/todos/[id]/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Rendering | dynamic |
| Title | `urql fixture` |
| Status | ✓ 2 verified |

## Rendering

- dynamic: has the dynamic segment `[id]` and no `generateStaticParams` (page)

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page

## Client boundaries

2 `'use client'` boundaries bring 2 components and 3 project modules (about 1.5 KB of source) to the browser, plus 1 package (`urql`).

- [`Providers`](../components/Providers.md), rendered by `RootLayout` (layout): 1 component · 2 modules · 0.6 KB, `src/app/layout.tsx:10`
  - packages: `urql`
- [`TodoDetail`](../components/TodoDetail.md), rendered by `TodoPage` (page): 1 component · 1 module · 0.9 KB, `src/app/todos/[id]/page.tsx:5`
  - packages: `urql`

## Metadata

- layout `metadata`: title, `src/app/layout.tsx:4`

## Component tree

- [`TodoPage`](../components/TodoPage.md) · server
  - [`TodoDetail`](../components/TodoDetail.md) · client · ⇄ 2 requests

## Navigation

- From [`/`](index.md) (push, link)

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)
- [TodoDetail click](../flows/tododetail-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/graphql`](#req_13zx8cl90id) | page-load | [`TodoDetail`](../components/TodoDetail.md) | ✓ verified (2 captures) |
| [`POST /api/graphql`](#req_0pkoq320yzc) | event onClick | [`TodoDetail`](../components/TodoDetail.md) | ✓ verified (1 capture) |

### <a id="req_13zx8cl90id"></a>`GET /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoDetail`](../components/TodoDetail.md) · `src/components/TodoDetail.tsx:31` |
| Trigger | page-load |
| Transport | graphql · `useQuery` |
| URL | `/api/graphql` |
| GraphQL | [`Todo`](../graphql.md#operation-Todo) (query) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Request body** `TodoQueryVariables`

```ts
{ id: string }
```

**Response** `TodoQuery`

```ts
{
  todo: 
    | {
      id: string
      title: string
      done: boolean
      status: "OPEN" | "DONE"
      owner: { name: string; email: string }
    }
    | null
}
```

**Captured** `GET http://localhost:3077/api/graphql` → 200 OK · 43 ms · 2026-10-30 10:34 UTC · page `/todos/4` (newest of 2)

Request body:

```json
{
  "query": "query Todo($id: ID!) {\n  todo(id: $id) {\n    id\n    title\n    done\n    status\n    owner {\n      name\n      email\n      __typename\n    }\n    __typename\n  }\n}",
  "operationName": "Todo",
  "variables": {
    "id": "4"
  }
}
```

Response body:

```json
{
  "data": {
    "todo": {
      "id": "4",
      "title": "Record captures",
      "done": true,
      "status": "DONE",
      "owner": {
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "__typename": "User"
      },
      "__typename": "Todo"
    }
  }
}
```

### <a id="req_0pkoq320yzc"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoDetail`](../components/TodoDetail.md) · `src/components/TodoDetail.tsx:32` |
| Trigger | event onClick |
| Transport | graphql · `useMutation` |
| URL | `/api/graphql` |
| GraphQL | [`ToggleTodo`](../graphql.md#operation-ToggleTodo) (mutation) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Request body** `ToggleTodoMutationVariables`

```ts
{ id: string }
```

**Response** `ToggleTodoMutation`

```ts
{ toggleTodo: { id: string; done: boolean; status: "OPEN" | "DONE" } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 27 ms · 2026-10-30 10:34 UTC · page `/todos/4`

Request body:

```json
{
  "operationName": "ToggleTodo",
  "query": "mutation ToggleTodo($id: ID!) {\n  toggleTodo(id: $id) {\n    id\n    done\n    status\n    __typename\n  }\n}",
  "variables": {
    "id": "4"
  }
}
```

Response body:

```json
{
  "data": {
    "toggleTodo": {
      "id": "4",
      "done": true,
      "status": "DONE",
      "__typename": "Todo"
    }
  }
}
```
