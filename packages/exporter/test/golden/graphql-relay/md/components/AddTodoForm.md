# Component `AddTodoForm`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/AddTodoForm.tsx:8` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Types used

- [`AddTodoFormMutation`](../types.md#typ_0nkk0lukv3w)

## Navigation

- push `/todos/:id` → [`/todos/[id]`](../pages/todos.%5Bid%5D.md) · event onSubmit · on success · `src/components/AddTodoForm.tsx:24`
- push `/todos/:id` → [`/todos/[id]`](../pages/todos.%5Bid%5D.md) · event onSubmit · `src/components/AddTodoForm.tsx:24`

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_25b0dzm9av8) | event onSubmit | [`AddTodoForm`]() | ✓ verified (1 capture) |

### <a id="req_25b0dzm9av8"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`AddTodoForm`]() · `src/components/AddTodoForm.tsx:11` |
| Trigger | event onSubmit |
| Transport | graphql · `useMutation` |
| URL | `/api/graphql` |
| GraphQL | [`AddTodoFormMutation`](../graphql.md#operation-AddTodoFormMutation) (mutation) |
| Handled by | [`/api/graphql`](../pages/api.graphql.md) |

**Request body** [`AddTodoFormMutation$variables`](../types.md#typ_1jk7p5vwxhg)

```ts
{ input: AddTodoInput }
```

**Response** [`AddTodoFormMutation$data`](../types.md#typ_07be3pbscua)

```ts
{ readonly addTodo: { readonly id: string; readonly title: string } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 33 ms · 2026-10-30 10:34 UTC · page `/`

Request body:

```json
{
  "doc_id": "7b287a25c92827de62ee76b0bdbdc3a1f06652f85ea710168f89cd568052bf8d",
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
      "title": "Record captures"
    }
  }
}
```
