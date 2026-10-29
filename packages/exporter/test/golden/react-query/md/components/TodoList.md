# Component `TodoList`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/TodoList.tsx:9` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`TodosPage`](TodosPage.md) |
| Renders | `Link` (`next/link`) |

## Props

Takes no props.

## Types used

- [`Todo`](../types.md#typ_0fc96ucq8sd)

## Navigation

- link `/todos/:id` → [`/todos/[id]`](../pages/todos.%5Bid%5D.md) · event onClick · conditional · `src/components/TodoList.tsx:26`

## Flows

- [TodoList change](../flows/todolist-change.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](#req_0s4qt6a0r0d) | page-load | [`TodoList`]() | ✓ verified (3 captures) |
| [`PATCH {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`](#req_0edpknxxbhl) | event onChange | [`TodoList`]() | ✓ verified (1 capture) |

### <a id="req_0s4qt6a0r0d"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`TodoList`]() · `src/components/TodoList.tsx:11` |
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
| From | [`TodoList`]() · `src/components/TodoList.tsx:13` |
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
