# Page `/todos/[id]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/todos/[id]/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Status | ✓ 2 verified |

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
