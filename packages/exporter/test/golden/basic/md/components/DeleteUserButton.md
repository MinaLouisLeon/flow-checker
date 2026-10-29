# Component `DeleteUserButton`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `components/DeleteUserButton.tsx:12` |
| Kind | client (`'use client'`) |
| Used on | [`/users/[id]`](../pages/users.%5Bid%5D.md) |
| Rendered by | [`UserPage`](UserPage.md) |

## Props

[`DeleteUserButtonProps`](../types.md#typ_0ywmxvblq29)

```ts
{ userId: number }
```

## Navigation

- push `/` → [`/`](../pages/index.md) · event onClick · on success · `components/DeleteUserButton.tsx:19`

## Flows

- [DeleteUserButton click](../flows/deleteuserbutton-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](#req_0l0l4hns6qh) | event onClick | [`DeleteUserButton`]() | ✓ verified (1 capture) |

### <a id="req_0l0l4hns6qh"></a>`DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`DeleteUserButton`]() · `components/DeleteUserButton.tsx:18` |
| Trigger | event onClick |
| Transport | axios |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id` (pattern) |
| Call path | `deleteUser` → `api.delete` |

**Response** `void`

**Captured** `DELETE http://localhost:4010/users/2` → 204 No Content · 21 ms · 2026-10-28 10:56 UTC · page `/users/2`
