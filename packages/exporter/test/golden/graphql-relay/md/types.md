# Types

[← Overview](README.md)

19 named types, fully resolved.

## <a id="typ_231vg8grtmp"></a>AddTodoInput

type-alias · `src/__generated__/AddTodoFormMutation.graphql.ts:14`

```ts
type AddTodoInput = { ownerId?: string | null; title: string }
```

Used by: in [`AddTodoFormMutation$variables`](#typ_1jk7p5vwxhg).

## <a id="typ_1jk7p5vwxhg"></a>AddTodoFormMutation$variables

type-alias · `src/__generated__/AddTodoFormMutation.graphql.ts:18`

```ts
type AddTodoFormMutation$variables = { input: AddTodoInput }
```

Used by: request [`POST /api/graphql`](components/AddTodoForm.md#req_25b0dzm9av8), in [`AddTodoFormMutation`](#typ_0nkk0lukv3w).

## <a id="typ_07be3pbscua"></a>AddTodoFormMutation$data

type-alias · `src/__generated__/AddTodoFormMutation.graphql.ts:21`

```ts
type AddTodoFormMutation$data = { readonly addTodo: { readonly id: string; readonly title: string } }
```

Used by: request [`POST /api/graphql`](components/AddTodoForm.md#req_25b0dzm9av8), in [`AddTodoFormMutation`](#typ_0nkk0lukv3w).

## <a id="typ_0nkk0lukv3w"></a>AddTodoFormMutation

type-alias · `src/__generated__/AddTodoFormMutation.graphql.ts:27`

```ts
type AddTodoFormMutation = { response: AddTodoFormMutation$data; variables: AddTodoFormMutation$variables }
```

Used by: used in [`AddTodoForm`](components/AddTodoForm.md).

## <a id="typ_1trtwe7hly4"></a>TodoStatus

type-alias · `src/__generated__/TodoDetailQuery.graphql.ts:14`

```ts
type TodoStatus = "DONE" | "OPEN" | "%future added value"
```

Used by: in [`TodoDetailQuery$data`](#typ_1m5qqany6tv).

## <a id="typ_1ji4t5gnvh0"></a>TodoDetailQuery$variables

type-alias · `src/__generated__/TodoDetailQuery.graphql.ts:15`

```ts
type TodoDetailQuery$variables = { id: string }
```

Used by: props of [`TodoDetail`](components/TodoDetail.md), request [`POST /api/graphql`](components/TodoPage.md#req_0b9cucu4bbq), in [`TodoDetailQuery`](#typ_21jc4oi1jmb).

## <a id="typ_1m5qqany6tv"></a>TodoDetailQuery$data

type-alias · `src/__generated__/TodoDetailQuery.graphql.ts:18`

```ts
type TodoDetailQuery$data = {
  readonly todo: 
    | {
      readonly done: boolean
      readonly id: string
      readonly owner: { readonly name: string }
      readonly status: TodoStatus
      readonly title: string
    }
    | null
    | undefined
}
```

Used by: request [`POST /api/graphql`](components/TodoPage.md#req_0b9cucu4bbq), in [`TodoDetailQuery`](#typ_21jc4oi1jmb).

## <a id="typ_21jc4oi1jmb"></a>TodoDetailQuery

type-alias · `src/__generated__/TodoDetailQuery.graphql.ts:29`

```ts
type TodoDetailQuery = { response: TodoDetailQuery$data; variables: TodoDetailQuery$variables }
```

Used by: used in [`TodoDetail`](components/TodoDetail.md), used in [`TodoPage`](components/TodoPage.md).

## <a id="typ_0rtunk5nqpl"></a>TodoDetailToggleMutation$variables

type-alias · `src/__generated__/TodoDetailToggleMutation.graphql.ts:14`

```ts
type TodoDetailToggleMutation$variables = { id: string }
```

Used by: request [`POST /api/graphql`](components/TodoDetail.md#req_0manrbz632m), in [`TodoDetailToggleMutation`](#typ_0hkj1ywjyme).

## <a id="typ_269jvnd7qf5"></a>TodoDetailToggleMutation$data

type-alias · `src/__generated__/TodoDetailToggleMutation.graphql.ts:17`

```ts
type TodoDetailToggleMutation$data = { readonly toggleTodo: { readonly done: boolean; readonly id: string } }
```

Used by: request [`POST /api/graphql`](components/TodoDetail.md#req_0manrbz632m), in [`TodoDetailToggleMutation`](#typ_0hkj1ywjyme).

## <a id="typ_0hkj1ywjyme"></a>TodoDetailToggleMutation

type-alias · `src/__generated__/TodoDetailToggleMutation.graphql.ts:23`

```ts
type TodoDetailToggleMutation = {
  response: TodoDetailToggleMutation$data
  variables: TodoDetailToggleMutation$variables
}
```

Used by: used in [`TodoDetail`](components/TodoDetail.md).

## <a id="typ_1us75t63uuw"></a>TodoItem_todo$data

type-alias · `src/__generated__/TodoItem_todo.graphql.ts:12`

```ts
type TodoItem_todo$data = {
  readonly done: boolean
  readonly title: string
  readonly " $fragmentType": "TodoItem_todo"
}
```

Used by: in [`TodoItem_todo$key`](#typ_09gwzh9zgzk).

## <a id="typ_09gwzh9zgzk"></a>TodoItem_todo$key

type-alias · `src/__generated__/TodoItem_todo.graphql.ts:17`

```ts
type TodoItem_todo$key = {
  readonly " $data"?: TodoItem_todo$data
  readonly " $fragmentSpreads": { TodoItem_todo: true }
}
```

Used by: props of [`TodoItem`](components/TodoItem.md).

## <a id="typ_0sd209oo5ki"></a>TodoListQuery$variables

type-alias · `src/__generated__/TodoListQuery.graphql.ts:15`

```ts
type TodoListQuery$variables = { [key: string]: never }
```

Used by: request [`POST /api/graphql`](components/TodoList.md#req_0ixcyoz99u0), in [`TodoListQuery`](#typ_1hnuzynwht2).

## <a id="typ_26ljzzt0d5w"></a>TodoListQuery$data

type-alias · `src/__generated__/TodoListQuery.graphql.ts:16`

```ts
type TodoListQuery$data = {
  readonly todos: readonly { readonly id: string; readonly " $fragmentSpreads": { TodoItem_todo: true } }[]
}
```

Used by: in [`TodoListQuery`](#typ_1hnuzynwht2).

## <a id="typ_1hnuzynwht2"></a>TodoListQuery

type-alias · `src/__generated__/TodoListQuery.graphql.ts:22`

```ts
type TodoListQuery = { response: TodoListQuery$data; variables: TodoListQuery$variables }
```

Used by: used in [`TodoList`](components/TodoList.md).

## <a id="typ_1yt21z5dhfc"></a>UserListQuery$variables

type-alias · `src/__generated__/UserListQuery.graphql.ts:14`

```ts
type UserListQuery$variables = { [key: string]: never }
```

Used by: request [`POST /api/graphql`](components/UserList.md#req_2dy1uuhut7o), in [`UserListQuery`](#typ_28cihfc6gsp).

## <a id="typ_1fqrz3yzgfq"></a>UserListQuery$data

type-alias · `src/__generated__/UserListQuery.graphql.ts:15`

```ts
type UserListQuery$data = {
  readonly users: readonly { readonly email: string; readonly id: string; readonly name: string }[]
}
```

Used by: used in [`UserList`](components/UserList.md), request [`POST /api/graphql`](components/UserList.md#req_2dy1uuhut7o), in [`UserListQuery`](#typ_28cihfc6gsp).

## <a id="typ_28cihfc6gsp"></a>UserListQuery

type-alias · `src/__generated__/UserListQuery.graphql.ts:22`

```ts
type UserListQuery = { response: UserListQuery$data; variables: UserListQuery$variables }
```

Used by: used in [`UserList`](components/UserList.md).
