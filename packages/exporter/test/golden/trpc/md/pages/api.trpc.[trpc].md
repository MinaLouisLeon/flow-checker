# Route handler `/api/trpc/[trpc]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/api/trpc/[trpc]/route.ts` |
| Methods | GET, POST |

## Called by

| Request | From | Status |
| --- | --- | --- |
| [`POST /api/trpc/todo.add`](../components/AddTodoForm.md#req_2e9reb96ytq) | [`AddTodoForm`](../components/AddTodoForm.md) | ✓ verified (1 capture) |
| [`GET /api/trpc/health.ping`](../components/HealthBadge.md#req_0xg00gfgxqn) | [`HealthBadge`](../components/HealthBadge.md) | ✓ verified (1 capture) |
| [`GET /api/trpc/todo.byId`](../components/TodoDetail.md#req_1130uk5gwu8) | [`TodoDetail`](../components/TodoDetail.md) | ✓ verified (2 captures) |
| [`GET /api/trpc/user.byId`](../components/TodoDetail.md#req_1jhjx2h6c0y) | [`TodoDetail`](../components/TodoDetail.md) | ✓ verified (1 capture) |
| [`POST /api/trpc/todo.toggle`](../components/TodoDetail.md#req_1yefdvziu6b) | [`TodoDetail`](../components/TodoDetail.md) | ✓ verified (1 capture) |
| [`GET /api/trpc/todo.list`](../components/TodoList.md#req_0td0aq6jy41) | [`TodoList`](../components/TodoList.md) | ✓ verified (2 captures) |
| [`GET /api/trpc/user.list`](../components/UserList.md#req_0mfdzrz4ekf) | [`UserList`](../components/UserList.md) | ✓ verified (1 capture) |

## Requests it sends

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/todos`](#req_1tdume4or33) | route-handler | GET [`/api/trpc/[trpc]`]() | ✓ verified (2 captures) |
| [`GET {API_URL ?? http://localhost:4010}/todos/:id`](#req_1pf3v7qr14b) | route-handler | GET [`/api/trpc/[trpc]`]() | ✓ verified (2 captures) |
| [`POST {API_URL ?? http://localhost:4010}/todos`](#req_1pnj4az8jd4) | route-handler | POST [`/api/trpc/[trpc]`]() | ✓ verified (1 capture) |
| [`PATCH {API_URL ?? http://localhost:4010}/todos/:id`](#req_0e790agvf59) | route-handler | POST [`/api/trpc/[trpc]`]() | ✓ verified (1 capture) |
| [`GET {API_URL ?? http://localhost:4010}/users`](#req_1grc5hxysxt) | route-handler | GET [`/api/trpc/[trpc]`]() | ✓ verified (1 capture) |
| [`GET {API_URL ?? http://localhost:4010}/users/:id`](#req_2c4oanm9vl7) | route-handler | GET [`/api/trpc/[trpc]`]() | ✓ verified (1 capture) |

### <a id="req_1tdume4or33"></a>`GET {API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/trpc/[trpc]`]() · `src/server/routers/todo.ts:7` |
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

### <a id="req_1pf3v7qr14b"></a>`GET {API_URL ?? http://localhost:4010}/todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/trpc/[trpc]`]() · `src/server/routers/todo.ts:8` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos/:id` (pattern) |
| In procedure | [`todo.byId`](../trpc.md#procedure-todo_byId) (query) |
| Call path | `getTodo` → `api` → `fetch` |

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `GET http://localhost:4010/todos/3` → 200 OK · 3 ms · 2026-10-30 07:09 UTC (newest of 2)

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": true,
  "title": "Record captures"
}
```

### <a id="req_1pnj4az8jd4"></a>`POST {API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | POST [`/api/trpc/[trpc]`]() · `src/server/routers/todo.ts:11` |
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

### <a id="req_0e790agvf59"></a>`PATCH {API_URL ?? http://localhost:4010}/todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | POST [`/api/trpc/[trpc]`]() · `src/server/routers/todo.ts:14` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos/:id` (pattern) |
| In procedure | [`todo.toggle`](../trpc.md#procedure-todo_toggle) (mutation) |
| Call path | `patchTodo` → `api` → `fetch` |

**Request body** `{ done: boolean; }`

```ts
{ done: boolean }
```

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `PATCH http://localhost:4010/todos/3` → 200 OK · 4 ms · 2026-10-30 07:09 UTC

Request body:

```json
{
  "done": true
}
```

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": true,
  "title": "Record captures"
}
```

### <a id="req_1grc5hxysxt"></a>`GET {API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | GET [`/api/trpc/[trpc]`]() · `src/server/routers/user.ts:14` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/users` |
| In procedure | [`user.list`](../trpc.md#procedure-user_list) (query) |
| Call path | `fetchUsers` → `api` → `fetch` |

> ⚠ **[unknown-response](../GLOSSARY.md#flag-unknown-response)**: No response type was found (annotation, generic or cast).

**Captured** `GET http://localhost:4010/users` → 200 OK · 17 ms · 2026-10-30 07:09 UTC

Response body:

```json
[
  {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "admin"
  },
  {
    "id": 2,
    "name": "Alan Turing",
    "email": "alan@example.com",
    "role": "member"
  }
]
```

### <a id="req_2c4oanm9vl7"></a>`GET {API_URL ?? http://localhost:4010}/users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | GET [`/api/trpc/[trpc]`]() · `src/server/routers/user.ts:18` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/users/:id` (pattern) |
| In procedure | [`user.byId`](../trpc.md#procedure-user_byId) (query) |
| Call path | `fetchUser` → `api` → `fetch` |

> ⚠ **[unknown-response](../GLOSSARY.md#flag-unknown-response)**: No response type was found (annotation, generic or cast).

**Captured** `GET http://localhost:4010/users/1` → 200 OK · 3 ms · 2026-10-30 07:09 UTC

Response body:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "admin"
}
```
