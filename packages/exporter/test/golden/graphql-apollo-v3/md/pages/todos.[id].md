# Page `/todos/[id]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/todos/[id]/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Status | ✓ 2 verified |

## Component tree

- [`TodoPage`](../components/TodoPage.md) · server
  - [`TodoDetail`](../components/TodoDetail.md) · client · ⇄ 2 requests

## Navigation

- From [`/`](index.md) (push, link)
- To [`/`](index.md) (push)

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)
- [TodoDetail click](../flows/tododetail-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_1pbvj0u5igd) | page-load | [`TodoDetail`](../components/TodoDetail.md) | ✓ verified (2 captures) |
| [`POST /api/graphql`](#req_16r77ymnxz7) | event onClick | [`TodoDetail`](../components/TodoDetail.md) | ✓ verified (2 captures) |

### <a id="req_1pbvj0u5igd"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoDetail`](../components/TodoDetail.md) · `src/components/TodoDetail.tsx:10` |
| Trigger | page-load |
| Transport | graphql · `useQuery` |
| URL | `/api/graphql` |
| GraphQL | [`Todo`](../graphql.md#operation-Todo) (query) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Request body** [`TodoVars`](../types.md#typ_1fpq9nx1vnr)

```ts
{ id: string }
```

**Response** [`TodoData`](../types.md#typ_255hzpa6ygn)

```ts
{ todo: TodoDetailFields | null }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 48 ms · 2026-10-30 10:33 UTC · page `/todos/4` (newest of 2)

Request body:

```json
{
  "operationName": "Todo",
  "variables": {
    "id": "4"
  },
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "0e09449f79c9be377ed88e00b678e281364eebfbe732f99daa5b3f2b049f76bd"
    }
  },
  "query": "query Todo($id: ID!) {\n  todo(id: $id) {\n    ...TodoFields\n    status\n    owner {\n      id\n      name\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment TodoFields on Todo {\n  id\n  title\n  done\n  __typename\n}"
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
      "__typename": "Todo",
      "status": "OPEN",
      "owner": {
        "id": "u1",
        "name": "Ada Lovelace",
        "__typename": "User"
      }
    }
  }
}
```

### <a id="req_16r77ymnxz7"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoDetail`](../components/TodoDetail.md) · `src/components/TodoDetail.tsx:11` |
| Trigger | event onClick |
| Transport | graphql · `useMutation` |
| URL | `/api/graphql` |
| GraphQL | [`DeleteTodo`](../graphql.md#operation-DeleteTodo) (mutation) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Request body** [`TodoVars`](../types.md#typ_1fpq9nx1vnr)

```ts
{ id: string }
```

**Response** [`DeleteTodoData`](../types.md#typ_23z70ad4x4v)

```ts
{ deleteTodo: boolean }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 19 ms · 2026-10-30 10:33 UTC · page `/todos/4` (newest of 2)

Request body:

```json
{
  "operationName": "DeleteTodo",
  "variables": {
    "id": "4"
  },
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "df3507b3704816b720732c21aad5660fc53324e32318046d72fc0096ec7bc27f"
    }
  },
  "query": "mutation DeleteTodo($id: ID!) {\n  deleteTodo(id: $id)\n}"
}
```

Response body:

```json
{
  "data": {
    "deleteTodo": true
  }
}
```
