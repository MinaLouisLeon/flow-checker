# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Access | open |
| Rendering | dynamic |
| Title | `basic fixture` |
| Status | ✓ 1 verified |

## Rendering

- dynamic: `export const dynamic = 'force-dynamic'` (page), `app/page.tsx:4`
- dynamic: fetches with `cache: 'no-store'` (page), `lib/api.ts:14`

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page
- ⚠ no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (page), `lib/api.ts:14`
- ⚠ no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (page), `lib/api.ts:14`

## Metadata

- layout `metadata`: title, `app/layout.tsx:4`

## Component tree

- [`HomePage`](../components/HomePage.md) · server · ⇄ 1 request
  - [`UserList`](../components/UserList.md) · server
    - `Link` · external (`next/link`)

## Navigation

- To [`/about`](about.md) (link)
- From [`/users/[id]`](users.%5Bid%5D.md) (push)
- To [`/users/[id]`](users.%5Bid%5D.md) (link)

## Flows

- [DeleteUserButton click](../flows/deleteuserbutton-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](#req_23wds4ry0if) | server-render | [`HomePage`](../components/HomePage.md) | ✓ verified (3 captures) |

### <a id="req_23wds4ry0if"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`HomePage`](../components/HomePage.md) · `app/page.tsx:8` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users` |
| Call path | `getUsers` → `fetch` |

**Response** `User[]` (see [`User`](../types.md#typ_0857a9l1j3p))

**Captured** `GET http://localhost:4010/users` → 200 OK · 16 ms · 2026-10-28 10:56 UTC (newest of 3)

Response body:

```json
[
  {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "admin"
  }
]
```
