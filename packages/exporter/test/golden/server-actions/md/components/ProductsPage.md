# Component `ProductsPage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/products/page.tsx:7` |
| Kind | server |
| Used on | [`/products`](../pages/products.md) |
| Renders | `Link` (`next/link`), [`DeleteProductButton`](DeleteProductButton.md) |

## Props

Takes no props.

## Navigation

- link `/products/new` → [`/products/new`](../pages/products.new.md) · event onClick · `src/app/products/page.tsx:12`
- link `/products/:id` → [`/products/[id]`](../pages/products.%5Bid%5D.md) · event onClick · `src/app/products/page.tsx:16`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/products`](#req_1u9qpywsqwd) | server-render | [`ProductsPage`]() | ✓ verified (4 captures) |

### <a id="req_1u9qpywsqwd"></a>`GET {API_URL ?? http://localhost:4010}/products`

|  |  |
| --- | --- |
| Status | ✓ verified (4 captures) |
| From | [`ProductsPage`]() · `src/app/products/page.tsx:8` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/products` |
| Call path | `listProducts` → `fetch` |

**Response** `Product[]` (see [`Product`](../types.md#typ_0c608pp860k))

**Captured** `GET http://localhost:4010/products` → 200 OK · 26 ms · 2026-10-28 10:57 UTC (newest of 4)

Response body:

```json
[
  {
    "id": 2,
    "name": "Mouse",
    "price": 19.5,
    "stock": 0
  },
  {
    "id": 3,
    "stock": 0,
    "name": "Cable",
    "price": 9.5
  }
]
```
