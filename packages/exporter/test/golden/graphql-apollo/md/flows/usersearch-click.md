# Flow: UserSearch click

[← Overview](../README.md)

|  |  |
| --- | --- |
| Starts | [`UserSearch`](../components/UserSearch.md) on [`/users`](../pages/users.md) |
| Pages | [`/users`](../pages/users.md) |
| Status | not walked yet |

## Sequence

```mermaid
sequenceDiagram
  actor U as User
  participant P0 as /users
  participant P1 as /api/graphql (handler)
  U->>P0: onClick (UserSearch)
  P0->>P1: POST /api/graphql
  P1-->>P0: 200 UsersResult
```

## Steps

| # | Step | Detail |
| ---: | --- | --- |
| 1 | User `onClick` in [`UserSearch`](../components/UserSearch.md) on [`/users`](../pages/users.md) | `src/components/UserSearch.tsx:65` |
| 2 | [`POST /api/graphql`](#req_0qoh2ov7p3i) | response `UsersResult` · ✓ verified (1 capture) |

## Requests

### <a id="req_0qoh2ov7p3i"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserSearch`](../components/UserSearch.md) · `src/components/UserSearch.tsx:46` |
| Trigger | event onClick |
| Transport | graphql · `client.query` |
| URL | `/api/graphql` |
| GraphQL | [`Users`](../graphql.md#operation-Users) (query) |
| Handled by | [`/api/graphql`](../pages/api.graphql.md) |

**Response** [`UsersResult`](../types.md#typ_0y0dnmxm2ov)

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
