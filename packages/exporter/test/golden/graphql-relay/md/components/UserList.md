# Component `UserList`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/UserList.tsx:7` |
| Kind | client (`'use client'`) |
| Used on | [`/users`](../pages/users.md) |
| Rendered by | [`UsersPage`](UsersPage.md) |

## Props

Takes no props.

## Types used

- [`UserListQuery$data`](../types.md#typ_1fqrz3yzgfq)
- [`UserListQuery`](../types.md#typ_28cihfc6gsp)

## Flows

- [UserList click](../flows/userlist-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_2dy1uuhut7o) | event onClick | [`UserList`]() | ✓ verified (1 capture) |

### <a id="req_2dy1uuhut7o"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserList`]() · `src/components/UserList.tsx:12` |
| Trigger | event onClick |
| Transport | graphql · `fetchQuery` |
| URL | `/api/graphql` |
| GraphQL | [`UserListQuery`](../graphql.md#operation-UserListQuery) (query) |
| Handled by | [`/api/graphql`](../pages/api.graphql.md) |

**Request body** [`UserListQuery$variables`](../types.md#typ_1yt21z5dhfc)

```ts
{ [key: string]: never }
```

**Response** [`UserListQuery$data`](../types.md#typ_1fqrz3yzgfq)

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
