# Types

[← Overview](README.md)

4 named types, fully resolved.

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

Used by: used in [`TodoDetail`](components/TodoDetail.md), used in [`TodoList`](components/TodoList.md), request [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/AddTodoForm.md#req_21j0fo1p54x), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`](components/TodoDetail.md#req_0euad6xi67r), request [`GET {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/TodoList.md#req_0s4qt6a0r0d), request [`PATCH {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`](components/TodoList.md#req_0edpknxxbhl).

## <a id="typ_1llbjxbqwwk"></a>NewTodo

type-alias · `src/types/todo.ts:8`

```ts
type NewTodo = { title: string }
```

Used by: request [`POST {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos`](components/AddTodoForm.md#req_21j0fo1p54x).

## <a id="typ_1omtz7j8kgo"></a>TodoPatch

type-alias · `src/types/todo.ts:10`

```ts
type TodoPatch = { title?: string; done?: boolean }
```

Used by: request [`PATCH {NEXT_PUBLIC_API_URL ?? http://localhost:4010}/todos/:id`](components/TodoList.md#req_0edpknxxbhl).
