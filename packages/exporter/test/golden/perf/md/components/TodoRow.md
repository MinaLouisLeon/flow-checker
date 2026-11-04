# Component `TodoRow`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/todo-row.tsx:5` |
| Kind | client (`'use client'`) |
| Needs the browser for | `useState` (hook), `useEffect` (hook) |
| Brings to the browser | 1 component · 1 module · 0.4 KB |
| Used on | [`/todos`](../pages/todos.md) |
| Rendered by | [`TodosPage`](TodosPage.md) |

## Props

`{ id: number }`

## Types used

- [`Todo`](../types.md#typ_25zdvnqvuxl)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET http://localhost:4010/todos/:id?delay=30`](#req_21cujfajgmg) | effect | [`TodoRow`]() | ✓ verified (8 captures) |

### <a id="req_21cujfajgmg"></a>`GET http://localhost:4010/todos/:id?delay=30`

|  |  |
| --- | --- |
| Status | ✓ verified (8 captures) |
| From | [`TodoRow`]() · `src/components/todo-row.tsx:8` |
| Trigger | effect |
| Transport | fetch |
| URL | `http://localhost:4010/todos/:id?delay=30` (pattern) |

**Response** [`Todo`](../types.md#typ_25zdvnqvuxl)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

**Captured** `GET http://localhost:4010/todos/2?delay=30` → 200 OK · 94 ms · 2026-11-04 11:21 UTC · page `/todos` (newest of 8)

Response body:

```json
{
  "id": 2,
  "userId": 2,
  "title": "Break Enigma",
  "done": false
}
```
