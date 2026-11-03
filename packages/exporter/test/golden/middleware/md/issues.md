# Issues

[← Overview](README.md)

6 open items.

## Boundary gaps (6)

Pages with nothing to show while they load, nothing to catch an error or a missing page, and slots or intercepting routes `next build` rejects.

- [`/dashboard`](pages/dashboard.md): no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (`lib/api.ts:5`)
- [`/dashboard`](pages/dashboard.md): no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (`lib/api.ts:5`)
- [`/dashboard/settings`](pages/dashboard.settings.md): no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (`lib/api.ts:10`)
- [`/dashboard/settings`](pages/dashboard.settings.md): no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (`lib/api.ts:10`)
- [`/products`](pages/products.md): no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (`lib/api.ts:15`)
- [`/products`](pages/products.md): no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (`lib/api.ts:15`)
