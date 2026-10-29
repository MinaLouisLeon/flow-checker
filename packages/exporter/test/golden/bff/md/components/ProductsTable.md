# Component `ProductsTable`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/ProductsTable.tsx:8` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |
| Renders | `Link` (`next/link`) |

## Props

Takes no props.

## Types used

- [`Product`](../types.md#typ_1rwhmsgdwtz)

## Navigation

- link `/products/:id` → [`/products/[id]`](../pages/products.%5Bid%5D.md) · event onClick · `src/components/ProductsTable.tsx:23`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/products`](#req_1vj2qrt6hdx) | effect | [`ProductsTable`]() | ✓ verified (2 captures) |

### <a id="req_1vj2qrt6hdx"></a>`GET /api/products`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`ProductsTable`]() · `src/components/ProductsTable.tsx:12` |
| Trigger | effect |
| Transport | fetch |
| URL | `/api/products` |
| Handled by | [`/api/products`](../pages/api.products.md) |

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
| From | GET [`/api/products`](../pages/api.products.md) · `src/app/api/products/route.ts:7` |
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
