# Request performance

[← Overview](README.md)

Requests that wait for each other for no reason (waterfalls), run once per item of a list (N+1), or are sent twice on one page load, found in the code. Capture timings of each page load confirm them, and give each endpoint its median (p50) and slow-call (p95) time.

## To check (0)

The scan found no waterfalls, N+1 requests or duplicate requests.

## Slowest endpoints

From 10 page loads and server requests. Times in dev include compiling, so compare endpoints with each other.

| Endpoint | p50 | p95 | Slowest | Calls | Failed |
| --- | --- | --- | --- | --- | --- |
| `GET /api/trpc/health.ping` | 1.6 s | 1.6 s | 1.6 s | 1 | 0 |
| `GET /api/trpc/todo.list` | 24 ms | 1.6 s | 1.6 s | 2 | 0 |
| `POST /api/trpc/todo.add` | 77 ms | 77 ms | 77 ms | 1 | 0 |
| `GET /api/trpc/todo.byId` | 22 ms | 43 ms | 43 ms | 2 | 0 |
| `GET /api/trpc/user.list` | 41 ms | 41 ms | 41 ms | 1 | 0 |
| `POST /api/trpc/todo.toggle` | 37 ms | 37 ms | 37 ms | 1 | 0 |
| `GET {API_URL ?? http://localhost:4010}/todos` | 6 ms | 34 ms | 34 ms | 2 | 0 |
| `GET /api/trpc/user.byId` | 22 ms | 22 ms | 22 ms | 1 | 0 |
| `GET {API_URL ?? http://localhost:4010}/users` | 17 ms | 17 ms | 17 ms | 1 | 0 |
| `POST {API_URL ?? http://localhost:4010}/todos` | 5 ms | 5 ms | 5 ms | 1 | 0 |
| `PATCH {API_URL ?? http://localhost:4010}/todos/:id` | 4 ms | 4 ms | 4 ms | 1 | 0 |
| `GET {API_URL ?? http://localhost:4010}/todos/:id` | 3 ms | 3 ms | 3 ms | 2 | 0 |
| `GET {API_URL ?? http://localhost:4010}/users/:id` | 3 ms | 3 ms | 3 ms | 1 | 0 |
