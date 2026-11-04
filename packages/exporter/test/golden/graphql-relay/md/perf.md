# Request performance

[← Overview](README.md)

Requests that wait for each other for no reason (waterfalls), run once per item of a list (N+1), or are sent twice on one page load, found in the code. Capture timings of each page load confirm them, and give each endpoint its median (p50) and slow-call (p95) time.

## To check (0)

The scan found no waterfalls, N+1 requests or duplicate requests.

## Slowest endpoints

From 3 page loads and server requests. Times in dev include compiling, so compare endpoints with each other.

| Endpoint | p50 | p95 | Slowest | Calls | Failed |
| --- | --- | --- | --- | --- | --- |
| `POST /api/graphql` | 370 ms | 370 ms | 370 ms | 1 | 0 |
| `POST /api/graphql` | 72 ms | 72 ms | 72 ms | 1 | 0 |
| `POST /api/graphql` | 58 ms | 58 ms | 58 ms | 1 | 0 |
| `POST /api/graphql` | 33 ms | 33 ms | 33 ms | 1 | 0 |
| `POST /api/graphql` | 24 ms | 24 ms | 24 ms | 1 | 0 |
