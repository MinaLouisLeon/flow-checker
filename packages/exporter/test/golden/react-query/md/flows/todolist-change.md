# Flow: TodoList change

[← Overview](../README.md)

|  |  |
| --- | --- |
| Starts | [`TodoList`](../components/TodoList.md) on [`/`](../pages/index.md) |
| Pages | [`/`](../pages/index.md) |
| Status | not walked yet |

## Sequence

```mermaid
sequenceDiagram
  actor U as User
  participant P0 as /
  participant P1 as API (NEXT_PUBLIC_API_URL)
  U->>P0: onChange (TodoList)
  P0->>P1: PATCH /todos/:id
  P1-->>P0: 200 Todo
  Note over P0: setQueryData ['todos', 'detail', :id]
  Note over P0: invalidateQueries ['todos', 'list']
```

## Steps

| # | Step | Detail |
| ---: | --- | --- |
| 1 | User `onChange` in [`TodoList`](../components/TodoList.md) on [`/`](../pages/index.md) | `src/components/TodoList.tsx:28` |
| 2 | [`PATCH {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`](#req_2bvpz71hbm1) | body `TodoPatch` · response `Todo` · ✓ verified (1 capture) |
| 3 | `setQueryData` `['todos', 'detail', :id]` | `src/components/TodoList.tsx:16` |
| 4 | `invalidateQueries` `['todos', 'list']` | refetches `GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`, `GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos?userId=:userId` · `src/components/TodoList.tsx:17` |

## Requests

### <a id="req_2bvpz71hbm1"></a>`PATCH {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoList`](../components/TodoList.md) · `src/components/TodoList.tsx:13` |
| Trigger | event onChange |
| Transport | fetch · `useMutation` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id` (pattern) |
| Call path | `useMutation` → `updateTodo` → `http` → `fetch` |

**Request body** [`TodoPatch`](../types.md#typ_1omtz7j8kgo)

```ts
{ title?: string; done?: boolean }
```

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `PATCH http://localhost:4010/todos/2` → 200 OK · 7 ms · 2026-10-30 01:38 UTC · page `/`

Request body:

```json
{
  "done": true
}
```

Response body:

```json
{
  "id": 2,
  "userId": 2,
  "title": "Break Enigma",
  "done": true
}
```
