# Page `/login`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/login/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Access | guarded |

## Access

- redirects to `/dashboard` when `cookie session is set` (middleware), `proxy.ts:20`

## Component tree

- [`LoginPage`](../components/LoginPage.md) · server

## Navigation

- From [`/`](index.md) (link)
- To [`/dashboard`](dashboard.md) (redirect)
- From [`/dashboard`](dashboard.md) (redirect)
- From [`/dashboard/settings`](dashboard.settings.md) (redirect)

## Middleware

[`proxy.ts`](../middleware.md) runs here only for some requests (see the matcher).

- Redirects to [`/dashboard`](dashboard.md)

## Requests

This page sends no requests the scan found.
