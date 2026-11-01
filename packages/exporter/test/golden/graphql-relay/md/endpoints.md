# Endpoints

[← Overview](README.md)

5 endpoints on 1 host, 5 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-app"></a>This app's API

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`mutation AddTodoFormMutation`](#ep_0gd97outiw1) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query TodoDetailQuery`](#ep_17dce0wnicy) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`mutation TodoDetailToggleMutation`](#ep_1oor2z6bzmo) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query TodoListQuery`](#ep_1s6k2d8ttwx) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query UserListQuery`](#ep_15w54871k03) | GraphQL | browser | 1 | 1 | ✓ verified |

### <a id="ep_0gd97outiw1"></a>`mutation AddTodoFormMutation`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`AddTodoFormMutation`](graphql.md#operation-AddTodoFormMutation) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST /api/graphql`](components/AddTodoForm.md#req_25b0dzm9av8) in [`AddTodoForm`](components/AddTodoForm.md) |

**Request body** [`AddTodoFormMutation$variables`](types.md#typ_1jk7p5vwxhg)

```ts
{ input: AddTodoInput }
```

**Response** [`AddTodoFormMutation$data`](types.md#typ_07be3pbscua)

```ts
{ readonly addTodo: { readonly id: string; readonly title: string } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 33 ms · 2026-10-30 10:34 UTC · page `/`

Request body:

```json
{
  "doc_id": "7b287a25c92827de62ee76b0bdbdc3a1f06652f85ea710168f89cd568052bf8d",
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
      "title": "Record captures"
    }
  }
}
```

### <a id="ep_17dce0wnicy"></a>`query TodoDetailQuery`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`TodoDetailQuery`](graphql.md#operation-TodoDetailQuery) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`POST /api/graphql`](components/TodoPage.md#req_0b9cucu4bbq) in [`TodoPage`](components/TodoPage.md) |

**Request body** [`TodoDetailQuery$variables`](types.md#typ_1ji4t5gnvh0)

```ts
{ id: string }
```

**Response** [`TodoDetailQuery$data`](types.md#typ_1m5qqany6tv)

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

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 58 ms · 2026-10-30 10:34 UTC · page `/todos/4`

Request body:

```json
{
  "doc_id": "feffca234775cf9b6036b7f757110fbf6f4094f87f75b06bfefb31e31110034d",
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
      "done": false,
      "status": "OPEN",
      "owner": {
        "name": "Ada Lovelace",
        "id": "u1"
      }
    }
  }
}
```

### <a id="ep_1oor2z6bzmo"></a>`mutation TodoDetailToggleMutation`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`TodoDetailToggleMutation`](graphql.md#operation-TodoDetailToggleMutation) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`POST /api/graphql`](components/TodoDetail.md#req_0manrbz632m) in [`TodoDetail`](components/TodoDetail.md) |

**Request body** [`TodoDetailToggleMutation$variables`](types.md#typ_0rtunk5nqpl)

```ts
{ id: string }
```

**Response** [`TodoDetailToggleMutation$data`](types.md#typ_269jvnd7qf5)

```ts
{ readonly toggleTodo: { readonly done: boolean; readonly id: string } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 24 ms · 2026-10-30 10:35 UTC · page `/todos/4`

Request body:

```json
{
  "doc_id": "ca3885e07dab7aa341848f8d0138896377bf5af08ce9e5106c59714b07e26adf",
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
      "done": true
    }
  }
}
```

### <a id="ep_1s6k2d8ttwx"></a>`query TodoListQuery`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`TodoListQuery`](graphql.md#operation-TodoListQuery) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST /api/graphql`](components/TodoList.md#req_0ixcyoz99u0) in [`TodoList`](components/TodoList.md) |

**Request body** [`TodoListQuery$variables`](types.md#typ_0sd209oo5ki)

```ts
{ [key: string]: never }
```

**Response** `TodoListQuery$data`

```ts
{
  readonly todos: readonly { readonly id: string; readonly done: boolean; readonly title: string }[]
}
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 370 ms · 2026-10-30 10:34 UTC · page `/`

Request body:

```json
{
  "doc_id": "3f68cfe7f95fdfd770274ece724d3623c361f4a0c3a21e96fdfbf28d3d75153d",
  "variables": {}
}
```

Response body:

```json
{
  "data": {
    "todos": [
      {
        "id": "1",
        "title": "Write the schema",
        "done": true
      },
      {
        "id": "2",
        "title": "Add a route handler",
        "done": false
      },
      {
        "id": "3",
        "title": "Try a persisted query",
        "done": false
      }
    ]
  }
}
```

### <a id="ep_15w54871k03"></a>`query UserListQuery`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`UserListQuery`](graphql.md#operation-UserListQuery) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/users`](pages/users.md) |
| Call sites | [`POST /api/graphql`](components/UserList.md#req_2dy1uuhut7o) in [`UserList`](components/UserList.md) |

**Request body** [`UserListQuery$variables`](types.md#typ_1yt21z5dhfc)

```ts
{ [key: string]: never }
```

**Response** [`UserListQuery$data`](types.md#typ_1fqrz3yzgfq)

```ts
{
  readonly users: readonly { readonly email: string; readonly id: string; readonly name: string }[]
}
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 72 ms · 2026-10-30 10:35 UTC · page `/users`

Request body:

```json
{
  "doc_id": "fdcca2996f159e3306fc76535a22a6d4afcfa77d41c15bd60b6bd119a64dbe88",
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
        "email": "ada@example.com"
      },
      {
        "id": "u2",
        "name": "Grace Hopper",
        "email": "grace@example.com"
      },
      {
        "id": "u3",
        "name": "Alan Turing",
        "email": "alan@example.com"
      }
    ]
  }
}
```
