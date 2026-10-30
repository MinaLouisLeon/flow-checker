# Component `ProductPanel`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `components/ProductPanel.tsx:7` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Types used

- [`Product`](../types.md#typ_1f1vojxmn7g)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products`](#req_08kv7zxxjyg) | effect | [`ProductPanel`]() | ✗ type mismatch (4 captures) |

### <a id="req_08kv7zxxjyg"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products`

|  |  |
| --- | --- |
| Status | ✗ type mismatch (4 captures) |
| From | [`ProductPanel`]() · `components/ProductPanel.tsx:11` |
| Trigger | effect |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products` |
| Postman | [List products](../postman.md#pmr_266pqs2sv5q) |
| Call path | `getProducts` → `fetch` |

> ⚠ **contract-mismatch**: The response type Product\[\] doesn't match the Postman example "200 OK": \[\].price is number 49.9 (expected string).
>
> ⚠ **type-mismatch**: Response doesn't match Product\[\]: \[\].price is number 49.9 (expected string) (4 of 4 captures).

**Response** `Product[]` (see [`Product`](../types.md#typ_1f1vojxmn7g))

**Type check**: 4 of 4 checked captures didn't match.

| Part | Field | Problem | Expected | Captured | Captures |
| --- | --- | --- | --- | --- | ---: |
| response | `[].price` | wrong-type | `string` | `number 49.9` | 4 |

**Captured** `GET http://localhost:4010/products` → 200 OK · 5 ms · 2026-10-30 04:06 UTC · page `/` (newest of 4)

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
