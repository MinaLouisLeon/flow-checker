# Types

[← Overview](README.md)

16 named types, fully resolved.

## <a id="typ_0wq8jlhw5gw"></a>FragmentType\<typeof TodoItemFragment\>

type-alias · `src/gql/fragment-masking.ts:7`

```ts
type FragmentType<typeof TodoItemFragment> = { " $fragmentRefs"?: { TodoItemFragment: TodoItemFragment } }
```

Used by: props of [`TodoItem`](components/TodoItem.md).

## <a id="typ_25ax93uu3f2"></a>Exact\<{ \[key: string\]: never; }\>

type-alias · `src/gql/graphql.ts:3`

```ts
type Exact<{ [key: string]: never; }> = { [key: string]: never }
```

Not used by any component or request directly.

## <a id="typ_0kk3su9xks9"></a>Exact\<{ id: string \| number; }\>

type-alias · `src/gql/graphql.ts:3`

```ts
type Exact<{ id: string | number; }> = { id: string | number }
```

Used by: request [`POST /api/graphql`](components/TodoView.md#req_0y9v4qo3n8x), request [`POST /api/graphql`](components/TodoView.md#req_08vp0aultnf).

## <a id="typ_164dkm81jm4"></a>Exact\<{ input: AddTodoInput; }\>

type-alias · `src/gql/graphql.ts:3`

```ts
type Exact<{ input: AddTodoInput; }> = { input: AddTodoInput }
```

Used by: request [`POST /api/graphql`](components/AddTodoForm.md#req_1se0zfbjglz).

## <a id="typ_0oaau18ifc2"></a>Exact\<{ status?: TodoStatus \| null \| undefined; }\>

type-alias · `src/gql/graphql.ts:3`

```ts
type Exact<{ status?: TodoStatus | null | undefined; }> = { status?: "DONE" | "OPEN" | null }
```

Used by: request [`POST /api/graphql`](components/TodoList.md#req_1cmdvpo38br).

## <a id="typ_0rr10bb7h1t"></a>Exact\<{ text: string; }\>

type-alias · `src/gql/graphql.ts:3`

```ts
type Exact<{ text: string; }> = { text: string }
```

Used by: request [`POST /api/graphql`](components/UserSearch.md#req_27iyr9uuhkz).

## <a id="typ_2eia097dg9g"></a>AddTodoInput

type-alias · `src/gql/graphql.ts:7`

```ts
type AddTodoInput = { ownerId?: string | number | null; title: string }
```

Used by: in [`Exact<{ input: AddTodoInput; }>`](#typ_164dkm81jm4).

## <a id="typ_25jlj2yb23q"></a>TodoStatus

type-alias · `src/gql/graphql.ts:12`

```ts
type TodoStatus = "DONE" | "OPEN"
```

Used by: in [`TodoQuery`](#typ_18j2vjt684p), in [`ToggleTodoMutation`](#typ_0r3wizusxxi).

## <a id="typ_16ca9i9k1a7"></a>AddTodoMutation

type-alias · `src/gql/graphql.ts:21`

```ts
type AddTodoMutation = { addTodo: { id: string; title: string } }
```

Used by: request [`POST /api/graphql`](components/AddTodoForm.md#req_1se0zfbjglz).

## <a id="typ_18j2vjt684p"></a>TodoQuery

type-alias · `src/gql/graphql.ts:28`

```ts
type TodoQuery = {
  todo: 
    | {
      id: string
      title: string
      done: boolean
      status: TodoStatus
      owner: { name: string }
    }
    | null
}
```

Used by: request [`POST /api/graphql`](components/TodoView.md#req_0y9v4qo3n8x).

## <a id="typ_0r3wizusxxi"></a>ToggleTodoMutation

type-alias · `src/gql/graphql.ts:35`

```ts
type ToggleTodoMutation = { toggleTodo: { id: string; done: boolean; status: TodoStatus } }
```

Used by: request [`POST /api/graphql`](components/TodoView.md#req_08vp0aultnf).

## <a id="typ_10ogag4yxtl"></a>TodoItemFragment

type-alias · `src/gql/graphql.ts:37`

```ts
type TodoItemFragment = {
  id: string
  title: string
  done: boolean
  " $fragmentName"?: "TodoItemFragment"
}
```

Used by: in [`FragmentType<typeof TodoItemFragment>`](#typ_0wq8jlhw5gw), in [`TodosQuery`](#typ_22md51zxgcz).

## <a id="typ_22md51zxgcz"></a>TodosQuery

type-alias · `src/gql/graphql.ts:44`

```ts
type TodosQuery = {
  todos: { id: string; " $fragmentRefs"?: { TodoItemFragment: TodoItemFragment } }[]
}
```

Not used by any component or request directly.

## <a id="typ_1g0hej3ogvt"></a>SearchQuery

type-alias · `src/gql/graphql.ts:54`

```ts
type SearchQuery = {
  search: (
    | { __typename: "Todo"; id: string; title: string }
    | { __typename: "User"; id: string; name: string })[]
}
```

Used by: request [`POST /api/graphql`](components/UserSearch.md#req_27iyr9uuhkz).

## <a id="typ_0y0dnmxm2ov"></a>UsersQuery

type-alias · `src/gql/graphql.ts:62`

```ts
type UsersQuery = { users: { id: string; name: string; email: string }[] }
```

Used by: used in [`UserSearch`](components/UserSearch.md), request [`POST /api/graphql`](components/UserSearch.md#req_0qoh2ov7p3i).

## <a id="typ_201lug1iryj"></a>ViewerQuery

type-alias · `src/gql/graphql.ts:67`

```ts
type ViewerQuery = { viewer: { id: string; name: string } }
```

Used by: request [`POST /api/graphql`](components/ViewerBadge.md#req_235i024m0l6).
