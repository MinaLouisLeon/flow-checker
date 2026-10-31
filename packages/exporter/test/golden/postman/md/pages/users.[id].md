# Page `/users/[id]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/users/[id]/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Status | ✓ 2 verified |

## Component tree

- [`UserPage`](../components/UserPage.md) · server · ⇄ 1 request
  - [`DeleteUserButton`](../components/DeleteUserButton.md) · client · ⇄ 1 request

## Navigation

- From [`/`](index.md) (link)
- To [`/`](index.md) (push)

## Flows

- [DeleteUserButton click](../flows/deleteuserbutton-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](#req_0zfyatg6d3b) | server-render | [`UserPage`](../components/UserPage.md) | ✓ verified (1 capture) |
| [`DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](#req_1nhvqmicx4q) | event onClick | [`DeleteUserButton`](../components/DeleteUserButton.md) | ✓ verified (1 capture) |

### <a id="req_0zfyatg6d3b"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserPage`](../components/UserPage.md) · `app/users/[id]/page.tsx:9` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id` (pattern) |
| Postman | [Get user](../postman.md#pmr_0kyh3rt9c3n) |
| Call path | `getUser` → `fetch` |

**Response** (from Postman examples) `{ id: number; name: string; email: string; role: string }`

**Captured** `GET http://localhost:4010/users/2` → 200 OK · 31 ms · 2026-10-30 04:06 UTC

Response body:

```json
{
  "id": 2,
  "name": "Alan Turing",
  "email": "alan@example.com",
  "role": "member"
}
```

### <a id="req_1nhvqmicx4q"></a>`DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`DeleteUserButton`](../components/DeleteUserButton.md) · `components/DeleteUserButton.tsx:13` |
| Trigger | event onClick |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id` (pattern) |
| Call path | `deleteUser` → `fetch` |

> ⚠ **not-in-collection**: The Postman collection "Fixture API" has no DELETE /users/:id request.

**Response** `void`

**Captured** `DELETE http://localhost:4010/users/2` → 204 No Content · 7 ms · 2026-10-30 04:06 UTC · page `/users/2`
