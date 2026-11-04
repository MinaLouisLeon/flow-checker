# Issues

[← Overview](README.md)

8 open items.

## Server actions open to anyone (1)

Server actions that change data with no auth check and no input check. A server action is a public `POST` endpoint: anyone can call it with any arguments.

- [`/products`](pages/products.md): Server action `deleteProduct` changes data (`fetch DELETE` through `removeProduct`) with no auth check and uses its input as sent: a server action is a public `POST` endpoint, so anyone can call it with any arguments (`src/actions/products.ts:30`)

## Boundary gaps (5)

Pages with nothing to show while they load, nothing to catch an error or a missing page, and slots or intercepting routes `next build` rejects.

- [`/products`](pages/products.md): no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (`src/lib/backend.ts:7`)
- [`/products`](pages/products.md): no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (`src/lib/backend.ts:7`)
- [`/products/[id]`](pages/products.%5Bid%5D.md): no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (`src/lib/backend.ts:12`)
- [`/products/[id]`](pages/products.%5Bid%5D.md): no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (`src/lib/backend.ts:12`)
- [`/products/[id]`](pages/products.%5Bid%5D.md): no not-found page: calls `notFound()` with no `not-found` file above it, so Next shows its default page (`src/app/products/[id]/page.tsx:10`)

## Flows not confirmed (2)

Inferred from the code but not walked end to end in a recorded session yet.

- [CreateProductForm submit](flows/createproductform-submit.md): not walked yet
- [DeleteProductButton click](flows/deleteproductbutton-click.md): not walked yet
