# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Status | ✓ 2 verified |

## Component tree

- [`HomePage`](../components/HomePage.md) · server
  - [`CreateProductForm`](../components/CreateProductForm.md) · client · ⇄ 1 request
  - [`ProductsTable`](../components/ProductsTable.md) · client · ⇄ 1 request
    - `Link` · external (`next/link`)

## Navigation

- From [`/products/[id]`](products.%5Bid%5D.md) (link)
- To [`/products/[id]`](products.%5Bid%5D.md) (push, link)

## Flows

- [CreateProductForm submit](../flows/createproductform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/products`](#req_2ckm3fl20ym) | event onSubmit | [`CreateProductForm`](../components/CreateProductForm.md) | ✓ verified (1 capture) |
| [`GET /api/products`](#req_1vj2qrt6hdx) | effect | [`ProductsTable`](../components/ProductsTable.md) | ✓ verified (2 captures) |

### <a id="req_2ckm3fl20ym"></a>`POST /api/products`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`CreateProductForm`](../components/CreateProductForm.md) · `src/components/CreateProductForm.tsx:21` |
| Trigger | event onSubmit |
| Transport | fetch |
| URL | `/api/products` |
| Handled by | [`/api/products`](api.products.md) |

**Request body** [`CreateProductInput`](../types.md#typ_2g53pdr4pws)

```ts
{ name: string; price: number; stock?: number }
```

**Response** [`Product`](../types.md#typ_1rwhmsgdwtz)

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

**Leads to** `POST {BACKEND_URL ?? http://localhost:4010}/products`:

#### <a id="req_02nrpzzew80"></a>`POST {BACKEND_URL ?? http://localhost:4010}/products`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | POST [`/api/products`](api.products.md) · `src/app/api/products/route.ts:23` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{BACKEND_URL ?? http://localhost:4010}/products` |
| Call path | `backend` → `fetch` |

**Request body** `{ name: string; price: number; stock: number; }`

```ts
{ name: string; price: number; stock: number }
```

**Response** [`Product`](../types.md#typ_1rwhmsgdwtz)

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

### <a id="req_1vj2qrt6hdx"></a>`GET /api/products`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`ProductsTable`](../components/ProductsTable.md) · `src/components/ProductsTable.tsx:12` |
| Trigger | effect |
| Transport | fetch |
| URL | `/api/products` |
| Handled by | [`/api/products`](api.products.md) |

**Response** `Product[]` (see [`Product`](../types.md#typ_1rwhmsgdwtz))

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

**Leads to** `GET {BACKEND_URL ?? http://localhost:4010}/products`:

#### <a id="req_0pmni454dyo"></a>`GET {BACKEND_URL ?? http://localhost:4010}/products`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/products`](api.products.md) · `src/app/api/products/route.ts:7` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{BACKEND_URL ?? http://localhost:4010}/products` |
| Call path | `backend` → `fetch` |

**Response** `Product[]` (see [`Product`](../types.md#typ_1rwhmsgdwtz))

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
