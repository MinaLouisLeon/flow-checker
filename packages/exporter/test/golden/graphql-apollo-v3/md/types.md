# Types

[← Overview](README.md)

13 named types, fully resolved.

## <a id="typ_0eodlzjasgm"></a>SearchResult

type-alias · `src/types/search.ts:1`

```ts
type SearchResult = | { __typename: "Todo"; id: string; title: string }
  | { __typename: "User"; id: string; name: string }
```

Used by: in [`SearchData`](#typ_23i4ebffrfm).

## <a id="typ_23i4ebffrfm"></a>SearchData

interface · `src/types/search.ts:5`

```ts
interface SearchData { search: SearchResult[] }
```

Used by: used in [`Search`](components/Search.md), request [`POST /api/graphql`](components/Search.md#req_0k4apzrnh4p).

## <a id="typ_1wwzgmtm01j"></a>SearchVars

interface · `src/types/search.ts:9`

```ts
interface SearchVars { text: string }
```

Used by: used in [`Search`](components/Search.md), request [`POST /api/graphql`](components/Search.md#req_0k4apzrnh4p).

## <a id="typ_189hnmmjqzy"></a>User

interface · `src/types/todo.ts:3`

```ts
interface User { id: string; name: string; email: string }
```

Used by: in [`ViewerData`](#typ_1y0i7pm0ntp).

## <a id="typ_0drld5pt875"></a>TodoFields

interface · `src/types/todo.ts:9`

```ts
interface TodoFields { id: string; title: string; done: boolean }
```

Used by: in [`TodosData`](#typ_1qf74f1isvg), in [`AddTodoData`](#typ_0wlmt9r8y2s).

## <a id="typ_1oh2wp5idbs"></a>TodoDetailFields

interface · `src/types/todo.ts:15`

```ts
interface TodoDetailFields {
  status: "OPEN" | "DONE"
  owner: { id: string; name: string }
  id: string
  title: string
  done: boolean
}
```

Used by: in [`TodoData`](#typ_255hzpa6ygn).

## <a id="typ_1qf74f1isvg"></a>TodosData

interface · `src/types/todo.ts:20`

```ts
interface TodosData { todos: TodoFields[] }
```

Used by: used in [`TodoList`](components/TodoList.md), request [`POST /api/graphql`](components/TodoList.md#req_0tco1ayy7vx).

## <a id="typ_255hzpa6ygn"></a>TodoData

interface · `src/types/todo.ts:24`

```ts
interface TodoData { todo: TodoDetailFields | null }
```

Used by: used in [`TodoDetail`](components/TodoDetail.md), request [`POST /api/graphql`](components/TodoDetail.md#req_1pbvj0u5igd).

## <a id="typ_1fpq9nx1vnr"></a>TodoVars

interface · `src/types/todo.ts:28`

```ts
interface TodoVars { id: string }
```

Used by: used in [`TodoDetail`](components/TodoDetail.md), request [`POST /api/graphql`](components/TodoDetail.md#req_1pbvj0u5igd), request [`POST /api/graphql`](components/TodoDetail.md#req_16r77ymnxz7).

## <a id="typ_0wlmt9r8y2s"></a>AddTodoData

interface · `src/types/todo.ts:32`

```ts
interface AddTodoData { addTodo: TodoFields }
```

Used by: used in [`AddTodoForm`](components/AddTodoForm.md), request [`POST /api/graphql`](components/AddTodoForm.md#req_1vvhclt0a1p).

## <a id="typ_1bkwuejlfje"></a>AddTodoVars

interface · `src/types/todo.ts:36`

```ts
interface AddTodoVars { input: { title: string; ownerId?: string } }
```

Used by: used in [`AddTodoForm`](components/AddTodoForm.md), request [`POST /api/graphql`](components/AddTodoForm.md#req_1vvhclt0a1p).

## <a id="typ_23z70ad4x4v"></a>DeleteTodoData

interface · `src/types/todo.ts:40`

```ts
interface DeleteTodoData { deleteTodo: boolean }
```

Used by: used in [`TodoDetail`](components/TodoDetail.md), request [`POST /api/graphql`](components/TodoDetail.md#req_16r77ymnxz7).

## <a id="typ_1y0i7pm0ntp"></a>ViewerData

interface · `src/types/todo.ts:44`

```ts
interface ViewerData { viewer: User }
```

Used by: used in [`ViewerBadge`](components/ViewerBadge.md), request [`POST /api/graphql`](components/ViewerBadge.md#req_0zshh8iwl6e).
