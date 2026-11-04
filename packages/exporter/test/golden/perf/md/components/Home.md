# Component `Home`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/page.tsx:4` |
| Kind | server |
| Used on | [`/`](../pages/index.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET http://localhost:4010/users/1?delay=80`](#req_23ca0tetmxk) | server-render | [`Home`]() | ✓ verified (3 captures) |
| [`GET http://localhost:4010/products?delay=80`](#req_0kd0ltojnrd) | server-render | [`Home`]() | ✓ verified (3 captures) |

### <a id="req_23ca0tetmxk"></a>`GET http://localhost:4010/users/1?delay=80`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`Home`]() · `src/app/page.tsx:5` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/users/1?delay=80` |
| Call path | `getUser` → `get` → `fetch` |

**Response** [`User`](../types.md#typ_0mxt2h8i81o)

```ts
{ id: number; name: string; email: string; role: string }
```

**Captured** `GET http://localhost:4010/users/1?delay=80` → 200 OK · 93 ms · 2026-11-04 11:21 UTC (newest of 3)

Response body:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "admin"
}
```

### <a id="req_0kd0ltojnrd"></a>`GET http://localhost:4010/products?delay=80`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`Home`]() · `src/app/page.tsx:6` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/products?delay=80` |
| Call path | `getProducts` → `get` → `fetch` |

**Response** `Product[]` (see [`Product`](../types.md#typ_0v98ajm1yyv))

**Captured** `GET http://localhost:4010/products?delay=80` → 200 OK · 101 ms · 2026-11-04 11:21 UTC (newest of 3)

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
