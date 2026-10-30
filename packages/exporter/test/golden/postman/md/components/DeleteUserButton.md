# Component `DeleteUserButton`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `components/DeleteUserButton.tsx:7` |
| Kind | client (`'use client'`) |
| Used on | [`/users/[id]`](../pages/users.%5Bid%5D.md) |
| Rendered by | [`UserPage`](UserPage.md) |

## Props

`{ id: number }`

## Navigation

- push `/` → [`/`](../pages/index.md) · event onClick · `components/DeleteUserButton.tsx:14`

## Flows

- [DeleteUserButton click](../flows/deleteuserbutton-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](#req_1nhvqmicx4q) | event onClick | [`DeleteUserButton`]() | ✓ verified (1 capture) |

### <a id="req_1nhvqmicx4q"></a>`DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`DeleteUserButton`]() · `components/DeleteUserButton.tsx:13` |
| Trigger | event onClick |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id` (pattern) |
| Call path | `deleteUser` → `fetch` |

> ⚠ **not-in-collection**: The Postman collection "Fixture API" has no DELETE /users/:id request.

**Response** `void`

**Captured** `DELETE http://localhost:4010/users/2` → 204 No Content · 7 ms · 2026-10-30 04:06 UTC · page `/users/2`
