# Issues

[← Overview](README.md)

5 open items.

## Boundary gaps (4)

Pages with nothing to show while they load, nothing to catch an error or a missing page, and slots or intercepting routes `next build` rejects.

- [`/`](pages/index.md): no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (`lib/api.ts:14`)
- [`/`](pages/index.md): no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (`lib/api.ts:14`)
- [`/users/[id]`](pages/users.%5Bid%5D.md): no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (`lib/api.ts:20`)
- [`/users/[id]`](pages/users.%5Bid%5D.md): no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (`lib/api.ts:20`)

## Flows not confirmed (1)

Inferred from the code but not walked end to end in a recorded session yet.

- [DeleteUserButton click](flows/deleteuserbutton-click.md): not walked yet
