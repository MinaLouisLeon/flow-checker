# Page `/users`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/users/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Status | ✓ 1 verified |

## Component tree

- [`UsersPage`](../components/UsersPage.md) · server
  - [`UserList`](../components/UserList.md) · client · ⇄ 1 request

## Flows

- [UserList click](../flows/userlist-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`GET /api/graphql`](#req_0m0edcldv9l) | event onClick | [`UserList`](../components/UserList.md) | ✓ verified (1 capture) |

### <a id="req_0m0edcldv9l"></a>`GET /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserList`](../components/UserList.md) · `src/components/UserList.tsx:21` |
| Trigger | event onClick |
| Transport | graphql · `client.query` |
| URL | `/api/graphql` |
| GraphQL | [`Users`](../graphql.md#operation-Users) (query) |
| Handled by | [`/api/graphql`](api.graphql.md) |

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
