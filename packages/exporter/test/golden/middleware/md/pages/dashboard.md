# Page `/dashboard`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/dashboard/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Access | guarded |
| Status | ✓ 1 verified |

## Access

- redirects to `/login` when `!token` (middleware), `proxy.ts:23`
- redirects to `/login?expired=1` when `token && !user` (middleware), `proxy.ts:27`

## Component tree

- [`DashboardPage`](../components/DashboardPage.md) · server · ⇄ 1 request
  - `Link` · external (`next/link`)

## Navigation

- To [`/dashboard/settings`](dashboard.settings.md) (link)
- From [`/`](index.md) (link)
- From [`/login`](login.md) (redirect)
- To [`/login`](login.md) (redirect)

## Middleware

[`proxy.ts`](../middleware.md) runs before every request to this route.

- Redirects to [`/login`](login.md) if `!token`
- Redirects to [`/login`](login.md) if `token && !user`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/users`](#req_02gshaf9oil) | server-render | [`DashboardPage`](../components/DashboardPage.md) | ✓ verified (2 captures) |

### <a id="req_02gshaf9oil"></a>`GET {API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`DashboardPage`](../components/DashboardPage.md) · `app/dashboard/page.tsx:7` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/users` |
| Call path | `getUsers` → `fetch` |

**Response** `User[]` (see [`User`](../types.md#typ_0857a9l1j3p))

**Captured** `GET http://localhost:4010/users` → 200 OK · 23 ms · 2026-10-30 02:43 UTC (newest of 2)

Response body:

```json
[
  {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "admin"
  },
  {
    "id": 2,
    "name": "Alan Turing",
    "email": "alan@example.com",
    "role": "member"
  }
]
```
