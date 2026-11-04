# Request performance

[← Overview](README.md)

Requests that wait for each other for no reason (waterfalls), run once per item of a list (N+1), or are sent twice on one page load, found in the code. Capture timings of each page load confirm them, and give each endpoint its median (p50) and slow-call (p95) time.

## To check (0)

The scan found no waterfalls, N+1 requests or duplicate requests.

## Slowest endpoints

From 5 page loads and server requests. Times in dev include compiling, so compare endpoints with each other.

| Endpoint | p50 | p95 | Slowest | Calls | Failed |
| --- | --- | --- | --- | --- | --- |
| `GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users` | 35 ms | 366 ms | 366 ms | 3 | 0 |
| `GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id` | 45 ms | 45 ms | 45 ms | 1 | 0 |
| `DELETE {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id` | 21 ms | 21 ms | 21 ms | 1 | 0 |
| `GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos` | 9 ms | 12 ms | 12 ms | 2 | 0 |
