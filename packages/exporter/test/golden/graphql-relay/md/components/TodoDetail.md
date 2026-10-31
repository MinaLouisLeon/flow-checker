# Component `TodoDetail`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/TodoDetail.tsx:27` |
| Kind | client (`'use client'`) |
| Used on | [`/todos/[id]`](../pages/todos.%5Bid%5D.md) |
| Rendered by | [`TodoPage`](TodoPage.md) |

## Props

`{ id: string; queryRef: PreloadedQuery<TodoDetailQuery> }` (see [`TodoDetailQuery$variables`](../types.md#typ_1ji4t5gnvh0))

```ts
{
  id: string
  queryRef: {
    kind: "PreloadedQuery"
    environment: Environment
    environmentProviderOptions?: { [key: string]: unknown } | null
    fetchKey: string | number
    fetchPolicy: "store-or-network" | "store-and-network" | "network-only"
    networkCacheConfig?: CacheConfig | null
    id?: string | null
    name: string
    source?: RelayObservable<GraphQLResponse> | null
    variables: TodoDetailQuery$variables
    dispose: () => void
    isDisposed: boolean
  }
}
```

## Types used

- [`TodoDetailQuery`](../types.md#typ_21jc4oi1jmb)
- [`TodoDetailToggleMutation`](../types.md#typ_0hkj1ywjyme)

## Flows

- [TodoDetail click](../flows/tododetail-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_0manrbz632m) | event onClick | [`TodoDetail`]() | ✓ verified (1 capture) |

### <a id="req_0manrbz632m"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoDetail`]() · `src/components/TodoDetail.tsx:32` |
| Trigger | event onClick |
| Transport | graphql · `commitMutation` |
| URL | `/api/graphql` |
| GraphQL | [`TodoDetailToggleMutation`](../graphql.md#operation-TodoDetailToggleMutation) (mutation) |
| Handled by | [`/api/graphql`](../pages/api.graphql.md) |

**Request body** [`TodoDetailToggleMutation$variables`](../types.md#typ_0rtunk5nqpl)

```ts
{ id: string }
```

**Response** [`TodoDetailToggleMutation$data`](../types.md#typ_269jvnd7qf5)

```ts
{ readonly toggleTodo: { readonly done: boolean; readonly id: string } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 24 ms · 2026-10-30 10:35 UTC · page `/todos/4`

Request body:

```json
{
  "doc_id": "ca3885e07dab7aa341848f8d0138896377bf5af08ce9e5106c59714b07e26adf",
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
      "done": true
    }
  }
}
```
