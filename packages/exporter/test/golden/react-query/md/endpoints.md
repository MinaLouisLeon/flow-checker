# Endpoints

[← Overview](README.md)

7 endpoints on 1 host, 7 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-env_NEXT_PUBLIC_API_URL"></a>`{NEXT_PUBLIC_API_URL ?? http://localhost:4010}`

Base URL from `process.env.NEXT_PUBLIC_API_URL`, falls back to `http://localhost:4010`.

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /settings`](#ep_014n09i1jig) | HTTP | browser | 2 | 1 | ✓ verified (2 of 2 call sites) |
| [`GET /todos`](#ep_0i0im2g2p7v) | HTTP | browser | 3 | 3 | ✓ verified (3 of 3 call sites) |
| [`POST /todos`](#ep_1tgnolqki2r) | HTTP | browser | 1 | 1 | ✓ verified |
| [`GET /todos/:id`](#ep_1am9fi3i0v3) | HTTP | browser | 1 | 1 | ✓ verified |
| [`PATCH /todos/:id`](#ep_04gtw68xyhb) | HTTP | browser | 1 | 1 | ✓ verified |
| [`GET /users`](#ep_16nzt1zcm62) | HTTP | browser + server | 3 | 2 | ✓ verified (3 of 3 call sites) |
| [`GET /users/:id`](#ep_1xqlxqpqvbv) | HTTP | browser | 2 | 1 | ✓ verified (2 of 2 call sites) |

### <a id="ep_014n09i1jig"></a>`GET /settings`

|  |  |
| --- | --- |
| Status | ✓ verified (2 of 2 call sites) |
| Transport | HTTP |
| Called from | browser |
| Pages | [`/settings`](pages/settings.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`](components/SettingsBadge.md#req_092dy6av59n) in [`SettingsBadge`](components/SettingsBadge.md)<br>[`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`](components/SettingsPanel.md#req_1psqg80jksx) in [`SettingsPanel`](components/SettingsPanel.md) |

**Response** [`Settings`](types.md#typ_0ccr3ev5sff)

```ts
{ theme: "light" | "dark"; locale: string; digest: string | null }
```

**Captured** `GET http://localhost:4010/settings` → 200 OK · 7 ms · 2026-10-31 22:51 UTC · page `/settings` (newest of 2)

Response body:

```json
{
  "theme": "dark",
  "locale": "en",
  "digest": null
}
```

### <a id="ep_0i0im2g2p7v"></a>`GET /todos`

|  |  |
| --- | --- |
| Status | ✓ verified (3 of 3 call sites) |
| Transport | HTTP |
| Called from | browser |
| Query | `?userId=:userId` |
| Pages | [`/settings`](pages/settings.md), [`/`](pages/index.md), [`/users`](pages/users.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/SettingsPanel.md#req_1dhqpyygtma) in [`SettingsPanel`](components/SettingsPanel.md)<br>[`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/TodoList.md#req_1di2bq7b96m) in [`TodoList`](components/TodoList.md)<br>[`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos?userId=:userId`](components/UserList.md#req_0ht2fssv0ja) in [`UserList`](components/UserList.md) |

**Response** `Todo[]` (see [`Todo`](types.md#typ_0fc96ucq8sd))

**Captured** `GET http://localhost:4010/todos` → 200 OK · 7 ms · 2026-10-31 22:51 UTC · page `/settings` (newest of 6)

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
    "done": true
  },
  {
    "id": 3,
    "userId": 1,
    "done": false,
    "title": "Record captures"
  }
]
```

### <a id="ep_1tgnolqki2r"></a>`POST /todos`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/AddTodoForm.md#req_1ybk9xw63lt) in [`AddTodoForm`](components/AddTodoForm.md) |

**Request body** [`NewTodo`](types.md#typ_1llbjxbqwwk)

```ts
{ title: string }
```

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:4010/todos` → 201 Created · 8 ms · 2026-10-31 22:51 UTC · page `/`

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

### <a id="ep_1am9fi3i0v3"></a>`GET /todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`](components/TodoDetail.md#req_27sy7hb0xsq) in [`TodoDetail`](components/TodoDetail.md) |

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `GET http://localhost:4010/todos/3` → 200 OK · 11 ms · 2026-10-31 22:51 UTC · page `/todos/3`

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": false,
  "title": "Record captures"
}
```

### <a id="ep_04gtw68xyhb"></a>`PATCH /todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Pages | [`/`](pages/index.md) |
| Call sites | [`PATCH {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`](components/TodoList.md#req_2bvpz71hbm1) in [`TodoList`](components/TodoList.md) |

**Request body** [`TodoPatch`](types.md#typ_1omtz7j8kgo)

```ts
{ title?: string; done?: boolean }
```

**Response** [`Todo`](types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `PATCH http://localhost:4010/todos/2` → 200 OK · 8 ms · 2026-10-31 22:51 UTC · page `/`

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

### <a id="ep_16nzt1zcm62"></a>`GET /users`

|  |  |
| --- | --- |
| Status | ✓ verified (3 of 3 call sites) |
| Transport | HTTP |
| Called from | browser + server |
| Pages | [`/users`](pages/users.md), [`/settings`](pages/settings.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](components/UsersPage.md#req_2a0uqvzh6dw) in [`UsersPage`](components/UsersPage.md)<br>[`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](components/SettingsPanel.md#req_01zlsrjrncf) in [`SettingsPanel`](components/SettingsPanel.md)<br>[`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](components/UserList.md#req_0m4arr015hb) in [`UserList`](components/UserList.md) |

**Response** `User[]` (see [`User`](types.md#typ_25sov0zzv45))

**Captured** `GET http://localhost:4010/users` → 200 OK · 8 ms · 2026-10-31 22:51 UTC · page `/settings` (newest of 4)

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

### <a id="ep_1xqlxqpqvbv"></a>`GET /users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (2 of 2 call sites) |
| Transport | HTTP |
| Called from | browser |
| Pages | [`/users`](pages/users.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](components/UserList.md#req_0ka937821vy) in [`UserList`](components/UserList.md)<br>[`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](components/UserList.md#req_1g8keamimjw) in [`UserList`](components/UserList.md) |

**Response** [`User`](types.md#typ_25sov0zzv45)

```ts
{ id: number; name: string; email: string; role: "admin" | "member" }
```

**Captured** `GET http://localhost:4010/users/2` → 200 OK · 3 ms · 2026-10-31 22:51 UTC · page `/users` (newest of 2)

Response body:

```json
{
  "id": 2,
  "name": "Alan Turing",
  "email": "alan@example.com",
  "role": "member"
}
```
