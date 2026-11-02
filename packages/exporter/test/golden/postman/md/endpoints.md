# Endpoints

[← Overview](README.md)

6 endpoints on 2 hosts, 4 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-base_http___localhost_4010"></a>`http://localhost:4010`

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /todos`](#ep_26ggeb6bo31) | HTTP | browser | 1 | 1 | ✓ verified |

### <a id="ep_26ggeb6bo31"></a>`GET /todos`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Postman | [List todos](postman.md#pmr_1786nvyhcbb) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET http://localhost:4010/todos`](components/TodoPanel.md#req_1e93pbv41le) in [`TodoPanel`](components/TodoPanel.md) |

**Response** `Todo[]` (see [`Todo`](types.md#typ_29n1iw0u1hd))

**Captured** `GET http://localhost:4010/todos` → 200 OK · 6 ms · 2026-10-30 04:06 UTC · page `/` (newest of 4)

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
    "title": "Check the contract"
  }
]
```

## <a id="host-env_NEXT_PUBLIC_API_URL"></a>`{NEXT_PUBLIC_API_URL ?? http://localhost:4010}`

Base URL from `process.env.NEXT_PUBLIC_API_URL`, falls back to `http://localhost:4010`.

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /products`](#ep_1xk43u1zuzy) | HTTP | browser | 1 | 1 | ✗ type mismatch |
| [`POST /todos`](#ep_1tgnolqki2r) | HTTP | browser | 1 | 1 | ✓ verified |
| [`GET /users`](#ep_16nzt1zcm62) | HTTP | server | 1 | 1 | ✓ verified |
| [`GET /users/:id`](#ep_1xqlxqpqvbv) | HTTP | server | 1 | 1 | ✓ verified |
| [`DELETE /users/:id`](#ep_0l1jfzv9rl3) | HTTP | browser | 1 | 1 | ✓ verified |

### <a id="ep_1xk43u1zuzy"></a>`GET /products`

|  |  |
| --- | --- |
| Status | ✗ type mismatch |
| Transport | HTTP |
| Called from | browser |
| Postman | [List products](postman.md#pmr_266pqs2sv5q) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products`](components/ProductPanel.md#req_08kv7zxxjyg) in [`ProductPanel`](components/ProductPanel.md) |

**Response** `Product[]` (see [`Product`](types.md#typ_1f1vojxmn7g))

**Captured** `GET http://localhost:4010/products` → 200 OK · 5 ms · 2026-10-30 04:06 UTC · page `/` (newest of 4)

Response body:

```json
[
  {
    "id": 1,
    "name": "Keyboard",
    "price": 49.9,
    "stock": 12
  },
  {
    "id": 2,
    "name": "Mouse",
    "price": 19.5,
    "stock": 0
  }
]
```

### <a id="ep_1tgnolqki2r"></a>`POST /todos`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Postman | [Create todo](postman.md#pmr_1jsi4tlr1i9) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/TodoPanel.md#req_07zzxwzir2w) in [`TodoPanel`](components/TodoPanel.md) |

**Request body** [`NewTodo`](types.md#typ_1hvhy5iwv7p)

```ts
{ title: string; userId: number }
```

**Response** [`Todo`](types.md#typ_29n1iw0u1hd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:4010/todos` → 201 Created · 6 ms · 2026-10-30 04:06 UTC · page `/`

Request body:

```json
{
  "title": "Check the contract",
  "userId": 1
}
```

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": false,
  "title": "Check the contract"
}
```

### <a id="ep_16nzt1zcm62"></a>`GET /users`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Postman | [List users](postman.md#pmr_0juh4djhx8l) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](components/HomePage.md#req_0iv5kcsl9up) in [`HomePage`](components/HomePage.md) |

**Response** `User[]` (see [`User`](types.md#typ_2ao02lpx6nv))

**Captured** `GET http://localhost:4010/users` → 200 OK · 8 ms · 2026-10-30 04:06 UTC (newest of 3)

Response body:

```json
[
  {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "admin"
  }
]
```

### <a id="ep_1xqlxqpqvbv"></a>`GET /users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Postman | [Get user](postman.md#pmr_0kyh3rt9c3n) |
| Pages | [`/users/[id]`](pages/users.%5Bid%5D.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](components/UserPage.md#req_0zfyatg6d3b) in [`UserPage`](components/UserPage.md) |

**Response** (from Postman examples) `{ id: number; name: string; email: string; role: string }`

**Captured** `GET http://localhost:4010/users/2` → 200 OK · 31 ms · 2026-10-30 04:06 UTC

Response body:

```json
{
  "id": 2,
  "name": "Alan Turing",
  "email": "alan@example.com",
  "role": "member"
}
```

### <a id="ep_0l1jfzv9rl3"></a>`DELETE /users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Pages | [`/users/[id]`](pages/users.%5Bid%5D.md) |
| Call sites | [`DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](components/DeleteUserButton.md#req_1nhvqmicx4q) in [`DeleteUserButton`](components/DeleteUserButton.md) |

**Response** `void`

**Captured** `DELETE http://localhost:4010/users/2` → 204 No Content · 7 ms · 2026-10-30 04:06 UTC · page `/users/2`
