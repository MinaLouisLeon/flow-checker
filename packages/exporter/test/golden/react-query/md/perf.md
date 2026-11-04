# Request performance

[← Overview](README.md)

Requests that wait for each other for no reason (waterfalls), run once per item of a list (N+1), or are sent twice on one page load, found in the code. Capture timings of each page load confirm them, and give each endpoint its median (p50) and slow-call (p95) time.

## To check (0)

The scan found no waterfalls, N+1 requests or duplicate requests.

## Slowest endpoints

From 5 page loads and server requests. Times in dev include compiling, so compare endpoints with each other.

| Endpoint | p50 | p95 | Slowest | Calls | Failed |
| --- | --- | --- | --- | --- | --- |
| `GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users` | 8 ms | 30 ms | 30 ms | 4 | 0 |
| `GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id` | 11 ms | 11 ms | 11 ms | 1 | 0 |
| `GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/settings` | 7 ms | 10 ms | 10 ms | 2 | 0 |
| `GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos` | 7 ms | 9 ms | 9 ms | 6 | 0 |
| `GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id` | 5 ms | 9 ms | 9 ms | 4 | 0 |
| `PATCH {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id` | 8 ms | 8 ms | 8 ms | 1 | 0 |
| `POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos` | 8 ms | 8 ms | 8 ms | 1 | 0 |
