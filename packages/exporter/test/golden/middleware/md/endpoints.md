# Endpoints

[← Overview](README.md)

5 endpoints on 2 hosts, 0 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-app"></a>This app's API

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /api/health`](#ep_1y7bxh1ie1h) | HTTP | — | 0 | 0 | not captured |

### <a id="ep_1y7bxh1ie1h"></a>`GET /api/health`

|  |  |
| --- | --- |
| Status | not captured |
| Transport | HTTP |
| Called from | — |
| Served by | [`/api/health`](pages/api.health.md) |
| Call sites | nothing in the code calls it |

## <a id="host-env_API_URL"></a>`{API_URL ?? http://localhost:4010}`

Base URL from `process.env.API_URL`, falls back to `http://localhost:4010`.

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /me`](#ep_1lugt3jwhog) | HTTP | server | 1 | 0 | ✓ verified |
| [`GET /products`](#ep_16a5uohh2s8) | HTTP | server | 1 | 1 | ✓ verified |
| [`GET /settings`](#ep_0hbwt9tdbrl) | HTTP | server | 1 | 1 | ✓ verified |
| [`GET /users`](#ep_1ummwnixxxj) | HTTP | server | 1 | 1 | ✓ verified |

### <a id="ep_1lugt3jwhog"></a>`GET /me`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Call sites | [`GET {API_URL ?? http://localhost:4010}/me`](middleware.md#req_0pdaq2dj6vz) in [middleware](middleware.md) |

**Response** [`User`](types.md#typ_0857a9l1j3p)

```ts
{ id: number; name: string; email: string; role: "admin" | "member" }
```

**Captured** `GET http://localhost:4010/me` → 200 OK · 3 ms · 2026-10-30 02:43 UTC (newest of 4)

Response body:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "admin"
}
```

Masked: `request.headers.authorization`

### <a id="ep_16a5uohh2s8"></a>`GET /products`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/products`](pages/products.md) |
| Call sites | [`GET {API_URL ?? http://localhost:4010}/products`](components/ProductsPage.md#req_263u38ocrza) in [`ProductsPage`](components/ProductsPage.md) |

**Response** `Product[]` (see [`Product`](types.md#typ_2dct2hpocpn))

**Captured** `GET http://localhost:4010/products` → 200 OK · 36 ms · 2026-10-30 02:42 UTC

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

### <a id="ep_0hbwt9tdbrl"></a>`GET /settings`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/dashboard/settings`](pages/dashboard.settings.md) |
| Call sites | [`GET {API_URL ?? http://localhost:4010}/settings`](components/SettingsPage.md#req_0q6t9lmdld7) in [`SettingsPage`](components/SettingsPage.md) |

**Response** [`Settings`](types.md#typ_21gfaviyj48)

```ts
{ theme: string; locale: string; digest: string | null }
```

**Captured** `GET http://localhost:4010/settings` → 200 OK · 14 ms · 2026-10-30 02:42 UTC

Response body:

```json
{
  "theme": "dark",
  "locale": "en",
  "digest": null
}
```

### <a id="ep_1ummwnixxxj"></a>`GET /users`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/dashboard`](pages/dashboard.md) |
| Call sites | [`GET {API_URL ?? http://localhost:4010}/users`](components/DashboardPage.md#req_02gshaf9oil) in [`DashboardPage`](components/DashboardPage.md) |

**Response** `User[]` (see [`User`](types.md#typ_0857a9l1j3p))

**Captured** `GET http://localhost:4010/users` → 200 OK · 23 ms · 2026-10-30 02:43 UTC (newest of 2)

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
