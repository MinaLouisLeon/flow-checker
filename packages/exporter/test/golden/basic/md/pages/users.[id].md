# Page `/users/[id]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/users/[id]/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Status | ✓ 3 verified |

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
