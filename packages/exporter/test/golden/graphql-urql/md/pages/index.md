# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Status | ✓ 2 verified |

## Component tree

- [`HomePage`](../components/HomePage.md) · server
  - [`TodoList`](../components/TodoList.md) · client · ⇄ 1 request
    - `Link` · external (`next/link`) · conditional
  - [`AddTodoForm`](../components/AddTodoForm.md) · client · ⇄ 1 request

## Navigation

- To [`/todos/[id]`](todos.%5Bid%5D.md) (push, link)

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_1ncc9k5xsh8) | event onSubmit | [`AddTodoForm`](../components/AddTodoForm.md) | ✓ verified (1 capture) |
| [`GET /api/graphql`](#req_19g4fbnqrgn) | page-load | [`TodoList`](../components/TodoList.md) | ✓ verified (2 captures) |

### <a id="req_1ncc9k5xsh8"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`AddTodoForm`](../components/AddTodoForm.md) · `src/components/AddTodoForm.tsx:19` |
| Trigger | event onSubmit |
| Transport | graphql · `useMutation` |
| URL | `/api/graphql` |
| GraphQL | [`AddTodo`](../graphql.md#operation-AddTodo) (mutation) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Request body** `AddTodoMutationVariables`

```ts
{ input: { title: string; ownerId?: string | null } }
```

**Response** `AddTodoMutation`

```ts
{ addTodo: { id: string; title: string } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 36 ms · 2026-10-30 10:34 UTC · page `/`

Request body:

```json
{
  "operationName": "AddTodo",
  "query": "mutation AddTodo($input: AddTodoInput!) {\n  addTodo(input: $input) {\n    id\n    title\n    __typename\n  }\n}",
  "variables": {
    "input": {
      "title": "Record captures"
    }
  }
}
```

Response body:

```json
{
  "data": {
    "addTodo": {
      "id": "4",
      "title": "Record captures",
      "__typename": "Todo"
    }
  }
}
```

### <a id="req_19g4fbnqrgn"></a>`GET /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoList`](../components/TodoList.md) · `src/components/TodoList.tsx:18` |
| Trigger | page-load |
| Transport | graphql · `useQuery` |
| URL | `/api/graphql` |
| GraphQL | [`Todos`](../graphql.md#operation-Todos) (query) |
| Handled by | [`/api/graphql`](api.graphql.md) |

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
