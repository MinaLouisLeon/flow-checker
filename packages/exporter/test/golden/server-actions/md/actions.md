# Server actions

[← Overview](README.md)

Every server action, with the auth check and the input check that run before it changes data. A server action is a public `POST` endpoint: once a page uses it, anyone can call it with any arguments, not only your forms. TypeScript types aren't checked when it runs.

## To check (1)

- `deleteProduct` (`src/actions/products.ts:30`): ⚠ **[open to anyone](GLOSSARY.md#action-unprotected)**, [no auth check](GLOSSARY.md#action-auth-none), [input not checked](GLOSSARY.md#action-input-none); changes data through a request
  - Server action `deleteProduct` changes data (`fetch DELETE` through `removeProduct`) with no auth check and uses its input as sent: a server action is a public `POST` endpoint, so anyone can call it with any arguments

## Actions

| Action | Auth | Input | Changes | Pages |
| --- | --- | --- | --- | --- |
| `createProduct`<br>`src/actions/products.ts:9` | No auth check: it runs for anyone who sends the request. | Input checked by `Object.keys(fieldErrors).length > 0`. | request: `fetch POST` through `insertProduct`<br>cache: `revalidatePath` | [`/products/new`](pages/products.new.md) |
| `deleteProduct` ⚠ open to anyone<br>`src/actions/products.ts:30` | No auth check: it runs for anyone who sends the request. | Input not checked: `id` is used as sent. | request: `fetch DELETE` through `removeProduct`<br>cache: `revalidatePath` | [`/products`](pages/products.md) |
