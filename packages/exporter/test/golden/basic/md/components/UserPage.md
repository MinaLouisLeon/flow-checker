# Component `UserPage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/users/[id]/page.tsx:8` |
| Kind | server |
| Used on | [`/users/[id]`](../pages/users.%5Bid%5D.md) |
| Renders | [`ProfileCard`](ProfileCard.md), [`DeleteUserButton`](DeleteUserButton.md) |

## Props

`{ params: Promise<{ id: string }> }`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](#req_21o1or0unbb) | server-render | [`UserPage`]() | ✓ verified (1 capture) |

### <a id="req_21o1or0unbb"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserPage`]() · `app/users/[id]/page.tsx:10` |
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
