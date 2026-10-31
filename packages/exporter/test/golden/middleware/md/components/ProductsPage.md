# Component `ProductsPage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/products/page.tsx:5` |
| Kind | server |
| Used on | [`/products`](../pages/products.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/products`](#req_263u38ocrza) | server-render | [`ProductsPage`]() | ✓ verified (1 capture) |

### <a id="req_263u38ocrza"></a>`GET {API_URL ?? http://localhost:4010}/products`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`ProductsPage`]() · `app/products/page.tsx:6` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/products` |
| Call path | `getProducts` → `fetch` |

**Response** `Product[]` (see [`Product`](../types.md#typ_2dct2hpocpn))

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
