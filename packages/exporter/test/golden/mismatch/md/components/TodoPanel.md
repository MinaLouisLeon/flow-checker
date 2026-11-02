# Component `TodoPanel`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `components/TodoPanel.tsx:9` |
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
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](#req_1a4xvnngrvj) | effect | [`TodoPanel`]() | ✓ verified (2 captures) |
| [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](#req_1m9d40sdmxx) | event onSubmit | [`TodoPanel`]() | ✗ type mismatch (1 capture) |

### <a id="req_1a4xvnngrvj"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodoPanel`]() · `components/TodoPanel.tsx:13` |
| Trigger | effect |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos` |
| Call path | `getTodos` → `fetch` |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_29n1iw0u1hd))

**Captured** `GET http://localhost:4010/todos` → 200 OK · 9 ms · 2026-10-29 12:38 UTC · page `/` (newest of 2)

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
  }
]
```

### <a id="req_1m9d40sdmxx"></a>`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`

|  |  |
| --- | --- |
| Status | ✗ type mismatch (1 capture) |
| From | [`TodoPanel`]() · `components/TodoPanel.tsx:19` |
| Trigger | event onSubmit |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos` |
| Call path | `createTodo` → `fetch` |

> ⚠ **[type-mismatch](../GLOSSARY.md#flag-type-mismatch)**: Response doesn't match Todo: userId is string "1" (expected number). Request body doesn't match NewTodo: userId is string "1" (expected number) (1 of 1 capture).

**Request body** [`NewTodo`](../types.md#typ_1hvhy5iwv7p)

```ts
{ title: string; userId: number }
```

**Response** [`Todo`](../types.md#typ_29n1iw0u1hd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Type check**: 1 of 1 checked capture didn't match.

| Part | Field | Problem | Expected | Captured | Captures |
| --- | --- | --- | --- | --- | ---: |
| request body | `userId` | wrong-type | `number` | `string "1"` | 1 |
| response | `userId` | wrong-type | `number` | `string "1"` | 1 |

**Captured** `POST http://localhost:4010/todos` → 201 Created · 10 ms · 2026-10-29 12:38 UTC · page `/`

Request body:

```json
{
  "title": "Check types",
  "userId": "1"
}
```

Response body:

```json
{
  "id": 3,
  "userId": "1",
  "done": false,
  "title": "Check types"
}
```
