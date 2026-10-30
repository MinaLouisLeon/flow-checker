# Component `UserList`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/UserList.tsx:5` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/trpc/user.list`](#req_1sz2hauuhmt) | page-load | [`UserList`]() | ✓ verified (1 capture) |

### <a id="req_1sz2hauuhmt"></a>`GET /api/trpc/user.list`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserList`]() · `src/components/UserList.tsx:6` |
| Trigger | page-load |
| Transport | trpc · `useQuery` |
| URL | `/api/trpc/user.list` |
| tRPC | [`user.list`](../trpc.md#procedure-user_list) (query) |
| Handled by | [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) |

**Response** `User[]` (see [`User`](../types.md#typ_25sov0zzv45))

**Captured** `GET http://localhost:3077/api/trpc/user.list` → 200 · 2148 ms · 2026-10-30 07:05 UTC · page `/`

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

#### <a id="req_0v7l7pp65e3"></a>`GET {API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | GET [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) · `src/server/routers/user.ts:5` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/users` |
| In procedure | [`user.list`](../trpc.md#procedure-user_list) (query) |
| Call path | `listUsers` → `api` → `fetch` |

**Response** `User[]` (see [`User`](../types.md#typ_25sov0zzv45))

**Captured** `GET http://localhost:4010/users` → 200 OK · 22 ms · 2026-10-30 07:05 UTC

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
