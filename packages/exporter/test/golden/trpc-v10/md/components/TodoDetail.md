# Component `TodoDetail`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/TodoDetail.tsx:5` |
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
| [`GET /api/trpc/todo.byId`](#req_0i7plnzsuv7) | page-load | [`TodoDetail`]() | ✓ verified (2 captures) |
| [`POST /api/trpc/todo.toggle`](#req_02es5n58ro4) | event onClick | [`TodoDetail`]() | ✓ verified (1 capture) |

### <a id="req_0i7plnzsuv7"></a>`GET /api/trpc/todo.byId`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoDetail`]() · `src/components/TodoDetail.tsx:7` |
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

**Captured** `GET http://localhost:3077/api/trpc/todo.byId` → 200 · 25 ms · 2026-10-30 07:05 UTC · page `/todos/3` (newest of 2)

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

#### <a id="req_19v0zzhv2k5"></a>`GET {API_URL ?? http://localhost:4010}/todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | GET [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:17` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos/:id` (pattern) |
| In procedure | [`todo.byId`](../trpc.md#procedure-todo_byId) (query) |
| Call path | `getTodo` → `api` → `fetch` |

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `GET http://localhost:4010/todos/3` → 200 OK · 2 ms · 2026-10-30 07:05 UTC (newest of 2)

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": true,
  "title": "Record captures"
}
```

### <a id="req_02es5n58ro4"></a>`POST /api/trpc/todo.toggle`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoDetail`]() · `src/components/TodoDetail.tsx:11` |
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

**Captured** `POST http://localhost:3077/api/trpc/todo.toggle` → 200 · 38 ms · 2026-10-30 07:05 UTC · page `/todos/3`

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

#### <a id="req_0n9qb5iqo86"></a>`PATCH {API_URL ?? http://localhost:4010}/todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | POST [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:23` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos/:id` (pattern) |
| In procedure | [`todo.toggle`](../trpc.md#procedure-todo_toggle) (mutation) |
| Call path | `patchTodo` → `api` → `fetch` |

**Request body** `Partial<Pick<Todo, 'done' | 'title'>>`

```ts
{ title?: string; done?: boolean }
```

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `PATCH http://localhost:4010/todos/3` → 200 OK · 3 ms · 2026-10-30 07:05 UTC

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
