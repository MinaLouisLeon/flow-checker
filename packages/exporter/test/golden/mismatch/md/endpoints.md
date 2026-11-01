# Endpoints

[← Overview](README.md)

4 endpoints on 1 host, 3 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-env_NEXT_PUBLIC_API_URL"></a>`{NEXT_PUBLIC_API_URL ?? http://localhost:4010}`

Base URL from `process.env.NEXT_PUBLIC_API_URL`, falls back to `http://localhost:4010`.

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /settings`](#ep_014n09i1jig) | HTTP | browser | 1 | 1 | ✗ type mismatch |
| [`GET /todos`](#ep_0i0im2g2p7v) | HTTP | browser | 1 | 1 | ✓ verified |
| [`POST /todos`](#ep_1tgnolqki2r) | HTTP | browser | 1 | 1 | ✗ type mismatch |
| [`GET /users`](#ep_16nzt1zcm62) | HTTP | server | 1 | 1 | ✗ type mismatch |

### <a id="ep_014n09i1jig"></a>`GET /settings`

|  |  |
| --- | --- |
| Status | ✗ type mismatch |
| Transport | HTTP |
| Called from | browser |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`](components/SettingsPanel.md#req_23elzbn49tu) in [`SettingsPanel`](components/SettingsPanel.md) |

**Response** [`Settings`](types.md#typ_0xjkp2la9ri)

```ts
{
  theme: "light" | "dark"
  locale: string
  digest: { frequency: "daily" | "weekly" }
}
```

**Captured** `GET http://localhost:4010/settings` → 200 OK · 12 ms · 2026-10-29 12:38 UTC · page `/` (newest of 2)

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
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/TodoPanel.md#req_1a4xvnngrvj) in [`TodoPanel`](components/TodoPanel.md) |

**Response** `Todo[]` (see [`Todo`](types.md#typ_29n1iw0u1hd))

**Captured** `GET http://localhost:4010/todos` → 200 OK · 9 ms · 2026-10-29 12:38 UTC · page `/` (newest of 2)

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
  }
]
```

### <a id="ep_1tgnolqki2r"></a>`POST /todos`

|  |  |
| --- | --- |
| Status | ✗ type mismatch |
| Transport | HTTP |
| Called from | browser |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/TodoPanel.md#req_1m9d40sdmxx) in [`TodoPanel`](components/TodoPanel.md) |

**Request body** [`NewTodo`](types.md#typ_1hvhy5iwv7p)

```ts
{ title: string; userId: number }
```

**Response** [`Todo`](types.md#typ_29n1iw0u1hd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:4010/todos` → 201 Created · 10 ms · 2026-10-29 12:38 UTC · page `/`

Request body:

```json
{
  "title": "Check types",
  "userId": "1"
}
```

Response body:

```json
{
  "id": 3,
  "userId": "1",
  "done": false,
  "title": "Check types"
}
```

### <a id="ep_16nzt1zcm62"></a>`GET /users`

|  |  |
| --- | --- |
| Status | ✗ type mismatch |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](components/HomePage.md#req_13cmzl2vi57) in [`HomePage`](components/HomePage.md) |

**Response** `Account[]` (see [`Account`](types.md#typ_2fa1fwnmo05))

**Captured** `GET http://localhost:4010/users` → 200 OK · 29 ms · 2026-10-29 12:38 UTC (newest of 2)

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
