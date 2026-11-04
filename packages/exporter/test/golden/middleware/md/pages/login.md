# Page `/login`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/login/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Access | guarded |
| Rendering | static |
| Title | `middleware fixture` |

## Access

- redirects to `/dashboard` when `cookie session is set` (middleware), `proxy.ts:20`

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page

## Client boundaries

Nothing runs in the browser: every component renders on the server.

## Metadata

- layout `metadata`: title, `app/layout.tsx:4`

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
