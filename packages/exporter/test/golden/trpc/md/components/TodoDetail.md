# Component `TodoDetail`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/TodoDetail.tsx:6` |
| Kind | client (`'use client'`) |
| Used on | [`/todos/[id]`](../pages/todos.%5Bid%5D.md) |
| Rendered by | [`TodoPage`](TodoPage.md) |

## Props

`{ id: number }`

## Flows

- [TodoDetail click](../flows/tododetail-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/trpc/todo.byId`](#req_1130uk5gwu8) | page-load | [`TodoDetail`]() | ✓ verified (2 captures) |
| [`GET /api/trpc/user.byId`](#req_1jhjx2h6c0y) | page-load | [`TodoDetail`]() | ✓ verified (1 capture) |
| [`POST /api/trpc/todo.toggle`](#req_1yefdvziu6b) | event onClick | [`TodoDetail`]() | ✓ verified (1 capture) |

### <a id="req_1130uk5gwu8"></a>`GET /api/trpc/todo.byId`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoDetail`]() · `src/components/TodoDetail.tsx:10` |
| Trigger | page-load |
| Transport | trpc · `useQuery` |
| URL | `/api/trpc/todo.byId` |
| tRPC | [`todo.byId`](../trpc.md#procedure-todo_byId) (query) |
| Handled by | [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) |

**Request body** `{ id: number }`

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `GET http://localhost:3077/api/trpc/todo.byId` → 200 · 22 ms · 2026-10-30 07:09 UTC · page `/todos/3` (newest of 2)

Request body:

```json
{
  "id": 3
}
```

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": true,
  "title": "Record captures"
}
```

**Leads to** `GET {API_URL ?? http://localhost:4010}/todos/:id`:

#### <a id="req_1pf3v7qr14b"></a>`GET {API_URL ?? http://localhost:4010}/todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:8` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos/:id` (pattern) |
| In procedure | [`todo.byId`](../trpc.md#procedure-todo_byId) (query) |
| Call path | `getTodo` → `api` → `fetch` |

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `GET http://localhost:4010/todos/3` → 200 OK · 3 ms · 2026-10-30 07:09 UTC (newest of 2)

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": true,
  "title": "Record captures"
}
```

### <a id="req_1jhjx2h6c0y"></a>`GET /api/trpc/user.byId`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoDetail`]() · `src/components/TodoDetail.tsx:11` |
| Trigger | page-load |
| Transport | trpc · `useQuery` |
| URL | `/api/trpc/user.byId` |
| tRPC | [`user.byId`](../trpc.md#procedure-user_byId) (query) |
| Handled by | [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) |

**Request body** `{ id: number }`

**Response** `z.output<typeof UserSchema>`

```ts
{ id: number; name: string; email: string; role: "admin" | "member" }
```

**Captured** `GET http://localhost:3077/api/trpc/user.byId` → 200 · 22 ms · 2026-10-30 07:09 UTC · page `/todos/3`

Request body:

```json
{
  "id": 1
}
```

Response body:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "admin"
}
```

**Leads to** `GET {API_URL ?? http://localhost:4010}/users/:id`:

#### <a id="req_2c4oanm9vl7"></a>`GET {API_URL ?? http://localhost:4010}/users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | GET [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) · `src/server/routers/user.ts:18` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/users/:id` (pattern) |
| In procedure | [`user.byId`](../trpc.md#procedure-user_byId) (query) |
| Call path | `fetchUser` → `api` → `fetch` |

> ⚠ **[unknown-response](../GLOSSARY.md#flag-unknown-response)**: No response type was found (annotation, generic or cast).

**Captured** `GET http://localhost:4010/users/1` → 200 OK · 3 ms · 2026-10-30 07:09 UTC

Response body:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "admin"
}
```

### <a id="req_1yefdvziu6b"></a>`POST /api/trpc/todo.toggle`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoDetail`]() · `src/components/TodoDetail.tsx:18` |
| Trigger | event onClick |
| Transport | trpc |
| URL | `/api/trpc/todo.toggle` |
| tRPC | [`todo.toggle`](../trpc.md#procedure-todo_toggle) (mutation) |
| Handled by | [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) |

**Request body** `{ id: number; done: boolean }`

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:3077/api/trpc/todo.toggle` → 200 · 37 ms · 2026-10-30 07:09 UTC · page `/todos/3`

Request body:

```json
{
  "id": 3,
  "done": true
}
```

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": true,
  "title": "Record captures"
}
```

**Leads to** `PATCH {API_URL ?? http://localhost:4010}/todos/:id`:

#### <a id="req_0e790agvf59"></a>`PATCH {API_URL ?? http://localhost:4010}/todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | POST [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:14` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos/:id` (pattern) |
| In procedure | [`todo.toggle`](../trpc.md#procedure-todo_toggle) (mutation) |
| Call path | `patchTodo` → `api` → `fetch` |

**Request body** `{ done: boolean; }`

```ts
{ done: boolean }
```

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `PATCH http://localhost:4010/todos/3` → 200 OK · 4 ms · 2026-10-30 07:09 UTC

Request body:

```json
{
  "done": true
}
```

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": true,
  "title": "Record captures"
}
```
