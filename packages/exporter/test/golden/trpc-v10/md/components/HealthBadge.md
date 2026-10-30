# Component `HealthBadge`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/HealthBadge.tsx:5` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/trpc/ping`](#req_1bu2fw37bk8) | page-load | [`HealthBadge`]() | ✓ verified (1 capture) |

### <a id="req_1bu2fw37bk8"></a>`GET /api/trpc/ping`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`HealthBadge`]() · `src/components/HealthBadge.tsx:6` |
| Trigger | page-load |
| Transport | trpc · `useQuery` |
| URL | `/api/trpc/ping` |
| tRPC | [`ping`](../trpc.md#procedure-ping) (query) |
| Handled by | [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) |

**Response** `{ ok: true; at: string; }`

```ts
{ ok: true; at: string }
```

**Captured** `GET http://localhost:3077/api/trpc/ping` → 200 · 2148 ms · 2026-10-30 07:05 UTC · page `/`

Response body:

```json
{
  "ok": true,
  "at": "2026-10-30T07:05:05.857Z"
}
```
