# Page `/users`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/app/users/page.tsx` |
| Layouts | [`RootLayout`](../components/RootLayout.md) (`src/app/layout.tsx`) |
| Access | open |
| Status | ✓ 2 verified |

## Component tree

- [`UsersPage`](../components/UsersPage.md) · server
  - [`UserSearch`](../components/UserSearch.md) · client · ⇄ 2 requests

## Flows

- [UserSearch submit](../flows/usersearch-submit.md)
- [UserSearch click](../flows/usersearch-click.md)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_27iyr9uuhkz) | event onSubmit | [`UserSearch`](../components/UserSearch.md) | ✓ verified (1 capture) |
| [`POST /api/graphql`](#req_0qoh2ov7p3i) | event onClick | [`UserSearch`](../components/UserSearch.md) | ✓ verified (1 capture) |

### <a id="req_27iyr9uuhkz"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserSearch`](../components/UserSearch.md) · `src/components/UserSearch.tsx:38` |
| Trigger | event onSubmit |
| Transport | graphql · `useLazyQuery` |
| URL | `/api/graphql` |
| GraphQL | [`Search`](../graphql.md#operation-Search) (query) |
| Handled by | [`/api/graphql`](api.graphql.md) |

**Request body** [`Exact<{ text: string; }>`](../types.md#typ_0rr10bb7h1t)

```ts
{ text: string }
```

**Response** [`SearchQuery`](../types.md#typ_1g0hej3ogvt)

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

### <a id="req_0qoh2ov7p3i"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`UserSearch`](../components/UserSearch.md) · `src/components/UserSearch.tsx:46` |
| Trigger | event onClick |
| Transport | graphql · `client.query` |
| URL | `/api/graphql` |
| GraphQL | [`Users`](../graphql.md#operation-Users) (query) |
| Handled by | [`/api/graphql`](api.graphql.md) |

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
