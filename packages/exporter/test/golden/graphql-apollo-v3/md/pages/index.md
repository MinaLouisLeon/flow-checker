# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Status | ✓ 3 verified |

## Component tree

- [`HomePage`](../components/HomePage.md) · server
  - [`ViewerBadge`](../components/ViewerBadge.md) · client · ⇄ 1 request
  - [`TodoList`](../components/TodoList.md) · client · ⇄ 1 request
    - `Link` · external (`next/link`) · conditional
  - [`AddTodoForm`](../components/AddTodoForm.md) · client · ⇄ 1 request

## Navigation

- To [`/todos/[id]`](todos.%5Bid%5D.md) (push, link)
- From [`/todos/[id]`](todos.%5Bid%5D.md) (push)

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)
- [TodoDetail click](../flows/tododetail-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_1vvhclt0a1p) | event onSubmit | [`AddTodoForm`](../components/AddTodoForm.md) | ✓ verified (2 captures) |
| [`POST /api/graphql`](#req_0tco1ayy7vx) | page-load | [`TodoList`](../components/TodoList.md) | ✓ verified (3 captures) |
| [`POST /api/graphql`](#req_0zshh8iwl6e) | page-load | [`ViewerBadge`](../components/ViewerBadge.md) | ✓ verified (3 captures) |

### <a id="req_1vvhclt0a1p"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`AddTodoForm`](../components/AddTodoForm.md) · `src/components/AddTodoForm.tsx:12` |
| Trigger | event onSubmit |
| Transport | graphql · `useMutation` |
| URL | `/api/graphql` |
| GraphQL | [`AddTodo`](../graphql.md#operation-AddTodo) (mutation) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Request body** [`AddTodoVars`](../types.md#typ_1bkwuejlfje)

```ts
{ input: { title: string; ownerId?: string } }
```

**Response** [`AddTodoData`](../types.md#typ_0wlmt9r8y2s)

```ts
{ addTodo: TodoFields }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 23 ms · 2026-10-30 10:33 UTC · page `/` (newest of 2)

Request body:

```json
{
  "operationName": "AddTodo",
  "variables": {
    "input": {
      "title": "Record captures"
    }
  },
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "3f1819d16ee54d56e45ae7998635162e64d71eb45a18c10421f47aed72e9e02e"
    }
  },
  "query": "mutation AddTodo($input: AddTodoInput!) {\n  addTodo(input: $input) {\n    ...TodoFields\n    __typename\n  }\n}\n\nfragment TodoFields on Todo {\n  id\n  title\n  done\n  __typename\n}"
}
```

Response body:

```json
{
  "data": {
    "addTodo": {
      "id": "4",
      "title": "Record captures",
      "done": false,
      "__typename": "Todo"
    }
  }
}
```

### <a id="req_0tco1ayy7vx"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`TodoList`](../components/TodoList.md) · `src/components/TodoList.tsx:9` |
| Trigger | page-load |
| Transport | graphql · `useQuery` |
| URL | `/api/graphql` |
| GraphQL | [`Todos`](../graphql.md#operation-Todos) (query) |
| Handled by | [`/api/graphql`](api.graphql.md) |

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

### <a id="req_0zshh8iwl6e"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`ViewerBadge`](../components/ViewerBadge.md) · `src/components/ViewerBadge.tsx:8` |
| Trigger | page-load |
| Transport | graphql · `useQuery` |
| URL | `/api/graphql` |
| GraphQL | [`Viewer`](../graphql.md#operation-Viewer) (query) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Response** [`ViewerData`](../types.md#typ_1y0i7pm0ntp)

```ts
{ viewer: User }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 23 ms · 2026-10-30 10:33 UTC · page `/` (newest of 3)

Request body:

```json
{
  "operationName": "Viewer",
  "variables": {},
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "11989ecb8468c2f61be018171850054bc1968ecc87dd54708dc1b207f7b6cfaf"
    }
  }
}
```

Response body:

```json
{
  "data": {
    "viewer": {
      "id": "u1",
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "__typename": "User"
    }
  }
}
```
