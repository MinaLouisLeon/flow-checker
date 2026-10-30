# Component `AddTodoForm`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/AddTodoForm.tsx:7` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Navigation

- push `/todos/:id` → [`/todos/[id]`](../pages/todos.%5Bid%5D.md) · event onSubmit · on success · `src/components/AddTodoForm.tsx:14`

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/trpc/todo.add`](#req_0sfrr3m6hv2) | event onSubmit | [`AddTodoForm`]() | ✓ verified (1 capture) |

### <a id="req_0sfrr3m6hv2"></a>`POST /api/trpc/todo.add`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`AddTodoForm`]() · `src/components/AddTodoForm.tsx:11` |
| Trigger | event onSubmit |
| Transport | trpc · `useMutation` |
| URL | `/api/trpc/todo.add` |
| tRPC | [`todo.add`](../trpc.md#procedure-todo_add) (mutation) |
| Handled by | [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) |

**Request body** `z.input<typeof NewTodoSchema>`

```ts
{ title: string }
```

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:3077/api/trpc/todo.add` → 200 · 65 ms · 2026-10-30 07:05 UTC · page `/`

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

#### <a id="req_2ah5o8jjwsr"></a>`POST {API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | POST [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) · `src/server/routers/todo.ts:20` |
| Trigger | route-handler |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/todos` |
| In procedure | [`todo.add`](../trpc.md#procedure-todo_add) (mutation) |
| Call path | `createTodo` → `api` → `fetch` |

**Request body** `{ title: string; userId: number }`

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:4010/todos` → 201 Created · 6 ms · 2026-10-30 07:05 UTC

Request body:

```json
{
  "title": "Record captures",
  "userId": 1
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
