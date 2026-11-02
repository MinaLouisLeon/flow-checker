# Endpoints

[← Overview](README.md)

4 endpoints on 1 host, 2 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-env_NEXT_PUBLIC_API_URL"></a>`{NEXT_PUBLIC_API_URL ?? http://localhost:4010}`

Base URL from `process.env.NEXT_PUBLIC_API_URL`, falls back to `http://localhost:4010`.

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /todos`](#ep_0i0im2g2p7v) | HTTP | browser | 1 | 1 | ✓ verified |
| [`GET /users`](#ep_16nzt1zcm62) | HTTP | server | 1 | 1 | ✓ verified |
| [`GET /users/:id`](#ep_1xqlxqpqvbv) | HTTP | server | 1 | 1 | ✓ verified |
| [`DELETE /users/:id`](#ep_0l1jfzv9rl3) | HTTP | browser | 1 | 1 | ✓ verified |

### <a id="ep_0i0im2g2p7v"></a>`GET /todos`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Query | `?userId=:userId` |
| Pages | [`/users/[id]`](pages/users.%5Bid%5D.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos?userId=:userId`](components/ProfileCard.md#req_0h7xmjn6pcm) in [`ProfileCard`](components/ProfileCard.md) |

**Response** `Todo[]` (see [`Todo`](types.md#typ_1tfsxfuhjes))

**Captured** `GET http://localhost:4010/todos?userId=2` → 200 OK · 9 ms · 2026-10-28 10:56 UTC · page `/users/2` (newest of 2)

Response body:

```json
[
  {
    "id": 2,
    "userId": 2,
    "title": "Break Enigma",
    "done": false
  }
]
```

### <a id="ep_16nzt1zcm62"></a>`GET /users`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](components/HomePage.md#req_23wds4ry0if) in [`HomePage`](components/HomePage.md) |

**Response** `User[]` (see [`User`](types.md#typ_0857a9l1j3p))

**Captured** `GET http://localhost:4010/users` → 200 OK · 16 ms · 2026-10-28 10:56 UTC (newest of 3)

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
| Pages | [`/users/[id]`](pages/users.%5Bid%5D.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](components/UserPage.md#req_21o1or0unbb) in [`UserPage`](components/UserPage.md) |

**Response** [`User`](types.md#typ_0857a9l1j3p)

```ts
{ id: number; name: string; email: string; role: Role }
```

**Captured** `GET http://localhost:4010/users/2` → 200 OK · 45 ms · 2026-10-28 10:56 UTC

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
| Call sites | [`DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](components/DeleteUserButton.md#req_0l0l4hns6qh) in [`DeleteUserButton`](components/DeleteUserButton.md) |

**Response** `void`

**Captured** `DELETE http://localhost:4010/users/2` → 204 No Content · 21 ms · 2026-10-28 10:56 UTC · page `/users/2`
