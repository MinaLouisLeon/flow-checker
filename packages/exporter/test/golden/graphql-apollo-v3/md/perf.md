# Request performance

[← Overview](README.md)

Requests that wait for each other for no reason (waterfalls), run once per item of a list (N+1), or are sent twice on one page load, found in the code. Capture timings of each page load confirm them, and give each endpoint its median (p50) and slow-call (p95) time.

## To check (0)

The scan found no waterfalls, N+1 requests or duplicate requests.

## Slowest endpoints

From 3 page loads and server requests. Times in dev include compiling, so compare endpoints with each other.

| Endpoint | p50 | p95 | Slowest | Calls | Failed |
| --- | --- | --- | --- | --- | --- |
| `POST /api/graphql` | 78 ms | 342 ms | 342 ms | 3 | 0 |
| `POST /api/graphql` | 71 ms | 316 ms | 316 ms | 3 | 0 |
| `POST /api/graphql` | 19 ms | 52 ms | 52 ms | 2 | 0 |
| `POST /api/graphql` | 28 ms | 48 ms | 48 ms | 2 | 0 |
| `POST /api/graphql` | 19 ms | 23 ms | 23 ms | 2 | 0 |
| `POST /api/graphql` | 17 ms | 19 ms | 19 ms | 2 | 0 |
