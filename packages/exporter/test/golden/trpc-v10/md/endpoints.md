# Endpoints

[← Overview](README.md)

12 endpoints on 2 hosts, 7 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-app"></a>This app's API

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET ping`](#ep_05b4rvdf69k) | tRPC | browser | 1 | 1 | ✓ verified |
| [`POST todo.add`](#ep_0ibv7krl4ej) | tRPC | browser | 1 | 1 | ✓ verified |
| [`GET todo.byId`](#ep_25303l9f52p) | tRPC | browser | 1 | 1 | ✓ verified |
| [`GET todo.feed`](#ep_0dfumbyiny9) | tRPC | browser | 1 | 1 | ✓ verified |
| [`GET todo.list`](#ep_0msu49db75v) | tRPC | browser | 1 | 1 | ✓ verified |
| [`POST todo.toggle`](#ep_1u7mfef31ll) | tRPC | browser | 1 | 1 | ✓ verified |
| [`GET user.list`](#ep_1rinmezu3ej) | tRPC | browser | 1 | 1 | ✓ verified |

### <a id="ep_05b4rvdf69k"></a>`GET ping`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | tRPC · [`ping`](trpc.md#procedure-ping) (query) |
| Called from | browser |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET /api/trpc/ping`](components/HealthBadge.md#req_1bu2fw37bk8) in [`HealthBadge`](components/HealthBadge.md) |

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

### <a id="ep_0ibv7krl4ej"></a>`POST todo.add`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | tRPC · [`todo.add`](trpc.md#procedure-todo_add) (mutation) |
| Called from | browser |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST /api/trpc/todo.add`](components/AddTodoForm.md#req_0sfrr3m6hv2) in [`AddTodoForm`](components/AddTodoForm.md) |

**Request body** `z.input<typeof NewTodoSchema>`

```ts
{ title: string }
```

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

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

### <a id="ep_25303l9f52p"></a>`GET todo.byId`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | tRPC · [`todo.byId`](trpc.md#procedure-todo_byId) (query) |
| Called from | browser |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`GET /api/trpc/todo.byId`](components/TodoDetail.md#req_0i7plnzsuv7) in [`TodoDetail`](components/TodoDetail.md) |

**Request body** `{ id: number }`

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `GET http://localhost:3077/api/trpc/todo.byId` → 200 · 25 ms · 2026-10-30 07:05 UTC · page `/todos/3` (newest of 2)

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

### <a id="ep_0dfumbyiny9"></a>`GET todo.feed`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | tRPC · [`todo.feed`](trpc.md#procedure-todo_feed) (query) |
| Called from | browser |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Pages | [`/feed`](pages/feed.md) |
| Call sites | [`GET /api/trpc/todo.feed`](components/TodoFeed.md#req_1c78i0tgtyn) in [`TodoFeed`](components/TodoFeed.md) |

**Request body** `{ limit: number; cursor?: number | null }`

**Response** [`TodoPage`](types.md#typ_1ztzqbb553r)

```ts
{ items: Todo[]; nextCursor: number | null }
```

**Captured** `GET http://localhost:3077/api/trpc/todo.feed` → 200 · 37 ms · 2026-10-30 07:05 UTC · page `/feed` (newest of 2)

Request body:

```json
{
  "limit": 1,
  "cursor": 1
}
```

Response body:

```json
{
  "items": [
    {
      "id": 2,
      "userId": 2,
      "title": "Break Enigma",
      "done": false
    }
  ],
  "nextCursor": 2
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
| Call sites | [`GET /api/trpc/todo.list`](components/TodoList.md#req_17wtkw08tco) in [`TodoList`](components/TodoList.md) |

**Request body** `{ userId?: number } | undefined`

**Response** `Todo[]` (see [`Todo`](types.md#typ_0fc96ucq8sd))

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

### <a id="ep_1u7mfef31ll"></a>`POST todo.toggle`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | tRPC · [`todo.toggle`](trpc.md#procedure-todo_toggle) (mutation) |
| Called from | browser |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`POST /api/trpc/todo.toggle`](components/TodoDetail.md#req_02es5n58ro4) in [`TodoDetail`](components/TodoDetail.md) |

**Request body** `{ id: number; done: boolean }`

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:3077/api/trpc/todo.toggle` → 200 · 38 ms · 2026-10-30 07:05 UTC · page `/todos/3`

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

### <a id="ep_1rinmezu3ej"></a>`GET user.list`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | tRPC · [`user.list`](trpc.md#procedure-user_list) (query) |
| Called from | browser |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET /api/trpc/user.list`](components/UserList.md#req_1sz2hauuhmt) in [`UserList`](components/UserList.md) |

**Response** `User[]` (see [`User`](types.md#typ_25sov0zzv45))

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

## <a id="host-env_API_URL"></a>`{API_URL ?? http://localhost:4010}`

Base URL from `process.env.API_URL`, falls back to `http://localhost:4010`.

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /todos`](#ep_25v9o6f1xuc) | HTTP | server | 2 | 3 | ✓ verified (2 of 2 call sites) |
| [`POST /todos`](#ep_1a9zvb2cvpx) | HTTP | server | 1 | 2 | ✓ verified |
| [`GET /todos/:id`](#ep_2byawmgpkxh) | HTTP | server | 1 | 3 | ✓ verified |
| [`PATCH /todos/:id`](#ep_06drh6l9g5j) | HTTP | server | 1 | 2 | ✓ verified |
| [`GET /users`](#ep_1ummwnixxxj) | HTTP | server | 1 | 3 | ✓ verified |

### <a id="ep_25v9o6f1xuc"></a>`GET /todos`

|  |  |
| --- | --- |
| Status | ✓ verified (2 of 2 call sites) |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md), [`/todos/[id]`](pages/todos.%5Bid%5D.md), [`/feed`](pages/feed.md) |
| Call sites | [`GET {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_0omiq0w94p9) in GET [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md)<br>[`GET {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_2flmlyku854) in GET [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |

**Response** `Todo[]` (see [`Todo`](types.md#typ_0fc96ucq8sd))

**Captured** `GET http://localhost:4010/todos` → 200 OK · 3 ms · 2026-10-30 07:05 UTC (newest of 4)

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

### <a id="ep_1a9zvb2cvpx"></a>`POST /todos`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md), [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`POST {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_2ah5o8jjwsr) in POST [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |

**Request body** `{ title: string; userId: number }`

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

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

### <a id="ep_2byawmgpkxh"></a>`GET /todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md), [`/todos/[id]`](pages/todos.%5Bid%5D.md), [`/feed`](pages/feed.md) |
| Call sites | [`GET {API_URL ?? http://localhost:4010}/todos/:id`](pages/api.trpc.%5Btrpc%5D.md#req_19v0zzhv2k5) in GET [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

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

### <a id="ep_06drh6l9g5j"></a>`PATCH /todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md), [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`PATCH {API_URL ?? http://localhost:4010}/todos/:id`](pages/api.trpc.%5Btrpc%5D.md#req_0n9qb5iqo86) in POST [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |

**Request body** `Partial<Pick<Todo, 'done' | 'title'>>`

```ts
{ title?: string; done?: boolean }
```

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

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

### <a id="ep_1ummwnixxxj"></a>`GET /users`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md), [`/todos/[id]`](pages/todos.%5Bid%5D.md), [`/feed`](pages/feed.md) |
| Call sites | [`GET {API_URL ?? http://localhost:4010}/users`](pages/api.trpc.%5Btrpc%5D.md#req_0v7l7pp65e3) in GET [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |

**Response** `User[]` (see [`User`](types.md#typ_25sov0zzv45))

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
