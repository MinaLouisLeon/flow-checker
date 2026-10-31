# Component `ViewerBadge`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/ViewerBadge.tsx:7` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Types used

- [`ViewerData`](../types.md#typ_1y0i7pm0ntp)

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_0zshh8iwl6e) | page-load | [`ViewerBadge`]() | ✓ verified (3 captures) |

### <a id="req_0zshh8iwl6e"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (3 captures) |
| From | [`ViewerBadge`]() · `src/components/ViewerBadge.tsx:8` |
| Trigger | page-load |
| Transport | graphql · `useQuery` |
| URL | `/api/graphql` |
| GraphQL | [`Viewer`](../graphql.md#operation-Viewer) (query) |
| Handled by | [`/api/graphql`](../pages/api.graphql.md) |

**Response** [`ViewerData`](../types.md#typ_1y0i7pm0ntp)

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
