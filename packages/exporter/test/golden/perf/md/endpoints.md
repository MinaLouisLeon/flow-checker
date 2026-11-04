# Endpoints

[← Overview](README.md)

8 endpoints on 1 host, 1 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-base_http___localhost_4010"></a>`http://localhost:4010`

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /products`](#ep_275iksa9pjl) | HTTP | server | 4 | 4 | ✓ verified (4 of 4 call sites) |
| [`GET /products/:id`](#ep_025t2a5t2lw) | HTTP | server | 2 | 2 | ✓ verified (2 of 2 call sites) |
| [`GET /settings`](#ep_1ckvaf6myz5) | HTTP | server | 2 | 1 | not captured |
| [`GET /todos`](#ep_26ggeb6bo31) | HTTP | server | 2 | 2 | ✓ verified (2 of 2 call sites) |
| [`GET /todos/:id`](#ep_1a2ydq3gya7) | HTTP | browser | 1 | 1 | ✓ verified |
| [`GET /users/1`](#ep_1rapnh4g8ys) | HTTP | server | 3 | 2 | ✓ verified (1 of 3 call sites) |
| [`GET /users/2`](#ep_28hbmhfa5x4) | HTTP | server | 2 | 1 | ✓ verified (1 of 2 call sites) |
| [`GET /users/:id`](#ep_0vl5nnfgzjj) | HTTP | server | 2 | 1 | ✓ verified (2 of 2 call sites) |

### <a id="ep_275iksa9pjl"></a>`GET /products`

|  |  |
| --- | --- |
| Status | ✓ verified (4 of 4 call sites) |
| Transport | HTTP |
| Called from | server |
| Query | `?delay=80` |
| Pages | [`/catalog`](pages/catalog.md), [`/`](pages/index.md), [`/products`](pages/products.md), [`/users/[id]`](pages/users.%5Bid%5D.md) |
| Call sites | [`GET http://localhost:4010/products?delay=80`](components/CatalogPage.md#req_1nrjkflsk7s) in [`CatalogPage`](components/CatalogPage.md)<br>[`GET http://localhost:4010/products?delay=80`](components/Home.md#req_0kd0ltojnrd) in [`Home`](components/Home.md)<br>[`GET http://localhost:4010/products?delay=80`](components/ProductsPage.md#req_14b37uscwxs) in [`ProductsPage`](components/ProductsPage.md)<br>[`GET http://localhost:4010/products?delay=80`](components/UserPage.md#req_21fpvnjjwok) in [`UserPage`](components/UserPage.md) |

