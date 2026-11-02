# Endpoints

[← Overview](README.md)

6 endpoints on 2 hosts, 3 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-app"></a>This app's API

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /api/products`](#ep_1eafh09thyg) | HTTP | browser | 1 | 1 | ✓ verified |
| [`POST /api/products`](#ep_1wed7wd3h3i) | HTTP | browser | 1 | 1 | ✓ verified |
| [`GET /api/products/:id`](#ep_21y4fdp2ksy) | HTTP | browser | 1 | 1 | ✓ verified |

### <a id="ep_1eafh09thyg"></a>`GET /api/products`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Served by | [`/api/products`](pages/api.products.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET /api/products`](components/ProductsTable.md#req_1vj2qrt6hdx) in [`ProductsTable`](components/ProductsTable.md) |

**Response** `Product[]` (see [`Product`](types.md#typ_1rwhmsgdwtz))

**Captured** `GET http://localhost:3077/api/products` → 200 OK · 576 ms · 2026-10-28 10:57 UTC · page `/` (newest of 2)

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

### <a id="ep_1wed7wd3h3i"></a>`POST /api/products`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Served by | [`/api/products`](pages/api.products.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST /api/products`](components/CreateProductForm.md#req_2ckm3fl20ym) in [`CreateProductForm`](components/CreateProductForm.md) |

**Request body** [`CreateProductInput`](types.md#typ_2g53pdr4pws)

```ts
{ name: string; price: number; stock?: number }
```

**Response** [`Product`](types.md#typ_1rwhmsgdwtz)

```ts
{ id: number; name: string; price: number; stock: number }
```

**Captured** `POST http://localhost:3077/api/products` → 201 Created · 41 ms · 2026-10-28 10:57 UTC · page `/`

Request body:

```json
{
  "name": "Cable",
  "price": 9.5,
  "stock": 3
}
```

Response body:

```json
{
  "id": 3,
  "stock": 3,
  "name": "Cable",
  "price": 9.5
}
```

### <a id="ep_21y4fdp2ksy"></a>`GET /api/products/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | browser |
| Served by | [`/api/products/[id]`](pages/api.products.%5Bid%5D.md) |
| Pages | [`/products/[id]`](pages/products.%5Bid%5D.md) |
| Call sites | [`GET /api/products/:id`](components/ProductPage.md#req_2c3yq1l5klb) in [`ProductPage`](components/ProductPage.md) |

**Response** [`Product`](types.md#typ_1rwhmsgdwtz)

```ts
{ id: number; name: string; price: number; stock: number }
```

**Captured** `GET http://localhost:3077/api/products/3` → 200 OK · 1499 ms · 2026-10-28 10:57 UTC · page `/products/3` (newest of 2)

Response body:

```json
{
  "id": 3,
  "stock": 3,
  "name": "Cable",
  "price": 9.5
}
```

## <a id="host-env_BACKEND_URL"></a>`{BACKEND_URL ?? http://localhost:4010}`

Base URL from `process.env.BACKEND_URL`, falls back to `http://localhost:4010`.

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`GET /products`](#ep_1xle1no75i8) | HTTP | server | 1 | 1 | ✓ verified |
| [`POST /products`](#ep_0z635a4otwk) | HTTP | server | 1 | 1 | ✓ verified |
| [`GET /products/:id`](#ep_1rzjikzywsg) | HTTP | server | 1 | 1 | ✓ verified |

### <a id="ep_1xle1no75i8"></a>`GET /products`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET {BACKEND_URL ?? http://localhost:4010}/products`](pages/api.products.md#req_0pmni454dyo) in GET [`/api/products`](pages/api.products.md) |

**Response** `Product[]` (see [`Product`](types.md#typ_1rwhmsgdwtz))

**Captured** `GET http://localhost:4010/products` → 200 OK · 4 ms · 2026-10-28 10:57 UTC (newest of 2)

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

### <a id="ep_0z635a4otwk"></a>`POST /products`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST {BACKEND_URL ?? http://localhost:4010}/products`](pages/api.products.md#req_02nrpzzew80) in POST [`/api/products`](pages/api.products.md) |

**Request body** `{ name: string; price: number; stock: number; }`

```ts
{ name: string; price: number; stock: number }
```

**Response** [`Product`](types.md#typ_1rwhmsgdwtz)

```ts
{ id: number; name: string; price: number; stock: number }
```

**Captured** `POST http://localhost:4010/products` → 201 Created · 8 ms · 2026-10-28 10:57 UTC

Request body:

```json
{
  "name": "Cable",
  "price": 9.5,
  "stock": 3
}
```

Response body:

```json
{
  "id": 3,
  "stock": 3,
  "name": "Cable",
  "price": 9.5
}
```

### <a id="ep_1rzjikzywsg"></a>`GET /products/:id`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | HTTP |
| Called from | server |
| Pages | [`/products/[id]`](pages/products.%5Bid%5D.md) |
| Call sites | [`GET {BACKEND_URL ?? http://localhost:4010}/products/:id`](pages/api.products.%5Bid%5D.md#req_1t6ibh8o0so) in GET [`/api/products/[id]`](pages/api.products.%5Bid%5D.md) |

**Response** [`Product`](types.md#typ_1rwhmsgdwtz)

```ts
{ id: number; name: string; price: number; stock: number }
```

**Captured** `GET http://localhost:4010/products/3` → 200 OK · 3 ms · 2026-10-28 10:57 UTC (newest of 2)

Response body:

```json
{
  "id": 3,
  "stock": 3,
  "name": "Cable",
  "price": 9.5
}
```
