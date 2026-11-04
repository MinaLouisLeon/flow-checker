# Page `/products`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `app/products/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`app/layout.tsx`) |
| Access | open |
| Rendering | dynamic |
| Title | `middleware fixture` |
| Status | ✓ 1 verified |

## Rendering

- dynamic: `export const dynamic = 'force-dynamic'` (page), `app/products/page.tsx:3`
- dynamic: fetches with `cache: 'no-store'` (page), `lib/api.ts:15`

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page
- ⚠ no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (page), `lib/api.ts:15`
- ⚠ no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (page), `lib/api.ts:15`

## Client boundaries

Nothing runs in the browser: every component renders on the server.

## Environment variables

Names only ([all](../env.md)).

- `API_URL` (server): not defined, `lib/config.ts:1`

## Metadata

- layout `metadata`: title, `app/layout.tsx:4`

## Component tree

- [`ProductsPage`](../components/ProductsPage.md) · server · ⇄ 1 request

## Navigation

- From [`/`](index.md) (link)

## Middleware

[`proxy.ts`](../middleware.md) rewrites other paths to this route.

- Answers `/shop/*` (rewrite)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/products`](#req_263u38ocrza) | server-render | [`ProductsPage`](../components/ProductsPage.md) | ✓ verified (1 capture) |

### <a id="req_263u38ocrza"></a>`GET {API_URL ?? http://localhost:4010}/products`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`ProductsPage`](../components/ProductsPage.md) · `app/products/page.tsx:6` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/products` |
| Call path | `getProducts` → `fetch` |

**Response** `Product[]` (see [`Product`](../types.md#typ_2dct2hpocpn))

**Captured** `GET http://localhost:4010/products` → 200 OK · 36 ms · 2026-10-30 02:42 UTC

Response body:

```json
[
  {
    "id": 1,
    "name": "Keyboard",
    "price": 49.9,
    "stock": 12
  },
  {
    "id": 2,
    "name": "Mouse",
    "price": 19.5,
    "stock": 0
  }
]
```
