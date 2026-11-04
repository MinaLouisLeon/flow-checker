# Page `/products`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/products/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Rendering | dynamic |
| Title | `Perf` |
| Status | ✓ 2 verified |

## Rendering

- dynamic: fetches with `cache: 'no-store'` (page), `src/lib/api.ts:8`

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page
- ⚠ no loading state: waits for a request (`fetch`) (and 1 more) with no `loading` file or `<Suspense>` to show meanwhile (page), `src/lib/api.ts:8`
- ⚠ no error boundary: fetches on the server (`fetch`) (and 1 more), and no `error` file, error boundary or `global-error` catches a failure (page), `src/lib/api.ts:8`

## Client boundaries

Nothing runs in the browser: every component renders on the server.

## Request performance

Requests that slow this page down ([all](../perf.md)).

- ⚠ **[N+1](../GLOSSARY.md#perf-n-plus-one)**, [one after another](../GLOSSARY.md#perf-sequential), [confirmed at runtime](../GLOSSARY.md#perf-confirmed) (`src/app/products/page.tsx:8`): `GET http://localhost:4010/products/:id?delay=40` is sent once per item of `products` in `for (const product of products)` in `ProductsPage`, each waiting for the one before.
  - confirmed at runtime in 2 of 2 loads: up to 2 requests per load, 113 ms together.

## Metadata

- layout `metadata`: title, template `%s | Perf`, `src/app/layout.tsx:5`

## Component tree

- [`ProductsPage`](../components/ProductsPage.md) · server · ⇄ 2 requests

## Navigation

- From [`/`](index.md) (link)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET http://localhost:4010/products?delay=80`](#req_14b37uscwxs) | server-render | [`ProductsPage`](../components/ProductsPage.md) | ✓ verified (2 captures) |
| [`GET http://localhost:4010/products/:id?delay=40`](#req_16g2mworngz) | server-render | [`ProductsPage`](../components/ProductsPage.md) | ✓ verified (4 captures) |

### <a id="req_14b37uscwxs"></a>`GET http://localhost:4010/products?delay=80`

|  |  |
| --- | --- |
| Status | ✓ verified (2 captures) |
| From | [`ProductsPage`](../components/ProductsPage.md) · `src/app/products/page.tsx:6` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/products?delay=80` |
| Call path | `getProducts` → `get` → `fetch` |

**Response** `Product[]` (see [`Product`](../types.md#typ_0v98ajm1yyv))

**Captured** `GET http://localhost:4010/products?delay=80` → 200 OK · 97 ms · 2026-11-04 11:21 UTC (newest of 2)

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

### <a id="req_16g2mworngz"></a>`GET http://localhost:4010/products/:id?delay=40`

|  |  |
| --- | --- |
| Status | ✓ verified (4 captures) |
| From | [`ProductsPage`](../components/ProductsPage.md) · `src/app/products/page.tsx:9` |
| Trigger | server-render |
| Transport | fetch |
| URL | `http://localhost:4010/products/:id?delay=40` (pattern) |
| Call path | `getProduct` → `get` → `fetch` |

**Response** [`Product`](../types.md#typ_0v98ajm1yyv)

```ts
{ id: number; name: string; price: number; stock: number }
```

**Captured** `GET http://localhost:4010/products/2?delay=40` → 200 OK · 49 ms · 2026-11-04 11:21 UTC (newest of 4)

Response body:

```json
{
  "id": 2,
  "name": "Mouse",
  "price": 19.5,
  "stock": 0
}
```
