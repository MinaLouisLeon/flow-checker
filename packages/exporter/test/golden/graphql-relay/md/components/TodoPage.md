# Component `TodoPage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/TodoPage.tsx:8` |
| Kind | client (`'use client'`) |
| Used on | [`/todos/[id]`](../pages/todos.%5Bid%5D.md) |
| Rendered by | [`Page`](Page.md) |
| Renders | `Suspense` (`react`), [`TodoDetail`](TodoDetail.md) |

## Props

`{ id: string }`

## Types used

- [`TodoDetailQuery`](../types.md#typ_21jc4oi1jmb)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_0b9cucu4bbq) | effect | [`TodoPage`]() | ✓ verified (1 capture) |

### <a id="req_0b9cucu4bbq"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoPage`]() · `src/components/TodoPage.tsx:9` |
| Trigger | effect |
| Transport | graphql · `useQueryLoader` |
| URL | `/api/graphql` |
| GraphQL | [`TodoDetailQuery`](../graphql.md#operation-TodoDetailQuery) (query) |
| Handled by | [`/api/graphql`](../pages/api.graphql.md) |

**Request body** [`TodoDetailQuery$variables`](../types.md#typ_1ji4t5gnvh0)

```ts
{ id: string }
```

**Response** [`TodoDetailQuery$data`](../types.md#typ_1m5qqany6tv)

```ts
{
  readonly todo: 
    | {
      readonly done: boolean
      readonly id: string
      readonly owner: { readonly name: string }
      readonly status: TodoStatus
      readonly title: string
    }
    | null
    | undefined
}
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 58 ms · 2026-10-30 10:34 UTC · page `/todos/4`

Request body:

```json
{
  "doc_id": "feffca234775cf9b6036b7f757110fbf6f4094f87f75b06bfefb31e31110034d",
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
      "done": false,
      "status": "OPEN",
      "owner": {
        "name": "Ada Lovelace",
        "id": "u1"
      }
    }
  }
}
```
