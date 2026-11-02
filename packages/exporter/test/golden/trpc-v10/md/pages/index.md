# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Status | ✓ 4 verified |

## Component tree

- [`HomePage`](../components/HomePage.md) · server
  - [`HealthBadge`](../components/HealthBadge.md) · client · ⇄ 1 request
  - [`TodoList`](../components/TodoList.md) · client · ⇄ 1 request
    - `Link` · external (`next/link`) · conditional
  - [`AddTodoForm`](../components/AddTodoForm.md) · client · ⇄ 1 request
  - [`UserList`](../components/UserList.md) · client · ⇄ 1 request

## Navigation

- To [`/todos/[id]`](todos.%5Bid%5D.md) (push, link)

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/trpc/todo.add`](#req_0sfrr3m6hv2) | event onSubmit | [`AddTodoForm`](../components/AddTodoForm.md) | ✓ verified (1 capture) |
| [`GET /api/trpc/ping`](#req_1bu2fw37bk8) | page-load | [`HealthBadge`](../components/HealthBadge.md) | ✓ verified (1 capture) |
| [`GET /api/trpc/todo.list`](#req_17wtkw08tco) | page-load | [`TodoList`](../components/TodoList.md) | ✓ verified (2 captures) |
| [`GET /api/trpc/user.list`](#req_1sz2hauuhmt) | page-load | [`UserList`](../components/UserList.md) | ✓ verified (1 capture) |

### <a id="req_0sfrr3m6hv2"></a>`POST /api/trpc/todo.add`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`AddTodoForm`](../components/AddTodoForm.md) · `src/components/AddTodoForm.tsx:11` |
| Trigger | event onSubmit |
| Transport | trpc · `useMutation` |
| URL | `/api/trpc/todo.add` |
| tRPC | [`todo.add`](../trpc.md#procedure-todo_add) (mutation) |
| Handled by | [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) |

**Request body** `z.input<typeof NewTodoSchema>`

```ts
{ title: string }
```

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:3077/api/trpc/todo.add` → 200 · 65 ms · 2026-10-30 07:05 UTC · page `/`

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

#### <a id="req_2ah5o8jjwsr"></a>`POST {API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | POST [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:20` |
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

### <a id="req_1bu2fw37bk8"></a>`GET /api/trpc/ping`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`HealthBadge`](../components/HealthBadge.md) · `src/components/HealthBadge.tsx:6` |
| Trigger | page-load |
| Transport | trpc · `useQuery` |
| URL | `/api/trpc/ping` |
| tRPC | [`ping`](../trpc.md#procedure-ping) (query) |
| Handled by | [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) |

**Response** `{ ok: true; at: string; }`

```ts
{ ok: true; at: string }
```

**Captured** `GET http://localhost:3077/api/trpc/ping` → 200 · 2148 ms · 2026-10-30 07:05 UTC · page `/`

Response body:

```json
{
  "ok": true,
  "at": "2026-10-30T07:05:05.857Z"
}
```

### <a id="req_17wtkw08tco"></a>`GET /api/trpc/todo.list`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoList`](../components/TodoList.md) · `src/components/TodoList.tsx:7` |
| Trigger | page-load |
| Transport | trpc · `useQuery` |
| URL | `/api/trpc/todo.list` |
| tRPC | [`todo.list`](../trpc.md#procedure-todo_list) (query) |
| Handled by | [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) |

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
| From | GET [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:15` |
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

### <a id="req_1sz2hauuhmt"></a>`GET /api/trpc/user.list`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserList`](../components/UserList.md) · `src/components/UserList.tsx:6` |
| Trigger | page-load |
| Transport | trpc · `useQuery` |
| URL | `/api/trpc/user.list` |
| tRPC | [`user.list`](../trpc.md#procedure-user_list) (query) |
| Handled by | [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) |

**Response** `User[]` (see [`User`](../types.md#typ_25sov0zzv45))

**Captured** `GET http://localhost:3077/api/trpc/user.list` → 200 · 2148 ms · 2026-10-30 07:05 UTC · page `/`

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

**Leads to** `GET {API_URL ?? http://localhost:4010}/users`:

#### <a id="req_0v7l7pp65e3"></a>`GET {API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | GET [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) · `src/server/routers/user.ts:5` |
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
