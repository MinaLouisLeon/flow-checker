# Page `/`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | guarded |
| Rendering | static |
| Title | `server-actions fixture` |

## Access

- redirects to `/products` always (page), `src/app/page.tsx:4`

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page

## Client boundaries

Nothing runs in the browser: every component renders on the server.

## Metadata

- layout `metadata`: title, `src/app/layout.tsx:3`

## Component tree

- [`Home`](../components/Home.md) · server

## Navigation

- To [`/products`](products.md) (redirect)

## Requests

This page sends no requests the scan found.
