# Page `/users/[id]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/users/[id]/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | guarded |
| Rendering | dynamic |
| Title | `Perf` |
| Status | ✓ 4 verified |

## Access

- shows the not-found page (404) when `!user` (page), `src/app/users/[id]/page.tsx:8`

## Rendering

- dynamic: has the dynamic segment `[id]` and no `generateStaticParams` (page)
- dynamic: fetches with `cache: 'no-store'` (page), `src/lib/api.ts:8`

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page
- ⚠ no loading state: waits for a request (`fetch`) (and 3 more) with no `loading` file or `<Suspense>` to show meanwhile (page), `src/lib/api.ts:8`
- ⚠ no error boundary: fetches on the server (`fetch`) (and 3 more), and no `error` file, error boundary or `global-error` catches a failure (page), `src/lib/api.ts:8`
- ⚠ no not-found page: calls `notFound()` with no `not-found` file above it, so Next shows its default page (page), `src/app/users/[id]/page.tsx:8`

## Client boundaries

Nothing runs in the browser: every component renders on the server.

## Metadata

- layout `metadata`: title, template `%s | Perf`, `src/app/layout.tsx:5`

## Component tree

- [`UserPage`](../components/UserPage.md) · server · ⇄ 4 requests

## Navigation

- From [`/`](index.md) (link)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET http://localhost:4010/users/:id?delay=80`](#req_1n4wecz1zex) | server-render | [`UserPage`](../components/UserPage.md) | ✓ verified (2 captures) |
| [`GET http://localhost:4010/todos?userId=:userId&delay=40`](#req_00405rt0lsa) | server-render | [`UserPage`](../components/UserPage.md) | ✓ verified (2 captures) |
| [`GET http://localhost:4010/products?delay=80`](#req_21fpvnjjwok) | server-render | [`UserPage`](../components/UserPage.md) | ✓ verified (2 captures) |
| [`GET http://localhost:4010/users/:id?delay=80`](#req_228s24jz87h) | server-render | [`UserPage`](../components/UserPage.md) | ✓ verified (2 captures) |

### <a id="req_1n4wecz1zex"></a>`GET http://localhost:4010/users/:id?delay=80`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`UserPage`](../components/UserPage.md) · `src/app/users/[id]/page.tsx:7` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/users/:id?delay=80` (pattern) |
| Call path | `getUser` → `get` → `fetch` |

**Response** [`User`](../types.md#typ_0mxt2h8i81o)

```ts
{ id: number; name: string; email: string; role: string }
```

**Captured** `GET http://localhost:4010/users/1?delay=80` → 200 OK · 103 ms · 2026-11-04 11:21 UTC (newest of 2)

Response body:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "admin"
}
```

### <a id="req_00405rt0lsa"></a>`GET http://localhost:4010/todos?userId=:userId&delay=40`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`UserPage`](../components/UserPage.md) · `src/app/users/[id]/page.tsx:9` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/todos?userId=:userId&delay=40` (pattern) |
| Call path | `getUserTodos` → `get` → `fetch` |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_25zdvnqvuxl))

**Captured** `GET http://localhost:4010/todos?userId=1&delay=40` → 200 OK · 50 ms · 2026-11-04 11:21 UTC (newest of 2)

Response body:

```json
[
  {
    "id": 1,
    "userId": 1,
    "title": "Write the first program",
    "done": true
  }
]
```

### <a id="req_21fpvnjjwok"></a>`GET http://localhost:4010/products?delay=80`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`UserPage`](../components/UserPage.md) · `src/app/users/[id]/page.tsx:9` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/products?delay=80` |
| Call path | `getProducts` → `get` → `fetch` |

**Response** `Product[]` (see [`Product`](../types.md#typ_0v98ajm1yyv))

**Captured** `GET http://localhost:4010/products?delay=80` → 200 OK · 93 ms · 2026-11-04 11:21 UTC (newest of 2)

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

### <a id="req_228s24jz87h"></a>`GET http://localhost:4010/users/:id?delay=80`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`UserPage`](../components/UserPage.md) · `src/app/users/[id]/page.tsx:10` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/users/:id?delay=80` (pattern) |
| Call path | `getUser` → `get` → `fetch` |

**Response** [`User`](../types.md#typ_0mxt2h8i81o)

```ts
{ id: number; name: string; email: string; role: string }
```

**Captured** `GET http://localhost:4010/users/2?delay=80` → 200 OK · 99 ms · 2026-11-04 11:21 UTC (newest of 2)

Response body:

```json
{
  "id": 2,
  "name": "Alan Turing",
  "email": "alan@example.com",
  "role": "member"
}
```
