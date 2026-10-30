# Component `TodoPanel`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `components/TodoPanel.tsx:8` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Types used

- [`Todo`](../types.md#typ_29n1iw0u1hd)

## Flows

- [TodoPanel submit](../flows/todopanel-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET http://localhost:4010/todos`](#req_1e93pbv41le) | effect | [`TodoPanel`]() | ✓ verified (4 captures) |
| [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](#req_07zzxwzir2w) | event onSubmit | [`TodoPanel`]() | ✓ verified (1 capture) |

### <a id="req_1e93pbv41le"></a>`GET http://localhost:4010/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (4 captures) |
| From | [`TodoPanel`]() · `components/TodoPanel.tsx:12` |
| Trigger | effect |
| Transport | fetch |
| URL | `http://localhost:4010/todos` (from Postman) |
| Postman | [List todos](../postman.md#pmr_1786nvyhcbb) · matched by name and method, URL from the collection |
| Call path | `listTodos` → `fetch` |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_29n1iw0u1hd))

**Captured** `GET http://localhost:4010/todos` → 200 OK · 6 ms · 2026-10-30 04:06 UTC · page `/` (newest of 4)

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
    "done": false
  },
  {
    "id": 3,
    "userId": 1,
    "done": false,
    "title": "Check the contract"
  }
]
```

### <a id="req_07zzxwzir2w"></a>`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`TodoPanel`]() · `components/TodoPanel.tsx:18` |
| Trigger | event onSubmit |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos` |
| Postman | [Create todo](../postman.md#pmr_1jsi4tlr1i9) |
| Call path | `createTodo` → `fetch` |

**Request body** [`NewTodo`](../types.md#typ_1hvhy5iwv7p)

```ts
{ title: string; userId: number }
```

**Response** [`Todo`](../types.md#typ_29n1iw0u1hd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `POST http://localhost:4010/todos` → 201 Created · 6 ms · 2026-10-30 04:06 UTC · page `/`

Request body:

```json
{
  "title": "Check the contract",
  "userId": 1
}
```

Response body:

```json
{
  "id": 3,
  "userId": 1,
  "done": false,
  "title": "Check the contract"
}
```
