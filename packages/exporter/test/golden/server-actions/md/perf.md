# Request performance

[← Overview](README.md)

Requests that wait for each other for no reason (waterfalls), run once per item of a list (N+1), or are sent twice on one page load, found in the code. Capture timings of each page load confirm them, and give each endpoint its median (p50) and slow-call (p95) time.

## To check (0)

The scan found no waterfalls, N+1 requests or duplicate requests.

## Slowest endpoints

From 7 page loads and server requests. Times in dev include compiling, so compare endpoints with each other.

| Endpoint | p50 | p95 | Slowest | Calls | Failed |
| --- | --- | --- | --- | --- | --- |
| `POST createProduct (server action)` | 1.5 s | 1.5 s | 1.5 s | 1 | 0 |
| `POST deleteProduct (server action)` | 82 ms | 82 ms | 82 ms | 1 | 0 |
| `GET {API_URL ?? http://localhost:4010}/products` | 30 ms | 58 ms | 58 ms | 4 | 0 |
| `GET {API_URL ?? http://localhost:4010}/products/:id` | 18 ms | 18 ms | 18 ms | 1 | 0 |
| `POST {API_URL ?? http://localhost:4010}/products` | 8 ms | 8 ms | 8 ms | 1 | 0 |
| `DELETE {API_URL ?? http://localhost:4010}/products/:id` | 3 ms | 3 ms | 3 ms | 1 | 0 |
