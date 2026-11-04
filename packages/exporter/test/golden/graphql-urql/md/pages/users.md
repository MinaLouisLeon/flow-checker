# Page `/users`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/users/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Rendering | static |
| Title | `urql fixture` |
| Status | ✓ 1 verified |

## Boundaries

- While it loads: nothing, navigation waits for the page
- On an error: Next's default error page
- On `notFound()`: Next's default 404 page

## Client boundaries

2 `'use client'` boundaries bring 2 components and 3 project modules (about 1.3 KB of source) to the browser, plus 1 package (`urql`).

- [`Providers`](../components/Providers.md), rendered by `RootLayout` (layout): 1 component · 2 modules · 0.6 KB, `src/app/layout.tsx:10`
  - packages: `urql`
- [`UserList`](../components/UserList.md), rendered by `UsersPage` (page): 1 component · 1 module · 0.7 KB, `src/app/users/page.tsx:7`
  - packages: `urql`

## Metadata

- layout `metadata`: title, `src/app/layout.tsx:4`

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
