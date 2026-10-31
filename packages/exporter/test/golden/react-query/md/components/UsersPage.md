# Component `UsersPage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/users/page.tsx:6` |
| Kind | server |
| Used on | [`/users`](../pages/users.md) |
| Renders | `HydrationBoundary` (`@tanstack/react-query`), [`UserList`](UserList.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](#req_2a0uqvzh6dw) | server-render | [`UsersPage`]() | ✓ verified (1 capture) |

### <a id="req_2a0uqvzh6dw"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UsersPage`]() · `src/app/users/page.tsx:8` |
| Trigger | server-render |
| Transport | fetch · `prefetchQuery(userKeys.all)` · key `['users']` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users` |
| Call path | `queryClient.prefetchQuery` → `http` → `fetch` |

**Response** `User[]` (see [`User`](../types.md#typ_25sov0zzv45))

**Captured** `GET http://localhost:4010/users` → 200 OK · 30 ms · 2026-10-31 22:51 UTC

Response body:

```json
[
  {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "admin"
  },
  {
    "id": 2,
    "name": "Alan Turing",
    "email": "alan@example.com",
    "role": "member"
  }
]
```
