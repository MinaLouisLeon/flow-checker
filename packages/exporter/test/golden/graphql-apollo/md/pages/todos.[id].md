# Page `/todos/[id]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/todos/[id]/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Status | ✓ 2 verified |

## Component tree

- [`TodoPage`](../components/TodoPage.md) · server
  - [`TodoDetail`](../components/TodoDetail.md) · client
    - [`ClientOnly`](../components/ClientOnly.md) · client
    - `Suspense` · external (`react`)
    - [`TodoView`](../components/TodoView.md) · client · ⇄ 2 requests

## Navigation

- From [`/`](index.md) (push, link)

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)
- [TodoView click](../flows/todoview-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_0y9v4qo3n8x) | page-load | [`TodoView`](../components/TodoView.md) | ✓ verified (1 capture) |
| [`POST /api/graphql`](#req_08vp0aultnf) | event onClick | [`TodoView`](../components/TodoView.md) | ✓ verified (1 capture) |

### <a id="req_0y9v4qo3n8x"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoView`](../components/TodoView.md) · `src/components/TodoDetail.tsx:33` |
| Trigger | page-load |
| Transport | graphql · `useSuspenseQuery` |
| URL | `/api/graphql` |
| GraphQL | [`Todo`](../graphql.md#operation-Todo) (query) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Request body** [`Exact<{ id: string | number; }>`](../types.md#typ_0kk3su9xks9)

```ts
{ id: string | number }
```

**Response** [`TodoQuery`](../types.md#typ_18j2vjt684p)

```ts
{
  todo: 
    | {
      id: string
      title: string
      done: boolean
      status: TodoStatus
      owner: { name: string }
    }
    | null
}
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 · 21 ms · 2026-10-30 10:33 UTC · page `/todos/4`

Request body:

```json
{
  "operationName": "Todo",
  "variables": {
    "id": "4"
  },
  "extensions": {
    "clientLibrary": {
      "name": "@apollo/client",
      "version": "4.3.5"
    }
  },
  "query": "query Todo($id: ID!) {\n  todo(id: $id) {\n    id\n    title\n    done\n    status\n    owner {\n      name\n      __typename\n    }\n    __typename\n  }\n}"
}
```

Response body:

```json
{
  "data": {
    "todo": {
      "id": "4",
      "title": "Record captures",
      "done": false,
      "status": "OPEN",
      "owner": {
        "name": "Ada Lovelace",
        "__typename": "User"
      },
      "__typename": "Todo"
    }
  }
}
```

### <a id="req_08vp0aultnf"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoView`](../components/TodoView.md) · `src/components/TodoDetail.tsx:34` |
| Trigger | event onClick |
| Transport | graphql · `useMutation` |
| URL | `/api/graphql` |
| GraphQL | [`ToggleTodo`](../graphql.md#operation-ToggleTodo) (mutation) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Request body** [`Exact<{ id: string | number; }>`](../types.md#typ_0kk3su9xks9)

```ts
{ id: string | number }
```

**Response** [`ToggleTodoMutation`](../types.md#typ_0r3wizusxxi)

```ts
{ toggleTodo: { id: string; done: boolean; status: TodoStatus } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 · 20 ms · 2026-10-30 10:33 UTC · page `/todos/4`

Request body:

```json
{
  "operationName": "ToggleTodo",
  "variables": {
    "id": "4"
  },
  "extensions": {
    "clientLibrary": {
      "name": "@apollo/client",
      "version": "4.3.5"
    }
  },
  "query": "mutation ToggleTodo($id: ID!) {\n  toggleTodo(id: $id) {\n    id\n    done\n    status\n    __typename\n  }\n}"
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
