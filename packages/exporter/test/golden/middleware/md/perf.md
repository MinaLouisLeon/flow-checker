# Request performance

[← Overview](README.md)

Requests that wait for each other for no reason (waterfalls), run once per item of a list (N+1), or are sent twice on one page load, found in the code. Capture timings of each page load confirm them, and give each endpoint its median (p50) and slow-call (p95) time.

## To check (0)

The scan found no waterfalls, N+1 requests or duplicate requests.

## Slowest endpoints

From 4 page loads and server requests. Times in dev include compiling, so compare endpoints with each other.

| Endpoint | p50 | p95 | Slowest | Calls | Failed |
| --- | --- | --- | --- | --- | --- |
| `GET {API_URL ?? http://localhost:4010}/products` | 36 ms | 36 ms | 36 ms | 1 | 0 |
| `GET {API_URL ?? http://localhost:4010}/users` | 18 ms | 23 ms | 23 ms | 2 | 0 |
| `GET {API_URL ?? http://localhost:4010}/settings` | 14 ms | 14 ms | 14 ms | 1 | 0 |
| `GET {API_URL ?? http://localhost:4010}/me` | 3 ms | 6 ms | 6 ms | 4 | 1 |
