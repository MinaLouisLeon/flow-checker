# Page `/todos`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/todos/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Rendering | dynamic |
| Title | `Perf` |
| Status | ✓ 2 verified |

## Rendering

- dynamic: fetches with `cache: 'no-store'` (page), `src/lib/api.ts:8`

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page
- ⚠ no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (page), `src/lib/api.ts:8`
- ⚠ no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (page), `src/lib/api.ts:8`

## Client boundaries

1 `'use client'` boundary brings 1 component and 1 project module (about 0.4 KB of source) to the browser.

- [`TodoRow`](../components/TodoRow.md), rendered by `TodosPage` (page): 1 component · 1 module · 0.4 KB, `src/app/todos/page.tsx:10`

## Request performance

Requests that slow this page down ([all](../perf.md)).

- ⚠ **[N+1](../GLOSSARY.md#perf-n-plus-one)**, [confirmed at runtime](../GLOSSARY.md#perf-confirmed) (`src/app/todos/page.tsx:10`): `<TodoRow>` is rendered once per item of `todos` in `TodosPage`, and each sends `GET http://localhost:4010/todos/:id?delay=30`.
  - confirmed at runtime in 2 of 2 loads: up to 2 requests per load, 93 ms together.

## Metadata

- layout `metadata`: title, template `%s | Perf`, `src/app/layout.tsx:5`

## Component tree

- [`TodosPage`](../components/TodosPage.md) · server · ⇄ 1 request
  - [`TodoRow`](../components/TodoRow.md) · client · ⇄ 1 request

## Navigation

- From [`/`](index.md) (link)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET http://localhost:4010/todos?delay=40`](#req_14km2kuqtgu) | server-render | [`TodosPage`](../components/TodosPage.md) | ✓ verified (2 captures) |
| [`GET http://localhost:4010/todos/:id?delay=30`](#req_21cujfajgmg) | effect | [`TodoRow`](../components/TodoRow.md) | ✓ verified (8 captures) |

### <a id="req_14km2kuqtgu"></a>`GET http://localhost:4010/todos?delay=40`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`TodosPage`](../components/TodosPage.md) · `src/app/todos/page.tsx:6` |
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

### <a id="req_21cujfajgmg"></a>`GET http://localhost:4010/todos/:id?delay=30`

|  |  |
| --- | --- |
| Status | ✓ verified (8 captures) |
| From | [`TodoRow`](../components/TodoRow.md) · `src/components/todo-row.tsx:8` |
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
