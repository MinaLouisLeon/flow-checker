# GraphQL

[← Overview](README.md)

|  |  |
| --- | --- |
| Endpoint | `/api/graphql` |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Clients | apollo (batching) · `src/lib/apollo.ts:6` |
| Schema | `schema.graphql` · 7 types |
| Summary | 7 of 7 operations sent by the app |

Every operation goes to the same endpoint, so requests are matched by operation name (or persisted query id). Batched requests are recorded as one capture per operation.

## Operations

### <a id="operation-AddTodo"></a>`AddTodo`

|  |  |
| --- | --- |
| Type | mutation |
| Defined at | `src/components/AddTodoForm.tsx:8` |
| Types from | GraphQL Code Generator |
| Sent by | [`POST /api/graphql`](components/AddTodoForm.md#req_1se0zfbjglz) in [`AddTodoForm`](components/AddTodoForm.md) |

```graphql
mutation AddTodo($input: AddTodoInput!) {
  addTodo(input: $input) {
    id
    title
  }
}
```

**Variables** [`Exact<{ input: AddTodoInput; }>`](types.md#typ_164dkm81jm4)

```ts
{ input: AddTodoInput }
```

**Data** [`AddTodoMutation`](types.md#typ_16ca9i9k1a7)

```ts
{ addTodo: { id: string; title: string } }
```

### <a id="operation-Todo"></a>`Todo`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/components/TodoDetail.tsx:8` |
| Types from | GraphQL Code Generator |
| Sent by | [`POST /api/graphql`](components/TodoView.md#req_0y9v4qo3n8x) in [`TodoView`](components/TodoView.md) |

```graphql
query Todo($id: ID!) {
  todo(id: $id) {
    id
    title
    done
    status
    owner {
      name
    }
  }
}
```

**Variables** [`Exact<{ id: string | number; }>`](types.md#typ_0kk3su9xks9)

```ts
{ id: string | number }
```

**Data** [`TodoQuery`](types.md#typ_18j2vjt684p)

```ts
{
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

### <a id="operation-ToggleTodo"></a>`ToggleTodo`

|  |  |
| --- | --- |
| Type | mutation |
| Defined at | `src/components/TodoDetail.tsx:22` |
| Types from | GraphQL Code Generator |
| Sent by | [`POST /api/graphql`](components/TodoView.md#req_08vp0aultnf) in [`TodoView`](components/TodoView.md) |

```graphql
mutation ToggleTodo($id: ID!) {
  toggleTodo(id: $id) {
    id
    done
    status
  }
}
```

**Variables** [`Exact<{ id: string | number; }>`](types.md#typ_0kk3su9xks9)

```ts
{ id: string | number }
```

**Data** [`ToggleTodoMutation`](types.md#typ_0r3wizusxxi)

```ts
{ toggleTodo: { id: string; done: boolean; status: TodoStatus } }
```

### <a id="operation-Todos"></a>`Todos`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/components/TodoList.tsx:8` |
| Fragments | `TodoItem` |
| Types from | GraphQL Code Generator |
| Sent by | [`POST /api/graphql`](components/TodoList.md#req_1cmdvpo38br) in [`TodoList`](components/TodoList.md) |

```graphql
query Todos($status: TodoStatus) {
  todos(status: $status) {
    id
    ...TodoItem
  }
}
```

**Variables** [`Exact<{ status?: TodoStatus | null | undefined; }>`](types.md#typ_0oaau18ifc2)

```ts
{ status?: "DONE" | "OPEN" | null }
```

**Data** `TodosQuery`

```ts
{ todos: { id: string; title: string; done: boolean }[] }
```

### <a id="operation-Search"></a>`Search`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/components/UserSearch.tsx:8` |
| Types from | GraphQL Code Generator |
| Sent by | [`POST /api/graphql`](components/UserSearch.md#req_27iyr9uuhkz) in [`UserSearch`](components/UserSearch.md) |

```graphql
query Search($text: String!) {
  search(text: $text) {
    __typename
    ... on Todo {
      id
      title
    }
    ... on User {
      id
      name
    }
  }
}
```

**Variables** [`Exact<{ text: string; }>`](types.md#typ_0rr10bb7h1t)

```ts
{ text: string }
```

**Data** [`SearchQuery`](types.md#typ_1g0hej3ogvt)

```ts
{
  search: (
    | { __typename: "Todo"; id: string; title: string }
    | { __typename: "User"; id: string; name: string })[]
}
```

### <a id="operation-Users"></a>`Users`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/components/UserSearch.tsx:24` |
| Types from | GraphQL Code Generator |
| Sent by | [`POST /api/graphql`](components/UserSearch.md#req_0qoh2ov7p3i) in [`UserSearch`](components/UserSearch.md) |

```graphql
query Users {
  users {
    id
    name
    email
  }
}
```

**Data** [`UsersResult`](types.md#typ_0y0dnmxm2ov)

```ts
{ users: { id: string; name: string; email: string }[] }
```

### <a id="operation-Viewer"></a>`Viewer`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/components/ViewerBadge.tsx:6` |
| Types from | GraphQL Code Generator |
| Sent by | [`POST /api/graphql`](components/ViewerBadge.md#req_235i024m0l6) in [`ViewerBadge`](components/ViewerBadge.md) |

```graphql
query Viewer {
  viewer {
    id
    name
  }
}
```

**Data** [`ViewerQuery`](types.md#typ_201lug1iryj)

```ts
{ viewer: { id: string; name: string } }
```

## Fragments

| Fragment | On | Read by | Defined at |
| --- | --- | --- | --- |
| `TodoItem` | `Todo` | `TodoItem` | `src/components/TodoItem.tsx:7` |

## Operations no request sends (0)

The app sends every operation.
