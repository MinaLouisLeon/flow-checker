# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Status | ✓ 3 verified |

## Component tree

- [`HomePage`](../components/HomePage.md) · server
  - [`HealthBadge`](../components/HealthBadge.md) · client · ⇄ 1 request
  - [`TodoList`](../components/TodoList.md) · client · ⇄ 1 request
    - `Link` · external (`next/link`)
  - [`AddTodoForm`](../components/AddTodoForm.md) · client · ⇄ 1 request

## Navigation

- To [`/todos/[id]`](todos.%5Bid%5D.md) (push, link)

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/trpc/todo.add`](#req_2e9reb96ytq) | event onSubmit | [`AddTodoForm`](../components/AddTodoForm.md) | ✓ verified (1 capture) |
| [`GET /api/trpc/health.ping`](#req_0xg00gfgxqn) | page-load | [`HealthBadge`](../components/HealthBadge.md) | ✓ verified (1 capture) |
| [`GET /api/trpc/todo.list`](#req_0td0aq6jy41) | page-load | [`TodoList`](../components/TodoList.md) | ✓ verified (2 captures) |

### <a id="req_2e9reb96ytq"></a>`POST /api/trpc/todo.add`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`AddTodoForm`](../components/AddTodoForm.md) · `src/components/AddTodoForm.tsx:13` |
| Trigger | event onSubmit |
| Transport | trpc · `useMutation` |
| URL | `/api/trpc/todo.add` |
| tRPC | [`todo.add`](../trpc.md#procedure-todo_add) (mutation) |
| Handled by | [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) |

**Request body** `{ title: string }`

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:3077/api/trpc/todo.add` → 200 · 77 ms · 2026-10-30 07:08 UTC · page `/`

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

**Leads to** `POST {API_URL ?? http://localhost:4010}/todos`:

#### <a id="req_1pnj4az8jd4"></a>`POST {API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | POST [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:11` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos` |
| In procedure | [`todo.add`](../trpc.md#procedure-todo_add) (mutation) |
| Call path | `createTodo` → `api` → `fetch` |

**Request body** `{ title: string; }`

```ts
{ title: string }
```

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:4010/todos` → 201 Created · 5 ms · 2026-10-30 07:08 UTC

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

### <a id="req_0xg00gfgxqn"></a>`GET /api/trpc/health.ping`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`HealthBadge`](../components/HealthBadge.md) · `src/components/HealthBadge.tsx:8` |
| Trigger | page-load |
| Transport | trpc · `useQuery` |
| URL | `/api/trpc/health.ping` |
| tRPC | [`health.ping`](../trpc.md#procedure-health_ping) (query) |
| Handled by | [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) |

**Response** `{ ok: boolean; }`

```ts
{ ok: boolean }
```

**Captured** `GET http://localhost:3077/api/trpc/health.ping` → 200 · 1624 ms · 2026-10-30 07:08 UTC · page `/`

Response body:

```json
{
  "ok": true
}
```

### <a id="req_0td0aq6jy41"></a>`GET /api/trpc/todo.list`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoList`](../components/TodoList.md) · `src/components/TodoList.tsx:9` |
| Trigger | page-load |
| Transport | trpc · `useQuery` |
| URL | `/api/trpc/todo.list` |
| tRPC | [`todo.list`](../trpc.md#procedure-todo_list) (query) |
| Handled by | [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) |

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
| From | GET [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:7` |
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
