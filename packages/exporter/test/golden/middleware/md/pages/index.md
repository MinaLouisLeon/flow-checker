# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Access | open |
| Rendering | static |
| Title | `middleware fixture` |

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page

## Client boundaries

Nothing runs in the browser: every component renders on the server.

## Metadata

- layout `metadata`: title, `app/layout.tsx:4`

## Component tree

- [`HomePage`](../components/HomePage.md) · server
  - `Link` · external (`next/link`)

## Navigation

- To [`/dashboard`](dashboard.md) (link)
- To [`/products`](products.md) (link)
- To [`/login`](login.md) (link)

## Requests

This page sends no requests the scan found.
