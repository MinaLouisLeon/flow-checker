# Page `/dashboard/settings`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/dashboard/settings/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Access | guarded |
| Rendering | dynamic |
| Title | `middleware fixture` |
| Status | ✓ 1 verified |

## Access

- redirects to `/login` when `!token` (middleware), `proxy.ts:23`
- redirects to `/login?expired=1` when `token && !user` (middleware), `proxy.ts:27`

## Rendering

- dynamic: `export const dynamic = 'force-dynamic'` (page), `app/dashboard/settings/page.tsx:3`
- dynamic: fetches with `cache: 'no-store'` (page), `lib/api.ts:10`

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page
- ⚠ no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (page), `lib/api.ts:10`
- ⚠ no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (page), `lib/api.ts:10`

## Client boundaries

Nothing runs in the browser: every component renders on the server.

## Metadata

- layout `metadata`: title, `app/layout.tsx:4`

## Component tree

- [`SettingsPage`](../components/SettingsPage.md) · server · ⇄ 1 request

## Navigation

- From [`/dashboard`](dashboard.md) (link)
- To [`/login`](login.md) (redirect)

## Middleware

[`proxy.ts`](../middleware.md) runs before every request to this route.

- Redirects to [`/login`](login.md) if `!token`
- Redirects to [`/login`](login.md) if `token && !user`

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/settings`](#req_0q6t9lmdld7) | server-render | [`SettingsPage`](../components/SettingsPage.md) | ✓ verified (1 capture) |

### <a id="req_0q6t9lmdld7"></a>`GET {API_URL ?? http://localhost:4010}/settings`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`SettingsPage`](../components/SettingsPage.md) · `app/dashboard/settings/page.tsx:6` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/settings` |
| Call path | `getSettings` → `fetch` |

**Response** [`Settings`](../types.md#typ_21gfaviyj48)

```ts
{ theme: string; locale: string; digest: string | null }
```

**Captured** `GET http://localhost:4010/settings` → 200 OK · 14 ms · 2026-10-30 02:42 UTC

Response body:

```json
{
  "theme": "dark",
  "locale": "en",
  "digest": null
}
```
