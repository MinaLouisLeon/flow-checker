# Middleware `proxy.ts`

[← Overview](README.md)

|  |  |
| --- | --- |
| File | `proxy.ts:5` |
| Convention | `proxy` (Next.js 16+) |
| Export | `proxy` |
| Matcher | `/dashboard/:path*`, `/shop/:path*`, `/old-home`, `/login` (has cookie session) |

## Runs on

| Route | Kind | When |
| --- | --- | --- |
| [`/dashboard`](pages/dashboard.md) | page | every request |
| [`/dashboard/settings`](pages/dashboard.settings.md) | page | every request |
| [`/login`](pages/login.md) | page | some requests |

## Redirects

| To | From | If | Source |
| --- | --- | --- | --- |
| [`/`](pages/index.md) | `/old-home` | — | `proxy.ts:16` |
| [`/dashboard`](pages/dashboard.md) | [`/login`](pages/login.md) | — | `proxy.ts:20` |
| [`/login`](pages/login.md) | [`/dashboard`](pages/dashboard.md), [`/dashboard/settings`](pages/dashboard.settings.md) | `!token` | `proxy.ts:23` |
| [`/login`](pages/login.md) | [`/dashboard`](pages/dashboard.md), [`/dashboard/settings`](pages/dashboard.settings.md) | `token && !user` | `proxy.ts:27` |

## Rewrites

| Path | Answered by | If | Source |
| --- | --- | --- | --- |
| `/shop/*` | [`/products`](pages/products.md) | — | `proxy.ts:10` |

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/me`](#req_0pdaq2dj6vz) | middleware | middleware | ✓ verified (4 captures) |

### <a id="req_0pdaq2dj6vz"></a>`GET {API_URL ?? http://localhost:4010}/me`

|  |  |
| --- | --- |
| Status | ✓ verified (4 captures) |
| From | middleware · `proxy.ts:24` |
| Trigger | middleware |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/me` |
| Call path | `getSessionUser` → `fetch` |

**Response** [`User`](types.md#typ_0857a9l1j3p)

```ts
{ id: number; name: string; email: string; role: "admin" | "member" }
```

**Captured** `GET http://localhost:4010/me` → 200 OK · 3 ms · 2026-10-30 02:43 UTC (newest of 4)

Response body:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "admin"
}
```

Masked: `request.headers.authorization`

**Captured** `GET http://localhost:4010/me` → 401 Unauthorized · 6 ms · 2026-10-30 02:42 UTC (newest of 4)

Response body:

```json
{
  "error": "Not signed in"
}
```

Masked: `request.headers.authorization`
