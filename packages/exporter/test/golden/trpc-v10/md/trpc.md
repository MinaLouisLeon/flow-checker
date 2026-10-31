# tRPC

[← Overview](README.md)

|  |  |
| --- | --- |
| Endpoint | `/api/trpc` |
| Served by | [`/api/trpc/[trpc]`](pages/api.trpc.%5Btrpc%5D.md) |
| Router | `appRouter` · `src/server/root.ts:6` |
| Summary | 7 of 7 procedures called by the app |

Each procedure call in the code is a request to the endpoint. Batched calls (`/api/trpc/a,b?batch=1`) are recorded as one capture per procedure.

## Procedures

### <a id="procedure-ping"></a>`ping`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/server/routers/health.ts:5` |
| Called by | [`GET /api/trpc/ping`](components/HealthBadge.md#req_1bu2fw37bk8) in [`HealthBadge`](components/HealthBadge.md) |

**Output** `{ ok: true; at: string; }`

```ts
{ ok: true; at: string }
```

### <a id="procedure-todo_add"></a>`todo.add`

|  |  |
| --- | --- |
| Type | mutation |
| Defined at | `src/server/routers/todo.ts:20` |
| Called by | [`POST /api/trpc/todo.add`](components/AddTodoForm.md#req_0sfrr3m6hv2) in [`AddTodoForm`](components/AddTodoForm.md) |
| Sends | [`POST {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_2ah5o8jjwsr) |

**Input** `z.input<typeof NewTodoSchema>`

```ts
{ title: string }
```

**Output** [`Todo`](types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

### <a id="procedure-todo_byId"></a>`todo.byId`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/server/routers/todo.ts:17` |
| Called by | [`GET /api/trpc/todo.byId`](components/TodoDetail.md#req_0i7plnzsuv7) in [`TodoDetail`](components/TodoDetail.md) |
| Sends | [`GET {API_URL ?? http://localhost:4010}/todos/:id`](pages/api.trpc.%5Btrpc%5D.md#req_19v0zzhv2k5) |

**Input** `{ id: number }`

**Output** [`Todo`](types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

### <a id="procedure-todo_feed"></a>`todo.feed`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/server/routers/todo.ts:26` |
| Called by | [`GET /api/trpc/todo.feed`](components/TodoFeed.md#req_1c78i0tgtyn) in [`TodoFeed`](components/TodoFeed.md) |
| Sends | [`GET {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_2flmlyku854) |

**Input** `{ limit: number; cursor?: number | null }`

**Output** [`TodoPage`](types.md#typ_1ztzqbb553r)

```ts
{ items: Todo[]; nextCursor: number | null }
```

### <a id="procedure-todo_list"></a>`todo.list`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/server/routers/todo.ts:14` |
| Called by | [`GET /api/trpc/todo.list`](components/TodoList.md#req_17wtkw08tco) in [`TodoList`](components/TodoList.md) |
| Sends | [`GET {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_0omiq0w94p9) |

**Input** `{ userId?: number } | undefined`

**Output** `Todo[]` (see [`Todo`](types.md#typ_0fc96ucq8sd))

### <a id="procedure-todo_toggle"></a>`todo.toggle`

|  |  |
| --- | --- |
| Type | mutation |
| Defined at | `src/server/routers/todo.ts:23` |
| Called by | [`POST /api/trpc/todo.toggle`](components/TodoDetail.md#req_02es5n58ro4) in [`TodoDetail`](components/TodoDetail.md) |
| Sends | [`PATCH {API_URL ?? http://localhost:4010}/todos/:id`](pages/api.trpc.%5Btrpc%5D.md#req_0n9qb5iqo86) |

**Input** `{ id: number; done: boolean }`

**Output** [`Todo`](types.md#typ_0fc96ucq8sd)

```ts
{ id: number; userId: number; title: string; done: boolean }
```

### <a id="procedure-user_list"></a>`user.list`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/server/routers/user.ts:5` |
| Called by | [`GET /api/trpc/user.list`](components/UserList.md#req_1sz2hauuhmt) in [`UserList`](components/UserList.md) |
| Sends | [`GET {API_URL ?? http://localhost:4010}/users`](pages/api.trpc.%5Btrpc%5D.md#req_0v7l7pp65e3) |

**Output** `User[]` (see [`User`](types.md#typ_25sov0zzv45))

## Procedures no request calls (0)

The app calls every procedure.
