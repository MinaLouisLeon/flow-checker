# Component `TodoList`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/TodoList.tsx:6` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |
| Renders | `Link` (`next/link`) |

## Props

Takes no props.

## Navigation

- link `/todos/:id` → [`/todos/[id]`](../pages/todos.%5Bid%5D.md) · event onClick · conditional · `src/components/TodoList.tsx:13`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/trpc/todo.list`](#req_17wtkw08tco) | page-load | [`TodoList`]() | ✓ verified (2 captures) |

### <a id="req_17wtkw08tco"></a>`GET /api/trpc/todo.list`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoList`]() · `src/components/TodoList.tsx:7` |
| Trigger | page-load |
| Transport | trpc · `useQuery` |
| URL | `/api/trpc/todo.list` |
| tRPC | [`todo.list`](../trpc.md#procedure-todo_list) (query) |
| Handled by | [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) |

**Request body** `{ userId?: number } | undefined`

**Response** `Todo[]` (see [`Todo`](../types.md#typ_0fc96ucq8sd))

**Captured** `GET http://localhost:3077/api/trpc/todo.list` → 200 · 30 ms · 2026-10-30 07:05 UTC · page `/` (newest of 2)

Response body:

```json
[
  {
    "id": 1,
    "userId": 1,
    "title": "Write the first program",
    "done": true
  },
  {
    "id": 2,
    "userId": 2,
    "title": "Break Enigma",
    "done": false
  },
  {
    "id": 3,
    "userId": 1,
    "done": false,
    "title": "Record captures"
  }
]
```

**Leads to** `GET {API_URL ?? http://localhost:4010}/todos`:

#### <a id="req_0omiq0w94p9"></a>`GET {API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:15` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos` |
| In procedure | [`todo.list`](../trpc.md#procedure-todo_list) (query) |
| Call path | `listTodos` → `api` → `fetch` |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_0fc96ucq8sd))

**Captured** `GET http://localhost:4010/todos` → 200 OK · 3 ms · 2026-10-30 07:05 UTC (newest of 2)

Response body:

```json
[
  {
    "id": 1,
    "userId": 1,
    "title": "Write the first program",
    "done": true
  },
  {
    "id": 2,
    "userId": 2,
    "title": "Break Enigma",
    "done": false
  },
  {
    "id": 3,
    "userId": 1,
    "done": false,
    "title": "Record captures"
  }
]
```
