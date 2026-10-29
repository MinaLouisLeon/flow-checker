# Component `ProductPage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/products/[id]/page.tsx:8` |
| Kind | client (`'use client'`) |
| Used on | [`/products/[id]`](../pages/products.%5Bid%5D.md) |
| Renders | `Link` (`next/link`) |

## Props

`{ params: Promise<{ id: string }> }`

## Types used

- [`Product`](../types.md#typ_1rwhmsgdwtz)

## Navigation

- link `/` → [`/`](../pages/index.md) · event onClick · `src/app/products/[id]/page.tsx:22`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/products/:id`](#req_2c3yq1l5klb) | effect | [`ProductPage`]() | ✓ verified (2 captures) |

### <a id="req_2c3yq1l5klb"></a>`GET /api/products/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`ProductPage`]() · `src/app/products/[id]/page.tsx:13` |
| Trigger | effect |
| Transport | fetch |
| URL | `/api/products/:id` (pattern) |
| Handled by | [`/api/products/[id]`](../pages/api.products.%5Bid%5D.md) |

**Response** [`Product`](../types.md#typ_1rwhmsgdwtz)

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

**Leads to** `GET {BACKEND_URL ?? http://localhost:4010}/products/:id`:

#### <a id="req_1t6ibh8o0so"></a>`GET {BACKEND_URL ?? http://localhost:4010}/products/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/products/[id]`](../pages/api.products.%5Bid%5D.md) · `src/app/api/products/[id]/route.ts:8` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{BACKEND_URL ?? http://localhost:4010}/products/:id` (pattern) |
| Call path | `backend` → `fetch` |

**Response** [`Product`](../types.md#typ_1rwhmsgdwtz)

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
