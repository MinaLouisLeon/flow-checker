# Endpoints

[← Overview](README.md)

5 endpoints on 1 host, 5 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-app"></a>This app's API

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`mutation AddTodo`](#ep_1jutox0n6zl) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query Todo`](#ep_2dska22im0v) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query Todos`](#ep_2c5ny8u59q2) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`mutation ToggleTodo`](#ep_0dra48drhl8) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query Users`](#ep_2fwm7w18i75) | GraphQL | browser | 1 | 1 | ✓ verified |

### <a id="ep_1jutox0n6zl"></a>`mutation AddTodo`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`AddTodo`](graphql.md#operation-AddTodo) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST /api/graphql`](components/AddTodoForm.md#req_1ncc9k5xsh8) in [`AddTodoForm`](components/AddTodoForm.md) |

**Request body** `AddTodoMutationVariables`

```ts
{ input: { title: string; ownerId?: string | null } }
```

**Response** `AddTodoMutation`

```ts
{ addTodo: { id: string; title: string } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 36 ms · 2026-10-30 10:34 UTC · page `/`

Request body:

```json
{
  "operationName": "AddTodo",
  "query": "mutation AddTodo($input: AddTodoInput!) {\n  addTodo(input: $input) {\n    id\n    title\n    __typename\n  }\n}",
  "variables": {
    "input": {
      "title": "Record captures"
    }
  }
}
```

Response body:

```json
{
  "data": {
    "addTodo": {
      "id": "4",
      "title": "Record captures",
      "__typename": "Todo"
    }
  }
}
```

### <a id="ep_2dska22im0v"></a>`query Todo`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`Todo`](graphql.md#operation-Todo) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`GET /api/graphql`](components/TodoDetail.md#req_13zx8cl90id) in [`TodoDetail`](components/TodoDetail.md) |

**Request body** `TodoQueryVariables`

```ts
{ id: string }
```

**Response** `TodoQuery`

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

**Captured** `GET http://localhost:3077/api/graphql` → 200 OK · 43 ms · 2026-10-30 10:34 UTC · page `/todos/4` (newest of 2)

Request body:

```json
{
  "query": "query Todo($id: ID!) {\n  todo(id: $id) {\n    id\n    title\n    done\n    status\n    owner {\n      name\n      email\n      __typename\n    }\n    __typename\n  }\n}",
  "operationName": "Todo",
  "variables": {
    "id": "4"
  }
}
```

Response body:

```json
{
  "data": {
    "todo": {
      "id": "4",
      "title": "Record captures",
      "done": true,
      "status": "DONE",
      "owner": {
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "__typename": "User"
      },
      "__typename": "Todo"
    }
  }
}
```

### <a id="ep_2c5ny8u59q2"></a>`query Todos`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`Todos`](graphql.md#operation-Todos) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`GET /api/graphql`](components/TodoList.md#req_19g4fbnqrgn) in [`TodoList`](components/TodoList.md) |

**Request body** `TodosQueryVariables`

```ts
{ status?: "OPEN" | "DONE" | null }
```

**Response** `TodosQuery`

```ts
{ todos: { id: string; title: string; done: boolean }[] }
```

**Captured** `GET http://localhost:3077/api/graphql` → 200 OK · 30 ms · 2026-10-30 10:34 UTC · page `/` (newest of 2)

Request body:

```json
{
  "query": "query Todos($status: TodoStatus) {\n  todos(status: $status) {\n    id\n    title\n    done\n    __typename\n  }\n}",
  "operationName": "Todos",
  "variables": {
    "status": "OPEN"
  }
}
```

Response body:

```json
{
  "data": {
    "todos": [
      {
        "id": "2",
        "title": "Add a route handler",
        "done": false,
        "__typename": "Todo"
      },
      {
        "id": "3",
        "title": "Try a persisted query",
        "done": false,
        "__typename": "Todo"
      },
      {
        "id": "4",
        "title": "Record captures",
        "done": false,
        "__typename": "Todo"
      }
    ]
  }
}
```

### <a id="ep_0dra48drhl8"></a>`mutation ToggleTodo`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`ToggleTodo`](graphql.md#operation-ToggleTodo) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`POST /api/graphql`](components/TodoDetail.md#req_0pkoq320yzc) in [`TodoDetail`](components/TodoDetail.md) |

**Request body** `ToggleTodoMutationVariables`

```ts
{ id: string }
```

**Response** `ToggleTodoMutation`

```ts
{ toggleTodo: { id: string; done: boolean; status: "OPEN" | "DONE" } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 27 ms · 2026-10-30 10:34 UTC · page `/todos/4`

Request body:

```json
{
  "operationName": "ToggleTodo",
  "query": "mutation ToggleTodo($id: ID!) {\n  toggleTodo(id: $id) {\n    id\n    done\n    status\n    __typename\n  }\n}",
  "variables": {
    "id": "4"
  }
}
```

Response body:

```json
{
  "data": {
    "toggleTodo": {
      "id": "4",
      "done": true,
      "status": "DONE",
      "__typename": "Todo"
    }
  }
}
```

### <a id="ep_2fwm7w18i75"></a>`query Users`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`Users`](graphql.md#operation-Users) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/users`](pages/users.md) |
| Call sites | [`GET /api/graphql`](components/UserList.md#req_0m0edcldv9l) in [`UserList`](components/UserList.md) |

**Response** `UsersQuery`

```ts
{ users: { id: string; name: string; email: string }[] }
```

**Captured** `GET http://localhost:3077/api/graphql` → 200 OK · 25 ms · 2026-10-30 10:34 UTC · page `/users`

Request body:

```json
{
  "query": "query Users {\n  users {\n    id\n    name\n    email\n    __typename\n  }\n}",
  "operationName": "Users",
  "variables": {}
}
```

Response body:

```json
{
  "data": {
    "users": [
      {
        "id": "u1",
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "__typename": "User"
      },
      {
        "id": "u2",
        "name": "Grace Hopper",
        "email": "grace@example.com",
        "__typename": "User"
      },
      {
        "id": "u3",
        "name": "Alan Turing",
        "email": "alan@example.com",
        "__typename": "User"
      }
    ]
  }
}
```
