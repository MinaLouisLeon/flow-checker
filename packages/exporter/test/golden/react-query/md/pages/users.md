# Page `/users`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/users/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Status | ✓ 5 verified |

## Component tree

- [`UsersPage`](../components/UsersPage.md) · server · ⇄ 1 request
  - `HydrationBoundary` · external (`@tanstack/react-query`)
  - [`UserList`](../components/UserList.md) · client · ⇄ 4 requests

## Flows

- [UserList mouseenter](../flows/userlist-mouseenter.md)
- [UserList click](../flows/userlist-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](#req_2a0uqvzh6dw) | server-render | [`UsersPage`](../components/UsersPage.md) | ✓ verified (1 capture) |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](#req_0m4arr015hb) | page-load | [`UserList`](../components/UserList.md) | ✓ verified (2 captures) |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos?userId=:userId`](#req_0ht2fssv0ja) | page-load | [`UserList`](../components/UserList.md) | ✓ verified (2 captures) |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](#req_0ka937821vy) | event onClick | [`UserList`](../components/UserList.md) | ✓ verified (1 capture) |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](#req_1g8keamimjw) | event onMouseEnter | [`UserList`](../components/UserList.md) | ✓ verified (1 capture) |

### <a id="req_2a0uqvzh6dw"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UsersPage`](../components/UsersPage.md) · `src/app/users/page.tsx:8` |
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

### <a id="req_0m4arr015hb"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`UserList`](../components/UserList.md) · `src/components/UserList.tsx:9` |
| Trigger | page-load |
| Transport | fetch · `useQuery(userKeys.all)` · key `['users']` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users` |
| Call path | `useQuery` → `http` → `fetch` |

**Response** `User[]` (see [`User`](../types.md#typ_25sov0zzv45))

**Captured** `GET http://localhost:4010/users` → 200 OK · 10 ms · 2026-10-31 22:51 UTC · page `/users` (newest of 2)

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

### <a id="req_0ht2fssv0ja"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos?userId=:userId`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`UserList`](../components/UserList.md) · `src/components/UserList.tsx:11` |
| Trigger | page-load |
| Transport | fetch · `useQueries(userKeys.todos(user.id))` · key `['todos', 'list', { userId: :id }]` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos?userId=:userId` (pattern) |
| Call path | `useQueries` → `fetchUserTodos` → `http` → `fetch` |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_0fc96ucq8sd))

**Captured** `GET http://localhost:4010/todos?userId=2` → 200 OK · 6 ms · 2026-10-31 22:51 UTC · page `/users` (newest of 2)

Response body:

```json
[
  {
    "id": 2,
    "userId": 2,
    "title": "Break Enigma",
    "done": true
  }
]
```

### <a id="req_0ka937821vy"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserList`](../components/UserList.md) · `src/components/UserList.tsx:18` |
| Trigger | event onClick |
| Transport | fetch · `ensureQueryData(userKeys.detail(id))` · key `['users', :id]` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id` (pattern) |
| Call path | `queryClient.ensureQueryData` → `fetchUser` → `http` → `fetch` |

**Response** [`User`](../types.md#typ_25sov0zzv45)

```ts
{ id: number; name: string; email: string; role: "admin" | "member" }
```

**Captured** `GET http://localhost:4010/users/2` → 200 OK · 3 ms · 2026-10-31 22:51 UTC · page `/users`

Response body:

```json
{
  "id": 2,
  "name": "Alan Turing",
  "email": "alan@example.com",
  "role": "member"
}
```

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

**Captured** `GET http://localhost:4010/users/1` → 200 OK · 5 ms · 2026-10-31 22:51 UTC · page `/users`

Response body:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "admin"
}
```
