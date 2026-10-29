# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Status | ✓ 3 verified |

## Component tree

- [`TodosPage`](../components/TodosPage.md) · server
  - [`AddTodoForm`](../components/AddTodoForm.md) · client · ⇄ 1 request
  - [`TodoList`](../components/TodoList.md) · client · ⇄ 2 requests
    - `Link` · external (`next/link`) · conditional

## Navigation

- To [`/todos/[id]`](todos.%5Bid%5D.md) (push, link)
- From [`/todos/[id]`](todos.%5Bid%5D.md) (link)

## Flows

- [AddTodoForm submit](../flows/addtodoform-submit.md)
- [TodoList change](../flows/todolist-change.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](#req_21j0fo1p54x) | event onSubmit | [`AddTodoForm`](../components/AddTodoForm.md) | ✓ verified (1 capture) |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](#req_0s4qt6a0r0d) | page-load | [`TodoList`](../components/TodoList.md) | ✓ verified (3 captures) |
| [`PATCH {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`](#req_0edpknxxbhl) | event onChange | [`TodoList`](../components/TodoList.md) | ✓ verified (1 capture) |

### <a id="req_21j0fo1p54x"></a>`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`AddTodoForm`](../components/AddTodoForm.md) · `src/components/AddTodoForm.tsx:14` |
| Trigger | event onSubmit |
| Transport | fetch · `useMutation` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos` |
| Call path | `useMutation` → `http` → `fetch` |

**Request body** [`NewTodo`](../types.md#typ_1llbjxbqwwk)

```ts
{ title: string }
```

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:4010/todos` → 201 Created · 10 ms · 2026-10-28 10:56 UTC · page `/`

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

### <a id="req_0s4qt6a0r0d"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`TodoList`](../components/TodoList.md) · `src/components/TodoList.tsx:11` |
| Trigger | page-load |
| Transport | fetch · `useQuery(todoKeys.all)` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos` |
| Call path | `useQuery` → `http` → `fetch` |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_0fc96ucq8sd))

**Captured** `GET http://localhost:4010/todos` → 200 OK · 10 ms · 2026-10-28 10:56 UTC · page `/` (newest of 3)

Response body:

```json
[
  {
    "id": 1,
    "userId": 1,
    "title": "Write the first program",
    "done": true
  },
  {
    "id": 2,
    "userId": 2,
    "title": "Break Enigma",
    "done": true
  },
  {
    "id": 3,
    "userId": 1,
    "done": false,
    "title": "Record captures"
  }
]
```

### <a id="req_0edpknxxbhl"></a>`PATCH {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoList`](../components/TodoList.md) · `src/components/TodoList.tsx:13` |
| Trigger | event onChange |
| Transport | fetch · `useMutation` |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id` (pattern) |
| Call path | `useMutation` → `updateTodo` → `http` → `fetch` |

**Request body** [`TodoPatch`](../types.md#typ_1omtz7j8kgo)

```ts
{ title?: string; done?: boolean }
```

**Response** [`Todo`](../types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `PATCH http://localhost:4010/todos/2` → 200 OK · 8 ms · 2026-10-28 10:56 UTC · page `/`

Request body:

```json
{
  "done": true
}
```

Response body:

```json
{
  "id": 2,
  "userId": 2,
  "title": "Break Enigma",
  "done": true
}
```
