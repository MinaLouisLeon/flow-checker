# Flow: AddTodoForm submit

[← Overview](../README.md)

|  |  |
| --- | --- |
| Starts | [`AddTodoForm`](../components/AddTodoForm.md) on [`/`](../pages/index.md) |
| Pages | [`/`](../pages/index.md) → [`/todos/[id]`](../pages/todos.%5Bid%5D.md) |
| Status | not walked yet |

## Sequence

```mermaid
sequenceDiagram
  actor U as User
  participant P0 as /
  participant P1 as /api/trpc/[trpc] (handler)
  participant P2 as API (API_URL)
  participant P3 as /todos/[id]
  U->>P0: onSubmit (AddTodoForm)
  P0->>P1: POST /api/trpc/todo.add
  P1->>P2: POST /todos
  P2-->>P1: 201 Todo
  P1-->>P0: 200 Todo
  Note over P0: invalidateQueries tRPC todo.list
  P0->>P3: push
  P3->>P1: on load: GET /api/trpc/todo.byId
  P1->>P2: GET /todos/:id
  P2-->>P1: 200 Todo
  P1-->>P3: 200 Todo
  P3->>P1: on load: GET /api/trpc/user.byId
  P1->>P2: GET /users/:id
  P2-->>P1: 200 response
  P1-->>P3: 200 z.output#60;typeof UserSchema#62;
```

## Steps

| # | Step | Detail |
| ---: | --- | --- |
| 1 | User `onSubmit` in [`AddTodoForm`](../components/AddTodoForm.md) on [`/`](../pages/index.md) | `src/components/AddTodoForm.tsx:28` |
| 2 | [`POST /api/trpc/todo.add`](#req_2e9reb96ytq) | body `{ title: string }` · response `Todo` · ✓ verified (1 capture) |
| 3 | `invalidateQueries` `tRPC todo.list` | refetches `GET /api/trpc/todo.list` · `src/components/AddTodoForm.tsx:16` |
| 4 | push → [`/todos/[id]`](../pages/todos.%5Bid%5D.md) | on success · `src/components/AddTodoForm.tsx:17` |
| 5 | Page loads: [`GET /api/trpc/todo.byId`](#req_1130uk5gwu8) | body `{ id: number }` · response `Todo` · ✓ verified (2 captures) |
| 6 | Page loads: [`GET /api/trpc/user.byId`](#req_1jhjx2h6c0y) | body `{ id: number }` · response `z.output<typeof UserSchema>` · ✓ verified (1 capture) |

## Requests

### <a id="req_2e9reb96ytq"></a>`POST /api/trpc/todo.add`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`AddTodoForm`](../components/AddTodoForm.md) · `src/components/AddTodoForm.tsx:13` |
| Trigger | event onSubmit |
| Transport | trpc · `useMutation` |
| URL | `/api/trpc/todo.add` |
| tRPC | [`todo.add`](../trpc.md#procedure-todo_add) (mutation) |
| Handled by | [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) |

**Request body** `{ title: string }`

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:3077/api/trpc/todo.add` → 200 · 77 ms · 2026-10-30 07:08 UTC · page `/`

Request body:

```json
{
  "title": "Record captures"
}
```

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": false,
  "title": "Record captures"
}
```

**Leads to** `POST {API_URL ?? http://localhost:4010}/todos`:

#### <a id="req_1pnj4az8jd4"></a>`POST {API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | POST [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:11` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos` |
| In procedure | [`todo.add`](../trpc.md#procedure-todo_add) (mutation) |
| Call path | `createTodo` → `api` → `fetch` |

**Request body** `{ title: string; }`

```ts
{ title: string }
```

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:4010/todos` → 201 Created · 5 ms · 2026-10-30 07:08 UTC

Request body:

```json
{
  "title": "Record captures"
}
```

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": false,
  "title": "Record captures"
}
```

### <a id="req_1130uk5gwu8"></a>`GET /api/trpc/todo.byId`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoDetail`](../components/TodoDetail.md) · `src/components/TodoDetail.tsx:10` |
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
| From | [`TodoDetail`](../components/TodoDetail.md) · `src/components/TodoDetail.tsx:11` |
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
