# Page `/users`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/users/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Status | ✓ 1 verified |

## Component tree

- [`UsersPage`](../components/UsersPage.md) · server
  - `Suspense` · external (`react`)
  - [`UserList`](../components/UserList.md) · client · ⇄ 1 request

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/trpc/user.list`](#req_0mfdzrz4ekf) | page-load | [`UserList`](../components/UserList.md) | ✓ verified (1 capture) |

### <a id="req_0mfdzrz4ekf"></a>`GET /api/trpc/user.list`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserList`](../components/UserList.md) · `src/components/UserList.tsx:8` |
| Trigger | page-load |
| Transport | trpc · `useSuspenseQuery` |
| URL | `/api/trpc/user.list` |
| tRPC | [`user.list`](../trpc.md#procedure-user_list) (query) |
| Handled by | [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) |

**Response** `{ id: number; name: string; email: string; role: "admin" | "member" }[]`

**Captured** `GET http://localhost:3077/api/trpc/user.list` → 200 · 41 ms · 2026-10-30 07:09 UTC · page `/users`

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

**Leads to** `GET {API_URL ?? http://localhost:4010}/users`:

#### <a id="req_1grc5hxysxt"></a>`GET {API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | GET [`/api/trpc/[trpc]`](api.trpc.%5Btrpc%5D.md) · `src/server/routers/user.ts:14` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/users` |
| In procedure | [`user.list`](../trpc.md#procedure-user_list) (query) |
| Call path | `fetchUsers` → `api` → `fetch` |

> ⚠ **unknown-response**: No response type was found (annotation, generic or cast).

**Captured** `GET http://localhost:4010/users` → 200 OK · 17 ms · 2026-10-30 07:09 UTC

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
