# Endpoints

[← Overview](README.md)

6 endpoints on 1 host, 6 called from the browser. One endpoint is a method and URL pattern; tRPC procedures, GraphQL operations and server actions count one each. Requests to this app's own route handlers are listed under "This app's API", and what those handlers send on under the host it goes to.

## <a id="host-app"></a>This app's API

| Endpoint | Transport | Called from | Call sites | Pages | Status |
| --- | --- | --- | ---: | ---: | --- |
| [`mutation AddTodo`](#ep_1jutox0n6zl) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`mutation DeleteTodo`](#ep_1wr6ue0mqkn) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query Search`](#ep_2cve50sbne6) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query Todo`](#ep_2dska22im0v) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query Todos`](#ep_2c5ny8u59q2) | GraphQL | browser | 1 | 1 | ✓ verified |
| [`query Viewer`](#ep_1mvljeijms0) | GraphQL | browser | 1 | 1 | ✓ verified |

### <a id="ep_1jutox0n6zl"></a>`mutation AddTodo`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`AddTodo`](graphql.md#operation-AddTodo) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST /api/graphql`](components/AddTodoForm.md#req_1vvhclt0a1p) in [`AddTodoForm`](components/AddTodoForm.md) |

**Request body** [`AddTodoVars`](types.md#typ_1bkwuejlfje)

```ts
{ input: { title: string; ownerId?: string } }
```

**Response** [`AddTodoData`](types.md#typ_0wlmt9r8y2s)

```ts
{ addTodo: TodoFields }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 23 ms · 2026-10-30 10:33 UTC · page `/` (newest of 2)

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
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "3f1819d16ee54d56e45ae7998635162e64d71eb45a18c10421f47aed72e9e02e"
    }
  },
  "query": "mutation AddTodo($input: AddTodoInput!) {\n  addTodo(input: $input) {\n    ...TodoFields\n    __typename\n  }\n}\n\nfragment TodoFields on Todo {\n  id\n  title\n  done\n  __typename\n}"
}
```

Response body:

```json
{
  "data": {
    "addTodo": {
      "id": "4",
      "title": "Record captures",
      "done": false,
      "__typename": "Todo"
    }
  }
}
```

### <a id="ep_1wr6ue0mqkn"></a>`mutation DeleteTodo`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`DeleteTodo`](graphql.md#operation-DeleteTodo) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/todos/[id]`](pages/todos.%5Bid%5D.md) |
| Call sites | [`POST /api/graphql`](components/TodoDetail.md#req_16r77ymnxz7) in [`TodoDetail`](components/TodoDetail.md) |

**Request body** [`TodoVars`](types.md#typ_1fpq9nx1vnr)

```ts
{ id: string }
```

**Response** [`DeleteTodoData`](types.md#typ_23z70ad4x4v)

```ts
{ deleteTodo: boolean }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 19 ms · 2026-10-30 10:33 UTC · page `/todos/4` (newest of 2)

Request body:

```json
{
  "operationName": "DeleteTodo",
  "variables": {
    "id": "4"
  },
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "df3507b3704816b720732c21aad5660fc53324e32318046d72fc0096ec7bc27f"
    }
  },
  "query": "mutation DeleteTodo($id: ID!) {\n  deleteTodo(id: $id)\n}"
}
```

Response body:

```json
{
  "data": {
    "deleteTodo": true
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
| Pages | [`/search`](pages/search.md) |
| Call sites | [`POST /api/graphql`](components/Search.md#req_0k4apzrnh4p) in [`Search`](components/Search.md) |

**Request body** [`SearchVars`](types.md#typ_1wwzgmtm01j)

```ts
{ text: string }
```

**Response** [`SearchData`](types.md#typ_23i4ebffrfm)

```ts
{ search: SearchResult[] }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 19 ms · 2026-10-30 10:33 UTC · page `/search` (newest of 2)

Request body:

```json
{
  "operationName": "Search",
  "variables": {
    "text": "a"
  },
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "15029ee6b1a77fa90e113d273aec5c628882e954a85592be3fd3b065887fa4e7"
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
| Call sites | [`POST /api/graphql`](components/TodoDetail.md#req_1pbvj0u5igd) in [`TodoDetail`](components/TodoDetail.md) |

**Request body** [`TodoVars`](types.md#typ_1fpq9nx1vnr)

```ts
{ id: string }
```

**Response** [`TodoData`](types.md#typ_255hzpa6ygn)

```ts
{ todo: TodoDetailFields | null }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 48 ms · 2026-10-30 10:33 UTC · page `/todos/4` (newest of 2)

Request body:

```json
{
  "operationName": "Todo",
  "variables": {
    "id": "4"
  },
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "0e09449f79c9be377ed88e00b678e281364eebfbe732f99daa5b3f2b049f76bd"
    }
  },
  "query": "query Todo($id: ID!) {\n  todo(id: $id) {\n    ...TodoFields\n    status\n    owner {\n      id\n      name\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment TodoFields on Todo {\n  id\n  title\n  done\n  __typename\n}"
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
      "__typename": "Todo",
      "status": "OPEN",
      "owner": {
        "id": "u1",
        "name": "Ada Lovelace",
        "__typename": "User"
      }
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
| Call sites | [`POST /api/graphql`](components/TodoList.md#req_0tco1ayy7vx) in [`TodoList`](components/TodoList.md) |

**Response** [`TodosData`](types.md#typ_1qf74f1isvg)

```ts
{ todos: TodoFields[] }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 35 ms · 2026-10-30 10:33 UTC · page `/` (newest of 3)

Request body:

```json
{
  "operationName": "Todos",
  "variables": {},
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "01222f14ad0e3236e408a6372a7a1d8249955ac5cef1542d8f53b55ed9b94911"
    }
  }
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
        "done": true,
        "__typename": "Todo"
      },
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

### <a id="ep_1mvljeijms0"></a>`query Viewer`

|  |  |
| --- | --- |
| Status | ✓ verified |
| Transport | GraphQL · [`Viewer`](graphql.md#operation-Viewer) |
| Called from | browser |
| Served by | [`/api/graphql`](pages/api.graphql.md) |
| Pages | [`/`](pages/index.md) |
| Call sites | [`POST /api/graphql`](components/ViewerBadge.md#req_0zshh8iwl6e) in [`ViewerBadge`](components/ViewerBadge.md) |

**Response** [`ViewerData`](types.md#typ_1y0i7pm0ntp)

```ts
{ viewer: User }
```

**Captured** `POST http://localhost:3077/api/graphql` → 200 OK · 23 ms · 2026-10-30 10:33 UTC · page `/` (newest of 3)

Request body:

```json
{
  "operationName": "Viewer",
  "variables": {},
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "11989ecb8468c2f61be018171850054bc1968ecc87dd54708dc1b207f7b6cfaf"
    }
  }
}
```

Response body:

```json
{
  "data": {
    "viewer": {
      "id": "u1",
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "__typename": "User"
    }
  }
}
```
