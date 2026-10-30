# Flow: TodoDetail click

[← Overview](../README.md)

|  |  |
| --- | --- |
| Starts | [`TodoDetail`](../components/TodoDetail.md) on [`/todos/[id]`](../pages/todos.%5Bid%5D.md) |
| Pages | [`/todos/[id]`](../pages/todos.%5Bid%5D.md) |
| Status | not walked yet |

## Sequence

```mermaid
sequenceDiagram
  actor U as User
  participant P0 as /todos/[id]
  participant P1 as /api/graphql (handler)
  U->>P0: onClick (TodoDetail)
  P0->>P1: POST /api/graphql
  P1-->>P0: 200 ToggleTodoMutation
```

## Steps

| # | Step | Detail |
| ---: | --- | --- |
| 1 | User `onClick` in [`TodoDetail`](../components/TodoDetail.md) on [`/todos/[id]`](../pages/todos.%5Bid%5D.md) | `src/components/TodoDetail.tsx:41` |
| 2 | [`POST /api/graphql`](#req_0pkoq320yzc) | body `ToggleTodoMutationVariables` · response `ToggleTodoMutation` · ✓ verified (1 capture) |

## Requests

### <a id="req_0pkoq320yzc"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoDetail`](../components/TodoDetail.md) · `src/components/TodoDetail.tsx:32` |
| Trigger | event onClick |
| Transport | graphql · `useMutation` |
| URL | `/api/graphql` |
| GraphQL | [`ToggleTodo`](../graphql.md#operation-ToggleTodo) (mutation) |
| Handled by | [`/api/graphql`](../pages/api.graphql.md) |

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
