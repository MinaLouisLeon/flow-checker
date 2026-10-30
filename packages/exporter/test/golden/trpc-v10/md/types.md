# Types

[← Overview](README.md)

3 named types, fully resolved.

## <a id="typ_0fc96ucq8sd"></a>Todo

interface · `src/types/todo.ts:1`

```ts
interface Todo { id: number; userId: number; title: string; done: boolean }
```

Used by: request [`POST /api/trpc/todo.add`](components/AddTodoForm.md#req_0sfrr3m6hv2), request [`GET /api/trpc/todo.byId`](components/TodoDetail.md#req_0i7plnzsuv7), request [`POST /api/trpc/todo.toggle`](components/TodoDetail.md#req_02es5n58ro4), request [`GET /api/trpc/todo.list`](components/TodoList.md#req_17wtkw08tco), request [`GET {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_0omiq0w94p9), request [`GET {API_URL ?? http://localhost:4010}/todos/:id`](pages/api.trpc.%5Btrpc%5D.md#req_19v0zzhv2k5), request [`POST {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_2ah5o8jjwsr), request [`PATCH {API_URL ?? http://localhost:4010}/todos/:id`](pages/api.trpc.%5Btrpc%5D.md#req_0n9qb5iqo86), request [`GET {API_URL ?? http://localhost:4010}/todos`](pages/api.trpc.%5Btrpc%5D.md#req_2flmlyku854), in [`TodoPage`](#typ_1ztzqbb553r).

## <a id="typ_1ztzqbb553r"></a>TodoPage

interface · `src/types/todo.ts:8`

```ts
interface TodoPage { items: Todo[]; nextCursor: number | null }
```

Used by: request [`GET /api/trpc/todo.feed`](components/TodoFeed.md#req_1c78i0tgtyn).

## <a id="typ_25sov0zzv45"></a>User

interface · `src/types/user.ts:1`

```ts
interface User { id: number; name: string; email: string; role: "admin" | "member" }
```

Used by: request [`GET /api/trpc/user.list`](components/UserList.md#req_1sz2hauuhmt), request [`GET {API_URL ?? http://localhost:4010}/users`](pages/api.trpc.%5Btrpc%5D.md#req_0v7l7pp65e3).
