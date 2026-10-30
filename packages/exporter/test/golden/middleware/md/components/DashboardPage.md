# Component `DashboardPage`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/dashboard/page.tsx:6` |
| Kind | server |
| Used on | [`/dashboard`](../pages/dashboard.md) |
| Renders | `Link` (`next/link`) |

## Props

Takes no props.

## Navigation

- link `/dashboard/settings` → [`/dashboard/settings`](../pages/dashboard.settings.md) · event onClick · `app/dashboard/page.tsx:16`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/users`](#req_02gshaf9oil) | server-render | [`DashboardPage`]() | ✓ verified (2 captures) |

### <a id="req_02gshaf9oil"></a>`GET {API_URL ?? http://localhost:4010}/users`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`DashboardPage`]() · `app/dashboard/page.tsx:7` |
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
