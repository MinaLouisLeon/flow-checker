# Server cache

[← Overview](README.md)

What Next keeps on the server between requests (`fetch` cache options, `use cache`, `unstable_cache`), the tags on it, and the calls that refresh it. Read from the code; `next dev` doesn't cache like a build does.

## Cached data

Nothing is cached.

## Revalidation calls

| Call | In | Refreshes | Pages | Where |
| --- | --- | --- | --- | --- |
| `revalidatePath('/products')` | server action `createProduct` | — | [`/products`](pages/products.md) | `src/actions/products.ts:25` |
| `revalidatePath('/products')` | server action `deleteProduct` | — | [`/products`](pages/products.md) | `src/actions/products.ts:32` |
