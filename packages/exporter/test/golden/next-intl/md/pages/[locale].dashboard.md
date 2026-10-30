# Page `/[locale]/dashboard`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/[locale]/dashboard/page.tsx` |
| Layouts | [`LocaleLayout`](../components/LocaleLayout.md) (`src/app/[locale]/layout.tsx`) |
| Status | ✓ 1 verified |

## Component tree

- [`DashboardPage`](../components/DashboardPage.md) · server
  - [`DashboardProfile`](../components/DashboardProfile.md) · client · ⇄ 1 request
    - `Link` · external (`next-intl/navigation`) · conditional

## Navigation

- To [`/[locale]/login`](%5Blocale%5D.login.md) (push, link)
- From [`/[locale]/verify`](%5Blocale%5D.verify.md) (replace)

## Flows

- [LoginForm submit](../flows/loginform-submit.md)

## Middleware

[`src/proxy.ts`](../middleware.md) runs before every request to this route.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/me`](#req_1ostg0bhzmk) | effect | [`DashboardProfile`](../components/DashboardProfile.md) | ✓ verified (2 captures) |

### <a id="req_1ostg0bhzmk"></a>`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/me`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`DashboardProfile`](../components/DashboardProfile.md) · `src/components/DashboardProfile.tsx:16` |
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
