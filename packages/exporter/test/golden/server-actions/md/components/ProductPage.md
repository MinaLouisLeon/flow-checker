# Component `ProductPage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/products/[id]/page.tsx:7` |
| Kind | server |
| Used on | [`/products/[id]`](../pages/products.%5Bid%5D.md) |
| Renders | `Link` (`next/link`) |

## Props

`{ params: Promise<{ id: string }> }`

## Navigation

- link `/products` → [`/products`](../pages/products.md) · event onClick · `src/app/products/[id]/page.tsx:18`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/products/:id`](#req_25a1hdpohd6) | server-render | [`ProductPage`]() | ✓ verified (1 capture) |

### <a id="req_25a1hdpohd6"></a>`GET {API_URL ?? http://localhost:4010}/products/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`ProductPage`]() · `src/app/products/[id]/page.tsx:9` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/products/:id` (pattern) |
| Call path | `getProduct` → `fetch` |

**Response** `Product | null` (see [`Product`](../types.md#typ_0c608pp860k))

**Captured** `GET http://localhost:4010/products/3` → 200 OK · 18 ms · 2026-10-28 10:56 UTC

Response body:

```json
{
  "id": 3,
  "stock": 0,
  "name": "Cable",
  "price": 9.5
}
```
