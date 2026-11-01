# Page `/products`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/products/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Access | open |
| Status | ✓ 1 verified |

## Component tree

- [`ProductsPage`](../components/ProductsPage.md) · server · ⇄ 1 request

## Navigation

- From [`/`](index.md) (link)

## Middleware

[`proxy.ts`](../middleware.md) rewrites other paths to this route.

- Answers `/shop/*` (rewrite)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/products`](#req_263u38ocrza) | server-render | [`ProductsPage`](../components/ProductsPage.md) | ✓ verified (1 capture) |

### <a id="req_263u38ocrza"></a>`GET {API_URL ?? http://localhost:4010}/products`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`ProductsPage`](../components/ProductsPage.md) · `app/products/page.tsx:6` |
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
