# Route handler `/api/trpc/[trpc]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/api/trpc/[trpc]/route.ts` |
| Methods | GET, POST |

## Called by

| Request | From | Status |
| --- | --- | --- |
| [`POST /api/trpc/todo.add`](../components/AddTodoForm.md#req_0sfrr3m6hv2) | [`AddTodoForm`](../components/AddTodoForm.md) | ✓ verified (1 capture) |
| [`GET /api/trpc/ping`](../components/HealthBadge.md#req_1bu2fw37bk8) | [`HealthBadge`](../components/HealthBadge.md) | ✓ verified (1 capture) |
| [`GET /api/trpc/todo.byId`](../components/TodoDetail.md#req_0i7plnzsuv7) | [`TodoDetail`](../components/TodoDetail.md) | ✓ verified (2 captures) |
| [`POST /api/trpc/todo.toggle`](../components/TodoDetail.md#req_02es5n58ro4) | [`TodoDetail`](../components/TodoDetail.md) | ✓ verified (1 capture) |
| [`GET /api/trpc/todo.feed`](../components/TodoFeed.md#req_1c78i0tgtyn) | [`TodoFeed`](../components/TodoFeed.md) | ✓ verified (2 captures) |
| [`GET /api/trpc/todo.list`](../components/TodoList.md#req_17wtkw08tco) | [`TodoList`](../components/TodoList.md) | ✓ verified (2 captures) |
| [`GET /api/trpc/user.list`](../components/UserList.md#req_1sz2hauuhmt) | [`UserList`](../components/UserList.md) | ✓ verified (1 capture) |

## Requests it sends

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/todos`](#req_0omiq0w94p9) | route-handler | GET [`/api/trpc/[trpc]`]() | ✓ verified (2 captures) |
| [`GET {API_URL ?? http://localhost:4010}/todos/:id`](#req_19v0zzhv2k5) | route-handler | GET [`/api/trpc/[trpc]`]() | ✓ verified (2 captures) |
| [`POST {API_URL ?? http://localhost:4010}/todos`](#req_2ah5o8jjwsr) | route-handler | POST [`/api/trpc/[trpc]`]() | ✓ verified (1 capture) |
| [`PATCH {API_URL ?? http://localhost:4010}/todos/:id`](#req_0n9qb5iqo86) | route-handler | POST [`/api/trpc/[trpc]`]() | ✓ verified (1 capture) |
| [`GET {API_URL ?? http://localhost:4010}/todos`](#req_2flmlyku854) | route-handler | GET [`/api/trpc/[trpc]`]() | ✓ verified (2 captures) |
| [`GET {API_URL ?? http://localhost:4010}/users`](#req_0v7l7pp65e3) | route-handler | GET [`/api/trpc/[trpc]`]() | ✓ verified (1 capture) |

### <a id="req_0omiq0w94p9"></a>`GET {API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/trpc/[trpc]`]() · `src/server/routers/todo.ts:15` |
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

### <a id="req_19v0zzhv2k5"></a>`GET {API_URL ?? http://localhost:4010}/todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/trpc/[trpc]`]() · `src/server/routers/todo.ts:17` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos/:id` (pattern) |
| In procedure | [`todo.byId`](../trpc.md#procedure-todo_byId) (query) |
| Call path | `getTodo` → `api` → `fetch` |

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `GET http://localhost:4010/todos/3` → 200 OK · 2 ms · 2026-10-30 07:05 UTC (newest of 2)

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": true,
  "title": "Record captures"
}
```

### <a id="req_2ah5o8jjwsr"></a>`POST {API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | POST [`/api/trpc/[trpc]`]() · `src/server/routers/todo.ts:20` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos` |
| In procedure | [`todo.add`](../trpc.md#procedure-todo_add) (mutation) |
| Call path | `createTodo` → `api` → `fetch` |

**Request body** `{ title: string; userId: number }`

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:4010/todos` → 201 Created · 6 ms · 2026-10-30 07:05 UTC

Request body:

```json
{
  "title": "Record captures",
  "userId": 1
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

### <a id="req_0n9qb5iqo86"></a>`PATCH {API_URL ?? http://localhost:4010}/todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | POST [`/api/trpc/[trpc]`]() · `src/server/routers/todo.ts:23` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos/:id` (pattern) |
| In procedure | [`todo.toggle`](../trpc.md#procedure-todo_toggle) (mutation) |
| Call path | `patchTodo` → `api` → `fetch` |

**Request body** `Partial<Pick<Todo, 'done' | 'title'>>`

```ts
{ title?: string; done?: boolean }
```

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `PATCH http://localhost:4010/todos/3` → 200 OK · 3 ms · 2026-10-30 07:05 UTC

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

### <a id="req_2flmlyku854"></a>`GET {API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/trpc/[trpc]`]() · `src/server/routers/todo.ts:27` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos` |
| In procedure | [`todo.feed`](../trpc.md#procedure-todo_feed) (query) |
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
    "done": true,
    "title": "Record captures"
  }
]
```

### <a id="req_0v7l7pp65e3"></a>`GET {API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | GET [`/api/trpc/[trpc]`]() · `src/server/routers/user.ts:5` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/users` |
| In procedure | [`user.list`](../trpc.md#procedure-user_list) (query) |
| Call path | `listUsers` → `api` → `fetch` |

**Response** `User[]` (see [`User`](../types.md#typ_25sov0zzv45))

**Captured** `GET http://localhost:4010/users` → 200 OK · 22 ms · 2026-10-30 07:05 UTC

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
