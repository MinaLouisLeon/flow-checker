# GraphQL

[← Overview](README.md)

|  |  |
| --- | --- |
| Endpoint | `/api/graphql` |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Clients | urql (GET queries) · `src/lib/urql.ts:5` |
| Schema | `schema.graphql` · 7 types |
| Summary | 5 of 5 operations sent by the app |

Every operation goes to the same endpoint, so requests are matched by operation name (or persisted query id). Batched requests are recorded as one capture per operation.

## Operations

### <a id="operation-AddTodo"></a>`AddTodo`

|  |  |
| --- | --- |
| Type | mutation |
| Defined at | `src/components/AddTodoForm.tsx:7` |
| Types from | the schema file |
| Sent by | [`POST /api/graphql`](components/AddTodoForm.md#req_1ncc9k5xsh8) in [`AddTodoForm`](components/AddTodoForm.md) |

```graphql
mutation AddTodo($input: AddTodoInput!) {
  addTodo(input: $input) {
    id
    title
  }
}
```

**Variables** `AddTodoMutationVariables`

```ts
{ input: { title: string; ownerId?: string | null } }
```

**Data** `AddTodoMutation`

```ts
{ addTodo: { id: string; title: string } }
```

### <a id="operation-Todo"></a>`Todo`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/components/TodoDetail.tsx:5` |
| Types from | the schema file |
| Sent by | [`GET /api/graphql`](components/TodoDetail.md#req_13zx8cl90id) in [`TodoDetail`](components/TodoDetail.md) |

```graphql
query Todo($id: ID!) {
  todo(id: $id) {
    id
    title
    done
    status
    owner {
      name
      email
    }
  }
}
```

**Variables** `TodoQueryVariables`

```ts
{ id: string }
```

**Data** `TodoQuery`

```ts
{
  todo: 
    | {
      id: string
      title: string
      done: boolean
      status: "OPEN" | "DONE"
      owner: { name: string; email: string }
    }
    | null
}
```

### <a id="operation-ToggleTodo"></a>`ToggleTodo`

|  |  |
| --- | --- |
| Type | mutation |
| Defined at | `src/components/TodoDetail.tsx:20` |
| Types from | the schema file |
| Sent by | [`POST /api/graphql`](components/TodoDetail.md#req_0pkoq320yzc) in [`TodoDetail`](components/TodoDetail.md) |

```graphql
mutation ToggleTodo($id: ID!) {
  toggleTodo(id: $id) {
    id
    done
    status
  }
}
```

**Variables** `ToggleTodoMutationVariables`

```ts
{ id: string }
```

**Data** `ToggleTodoMutation`

```ts
{ toggleTodo: { id: string; done: boolean; status: "OPEN" | "DONE" } }
```

### <a id="operation-Todos"></a>`Todos`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/components/TodoList.tsx:7` |
| Types from | the schema file |
| Sent by | [`GET /api/graphql`](components/TodoList.md#req_19g4fbnqrgn) in [`TodoList`](components/TodoList.md) |

```graphql
query Todos($status: TodoStatus) {
  todos(status: $status) {
    id
    title
    done
  }
}
```

**Variables** `TodosQueryVariables`

```ts
{ status?: "OPEN" | "DONE" | null }
```

**Data** `TodosQuery`

```ts
{ todos: { id: string; title: string; done: boolean }[] }
```

### <a id="operation-Users"></a>`Users`

|  |  |
| --- | --- |
| Type | query |
| Defined at | `src/components/UserList.tsx:6` |
| Types from | the schema file |
| Sent by | [`GET /api/graphql`](components/UserList.md#req_0m0edcldv9l) in [`UserList`](components/UserList.md) |

```graphql
query Users {
  users {
    id
    name
    email
  }
}
```

**Data** `UsersQuery`

```ts
{ users: { id: string; name: string; email: string }[] }
```

## Operations no request sends (0)

The app sends every operation.
