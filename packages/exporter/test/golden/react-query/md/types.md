# Types

[← Overview](README.md)

5 named types, fully resolved.

## <a id="typ_28rtveus0ih"></a>TodoDetailProps

interface · `src/components/TodoDetail.tsx:8`

```ts
interface TodoDetailProps { id: number }
```

Used by: props of [`TodoDetail`](components/TodoDetail.md).

## <a id="typ_0fc96ucq8sd"></a>Todo

interface · `src/types/todo.ts:1`

```ts
interface Todo { id: number; userId: number; title: string; done: boolean }
```

Used by: used in [`TodoDetail`](components/TodoDetail.md), used in [`TodoList`](components/TodoList.md), request [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/AddTodoForm.md#req_1ybk9xw63lt), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`](components/TodoDetail.md#req_27sy7hb0xsq), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/TodoList.md#req_1di2bq7b96m), request [`PATCH {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`](components/TodoList.md#req_2bvpz71hbm1), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos?userId=:userId`](components/UserList.md#req_0ht2fssv0ja).

## <a id="typ_1llbjxbqwwk"></a>NewTodo

type-alias · `src/types/todo.ts:8`

```ts
type NewTodo = { title: string }
```

Used by: request [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/AddTodoForm.md#req_1ybk9xw63lt).

## <a id="typ_1omtz7j8kgo"></a>TodoPatch

type-alias · `src/types/todo.ts:10`

```ts
type TodoPatch = { title?: string; done?: boolean }
```

Used by: request [`PATCH {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`](components/TodoList.md#req_2bvpz71hbm1).

## <a id="typ_25sov0zzv45"></a>User

interface · `src/types/user.ts:1`

```ts
interface User { id: number; name: string; email: string; role: "admin" | "member" }
```

Used by: request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](components/UsersPage.md#req_2a0uqvzh6dw), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users`](components/UserList.md#req_0m4arr015hb), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](components/UserList.md#req_0ka937821vy), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id`](components/UserList.md#req_1g8keamimjw).
