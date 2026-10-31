# Component `TodoList`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/TodoList.tsx:17` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |
| Renders | `Link` (`next/link`) |

## Props

Takes no props.

## Navigation

- link `/todos/:id` → [`/todos/[id]`](../pages/todos.%5Bid%5D.md) · event onClick · conditional · `src/components/TodoList.tsx:24`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/graphql`](#req_19g4fbnqrgn) | page-load | [`TodoList`]() | ✓ verified (2 captures) |

### <a id="req_19g4fbnqrgn"></a>`GET /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoList`]() · `src/components/TodoList.tsx:18` |
| Trigger | page-load |
| Transport | graphql · `useQuery` |
| URL | `/api/graphql` |
| GraphQL | [`Todos`](../graphql.md#operation-Todos) (query) |
| Handled by | [`/api/graphql`](../pages/api.graphql.md) |

**Request body** `TodosQueryVariables`

```ts
{ status?: "OPEN" | "DONE" | null }
```

**Response** `TodosQuery`

```ts
{ todos: { id: string; title: string; done: boolean }[] }
```

**Captured** `GET http://localhost:3077/api/graphql` → 200 OK · 30 ms · 2026-10-30 10:34 UTC · page `/` (newest of 2)

Request body:

```json
{
  "query": "query Todos($status: TodoStatus) {\n  todos(status: $status) {\n    id\n    title\n    done\n    __typename\n  }\n}",
  "operationName": "Todos",
  "variables": {
    "status": "OPEN"
  }
}
```

Response body:

```json
{
  "data": {
    "todos": [
      {
        "id": "2",
        "title": "Add a route handler",
        "done": false,
        "__typename": "Todo"
      },
      {
        "id": "3",
        "title": "Try a persisted query",
        "done": false,
        "__typename": "Todo"
      },
      {
        "id": "4",
        "title": "Record captures",
        "done": false,
        "__typename": "Todo"
      }
    ]
  }
}
```
