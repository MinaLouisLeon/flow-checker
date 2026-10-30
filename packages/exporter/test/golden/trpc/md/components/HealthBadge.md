# Component `HealthBadge`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/HealthBadge.tsx:6` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/trpc/health.ping`](#req_0xg00gfgxqn) | page-load | [`HealthBadge`]() | ✓ verified (1 capture) |

### <a id="req_0xg00gfgxqn"></a>`GET /api/trpc/health.ping`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`HealthBadge`]() · `src/components/HealthBadge.tsx:8` |
| Trigger | page-load |
| Transport | trpc · `useQuery` |
| URL | `/api/trpc/health.ping` |
| tRPC | [`health.ping`](../trpc.md#procedure-health_ping) (query) |
| Handled by | [`/api/trpc/[trpc]`](../pages/api.trpc.%5Btrpc%5D.md) |

**Response** `{ ok: boolean; }`

```ts
{ ok: boolean }
```

**Captured** `GET http://localhost:3077/api/trpc/health.ping` → 200 · 1624 ms · 2026-10-30 07:08 UTC · page `/`

Response body:

```json
{
  "ok": true
}
```
