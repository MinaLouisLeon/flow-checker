# Route handler `/api/products`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/api/products/route.ts` |
| Methods | GET, POST |

## Called by

| Request | From | Status |
| --- | --- | --- |
| [`POST /api/products`](../components/CreateProductForm.md#req_2ckm3fl20ym) | [`CreateProductForm`](../components/CreateProductForm.md) | ✓ verified (1 capture) |
| [`GET /api/products`](../components/ProductsTable.md#req_1vj2qrt6hdx) | [`ProductsTable`](../components/ProductsTable.md) | ✓ verified (2 captures) |

## Requests it sends

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {BACKEND_URL ?? http://localhost:4010}/products`](#req_0pmni454dyo) | route-handler | GET [`/api/products`]() | ✓ verified (2 captures) |
| [`POST {BACKEND_URL ?? http://localhost:4010}/products`](#req_02nrpzzew80) | route-handler | POST [`/api/products`]() | ✓ verified (1 capture) |

### <a id="req_0pmni454dyo"></a>`GET {BACKEND_URL ?? http://localhost:4010}/products`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/products`]() · `src/app/api/products/route.ts:7` |
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

### <a id="req_02nrpzzew80"></a>`POST {BACKEND_URL ?? http://localhost:4010}/products`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | POST [`/api/products`]() · `src/app/api/products/route.ts:23` |
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
