# Page `/[locale]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/[locale]/page.tsx` |
| Layouts | [`LocaleLayout`](../components/LocaleLayout.md) (`src/app/[locale]/layout.tsx`) |
| Access | guarded |

## Access

- shows the not-found page (404) when `!hasLocale(routing.locales, locale)` (layout), `src/app/[locale]/layout.tsx:19`

## Component tree

- [`HomePage`](../components/HomePage.md) · server
  - `Link` · external (`next-intl/navigation`)

## Navigation

- To [`/[locale]/login`](%5Blocale%5D.login.md) (link)

## Middleware

[`src/proxy.ts`](../middleware.md) runs before every request to this route.

## Requests

This page sends no requests the scan found.
