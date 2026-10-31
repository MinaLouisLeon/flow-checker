# Flow: UserList mouseenter

[← Overview](../README.md)

|  |  |
| --- | --- |
| Starts | [`UserList`](../components/UserList.md) on [`/users`](../pages/users.md) |
| Pages | [`/users`](../pages/users.md) |
| Status | not walked yet |

## Sequence

```mermaid
sequenceDiagram
  actor U as User
  participant P0 as /users
  participant P1 as API (NEXT_PUBLIC_API_URL)
  U->>P0: onMouseEnter (UserList)
  P0->>P1: GET /users/:id
  P1-->>P0: 200 User
```

## Steps

| # | Step | Detail |
| ---: | --- | --- |
| 1 | User `onMouseEnter` in [`UserList`](../components/UserList.md) on [`/users`](../pages/users.md) | `src/components/UserList.tsx:29` |
| 2 | [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](#req_1g8keamimjw) | response `User` · ✓ verified (1 capture) |

## Requests

### <a id="req_1g8keamimjw"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserList`](../components/UserList.md) · `src/components/UserList.tsx:29` |
| Trigger | event onMouseEnter |
| Transport | fetch · `prefetchQuery(userKeys.detail(id))` · key `['users', :id]` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id` (pattern) |
| Call path | `queryClient.prefetchQuery` → `fetchUser` → `http` → `fetch` |

**Response** [`User`](../types.md#typ_25sov0zzv45)

```ts
{ id: number; name: string; email: string; role: "admin" | "member" }
```

**Captured** `GET http://localhost:4010/users/1` → 200 OK · 5 ms · 2026-10-30 01:38 UTC · page `/users`

Response body:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "admin"
}
```
