# Types

[← Overview](README.md)

1 named type, fully resolved.

## <a id="typ_0fc96ucq8sd"></a>Todo

interface · `src/types/todo.ts:1`

```ts
interface Todo { id: number; userId: number; title: string; done: boolean }
```

Used by: request [`POST /api/trpc/todo.add`](components/AddTodoForm.md#req_2e9reb96ytq), request [`GET /api/trpc/todo.byId`](components/TodoDetail.md#req_1130uk5gwu8), request [`POST /api/trpc/todo.toggle`](components/TodoDetail.md#req_1yefdvziu6b), request [`GET /api/trpc/todo.list`](components/TodoList.md#req_0td0aq6jy41), request [`GET {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_1tdume4or33), request [`GET {API_URL ?? http://localhost:4010}/todos/:id`](pages/api.trpc.%5Btrpc%5D.md#req_1pf3v7qr14b), request [`POST {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_1pnj4az8jd4), request [`PATCH {API_URL ?? http://localhost:4010}/todos/:id`](pages/api.trpc.%5Btrpc%5D.md#req_0e790agvf59).
