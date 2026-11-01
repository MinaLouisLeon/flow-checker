# Endpoints

[← Overview](README.md)

7 endpoints on 1 host, 7 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-app"></a>This app's API

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`mutation AddTodo`](#ep_1jutox0n6zl) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query Search`](#ep_2cve50sbne6) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query Todo`](#ep_2dska22im0v) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query Todos`](#ep_2c5ny8u59q2) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`mutation ToggleTodo`](#ep_0dra48drhl8) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query Users`](#ep_2fwm7w18i75) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query Viewer`](#ep_1mvljeijms0) | GraphQL | browser | 1 | 1 | ✓ verified |

### <a id="ep_1jutox0n6zl"></a>`mutation AddTodo`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`AddTodo`](graphql.md#operation-AddTodo) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST /api/graphql`](components/AddTodoForm.md#req_1se0zfbjglz) in [`AddTodoForm`](components/AddTodoForm.md) |

**Request body** [`Exact<{ input: AddTodoInput; }>`](types.md#typ_164dkm81jm4)

```ts
{ input: AddTodoInput }
```

**Response** [`AddTodoMutation`](types.md#typ_16ca9i9k1a7)

```ts
{ addTodo: { id: string; title: string } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 · 20 ms · 2026-10-30 10:33 UTC · page `/`

Request body:

```json
{
  "operationName": "AddTodo",
  "variables": {
    "input": {
      "title": "Record captures"
    }
  },
  "extensions": {
    "clientLibrary": {
      "name": "@apollo/client",
      "version": "4.3.5"
    }
  },
  "query": "mutation AddTodo($input: AddTodoInput!) {\n  addTodo(input: $input) {\n    id\n    title\n    __typename\n  }\n}"
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

### <a id="ep_2cve50sbne6"></a>`query Search`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`Search`](graphql.md#operation-Search) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/users`](pages/users.md) |
| Call sites | [`POST /api/graphql`](components/UserSearch.md#req_27iyr9uuhkz) in [`UserSearch`](components/UserSearch.md) |

**Request body** [`Exact<{ text: string; }>`](types.md#typ_0rr10bb7h1t)

```ts
{ text: string }
```

**Response** [`SearchQuery`](types.md#typ_1g0hej3ogvt)

```ts
{
  search: (
    | { __typename: "Todo"; id: string; title: string }
    | { __typename: "User"; id: string; name: string })[]
}
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 · 47 ms · 2026-10-30 10:33 UTC · page `/users`

Request body:

```json
{
  "operationName": "Search",
  "variables": {
    "text": "a"
  },
  "extensions": {
    "clientLibrary": {
      "name": "@apollo/client",
      "version": "4.3.5"
    }
  },
  "query": "query Search($text: String!) {\n  search(text: $text) {\n    __typename\n    ... on Todo {\n      id\n      title\n      __typename\n    }\n    ... on User {\n      id\n      name\n      __typename\n    }\n  }\n}"
}
```

Response body:

```json
{
  "data": {
    "search": [
      {
        "__typename": "Todo",
        "id": "1",
        "title": "Write the schema"
      },
      {
        "__typename": "Todo",
        "id": "2",
        "title": "Add a route handler"
      },
      {
        "__typename": "Todo",
        "id": "3",
        "title": "Try a persisted query"
      },
      {
        "__typename": "Todo",
        "id": "4",
        "title": "Record captures"
      },
      {
        "__typename": "User",
        "id": "u1",
        "name": "Ada Lovelace"
      },
      {
        "__typename": "User",
        "id": "u2",
        "name": "Grace Hopper"
      },
      {
        "__typename": "User",
        "id": "u3",
        "name": "Alan Turing"
      }
    ]
  }
… (1 more line)
```

### <a id="ep_2dska22im0v"></a>`query Todo`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`Todo`](graphql.md#operation-Todo) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`POST /api/graphql`](components/TodoView.md#req_0y9v4qo3n8x) in [`TodoView`](components/TodoView.md) |

**Request body** [`Exact<{ id: string | number; }>`](types.md#typ_0kk3su9xks9)

```ts
{ id: string | number }
```

**Response** [`TodoQuery`](types.md#typ_18j2vjt684p)

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

**Captured** `POST http://localhost:3077/api/graphql` → 200 · 21 ms · 2026-10-30 10:33 UTC · page `/todos/4`

Request body:

```json
{
  "operationName": "Todo",
  "variables": {
    "id": "4"
  },
  "extensions": {
    "clientLibrary": {
      "name": "@apollo/client",
      "version": "4.3.5"
    }
  },
  "query": "query Todo($id: ID!) {\n  todo(id: $id) {\n    id\n    title\n    done\n    status\n    owner {\n      name\n      __typename\n    }\n    __typename\n  }\n}"
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
| Call sites | [`POST /api/graphql`](components/TodoList.md#req_1cmdvpo38br) in [`TodoList`](components/TodoList.md) |

**Request body** [`Exact<{ status?: TodoStatus | null | undefined; }>`](types.md#typ_0oaau18ifc2)

```ts
{ status?: "DONE" | "OPEN" | null }
```

**Response** `TodosQuery`

```ts
{ todos: { id: string; title: string; done: boolean }[] }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 · 22 ms · 2026-10-30 10:33 UTC · page `/` (newest of 3)

Request body:

```json
{
  "operationName": "Todos",
  "variables": {
    "status": "OPEN"
  },
  "extensions": {
    "clientLibrary": {
      "name": "@apollo/client",
      "version": "4.3.5"
    }
  },
  "query": "query Todos($status: TodoStatus) {\n  todos(status: $status) {\n    id\n    ...TodoItem\n    __typename\n  }\n}\n\nfragment TodoItem on Todo {\n  id\n  title\n  done\n  __typename\n}"
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
| Call sites | [`POST /api/graphql`](components/TodoView.md#req_08vp0aultnf) in [`TodoView`](components/TodoView.md) |

**Request body** [`Exact<{ id: string | number; }>`](types.md#typ_0kk3su9xks9)

```ts
{ id: string | number }
```

**Response** [`ToggleTodoMutation`](types.md#typ_0r3wizusxxi)

```ts
{ toggleTodo: { id: string; done: boolean; status: TodoStatus } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 · 20 ms · 2026-10-30 10:33 UTC · page `/todos/4`

Request body:

```json
{
  "operationName": "ToggleTodo",
  "variables": {
    "id": "4"
  },
  "extensions": {
    "clientLibrary": {
      "name": "@apollo/client",
      "version": "4.3.5"
    }
  },
  "query": "mutation ToggleTodo($id: ID!) {\n  toggleTodo(id: $id) {\n    id\n    done\n    status\n    __typename\n  }\n}"
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
| Call sites | [`POST /api/graphql`](components/UserSearch.md#req_0qoh2ov7p3i) in [`UserSearch`](components/UserSearch.md) |

**Response** [`UsersResult`](types.md#typ_0y0dnmxm2ov)

```ts
{ users: { id: string; name: string; email: string }[] }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 · 20 ms · 2026-10-30 10:33 UTC · page `/users`

Request body:

```json
{
  "operationName": "Users",
  "variables": {},
  "extensions": {
    "clientLibrary": {
      "name": "@apollo/client",
      "version": "4.3.5"
    }
  },
  "query": "query Users {\n  users {\n    id\n    name\n    email\n    __typename\n  }\n}"
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

### <a id="ep_1mvljeijms0"></a>`query Viewer`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`Viewer`](graphql.md#operation-Viewer) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST /api/graphql`](components/ViewerBadge.md#req_235i024m0l6) in [`ViewerBadge`](components/ViewerBadge.md) |

**Response** [`ViewerQuery`](types.md#typ_201lug1iryj)

```ts
{ viewer: { id: string; name: string } }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 · 315 ms · 2026-10-30 10:33 UTC · page `/`

Request body:

```json
{
  "operationName": "Viewer",
  "variables": {},
  "extensions": {
    "clientLibrary": {
      "name": "@apollo/client",
      "version": "4.3.5"
    }
  },
  "query": "query Viewer {\n  viewer {\n    id\n    name\n    __typename\n  }\n}"
}
```

Response body:

```json
{
  "data": {
    "viewer": {
      "id": "u1",
      "name": "Ada Lovelace",
      "__typename": "User"
    }
  }
}
```
