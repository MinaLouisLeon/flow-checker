# Component `HomePage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/page.tsx:9` |
| Kind | server |
| Used on | [`/`](../pages/index.md) |
| Renders | `Link` (`next/link`), [`ProductPanel`](ProductPanel.md), [`TodoPanel`](TodoPanel.md) |

## Props

Takes no props.

## Navigation

- link `/users/:id` → [`/users/[id]`](../pages/users.%5Bid%5D.md) · event onClick · `app/page.tsx:17`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](#req_0iv5kcsl9up) | server-render | [`HomePage`]() | ✓ verified (3 captures) |

### <a id="req_0iv5kcsl9up"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`HomePage`]() · `app/page.tsx:10` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users` |
| Postman | [List users](../postman.md#pmr_0juh4djhx8l) |
| Call path | `getUsers` → `fetch` |

**Response** `User[]` (see [`User`](../types.md#typ_2ao02lpx6nv))

**Captured** `GET http://localhost:4010/users` → 200 OK · 8 ms · 2026-10-30 04:06 UTC (newest of 3)

Response body:

```json
[
  {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "admin"
  }
]
```
