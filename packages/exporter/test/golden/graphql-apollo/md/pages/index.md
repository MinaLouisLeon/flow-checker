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
    - [`TodoItem`](../components/TodoItem.md) · client
      - `Link` · external (`next/link`) · conditional
  - [`AddTodoForm`](../components/AddTodoForm.md) · client · ⇄ 1 request

## Navigation

- To [`/todos/[id]`](todos.%5Bid%5D.md) (push, link)

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_1se0zfbjglz) | event onSubmit | [`AddTodoForm`](../components/AddTodoForm.md) | ✓ verified (1 capture) |
| [`POST /api/graphql`](#req_1cmdvpo38br) | page-load | [`TodoList`](../components/TodoList.md) | ✓ verified (3 captures) |
| [`POST /api/graphql`](#req_235i024m0l6) | page-load | [`ViewerBadge`](../components/ViewerBadge.md) | ✓ verified (1 capture) |

### <a id="req_1se0zfbjglz"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`AddTodoForm`](../components/AddTodoForm.md) · `src/components/AddTodoForm.tsx:20` |
| Trigger | event onSubmit |
| Transport | graphql · `useMutation` |
| URL | `/api/graphql` |
| GraphQL | [`AddTodo`](../graphql.md#operation-AddTodo) (mutation) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Request body** [`Exact<{ input: AddTodoInput; }>`](../types.md#typ_164dkm81jm4)

```ts
{ input: AddTodoInput }
```

**Response** [`AddTodoMutation`](../types.md#typ_16ca9i9k1a7)

```ts
{ addTodo: { id: string; title: string } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 · 20 ms · 2026-10-30 10:33 UTC · page `/`

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
    "clientLibrary": {
      "name": "@apollo/client",
      "version": "4.3.5"
    }
  },
  "query": "mutation AddTodo($input: AddTodoInput!) {\n  addTodo(input: $input) {\n    id\n    title\n    __typename\n  }\n}"
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

### <a id="req_1cmdvpo38br"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`TodoList`](../components/TodoList.md) · `src/components/TodoList.tsx:19` |
| Trigger | page-load |
| Transport | graphql · `useQuery` |
| URL | `/api/graphql` |
| GraphQL | [`Todos`](../graphql.md#operation-Todos) (query) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Request body** [`Exact<{ status?: TodoStatus | null | undefined; }>`](../types.md#typ_0oaau18ifc2)

```ts
{ status?: "DONE" | "OPEN" | null }
```

**Response** `TodosQuery`

```ts
{ todos: { id: string; title: string; done: boolean }[] }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 · 22 ms · 2026-10-30 10:33 UTC · page `/` (newest of 3)

Request body:

```json
{
  "operationName": "Todos",
  "variables": {
    "status": "OPEN"
  },
  "extensions": {
    "clientLibrary": {
      "name": "@apollo/client",
      "version": "4.3.5"
    }
  },
  "query": "query Todos($status: TodoStatus) {\n  todos(status: $status) {\n    id\n    ...TodoItem\n    __typename\n  }\n}\n\nfragment TodoItem on Todo {\n  id\n  title\n  done\n  __typename\n}"
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

### <a id="req_235i024m0l6"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`ViewerBadge`](../components/ViewerBadge.md) · `src/components/ViewerBadge.tsx:16` |
| Trigger | page-load |
| Transport | graphql · `useQuery` |
| URL | `/api/graphql` |
| GraphQL | [`Viewer`](../graphql.md#operation-Viewer) (query) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Response** [`ViewerQuery`](../types.md#typ_201lug1iryj)

```ts
{ viewer: { id: string; name: string } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 · 315 ms · 2026-10-30 10:33 UTC · page `/`

Request body:

```json
{
  "operationName": "Viewer",
  "variables": {},
  "extensions": {
    "clientLibrary": {
      "name": "@apollo/client",
      "version": "4.3.5"
    }
  },
  "query": "query Viewer {\n  viewer {\n    id\n    name\n    __typename\n  }\n}"
}
```

Response body:

```json
{
  "data": {
    "viewer": {
      "id": "u1",
      "name": "Ada Lovelace",
      "__typename": "User"
    }
  }
}
```
