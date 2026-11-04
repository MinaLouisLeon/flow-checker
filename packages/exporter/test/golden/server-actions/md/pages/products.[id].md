# Page `/products/[id]`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/products/[id]/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | guarded |
| Rendering | dynamic |
| Title | `server-actions fixture` |
| Status | ✓ 1 verified |

## Access

- shows the not-found page (404) when `!product` (page), `src/app/products/[id]/page.tsx:10`

## Rendering

- dynamic: has the dynamic segment `[id]` and no `generateStaticParams` (page)
- dynamic: `export const dynamic = 'force-dynamic'` (page), `src/app/products/[id]/page.tsx:5`
- dynamic: fetches with `cache: 'no-store'` (page), `src/lib/backend.ts:12`

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page
- ⚠ no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (page), `src/lib/backend.ts:12`
- ⚠ no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (page), `src/lib/backend.ts:12`
- ⚠ no not-found page: calls `notFound()` with no `not-found` file above it, so Next shows its default page (page), `src/app/products/[id]/page.tsx:10`

## Client boundaries

Nothing runs in the browser: every component renders on the server.

## Environment variables

Names only ([all](../env.md)).

- `API_URL` (server): not defined, `src/lib/backend.ts:4`

## Metadata

- layout `metadata`: title, `src/app/layout.tsx:3`

## Component tree

- [`ProductPage`](../components/ProductPage.md) · server · ⇄ 1 request
  - `Link` · external (`next/link`)

## Navigation

- From [`/products/new`](products.new.md) (redirect)
- To [`/products`](products.md) (link)
- From [`/products`](products.md) (link)

## Flows

- [CreateProductForm submit](../flows/createproductform-submit.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET {API_URL ?? http://localhost:4010}/products/:id`](#req_25a1hdpohd6) | server-render | [`ProductPage`](../components/ProductPage.md) | ✓ verified (1 capture) |

### <a id="req_25a1hdpohd6"></a>`GET {API_URL ?? http://localhost:4010}/products/:id`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`ProductPage`](../components/ProductPage.md) · `src/app/products/[id]/page.tsx:9` |
| Trigger | server-render |
| Transport | fetch |
| URL | `{API_URL ?? http://localhost:4010}/products/:id` (pattern) |
| Call path | `getProduct` → `fetch` |

**Response** `Product | null` (see [`Product`](../types.md#typ_0c608pp860k))

**Captured** `GET http://localhost:4010/products/3` → 200 OK · 18 ms · 2026-10-28 10:56 UTC

Response body:

```json
{
  "id": 3,
  "stock": 0,
  "name": "Cable",
  "price": 9.5
}
```
