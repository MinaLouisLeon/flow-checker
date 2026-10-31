# GraphQL

[← Overview](README.md)

|  |  |
| --- | --- |
| Endpoint | `/api/graphql` |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Clients | apollo (persisted queries) · `src/lib/apollo.ts:12` |
| Schema | `schema.graphql` · 7 types |
| Summary | 6 of 6 operations sent by the app |

Every operation goes to the same endpoint, so requests are matched by operation name (or persisted query id). Batched requests are recorded as one capture per operation.

## Operations

### <a id="operation-Todos"></a>`Todos`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/graphql/todos.ts:11` |
| Fragments | `TodoFields` |
| Types from | type arguments in the code |
| Sent by | [`POST /api/graphql`](components/TodoList.md#req_0tco1ayy7vx) in [`TodoList`](components/TodoList.md) |

```graphql
query Todos {
  todos {
    ...TodoFields
  }
}
```

**Data** [`TodosData`](types.md#typ_1qf74f1isvg)

```ts
{ todos: TodoFields[] }
```

### <a id="operation-Todo"></a>`Todo`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/graphql/todos.ts:20` |
| Fragments | `TodoFields` |
| Types from | type arguments in the code |
| Sent by | [`POST /api/graphql`](components/TodoDetail.md#req_1pbvj0u5igd) in [`TodoDetail`](components/TodoDetail.md) |

```graphql
query Todo($id: ID!) {
  todo(id: $id) {
    ...TodoFields
    status
    owner {
      id
      name
    }
  }
}
```

**Variables** [`TodoVars`](types.md#typ_1fpq9nx1vnr)

```ts
{ id: string }
```

**Data** [`TodoData`](types.md#typ_255hzpa6ygn)

```ts
{ todo: TodoDetailFields | null }
```

### <a id="operation-AddTodo"></a>`AddTodo`

|  |  |
| --- | --- |
| Type | mutation |
| Defined at | `src/graphql/todos.ts:34` |
| Fragments | `TodoFields` |
| Types from | type arguments in the code |
| Sent by | [`POST /api/graphql`](components/AddTodoForm.md#req_1vvhclt0a1p) in [`AddTodoForm`](components/AddTodoForm.md) |

```graphql
mutation AddTodo($input: AddTodoInput!) {
  addTodo(input: $input) {
    ...TodoFields
  }
}
```

**Variables** [`AddTodoVars`](types.md#typ_1bkwuejlfje)

```ts
{ input: { title: string; ownerId?: string } }
```

**Data** [`AddTodoData`](types.md#typ_0wlmt9r8y2s)

```ts
{ addTodo: TodoFields }
```

### <a id="operation-DeleteTodo"></a>`DeleteTodo`

|  |  |
| --- | --- |
| Type | mutation |
| Defined at | `src/graphql/todos.ts:43` |
| Types from | type arguments in the code |
| Sent by | [`POST /api/graphql`](components/TodoDetail.md#req_16r77ymnxz7) in [`TodoDetail`](components/TodoDetail.md) |

```graphql
mutation DeleteTodo($id: ID!) {
  deleteTodo(id: $id)
}
```

**Variables** [`TodoVars`](types.md#typ_1fpq9nx1vnr)

```ts
{ id: string }
```

**Data** [`DeleteTodoData`](types.md#typ_23z70ad4x4v)

```ts
{ deleteTodo: boolean }
```

### <a id="operation-Viewer"></a>`Viewer`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/graphql/todos.ts:49` |
| Types from | type arguments in the code |
| Sent by | [`POST /api/graphql`](components/ViewerBadge.md#req_0zshh8iwl6e) in [`ViewerBadge`](components/ViewerBadge.md) |

```graphql
query Viewer {
  viewer {
    id
    name
    email
  }
}
```

**Data** [`ViewerData`](types.md#typ_1y0i7pm0ntp)

```ts
{ viewer: User }
```

### <a id="operation-Search"></a>`Search`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/graphql/todos.ts:59` |
| Types from | type arguments in the code |
| Sent by | [`POST /api/graphql`](components/Search.md#req_0k4apzrnh4p) in [`Search`](components/Search.md) |

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

**Variables** [`SearchVars`](types.md#typ_1wwzgmtm01j)

```ts
{ text: string }
```

**Data** [`SearchData`](types.md#typ_23i4ebffrfm)

```ts
{ search: SearchResult[] }
```

## Fragments

| Fragment | On | Read by | Defined at |
| --- | --- | --- | --- |
| `TodoFields` | `Todo` |  | `src/graphql/todos.ts:3` |

## Operations no request sends (0)

The app sends every operation.
