# Issues

[← Overview](README.md)

6 open items.

## Type mismatches (3)

Captured data does not fit the declared types.

- [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](components/HomePage.md#req_13cmzl2vi57): Response doesn't match Account\[\]: \[\].id is number 1 (expected string); \[\].avatarUrl is missing (expected string); \[\].role is not in the type (2 of 2 captures). (`app/page.tsx:9`)
- [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings`](components/SettingsPanel.md#req_23elzbn49tu): Response doesn't match Settings: digest is null (expected { frequency: "daily" \| "weekly" }) (2 of 2 captures). (`components/SettingsPanel.tsx:12`)
- [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/TodoPanel.md#req_1m9d40sdmxx): Response doesn't match Todo: userId is string "1" (expected number). Request body doesn't match NewTodo: userId is string "1" (expected number) (1 of 1 capture). (`components/TodoPanel.tsx:19`)

## Boundary gaps (2)

Pages with nothing to show while they load, nothing to catch an error or a missing page, and slots or intercepting routes `next build` rejects.

- [`/`](pages/index.md): no loading state: waits for a request (`fetch`) with no `loading` file or `<Suspense>` to show meanwhile (`lib/api.ts:5`)
- [`/`](pages/index.md): no error boundary: fetches on the server (`fetch`), and no `error` file, error boundary or `global-error` catches a failure (`lib/api.ts:5`)

## Flows not confirmed (1)

Inferred from the code but not walked end to end in a recorded session yet.

- [TodoPanel submit](flows/todopanel-submit.md): not walked yet
