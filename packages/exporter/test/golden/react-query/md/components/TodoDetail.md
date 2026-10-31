# Component `TodoDetail`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/TodoDetail.tsx:13` |
| Kind | client (`'use client'`) |
| Used on | [`/todos/[id]`](../pages/todos.%5Bid%5D.md) |
| Rendered by | [`TodoPage`](TodoPage.md) |
| Renders | `Link` (`next/link`) |

## Props

[`TodoDetailProps`](../types.md#typ_28rtveus0ih)

```ts
{ id: number }
```

## Types used

- [`Todo`](../types.md#typ_0fc96ucq8sd)

## Navigation

- link `/` → [`/`](../pages/index.md) · event onClick · conditional · `src/components/TodoDetail.tsx:23`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`](#req_27sy7hb0xsq) | page-load | [`TodoDetail`]() | ✓ verified (1 capture) |

### <a id="req_27sy7hb0xsq"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoDetail`]() · `src/components/TodoDetail.tsx:14` |
| Trigger | page-load |
| Transport | fetch · `useSWR(['todo', id])` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id` (pattern) |
| Call path | `useSWR` → `fetchTodo` → `http` → `fetch` |

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `GET http://localhost:4010/todos/3` → 200 OK · 11 ms · 2026-10-31 22:51 UTC · page `/todos/3`

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": false,
  "title": "Record captures"
}
```
