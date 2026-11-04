# Component `CatalogPage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/catalog/page.tsx:4` |
| Kind | server |
| Used on | [`/catalog`](../pages/catalog.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET http://localhost:4010/products?delay=80`](#req_1nrjkflsk7s) | server-render | [`CatalogPage`]() | ✓ verified (2 captures) |
| [`GET http://localhost:4010/products/:id?delay=40`](#req_07e7tpm2bap) | server-render | [`CatalogPage`]() | ✓ verified (4 captures) |

### <a id="req_1nrjkflsk7s"></a>`GET http://localhost:4010/products?delay=80`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`CatalogPage`]() · `src/app/catalog/page.tsx:5` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/products?delay=80` |
| Call path | `getProducts` → `get` → `fetch` |

**Response** `Product[]` (see [`Product`](../types.md#typ_0v98ajm1yyv))

**Captured** `GET http://localhost:4010/products?delay=80` → 200 OK · 92 ms · 2026-11-04 11:21 UTC (newest of 2)

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

### <a id="req_07e7tpm2bap"></a>`GET http://localhost:4010/products/:id?delay=40`

|  |  |
| --- | --- |
| Status | ✓ verified (4 captures) |
| From | [`CatalogPage`]() · `src/app/catalog/page.tsx:6` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/products/:id?delay=40` (pattern) |
| Call path | `getProduct` → `get` → `fetch` |

**Response** [`Product`](../types.md#typ_0v98ajm1yyv)

```ts
{ id: number; name: string; price: number; stock: number }
```

**Captured** `GET http://localhost:4010/products/1?delay=40` → 200 OK · 59 ms · 2026-11-04 11:21 UTC (newest of 4)

Response body:

```json
{
  "id": 1,
  "name": "Keyboard",
  "price": 49.9,
  "stock": 12
}
```
