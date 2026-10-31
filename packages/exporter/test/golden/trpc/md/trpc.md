# tRPC

[← Overview](README.md)

|  |  |
| --- | --- |
| Endpoint | `/api/trpc` |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Router | `appRouter` · `src/server/root.ts:5` |
| Summary | 7 of 7 procedures called by the app |

Each procedure call in the code is a request to the endpoint. Batched calls (`/api/trpc/a,b?batch=1`) are recorded as one capture per procedure.

## Procedures

### <a id="procedure-health_ping"></a>`health.ping`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/server/root.ts:9` |
| Called by | [`GET /api/trpc/health.ping`](components/HealthBadge.md#req_0xg00gfgxqn) in [`HealthBadge`](components/HealthBadge.md) |

**Output** `{ ok: boolean; }`

```ts
{ ok: boolean }
```

### <a id="procedure-todo_add"></a>`todo.add`

|  |  |
| --- | --- |
| Type | mutation |
| Defined at | `src/server/routers/todo.ts:11` |
| Called by | [`POST /api/trpc/todo.add`](components/AddTodoForm.md#req_2e9reb96ytq) in [`AddTodoForm`](components/AddTodoForm.md) |
| Sends | [`POST {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_1pnj4az8jd4) |

**Input** `{ title: string }`

**Output** [`Todo`](types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

### <a id="procedure-todo_byId"></a>`todo.byId`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/server/routers/todo.ts:8` |
| Called by | [`GET /api/trpc/todo.byId`](components/TodoDetail.md#req_1130uk5gwu8) in [`TodoDetail`](components/TodoDetail.md) |
| Sends | [`GET {API_URL ?? http://localhost:4010}/todos/:id`](pages/api.trpc.%5Btrpc%5D.md#req_1pf3v7qr14b) |

**Input** `{ id: number }`

**Output** [`Todo`](types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

### <a id="procedure-todo_list"></a>`todo.list`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/server/routers/todo.ts:7` |
| Called by | [`GET /api/trpc/todo.list`](components/TodoList.md#req_0td0aq6jy41) in [`TodoList`](components/TodoList.md) |
| Sends | [`GET {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_1tdume4or33) |

**Output** `Todo[]` (see [`Todo`](types.md#typ_0fc96ucq8sd))

### <a id="procedure-todo_toggle"></a>`todo.toggle`

|  |  |
| --- | --- |
| Type | mutation |
| Defined at | `src/server/routers/todo.ts:14` |
| Called by | [`POST /api/trpc/todo.toggle`](components/TodoDetail.md#req_1yefdvziu6b) in [`TodoDetail`](components/TodoDetail.md) |
| Sends | [`PATCH {API_URL ?? http://localhost:4010}/todos/:id`](pages/api.trpc.%5Btrpc%5D.md#req_0e790agvf59) |

**Input** `{ id: number; done: boolean }`

**Output** [`Todo`](types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

### <a id="procedure-user_byId"></a>`user.byId`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/server/routers/user.ts:18` |
| Called by | [`GET /api/trpc/user.byId`](components/TodoDetail.md#req_1jhjx2h6c0y) in [`TodoDetail`](components/TodoDetail.md) |
| Sends | [`GET {API_URL ?? http://localhost:4010}/users/:id`](pages/api.trpc.%5Btrpc%5D.md#req_2c4oanm9vl7) |

**Input** `{ id: number }`

**Output** `z.output<typeof UserSchema>`

```ts
{ id: number; name: string; email: string; role: "admin" | "member" }
```

### <a id="procedure-user_list"></a>`user.list`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/server/routers/user.ts:14` |
| Called by | [`GET /api/trpc/user.list`](components/UserList.md#req_0mfdzrz4ekf) in [`UserList`](components/UserList.md) |
| Sends | [`GET {API_URL ?? http://localhost:4010}/users`](pages/api.trpc.%5Btrpc%5D.md#req_1grc5hxysxt) |

**Output** `{ id: number; name: string; email: string; role: "admin" | "member" }[]`

## Procedures no request calls (0)

The app calls every procedure.
