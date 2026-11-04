# Component `TodosPage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/todos/page.tsx:5` |
| Kind | server |
| Used on | [`/todos`](../pages/todos.md) |
| Renders | [`TodoRow`](TodoRow.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET http://localhost:4010/todos?delay=40`](#req_14km2kuqtgu) | server-render | [`TodosPage`]() | ✓ verified (2 captures) |

### <a id="req_14km2kuqtgu"></a>`GET http://localhost:4010/todos?delay=40`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodosPage`]() · `src/app/todos/page.tsx:6` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/todos?delay=40` |
| Call path | `getTodos` → `get` → `fetch` |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_25zdvnqvuxl))

**Captured** `GET http://localhost:4010/todos?delay=40` → 200 OK · 60 ms · 2026-11-04 11:21 UTC (newest of 2)

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
