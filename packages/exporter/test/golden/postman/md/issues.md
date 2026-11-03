# Issues

[← Overview](README.md)

9 open items.

## Type mismatches (1)

Captured data does not fit the declared types.

- [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products`](components/ProductPanel.md#req_08kv7zxxjyg): Response doesn't match Product\[\]: \[\].price is number 49.9 (expected string) (4 of 4 captures). (`components/ProductPanel.tsx:11`)

## Boundary gaps (4)

Pages with nothing to show while they load, nothing to catch an error or a missing page, and slots or intercepting routes `next build` rejects.

- [`/`](pages/index.md): no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (`lib/api.ts:5`)
- [`/`](pages/index.md): no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (`lib/api.ts:5`)
- [`/users/[id]`](pages/users.%5Bid%5D.md): no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (`lib/api.ts:12`)
- [`/users/[id]`](pages/users.%5Bid%5D.md): no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (`lib/api.ts:12`)

## Requests the scan could not fully resolve (2)

Dynamic URLs, unknown methods or response types. Live capture fills these in.

- [`DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](components/DeleteUserButton.md#req_1nhvqmicx4q): The Postman collection "Fixture API" has no DELETE /users/:id request. (`components/DeleteUserButton.tsx:13`)
- [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/products`](components/ProductPanel.md#req_08kv7zxxjyg): The response type Product\[\] doesn't match the Postman example "200 OK": \[\].price is number 49.9 (expected string). (`components/ProductPanel.tsx:11`)

## Flows not confirmed (2)

Inferred from the code but not walked end to end in a recorded session yet.

- [DeleteUserButton click](flows/deleteuserbutton-click.md): not walked yet
- [TodoPanel submit](flows/todopanel-submit.md): not walked yet
