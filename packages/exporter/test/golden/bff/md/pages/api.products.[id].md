# Route handler `/api/products/[id]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/api/products/[id]/route.ts` |
| Methods | GET |

## Called by

| Request | From | Status |
| --- | --- | --- |
| [`GET /api/products/:id`](../components/ProductPage.md#req_2c3yq1l5klb) | [`ProductPage`](../components/ProductPage.md) | ✓ verified (2 captures) |

## Requests it sends

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {BACKEND_URL ?? http://localhost:4010}/products/:id`](#req_1t6ibh8o0so) | route-handler | GET [`/api/products/[id]`]() | ✓ verified (2 captures) |

### <a id="req_1t6ibh8o0so"></a>`GET {BACKEND_URL ?? http://localhost:4010}/products/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/products/[id]`]() · `src/app/api/products/[id]/route.ts:8` |
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
