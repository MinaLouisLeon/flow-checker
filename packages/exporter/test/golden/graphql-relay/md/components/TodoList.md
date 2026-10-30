# Component `TodoList`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/TodoList.tsx:7` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |
| Renders | [`TodoItem`](TodoItem.md) |

## Props

Takes no props.

## Types used

- [`TodoListQuery`](../types.md#typ_1hnuzynwht2)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_0ixcyoz99u0) | page-load | [`TodoList`]() | ✓ verified (1 capture) |

### <a id="req_0ixcyoz99u0"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoList`]() · `src/components/TodoList.tsx:8` |
| Trigger | page-load |
| Transport | graphql · `useLazyLoadQuery` |
| URL | `/api/graphql` |
| GraphQL | [`TodoListQuery`](../graphql.md#operation-TodoListQuery) (query) |
| Handled by | [`/api/graphql`](../pages/api.graphql.md) |

**Request body** [`TodoListQuery$variables`](../types.md#typ_0sd209oo5ki)

```ts
{ [key: string]: never }
```

**Response** `TodoListQuery$data`

```ts
{
  readonly todos: readonly { readonly id: string; readonly done: boolean; readonly title: string }[]
}
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 370 ms · 2026-10-30 10:34 UTC · page `/`

Request body:

```json
{
  "doc_id": "3f68cfe7f95fdfd770274ece724d3623c361f4a0c3a21e96fdfbf28d3d75153d",
  "variables": {}
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
        "done": true
      },
      {
        "id": "2",
        "title": "Add a route handler",
        "done": false
      },
      {
        "id": "3",
        "title": "Try a persisted query",
        "done": false
      }
    ]
  }
}
```