**Response** `Product[]` (see [`Product`](types.md#typ_0v98ajm1yyv))

**Captured** `GET http://localhost:4010/products?delay=80` → 200 OK · 92 ms · 2026-11-04 11:21 UTC (newest of 9)

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

### <a id="ep_025t2a5t2lw"></a>`GET /products/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (2 of 2 call sites) |
| Transport | HTTP |
| Called from | server |
| Query | `?delay=40` |
| Pages | [`/catalog`](pages/catalog.md), [`/products`](pages/products.md) |
| Call sites | [`GET http://localhost:4010/products/:id?delay=40`](components/CatalogPage.md#req_07e7tpm2bap) in [`CatalogPage`](components/CatalogPage.md)<br>[`GET http://localhost:4010/products/:id?delay=40`](components/ProductsPage.md#req_16g2mworngz) in [`ProductsPage`](components/ProductsPage.md) |

**Response** [`Product`](types.md#typ_0v98ajm1yyv)

```ts
{ id: number; name: string; price: number; stock: number }
```

**Captured** `GET http://localhost:4010/products/2?delay=40` → 200 OK · 47 ms · 2026-11-04 11:21 UTC (newest of 8)

Response body:

```json
{
  "id": 2,
  "name": "Mouse",
  "price": 19.5,
  "stock": 0
}
```

### <a id="ep_1ckvaf6myz5"></a>`GET /settings`

|  |  |
| --- | --- |
| Status | not captured |
| Transport | HTTP |
| Called from | server |
| Query | `?delay=40` |
| Pages | [`/settings`](pages/settings.md) |
| Call sites | [`GET http://localhost:4010/settings?delay=40`](components/SettingsLayout.md#req_147qy0vyz3e) in [`SettingsLayout`](components/SettingsLayout.md)<br>[`GET http://localhost:4010/settings?delay=40`](components/SettingsPage.md#req_1p429pabq9j) in [`SettingsPage`](components/SettingsPage.md) |

**Response** [`Settings`](types.md#typ_0vz15qy2iug)

```ts
{ theme: string; locale: string; digest: string | null }
```

### <a id="ep_26ggeb6bo31"></a>`GET /todos`

|  |  |
| --- | --- |
| Status | ✓ verified (2 of 2 call sites) |
| Transport | HTTP |
| Called from | server |
| Query | `?delay=40`, `?userId=:userId&delay=40` |
| Pages | [`/todos`](pages/todos.md), [`/users/[id]`](pages/users.%5Bid%5D.md) |
| Call sites | [`GET http://localhost:4010/todos?delay=40`](components/TodosPage.md#req_14km2kuqtgu) in [`TodosPage`](components/TodosPage.md)<br>[`GET http://localhost:4010/todos?userId=:userId&delay=40`](components/UserPage.md#req_00405rt0lsa) in [`UserPage`](components/UserPage.md) |

**Response** `Todo[]` (see [`Todo`](types.md#typ_25zdvnqvuxl))

**Captured** `GET http://localhost:4010/todos?delay=40` → 200 OK · 60 ms · 2026-11-04 11:21 UTC (newest of 4)

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

### <a id="ep_1a2ydq3gya7"></a>`GET /todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Query | `?delay=30` |
| Pages | [`/todos`](pages/todos.md) |
| Call sites | [`GET http://localhost:4010/todos/:id?delay=30`](components/TodoRow.md#req_21cujfajgmg) in [`TodoRow`](components/TodoRow.md) |

**Response** [`Todo`](types.md#typ_25zdvnqvuxl)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `GET http://localhost:4010/todos/2?delay=30` → 200 OK · 94 ms · 2026-11-04 11:21 UTC · page `/todos` (newest of 8)

Response body:

```json
{
  "id": 2,
  "userId": 2,
  "title": "Break Enigma",
  "done": false
}
```

### <a id="ep_1rapnh4g8ys"></a>`GET /users/1`

|  |  |
| --- | --- |
| Status | ✓ verified (1 of 3 call sites) |
| Transport | HTTP |
| Called from | server |
| Query | `?delay=80`, `?delay=20` |
| Pages | [`/`](pages/index.md), [`/settings`](pages/settings.md) |
| Call sites | [`GET http://localhost:4010/users/1?delay=80`](components/Home.md#req_23ca0tetmxk) in [`Home`](components/Home.md)<br>[`GET http://localhost:4010/users/1?delay=20`](components/SettingsLayout.md#req_03bknq0ncj5) in [`SettingsLayout`](components/SettingsLayout.md)<br>[`GET http://localhost:4010/users/1?delay=20`](components/SettingsPage.md#req_0vimi2c2ovq) in [`SettingsPage`](components/SettingsPage.md) |

**Response** [`User`](types.md#typ_0mxt2h8i81o)

```ts
{ id: number; name: string; email: string; role: string }
```

**Captured** `GET http://localhost:4010/users/1?delay=80` → 200 OK · 93 ms · 2026-11-04 11:21 UTC (newest of 3)

Response body:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "admin"
}
```

### <a id="ep_28hbmhfa5x4"></a>`GET /users/2`

|  |  |
| --- | --- |
| Status | ✓ verified (1 of 2 call sites) |
| Transport | HTTP |
| Called from | server |
| Query | `?delay=80` |
| Pages | [`/settings`](pages/settings.md) |
| Call sites | [`GET http://localhost:4010/users/2?delay=80`](components/SettingsLayout.md#req_1rc36qnaspk) in [`SettingsLayout`](components/SettingsLayout.md)<br>[`GET http://localhost:4010/users/2?delay=80`](components/SettingsPage.md#req_1lhn3mfgf8g) in [`SettingsPage`](components/SettingsPage.md) |

**Response** [`User`](types.md#typ_0mxt2h8i81o)

```ts
{ id: number; name: string; email: string; role: string }
```

**Captured** `GET http://localhost:4010/users/2?delay=80` → 200 OK · 97 ms · 2026-11-04 11:21 UTC (newest of 2)

Response body:

```json
{
  "id": 2,
  "name": "Alan Turing",
  "email": "alan@example.com",
  "role": "member"
}
```

### <a id="ep_0vl5nnfgzjj"></a>`GET /users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (2 of 2 call sites) |
| Transport | HTTP |
| Called from | server |
| Query | `?delay=80` |
| Pages | [`/users/[id]`](pages/users.%5Bid%5D.md) |
| Call sites | [`GET http://localhost:4010/users/:id?delay=80`](components/UserPage.md#req_1n4wecz1zex) in [`UserPage`](components/UserPage.md)<br>[`GET http://localhost:4010/users/:id?delay=80`](components/UserPage.md#req_228s24jz87h) in [`UserPage`](components/UserPage.md) |

**Response** [`User`](types.md#typ_0mxt2h8i81o)

```ts
{ id: number; name: string; email: string; role: string }
```

**Captured** `GET http://localhost:4010/users/2?delay=80` → 200 OK · 99 ms · 2026-11-04 11:21 UTC (newest of 4)

Response body:

```json
{
  "id": 2,
  "name": "Alan Turing",
  "email": "alan@example.com",
  "role": "member"
}
```
