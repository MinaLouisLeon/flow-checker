# Component `TodoList`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/TodoList.tsx:7` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |
| Renders | `Link` (`next/link`) |

## Props

Takes no props.

## Navigation

- link `/todos/:id` → [`/todos/[id]`](../pages/todos.%5Bid%5D.md) · event onClick · `src/components/TodoList.tsx:14`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/trpc/todo.list`](#req_0td0aq6jy41) | page-load | [`TodoList`]() | ✓ verified (2 captures) |

### <a id="req_0td0aq6jy41"></a>`GET /api/trpc/todo.list`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoList`]() · `src/components/TodoList.tsx:9` |
| Trigger | page-load |
| Transport | trpc · `useQuery` |
| URL | `/api/trpc/todo.list` |
| tRPC | [`todo.list`](../trpc.md#procedure-todo_list) (query) |
| Handled by | [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_0fc96ucq8sd))

**Captured** `GET http://localhost:3077/api/trpc/todo.list` → 200 · 24 ms · 2026-10-30 07:08 UTC · page `/` (newest of 2)

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

#### <a id="req_1tdume4or33"></a>`GET {API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:7` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos` |
| In procedure | [`todo.list`](../trpc.md#procedure-todo_list) (query) |
| Call path | `listTodos` → `api` → `fetch` |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_0fc96ucq8sd))

**Captured** `GET http://localhost:4010/todos` → 200 OK · 6 ms · 2026-10-30 07:08 UTC (newest of 2)

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
