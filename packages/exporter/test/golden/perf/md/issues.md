# Issues

[← Overview](README.md)

14 open items.

## Request performance (5)

Requests that wait for each other for no reason, run once per item of a list, or are sent twice on one page load.

- [`CatalogPage`](components/CatalogPage.md): `GET http://localhost:4010/products/:id?delay=40` is sent once per item of `products` in `products.map()` in `CatalogPage`; confirmed at runtime in 2 of 2 loads: up to 2 requests per load, 59 ms together (`src/app/catalog/page.tsx:6`)
- [`Home`](components/Home.md): `getProducts()` waits for `getUser(1)` in `Home` but doesn't use its result: they could start together; confirmed at runtime in 3 of 3 loads: about 103 ms to save (`src/app/page.tsx:6`)
- [`ProductsPage`](components/ProductsPage.md): `GET http://localhost:4010/products/:id?delay=40` is sent once per item of `products` in `for (const product of products)` in `ProductsPage`, each waiting for the one before; confirmed at runtime in 2 of 2 loads: up to 2 requests per load, 113 ms together (`src/app/products/page.tsx:8`)
- [`SettingsLayout`](components/SettingsLayout.md): `GET http://localhost:4010/settings?delay=40` is sent from 2 places on one page load and nothing dedupes it; confirmed at runtime in 2 of 2 loads: up to 2 requests per load, 54 ms together (`src/app/settings/page.tsx:5`)
- [`TodosPage`](components/TodosPage.md): `<TodoRow>` is rendered once per item of `todos` in `TodosPage`, and each sends `GET http://localhost:4010/todos/:id?delay=30`; confirmed at runtime in 2 of 2 loads: up to 2 requests per load, 93 ms together (`src/app/todos/page.tsx:10`)

## Boundary gaps (3)

Pages with nothing to show while they load, nothing to catch an error or a missing page, and slots or intercepting routes `next build` rejects.

- [`/`](pages/index.md): no loading state: waits for a request (`fetch`) (and 1 more) with no `loading` file or `<Suspense>` to show meanwhile (on 6 pages) (`src/lib/api.ts:8`)
- [`/`](pages/index.md): no error boundary: fetches on the server (`fetch`) (and 1 more), and no `error` file, error boundary or `global-error` catches a failure (on 6 pages) (`src/lib/api.ts:8`)
- [`/users/[id]`](pages/users.%5Bid%5D.md): no not-found page: calls `notFound()` with no `not-found` file above it, so Next shows its default page (`src/app/users/[id]/page.tsx:8`)

## Captures without a request site (6)

No scanned request site fits these (unmatched), or several fit equally well (ambiguous). Unmatched requests usually point at code the scanner missed. Assign them in the dashboard's Live screen.

| Time | Request | Status | Page | Match |
| --- | --- | --- | --- | --- |
| 2026-11-04 11:21 UTC | `GET http://localhost:4010/settings?delay=40` | 200 | server | ambiguous |
| 2026-11-04 11:21 UTC | `GET http://localhost:4010/settings?delay=40` | 200 | server | ambiguous |
| 2026-11-04 11:21 UTC | `GET http://localhost:4010/users/1?delay=20` | 200 | server | ambiguous |
| 2026-11-04 11:21 UTC | `GET http://localhost:4010/settings?delay=40` | 200 | server | ambiguous |
| 2026-11-04 11:21 UTC | `GET http://localhost:4010/settings?delay=40` | 200 | server | ambiguous |
| 2026-11-04 11:21 UTC | `GET http://localhost:4010/users/1?delay=20` | 200 | server | ambiguous |
