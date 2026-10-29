# Page `/todos/[id]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/todos/[id]/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Status | ✓ 1 verified |

## Component tree

- [`TodoPage`](../components/TodoPage.md) · server
  - [`TodoDetail`](../components/TodoDetail.md) · client · ⇄ 1 request
    - `Link` · external (`next/link`) · conditional

## Navigation

- From [`/`](index.md) (push, link)
- To [`/`](index.md) (link)

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`](#req_0euad6xi67r) | page-load | [`TodoDetail`](../components/TodoDetail.md) | ✓ verified (1 capture) |

### <a id="req_0euad6xi67r"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoDetail`](../components/TodoDetail.md) · `src/components/TodoDetail.tsx:14` |
| Trigger | page-load |
| Transport | fetch · `useSWR(['todo', id])` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id` (pattern) |
| Call path | `useSWR` → `fetchTodo` → `http` → `fetch` |

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `GET http://localhost:4010/todos/3` → 200 OK · 16 ms · 2026-10-28 10:56 UTC · page `/todos/3`

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": false,
  "title": "Record captures"
}
```
