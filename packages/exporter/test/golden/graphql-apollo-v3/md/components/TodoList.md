# Component `TodoList`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/TodoList.tsx:8` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |
| Renders | `Link` (`next/link`) |

## Props

Takes no props.

## Types used

- [`TodosData`](../types.md#typ_1qf74f1isvg)

## Navigation

- link `/todos/:id` → [`/todos/[id]`](../pages/todos.%5Bid%5D.md) · event onClick · conditional · `src/components/TodoList.tsx:15`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_0tco1ayy7vx) | page-load | [`TodoList`]() | ✓ verified (3 captures) |

### <a id="req_0tco1ayy7vx"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`TodoList`]() · `src/components/TodoList.tsx:9` |
| Trigger | page-load |
| Transport | graphql · `useQuery` |
| URL | `/api/graphql` |
| GraphQL | [`Todos`](../graphql.md#operation-Todos) (query) |
| Handled by | [`/api/graphql`](../pages/api.graphql.md) |

**Response** [`TodosData`](../types.md#typ_1qf74f1isvg)

```ts
{ todos: TodoFields[] }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 35 ms · 2026-10-30 10:33 UTC · page `/` (newest of 3)

Request body:

```json
{
  "operationName": "Todos",
  "variables": {},
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "01222f14ad0e3236e408a6372a7a1d8249955ac5cef1542d8f53b55ed9b94911"
    }
  }
}
```

Response body:

```json
{
  "data": {
    "todos": [
      {
        "id": "1",
        "title": "Write the schema",
        "done": true,
        "__typename": "Todo"
      },
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
