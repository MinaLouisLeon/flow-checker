# Request performance

[← Overview](README.md)

Requests that wait for each other for no reason (waterfalls), run once per item of a list (N+1), or are sent twice on one page load, found in the code. Capture timings of each page load confirm them, and give each endpoint its median (p50) and slow-call (p95) time.

## To check (0)

The scan found no waterfalls, N+1 requests or duplicate requests.

## Slowest endpoints

From 3 page loads and server requests. Times in dev include compiling, so compare endpoints with each other.

| Endpoint | p50 | p95 | Slowest | Calls | Failed |
| --- | --- | --- | --- | --- | --- |
| `GET /api/graphql` | 30 ms | 373 ms | 373 ms | 2 | 0 |
| `GET /api/graphql` | 43 ms | 57 ms | 57 ms | 2 | 0 |
| `POST /api/graphql` | 36 ms | 36 ms | 36 ms | 1 | 0 |
| `POST /api/graphql` | 27 ms | 27 ms | 27 ms | 1 | 0 |
| `GET /api/graphql` | 25 ms | 25 ms | 25 ms | 1 | 0 |
