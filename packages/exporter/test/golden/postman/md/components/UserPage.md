# Component `UserPage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/users/[id]/page.tsx:7` |
| Kind | server |
| Used on | [`/users/[id]`](../pages/users.%5Bid%5D.md) |
| Renders | [`DeleteUserButton`](DeleteUserButton.md) |

## Props

`{ params: Promise<{ id: string }> }`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](#req_0zfyatg6d3b) | server-render | [`UserPage`]() | ✓ verified (1 capture) |

### <a id="req_0zfyatg6d3b"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserPage`]() · `app/users/[id]/page.tsx:9` |
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
