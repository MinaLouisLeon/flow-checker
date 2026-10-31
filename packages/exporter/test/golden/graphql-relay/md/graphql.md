# GraphQL

[← Overview](README.md)

|  |  |
| --- | --- |
| Endpoint | `/api/graphql` |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Clients | relay (persisted queries) · `src/relay/environment.ts:14` |
| Schema | `schema.graphql` · 7 types |
| Persisted queries | `persisted_queries.json` · 5 entries |
| Summary | 5 of 5 operations sent by the app |

Every operation goes to the same endpoint, so requests are matched by operation name (or persisted query id). Batched requests are recorded as one capture per operation.

## Operations

### <a id="operation-AddTodoFormMutation"></a>`AddTodoFormMutation`

|  |  |
| --- | --- |
| Type | mutation |
| Defined at | `src/components/AddTodoForm.tsx:11` |
| Types from | the Relay compiler |
| Sent by | [`POST /api/graphql`](components/AddTodoForm.md#req_25b0dzm9av8) in [`AddTodoForm`](components/AddTodoForm.md) |

```graphql
mutation AddTodoFormMutation($input: AddTodoInput!) {
  addTodo(input: $input) {
    id
    title
  }
}
```

**Variables** [`AddTodoFormMutation$variables`](types.md#typ_1jk7p5vwxhg)

```ts
{ input: AddTodoInput }
```

**Data** [`AddTodoFormMutation$data`](types.md#typ_07be3pbscua)

```ts
{ readonly addTodo: { readonly id: string; readonly title: string } }
```

### <a id="operation-TodoDetailQuery"></a>`TodoDetailQuery`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/components/TodoDetail.tsx:13` |
| Types from | the Relay compiler |
| Sent by | [`POST /api/graphql`](components/TodoPage.md#req_0b9cucu4bbq) in [`TodoPage`](components/TodoPage.md) |

```graphql
query TodoDetailQuery($id: ID!) {
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

**Variables** [`TodoDetailQuery$variables`](types.md#typ_1ji4t5gnvh0)

```ts
{ id: string }
```

**Data** [`TodoDetailQuery$data`](types.md#typ_1m5qqany6tv)

```ts
{
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

### <a id="operation-TodoDetailToggleMutation"></a>`TodoDetailToggleMutation`

|  |  |
| --- | --- |
| Type | mutation |
| Defined at | `src/components/TodoDetail.tsx:33` |
| Types from | the Relay compiler |
| Sent by | [`POST /api/graphql`](components/TodoDetail.md#req_0manrbz632m) in [`TodoDetail`](components/TodoDetail.md) |

```graphql
mutation TodoDetailToggleMutation($id: ID!) {
  toggleTodo(id: $id) {
    id
    done
  }
}
```

**Variables** [`TodoDetailToggleMutation$variables`](types.md#typ_0rtunk5nqpl)

```ts
{ id: string }
```

**Data** [`TodoDetailToggleMutation$data`](types.md#typ_269jvnd7qf5)

```ts
{ readonly toggleTodo: { readonly done: boolean; readonly id: string } }
```

### <a id="operation-TodoListQuery"></a>`TodoListQuery`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/components/TodoList.tsx:9` |
| Fragments | `TodoItem_todo` |
| Types from | the Relay compiler |
| Sent by | [`POST /api/graphql`](components/TodoList.md#req_0ixcyoz99u0) in [`TodoList`](components/TodoList.md) |

```graphql
query TodoListQuery {
  todos {
    id
    ...TodoItem_todo
  }
}
```

**Data** `TodoListQuery$data`

```ts
{
  readonly todos: readonly { readonly id: string; readonly done: boolean; readonly title: string }[]
}
```

### <a id="operation-UserListQuery"></a>`UserListQuery`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/components/UserList.tsx:14` |
| Types from | the Relay compiler |
| Sent by | [`POST /api/graphql`](components/UserList.md#req_2dy1uuhut7o) in [`UserList`](components/UserList.md) |

```graphql
query UserListQuery {
  users {
    id
    name
    email
  }
}
```

**Data** [`UserListQuery$data`](types.md#typ_1fqrz3yzgfq)

```ts
{
  readonly users: readonly { readonly email: string; readonly id: string; readonly name: string }[]
}
```

## Fragments

| Fragment | On | Read by | Defined at |
| --- | --- | --- | --- |
| `TodoItem_todo` | `Todo` | `TodoItem` | `src/components/TodoItem.tsx:9` |

## Operations no request sends (0)

The app sends every operation.
