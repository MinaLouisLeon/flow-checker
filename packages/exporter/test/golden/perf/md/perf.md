# Request performance

[← Overview](README.md)

Requests that wait for each other for no reason (waterfalls), run once per item of a list (N+1), or are sent twice on one page load, found in the code. Capture timings of each page load confirm them, and give each endpoint its median (p50) and slow-call (p95) time.

## To check (5)

| Finding | Where | At runtime | Pages |
| --- | --- | --- | --- |
| N+1: `GET http://localhost:4010/products/:id?delay=40` is sent once per item of `products` in `products.map()` in `CatalogPage` | `CatalogPage`<br>`src/app/catalog/page.tsx:6` | confirmed at runtime in 2 of 2 loads: up to 2 requests per load, 59 ms together | [`/catalog`](pages/catalog.md) |
| waterfall: `getProducts()` waits for `getUser(1)` in `Home` but doesn't use its result: they could start together | `Home`<br>`src/app/page.tsx:6` | confirmed at runtime in 3 of 3 loads: about 103 ms to save | [`/`](pages/index.md) |
| N+1: `GET http://localhost:4010/products/:id?delay=40` is sent once per item of `products` in `for (const product of products)` in `ProductsPage`, each waiting for the one before | `ProductsPage`<br>`src/app/products/page.tsx:8` | confirmed at runtime in 2 of 2 loads: up to 2 requests per load, 113 ms together | [`/products`](pages/products.md) |
| duplicate: `GET http://localhost:4010/settings?delay=40` is sent from 2 places on one page load and nothing dedupes it | `src/app/settings/page.tsx:5` | confirmed at runtime in 2 of 2 loads: up to 2 requests per load, 54 ms together | [`/settings`](pages/settings.md) |
| N+1: `<TodoRow>` is rendered once per item of `todos` in `TodosPage`, and each sends `GET http://localhost:4010/todos/:id?delay=30` | `TodosPage`<br>`src/app/todos/page.tsx:10` | confirmed at runtime in 2 of 2 loads: up to 2 requests per load, 93 ms together | [`/todos`](pages/todos.md) |

## Slowest endpoints

From 15 page loads and server requests. Times in dev include compiling, so compare endpoints with each other.

| Endpoint | p50 | p95 | Slowest | Calls | Failed |
| --- | --- | --- | --- | --- | --- |
| `GET http://localhost:4010/users/1` | 93 ms | 206 ms | 206 ms | 5 | 0 |
| `GET http://localhost:4010/users/:id` | 99 ms | 124 ms | 124 ms | 4 | 0 |
| `GET http://localhost:4010/users/2` | 97 ms | 117 ms | 117 ms | 2 | 0 |
| `GET http://localhost:4010/products` | 99 ms | 109 ms | 109 ms | 9 | 0 |
| `GET http://localhost:4010/todos/:id` | 52 ms | 94 ms | 94 ms | 8 | 0 |
| `GET http://localhost:4010/settings` | 54 ms | 76 ms | 76 ms | 4 | 0 |
| `GET http://localhost:4010/todos` | 59 ms | 66 ms | 66 ms | 4 | 0 |
| `GET http://localhost:4010/products/:id` | 51 ms | 65 ms | 65 ms | 8 | 0 |
