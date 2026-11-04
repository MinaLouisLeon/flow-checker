# Page `/about`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/(marketing)/about/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Access | open |
| Rendering | static |
| Title | `basic fixture` |

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page

## Client boundaries

Nothing runs in the browser: every component renders on the server.

## Metadata

- layout `metadata`: title, `app/layout.tsx:4`

## Component tree

- [`AboutPage`](../components/AboutPage.md) · server

## Navigation

- From [`/`](index.md) (link)

## Requests

This page sends no requests the scan found.
