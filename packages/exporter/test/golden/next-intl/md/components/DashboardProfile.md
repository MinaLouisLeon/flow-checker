# Component `DashboardProfile`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/DashboardProfile.tsx:10` |
| Kind | client (`'use client'`) |
| Used on | [`/[locale]/dashboard`](../pages/%5Blocale%5D.dashboard.md) |
| Rendered by | [`DashboardPage`](DashboardPage.md) |
| Renders | `Link` (`@/i18n/navigation`) |

## Props

Takes no props.

## Types used

- [`User`](../types.md#typ_1tpxqokvkch)

## Navigation

- push `/login` → [`/[locale]/login`](../pages/%5Blocale%5D.login.md) · event onClick · next-intl · `src/components/DashboardProfile.tsx:21`
- link `/login` → [`/[locale]/login`](../pages/%5Blocale%5D.login.md) · event onClick · next-intl, conditional · `src/components/DashboardProfile.tsx:25`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/me`](#req_1ostg0bhzmk) | effect | [`DashboardProfile`]() | ✓ verified (2 captures) |

### <a id="req_1ostg0bhzmk"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/me`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`DashboardProfile`]() · `src/components/DashboardProfile.tsx:16` |
| Trigger | effect |
| Transport | fetch |
| URL | `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/me` |
| Call path | `getMe` → `fetch` |

**Response** `User | null` (see [`User`](../types.md#typ_1tpxqokvkch))

**Captured** `GET http://localhost:4010/me` → 200 OK · 55 ms · 2026-10-28 10:58 UTC · page `/en/dashboard` (newest of 2)

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
