# Endpoints

[← Overview](README.md)

13 endpoints on 2 hosts, 7 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-app"></a>This app's API

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET health.ping`](#ep_02nhwic4gly) | tRPC | browser | 1 | 1 | ✓ verified |
| [`POST todo.add`](#ep_0ibv7krl4ej) | tRPC | browser | 1 | 1 | ✓ verified |
| [`GET todo.byId`](#ep_25303l9f52p) | tRPC | browser | 1 | 1 | ✓ verified |
| [`GET todo.list`](#ep_0msu49db75v) | tRPC | browser | 1 | 1 | ✓ verified |
| [`POST todo.toggle`](#ep_1u7mfef31ll) | tRPC | browser | 1 | 1 | ✓ verified |
| [`GET user.byId`](#ep_07ze9d1keja) | tRPC | browser | 1 | 1 | ✓ verified |
| [`GET user.list`](#ep_1rinmezu3ej) | tRPC | browser | 1 | 1 | ✓ verified |

### <a id="ep_02nhwic4gly"></a>`GET health.ping`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | tRPC · [`health.ping`](trpc.md#procedure-health_ping) (query) |
| Called from | browser |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET /api/trpc/health.ping`](components/HealthBadge.md#req_0xg00gfgxqn) in [`HealthBadge`](components/HealthBadge.md) |

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

### <a id="ep_0ibv7krl4ej"></a>`POST todo.add`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | tRPC · [`todo.add`](trpc.md#procedure-todo_add) (mutation) |
| Called from | browser |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST /api/trpc/todo.add`](components/AddTodoForm.md#req_2e9reb96ytq) in [`AddTodoForm`](components/AddTodoForm.md) |

**Request body** `{ title: string }`

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

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

### <a id="ep_25303l9f52p"></a>`GET todo.byId`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | tRPC · [`todo.byId`](trpc.md#procedure-todo_byId) (query) |
| Called from | browser |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`GET /api/trpc/todo.byId`](components/TodoDetail.md#req_1130uk5gwu8) in [`TodoDetail`](components/TodoDetail.md) |

**Request body** `{ id: number }`

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `GET http://localhost:3077/api/trpc/todo.byId` → 200 · 22 ms · 2026-10-30 07:09 UTC · page `/todos/3` (newest of 2)

Request body:

```json
{
  "id": 3
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

### <a id="ep_0msu49db75v"></a>`GET todo.list`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | tRPC · [`todo.list`](trpc.md#procedure-todo_list) (query) |
| Called from | browser |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET /api/trpc/todo.list`](components/TodoList.md#req_0td0aq6jy41) in [`TodoList`](components/TodoList.md) |

**Response** `Todo[]` (see [`Todo`](types.md#typ_0fc96ucq8sd))

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

### <a id="ep_1u7mfef31ll"></a>`POST todo.toggle`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | tRPC · [`todo.toggle`](trpc.md#procedure-todo_toggle) (mutation) |
| Called from | browser |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`POST /api/trpc/todo.toggle`](components/TodoDetail.md#req_1yefdvziu6b) in [`TodoDetail`](components/TodoDetail.md) |

**Request body** `{ id: number; done: boolean }`

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:3077/api/trpc/todo.toggle` → 200 · 37 ms · 2026-10-30 07:09 UTC · page `/todos/3`

Request body:

```json
{
  "id": 3,
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

### <a id="ep_07ze9d1keja"></a>`GET user.byId`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | tRPC · [`user.byId`](trpc.md#procedure-user_byId) (query) |
| Called from | browser |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`GET /api/trpc/user.byId`](components/TodoDetail.md#req_1jhjx2h6c0y) in [`TodoDetail`](components/TodoDetail.md) |

**Request body** `{ id: number }`

**Response** `z.output<typeof UserSchema>`

```ts
{ id: number; name: string; email: string; role: "admin" | "member" }
```

**Captured** `GET http://localhost:3077/api/trpc/user.byId` → 200 · 22 ms · 2026-10-30 07:09 UTC · page `/todos/3`

Request body:

```json
{
  "id": 1
}
```

Response body:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "admin"
}
```

### <a id="ep_1rinmezu3ej"></a>`GET user.list`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | tRPC · [`user.list`](trpc.md#procedure-user_list) (query) |
| Called from | browser |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Pages | [`/users`](pages/users.md) |
| Call sites | [`GET /api/trpc/user.list`](components/UserList.md#req_0mfdzrz4ekf) in [`UserList`](components/UserList.md) |

**Response** `{ id: number; name: string; email: string; role: "admin" | "member" }[]`

**Captured** `GET http://localhost:3077/api/trpc/user.list` → 200 · 41 ms · 2026-10-30 07:09 UTC · page `/users`

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

## <a id="host-env_API_URL"></a>`{API_URL ?? http://localhost:4010}`

Base URL from `process.env.API_URL`, falls back to `http://localhost:4010`.

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /todos`](#ep_25v9o6f1xuc) | HTTP | server | 1 | 3 | ✓ verified |
| [`POST /todos`](#ep_1a9zvb2cvpx) | HTTP | server | 1 | 2 | ✓ verified |
| [`GET /todos/:id`](#ep_2byawmgpkxh) | HTTP | server | 1 | 3 | ✓ verified |
| [`PATCH /todos/:id`](#ep_06drh6l9g5j) | HTTP | server | 1 | 2 | ✓ verified |
| [`GET /users`](#ep_1ummwnixxxj) | HTTP | server | 1 | 3 | ✓ verified |
| [`GET /users/:id`](#ep_0o9nq5wpp19) | HTTP | server | 1 | 3 | ✓ verified |

### <a id="ep_25v9o6f1xuc"></a>`GET /todos`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md), [`/todos/[id]`](pages/todos.%5Bid%5D.md), [`/users`](pages/users.md) |
| Call sites | [`GET {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_1tdume4or33) in GET [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |

**Response** `Todo[]` (see [`Todo`](types.md#typ_0fc96ucq8sd))

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

### <a id="ep_1a9zvb2cvpx"></a>`POST /todos`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md), [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`POST {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_1pnj4az8jd4) in POST [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |

**Request body** `{ title: string; }`

```ts
{ title: string }
```

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

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

### <a id="ep_2byawmgpkxh"></a>`GET /todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md), [`/todos/[id]`](pages/todos.%5Bid%5D.md), [`/users`](pages/users.md) |
| Call sites | [`GET {API_URL ?? http://localhost:4010}/todos/:id`](pages/api.trpc.%5Btrpc%5D.md#req_1pf3v7qr14b) in GET [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

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

### <a id="ep_06drh6l9g5j"></a>`PATCH /todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md), [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`PATCH {API_URL ?? http://localhost:4010}/todos/:id`](pages/api.trpc.%5Btrpc%5D.md#req_0e790agvf59) in POST [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |

**Request body** `{ done: boolean; }`

```ts
{ done: boolean }
```

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

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

### <a id="ep_1ummwnixxxj"></a>`GET /users`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md), [`/todos/[id]`](pages/todos.%5Bid%5D.md), [`/users`](pages/users.md) |
| Call sites | [`GET {API_URL ?? http://localhost:4010}/users`](pages/api.trpc.%5Btrpc%5D.md#req_1grc5hxysxt) in GET [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |

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

### <a id="ep_0o9nq5wpp19"></a>`GET /users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md), [`/todos/[id]`](pages/todos.%5Bid%5D.md), [`/users`](pages/users.md) |
| Call sites | [`GET {API_URL ?? http://localhost:4010}/users/:id`](pages/api.trpc.%5Btrpc%5D.md#req_2c4oanm9vl7) in GET [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |

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
