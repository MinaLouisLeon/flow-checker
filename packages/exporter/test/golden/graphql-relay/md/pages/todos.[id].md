# Page `/todos/[id]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/todos/[id]/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Status | ✓ 2 verified |

## Component tree

- [`Page`](../components/Page.md) · server
  - [`TodoPage`](../components/TodoPage.md) · client · ⇄ 1 request
    - `Suspense` · external (`react`) · conditional
    - [`TodoDetail`](../components/TodoDetail.md) · client · ⇄ 1 request · conditional

## Navigation

- From [`/`](index.md) (push, link)

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)
- [TodoDetail click](../flows/tododetail-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_0manrbz632m) | event onClick | [`TodoDetail`](../components/TodoDetail.md) | ✓ verified (1 capture) |
| [`POST /api/graphql`](#req_0b9cucu4bbq) | effect | [`TodoPage`](../components/TodoPage.md) | ✓ verified (1 capture) |

### <a id="req_0manrbz632m"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoDetail`](../components/TodoDetail.md) · `src/components/TodoDetail.tsx:32` |
| Trigger | event onClick |
| Transport | graphql · `commitMutation` |
| URL | `/api/graphql` |
| GraphQL | [`TodoDetailToggleMutation`](../graphql.md#operation-TodoDetailToggleMutation) (mutation) |
| Handled by | [`/api/graphql`](api.graphql.md) |

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

### <a id="req_0b9cucu4bbq"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoPage`](../components/TodoPage.md) · `src/components/TodoPage.tsx:9` |
| Trigger | effect |
| Transport | graphql · `useQueryLoader` |
| URL | `/api/graphql` |
| GraphQL | [`TodoDetailQuery`](../graphql.md#operation-TodoDetailQuery) (query) |
| Handled by | [`/api/graphql`](api.graphql.md) |

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
