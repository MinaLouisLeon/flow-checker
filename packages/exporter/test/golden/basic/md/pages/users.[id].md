# Page `/users/[id]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/users/[id]/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Access | open |
| Rendering | dynamic |
| Title | `basic fixture` |
| Status | ✓ 3 verified |

## Rendering

- dynamic: has the dynamic segment `[id]` and no `generateStaticParams` (page)
- dynamic: `export const dynamic = 'force-dynamic'` (page), `app/users/[id]/page.tsx:5`
- dynamic: fetches with `cache: 'no-store'` (page), `lib/api.ts:20`

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page
- ⚠ no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (page), `lib/api.ts:20`
- ⚠ no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (page), `lib/api.ts:20`

## Client boundaries

2 `'use client'` boundaries bring 2 components and 4 project modules (about 2.5 KB of source) to the browser, plus 1 package (`axios`).

- [`ProfileCard`](../components/ProfileCard.md), rendered by `UserPage` (page): 1 component · 3 modules · 1.7 KB, `app/users/[id]/page.tsx:13`
  - packages: `axios`
- [`DeleteUserButton`](../components/DeleteUserButton.md), rendered by `UserPage` (page): 1 component · 3 modules · 1.7 KB, `app/users/[id]/page.tsx:14`
  - packages: `axios`

## Environment variables

Names only ([all](../env.md)).

- `NEXT_PUBLIC_API_URL` (server and client): not defined, `lib/config.ts:1`

## Metadata

- layout `metadata`: title, `app/layout.tsx:4`

## Component tree

- [`UserPage`](../components/UserPage.md) · server · ⇄ 1 request
  - [`ProfileCard`](../components/ProfileCard.md) · client · ⇄ 1 request
  - [`DeleteUserButton`](../components/DeleteUserButton.md) · client · ⇄ 1 request

## Navigation

- To [`/`](index.md) (push)
- From [`/`](index.md) (link)

## Flows

- [DeleteUserButton click](../flows/deleteuserbutton-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](#req_21o1or0unbb) | server-render | [`UserPage`](../components/UserPage.md) | ✓ verified (1 capture) |
| [`DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](#req_0l0l4hns6qh) | event onClick | [`DeleteUserButton`](../components/DeleteUserButton.md) | ✓ verified (1 capture) |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos?userId=:userId`](#req_0h7xmjn6pcm) | effect | [`ProfileCard`](../components/ProfileCard.md) | ✓ verified (2 captures) |

### <a id="req_21o1or0unbb"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserPage`](../components/UserPage.md) · `app/users/[id]/page.tsx:10` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id` (pattern) |
| Call path | `getUser` → `fetch` |

**Response** [`User`](../types.md#typ_0857a9l1j3p)

```ts
{ id: number; name: string; email: string; role: Role }
```

**Captured** `GET http://localhost:4010/users/2` → 200 OK · 45 ms · 2026-10-28 10:56 UTC

Response body:

```json
{
  "id": 2,
  "name": "Alan Turing",
  "email": "alan@example.com",
  "role": "member"
}
```

### <a id="req_0l0l4hns6qh"></a>`DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`DeleteUserButton`](../components/DeleteUserButton.md) · `components/DeleteUserButton.tsx:18` |
| Trigger | event onClick |
| Transport | axios |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id` (pattern) |
| Call path | `deleteUser` → `api.delete` |

**Response** `void`

**Captured** `DELETE http://localhost:4010/users/2` → 204 No Content · 21 ms · 2026-10-28 10:56 UTC · page `/users/2`

### <a id="req_0h7xmjn6pcm"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos?userId=:userId`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`ProfileCard`](../components/ProfileCard.md) · `components/ProfileCard.tsx:16` |
| Trigger | effect |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos?userId=:userId` (pattern) |
| Call path | `getTodos` → `fetch` |

**Response** `Todo[]` (see [`Todo`](../types.md#typ_1tfsxfuhjes))

**Captured** `GET http://localhost:4010/todos?userId=2` → 200 OK · 9 ms · 2026-10-28 10:56 UTC · page `/users/2` (newest of 2)

Response body:

```json
[
  {
    "id": 2,
    "userId": 2,
    "title": "Break Enigma",
    "done": false
  }
]
```
