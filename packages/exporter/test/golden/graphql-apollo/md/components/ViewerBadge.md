# Component `ViewerBadge`

[← Overview](../README.md)

|  |  |
| --- | --- |
| File | `src/components/ViewerBadge.tsx:15` |
| Kind | client (`'use client'`) |
| Used on | [`/`](../pages/index.md) |
| Rendered by | [`HomePage`](HomePage.md) |

## Props

Takes no props.

## Requests

| Request | Trigger | From | Status |
| --- | --- | --- | --- |
| [`POST /api/graphql`](#req_235i024m0l6) | page-load | [`ViewerBadge`]() | ✓ verified (1 capture) |

### <a id="req_235i024m0l6"></a>`POST /api/graphql`

|  |  |
| --- | --- |
| Status | ✓ verified (1 capture) |
| From | [`ViewerBadge`]() · `src/components/ViewerBadge.tsx:16` |
| Trigger | page-load |
| Transport | graphql · `useQuery` |
| URL | `/api/graphql` |
| GraphQL | [`Viewer`](../graphql.md#operation-Viewer) (query) |
| Handled by | [`/api/graphql`](../pages/api.graphql.md) |

**Response** [`ViewerQuery`](../types.md#typ_201lug1iryj)

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
