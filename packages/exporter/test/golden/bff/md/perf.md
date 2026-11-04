# Request performance

[← Overview](README.md)

Requests that wait for each other for no reason (waterfalls), run once per item of a list (N+1), or are sent twice on one page load, found in the code. Capture timings of each page load confirm them, and give each endpoint its median (p50) and slow-call (p95) time.

## To check (0)

The scan found no waterfalls, N+1 requests or duplicate requests.

## Slowest endpoints

From 5 page loads and server requests. Times in dev include compiling, so compare endpoints with each other.

| Endpoint | p50 | p95 | Slowest | Calls | Failed |
| --- | --- | --- | --- | --- | --- |
| `GET /api/products/:id` | 1.5 s | 1.5 s | 1.5 s | 2 | 0 |
| `GET /api/products` | 544 ms | 576 ms | 576 ms | 2 | 0 |
| `POST /api/products` | 41 ms | 41 ms | 41 ms | 1 | 0 |
| `GET {BACKEND_URL ?? http://localhost:4010}/products` | 4 ms | 23 ms | 23 ms | 2 | 0 |
| `POST {BACKEND_URL ?? http://localhost:4010}/products` | 8 ms | 8 ms | 8 ms | 1 | 0 |
| `GET {BACKEND_URL ?? http://localhost:4010}/products/:id` | 3 ms | 5 ms | 5 ms | 2 | 0 |
