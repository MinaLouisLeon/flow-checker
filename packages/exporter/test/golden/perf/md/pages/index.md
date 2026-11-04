# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/page.tsx` |
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
- ⚠ no loading state: waits for a request (`fetch`) (and 1 more) with no `loading` file or `<Suspense>` to show meanwhile (page), `src/lib/api.ts:8`
- ⚠ no error boundary: fetches on the server (`fetch`) (and 1 more), and no `error` file, error boundary or `global-error` catches a failure (page), `src/lib/api.ts:8`

## Client boundaries

Nothing runs in the browser: every component renders on the server.

## Request performance

Requests that slow this page down ([all](../perf.md)).

- ⚠ **[waterfall](../GLOSSARY.md#perf-waterfall)**, [confirmed at runtime](../GLOSSARY.md#perf-confirmed) (`src/app/page.tsx:6`): `getProducts()` waits for `getUser(1)` in `Home` but doesn't use its result: they could start together.
  - confirmed at runtime in 3 of 3 loads: about 103 ms to save.
  1. `await getUser(1)` (`src/app/page.tsx:5`)
  2. `await getProducts()` (`src/app/page.tsx:6`)

## Metadata

- layout `metadata`: title, template `%s | Perf`, `src/app/layout.tsx:5`

## Component tree

- [`Home`](../components/Home.md) · server · ⇄ 2 requests

## Navigation

- To [`/users/[id]`](users.%5Bid%5D.md) (link)
- To [`/products`](products.md) (link)
- To [`/catalog`](catalog.md) (link)
- To [`/todos`](todos.md) (link)
- To [`/settings`](settings.md) (link)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET http://localhost:4010/users/1?delay=80`](#req_23ca0tetmxk) | server-render | [`Home`](../components/Home.md) | ✓ verified (3 captures) |
| [`GET http://localhost:4010/products?delay=80`](#req_0kd0ltojnrd) | server-render | [`Home`](../components/Home.md) | ✓ verified (3 captures) |

### <a id="req_23ca0tetmxk"></a>`GET http://localhost:4010/users/1?delay=80`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`Home`](../components/Home.md) · `src/app/page.tsx:5` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/users/1?delay=80` |
| Call path | `getUser` → `get` → `fetch` |

**Response** [`User`](../types.md#typ_0mxt2h8i81o)

```ts
{ id: number; name: string; email: string; role: string }
```

**Captured** `GET http://localhost:4010/users/1?delay=80` → 200 OK · 93 ms · 2026-11-04 11:21 UTC (newest of 3)

Response body:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "admin"
}
```

### <a id="req_0kd0ltojnrd"></a>`GET http://localhost:4010/products?delay=80`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`Home`](../components/Home.md) · `src/app/page.tsx:6` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/products?delay=80` |
| Call path | `getProducts` → `get` → `fetch` |

**Response** `Product[]` (see [`Product`](../types.md#typ_0v98ajm1yyv))

**Captured** `GET http://localhost:4010/products?delay=80` → 200 OK · 101 ms · 2026-11-04 11:21 UTC (newest of 3)

Response body:

```json
[
  {
    "id": 1,
    "name": "Keyboard",
    "price": 49.9,
    "stock": 12
  },
  {
    "id": 2,
    "name": "Mouse",
    "price": 19.5,
    "stock": 0
  }
]
```
