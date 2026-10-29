# Component `AddTodoForm`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/AddTodoForm.tsx:9` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`TodosPage`](TodosPage.md) |

## Props

Takes no props.

## Navigation

- push `/todos/:id` → [`/todos/[id]`](../pages/todos.%5Bid%5D.md) · event onSubmit · on success · `src/components/AddTodoForm.tsx:18`

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](#req_21j0fo1p54x) | event onSubmit | [`AddTodoForm`]() | ✓ verified (1 capture) |

### <a id="req_21j0fo1p54x"></a>`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`AddTodoForm`]() · `src/components/AddTodoForm.tsx:14` |
| Trigger | event onSubmit |
| Transport | fetch · `useMutation` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos` |
| Call path | `useMutation` → `http` → `fetch` |

**Request body** [`NewTodo`](../types.md#typ_1llbjxbqwwk)

```ts
{ title: string }
```

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:4010/todos` → 201 Created · 10 ms · 2026-10-28 10:56 UTC · page `/`

Request body:

```json
{
  "title": "Record captures"
}
```

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": false,
  "title": "Record captures"
}
```
