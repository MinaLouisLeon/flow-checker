# Page `/[locale]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/[locale]/page.tsx` |
| Layouts | [`LocaleLayout`](../components/LocaleLayout.md) (`src/app/[locale]/layout.tsx`) |
| Access | guarded |
| Rendering | static |
| Title | none |

## Access

- shows the not-found page (404) when `!hasLocale(routing.locales, locale)` (layout), `src/app/[locale]/layout.tsx:19`

## Rendering

- info: `generateStaticParams` lists the params to prerender (layout), `src/app/[locale]/layout.tsx:7`

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page
- ⚠ no not-found page: calls `notFound()` with no `not-found` file above it, so Next shows its default page (layout), `src/app/[locale]/layout.tsx:19`

## Client boundaries

Nothing runs in the browser: every component renders on the server.

## Component tree

- [`HomePage`](../components/HomePage.md) · server
  - `Link` · external (`next-intl/navigation`)

## Navigation

- To [`/[locale]/login`](%5Blocale%5D.login.md) (link)

## Middleware

[`src/proxy.ts`](../middleware.md) runs before every request to this route.

## Requests

This page sends no requests the scan found.
