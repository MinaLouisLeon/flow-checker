# Component `ProfileCard`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `components/ProfileCard.tsx:12` |
| Kind | client (`'use client'`) |
| Used on | [`/users/[id]`](../pages/users.%5Bid%5D.md) |
| Rendered by | [`UserPage`](UserPage.md) |

## Props

[`ProfileCardProps`](../types.md#typ_12vhl9gsqi3)

```ts
{ user: User }
```

## Types used

- [`Todo`](../types.md#typ_1tfsxfuhjes)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos?userId=:userId`](#req_0h7xmjn6pcm) | effect | [`ProfileCard`]() | ✓ verified (2 captures) |

### <a id="req_0h7xmjn6pcm"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos?userId=:userId`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`ProfileCard`]() · `components/ProfileCard.tsx:16` |
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
